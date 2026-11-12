import { formAPI, API_URL, clientId, authHeaders } from './api'
import { useFormStore, docOf, onLocalChange } from '../store/formStore'
import { applyOps, diffDocs, invertSet, applySet, stableStringify, sameValue } from '../utils/ops'
import { destructiveChanges } from '../utils/formStructure'

const MAX_RETRY_MS = 60000
const KEEPALIVE_LIMIT = 60000
// Props whose change can break collected answers; everything else in the same update is saved right away.
const RISKY_PROP = /^(type|options|rows|columns|settings|validation_rules)(\.|$)/
const FORM_TARGET = '@form'
const NON_TEXT_INPUTS = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'hidden']

const sig = (op) => stableStringify(op)
const propsOverlap = (a, b) => a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`)
const target = (op) => (op.type === 'form.update' ? FORM_TARGET : op.key)

/** Value of `prop` ("label", "settings.other_option") of a field (`key`) or of the form (`@form`). */
function valueAt(doc, key, prop) {
  const obj = key === FORM_TARGET ? doc.form : doc.fields.find((f) => f.key === key)
  if (!obj) return undefined
  const [head, item] = prop.split('.', 2)
  return item === undefined ? obj[head] : obj[head]?.[item]
}

const containsText = (value, text, depth = 0) => {
  if (value == null || depth > 2) return false
  if (typeof value !== 'object') return String(value) === text
  return Object.values(value).some((v) => containsText(v, text, depth + 1))
}

/**
 * The text input the user is in: `{key, prop, text, scope}`. `key` from the closest `[data-field-key]`
 * (none = form), `prop` from the closest `[data-prop]`; without `data-prop` the edited prop is guessed
 * by matching the input's text against the prop values.
 */
function focusedInput() {
  const el = typeof document !== 'undefined' ? document.activeElement : null
  if (!el || !(el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !NON_TEXT_INPUTS.includes(el.type)))) return null
  const propEl = el.closest('[data-prop]')
  return {
    key: el.closest('[data-field-key]')?.getAttribute('data-field-key') || FORM_TARGET,
    prop: propEl?.getAttribute('data-prop') || null,
    text: el.isContentEditable ? el.innerHTML : el.value,
    scope: propEl || el,
  }
}

/**
 * Autosave (plan §4.4, §4.6). Keeps a snapshot of the document as the server has it; the queue is
 * `diff(snapshot, local)`, so consecutive edits merge, and ops that are paused (destructive) or were
 * rejected stay in the queue until they change or the user decides.
 *
 * State: { status: 'saved'|'dirty'|'saving'|'paused'|'error', savedAt, paused: [{op, changes}], error, unsaved }
 */
export function createAutosave({ formId, onState, onRejected, onSaved }) {
  let server = null
  let timer = null
  let retryTimer = null
  let retryDelay = 0
  let inFlight = null
  let inFlightSigs = new Set()
  let again = false
  let networkError = null
  let disposed = false
  let saveSeq = 0
  const held = new Map()
  const approved = new Set()
  // Remote values for the input being typed in: `${target}|${prop}` → {type, key, prop, local, scope}.
  const focusHolds = new Map()
  // Our applied batches the poll has not caught up with yet: remote batches older than these lose to them.
  let ownBatches = []
  let state = { status: 'saved', savedAt: null, paused: [], error: null, unsaved: false }

  const store = () => useFormStore.getState()
  const local = () => docOf(store())
  const responseCount = () => store().currentForm?.responses?.length || 0

  const destructiveOf = (op) => {
    if (op.type !== 'field.delete' && op.type !== 'field.update') return []
    const before = server.fields.find((f) => f.key === op.key)
    if (!before) return []
    const after = applyOps(server, [op]).fields.find((f) => f.key === op.key)
    return destructiveChanges([{ ...before, id: op.key }], after ? [{ ...after, id: op.key }] : [])
  }

  /**
   * `diff(snapshot, local)` minus props held for the focused input that the user has not changed since
   * (local still has the old value there only because the remote one waits for blur).
   */
  function pendingOps() {
    const doc = local()
    const ops = diffDocs(server, doc)
    if (!focusHolds.size) return ops
    const holds = [...focusHolds.values()]
    return ops.map((op) => {
      if (op.type !== 'field.update' && op.type !== 'form.update') return op
      const t = target(op)
      const set = Object.fromEntries(Object.entries(op.set).filter(([k]) => !holds.some((h) => (
        h.key === t && propsOverlap(h.prop, k) && sameValue(valueAt(doc, t, h.prop), h.local)
      ))))
      return Object.keys(set).length ? { ...op, set } : null
    }).filter(Boolean)
  }

  /** Focus left the input: apply the held remote values the user did not overwrite (else local wins). */
  function releaseHolds() {
    if (!focusHolds.size || !server) return
    const active = document.activeElement
    const doc = local()
    const apply = []
    for (const [id, h] of focusHolds) {
      if (h.scope?.isConnected && h.scope.contains(active)) continue
      focusHolds.delete(id)
      if (!sameValue(valueAt(doc, h.key, h.prop), h.local)) continue
      if (h.key !== FORM_TARGET && !server.fields.some((f) => f.key === h.key)) continue
      const set = { [h.prop]: valueAt(server, h.key, h.prop) ?? null }
      apply.push(h.key === FORM_TARGET ? { type: 'form.update', set } : { type: 'field.update', key: h.key, set })
    }
    if (apply.length) store().applyRemoteOps(apply, { conflictOps: [] })
    refresh()
  }
  const onFocusChange = () => setTimeout(releaseHolds, 0)
  if (typeof document !== 'undefined') {
    document.addEventListener('focusin', onFocusChange)
    document.addEventListener('focusout', onFocusChange)
  }

  function plan() {
    const ops = pendingOps()
    const send = []
    const paused = []
    const heldOps = []
    const seen = new Set()
    const checkRisk = responseCount() > 0
    for (const op of ops) {
      const s = sig(op)
      seen.add(s)
      if (held.has(s)) {
        heldOps.push(op)
        continue
      }
      const changes = checkRisk && !approved.has(op.key) ? destructiveOf(op) : []
      if (!changes.length) {
        send.push(op)
        continue
      }
      if (op.type === 'field.update') {
        const safe = {}
        const risky = {}
        for (const [k, v] of Object.entries(op.set)) (RISKY_PROP.test(k) ? risky : safe)[k] = v
        if (Object.keys(safe).length) send.push({ ...op, set: safe })
        paused.push({ op: { ...op, set: risky }, changes })
      } else {
        paused.push({ op, changes })
      }
    }
    for (const s of held.keys()) if (!seen.has(s)) held.delete(s)
    return { ops, send, paused, heldOps }
  }

  function emit(patch) {
    const next = { ...state, ...patch }
    const changed = Object.keys(next).some((k) => (k === 'paused'
      ? stableStringify(next.paused.map((p) => p.changes)) !== stableStringify(state.paused.map((p) => p.changes))
      : next[k] !== state[k]))
    state = next
    if (changed) onState?.(state)
  }

  function refresh() {
    if (!server) return
    const { ops, send, paused, heldOps } = plan()
    let status = 'saved'
    let error = null
    if (inFlight) status = 'saving'
    else if (networkError) [status, error] = ['error', networkError]
    else if (heldOps.length) [status, error] = ['error', 'rejected']
    else if (send.length) status = 'dirty'
    else if (paused.length) status = 'paused'
    emit({ status, error, paused, unsaved: ops.length > 0 })
  }

  function schedule(delay = 1500) {
    if (disposed) return
    clearTimeout(timer)
    timer = setTimeout(() => flush(), delay)
  }

  async function post(body, keepalive) {
    const json = JSON.stringify(body)
    if (!keepalive || json.length > KEEPALIVE_LIMIT) return (await formAPI.ops(formId, body)).data
    // fetch + keepalive survives page unload and, unlike sendBeacon, can carry the Bearer/XSRF headers.
    const res = await fetch(`${API_URL}/forms/${formId}/ops`, {
      method: 'POST',
      keepalive: true,
      credentials: 'include',
      headers: authHeaders(),
      body: json,
    })
    if (!res.ok) {
      const error = new Error(`HTTP ${res.status}`)
      error.response = { status: res.status, data: await res.json().catch(() => null) }
      throw error
    }
    return res.json()
  }

  function handleResponse(sent, data) {
    const { revision, applied = [], rejected = [] } = data || {}
    const ids = {}
    const forced = {}
    for (const { index, op: normalized } of applied) {
      const op = sent[index]
      if (!op) continue
      server = applyOps(server, [op])
      if (op.key) approved.delete(op.key)
      if (op.type === 'field.insert' && normalized?.data?.id) ids[op.key] = normalized.data.id
      if (op.type === 'form.update' && normalized?.set) {
        for (const [k, v] of Object.entries(normalized.set)) if (!(k in op.set)) forced[k] = v
      }
    }
    if (Object.keys(ids).length) {
      server = { ...server, fields: server.fields.map((f) => (ids[f.key] ? { ...f, id: ids[f.key] } : f)) }
    }
    if (Object.keys(forced).length) server = { ...server, form: applySet(server.form, forced) }
    if (Object.keys(ids).length || Object.keys(forced).length) store().adoptServerValues({ ids, form: Object.keys(forced).length ? forced : null })
    if (revision != null && applied.length) {
      store().advanceRevision(revision)
      ownBatches = [...ownBatches, { revision, ops: applied.map(({ index }) => sent[index]).filter(Boolean) }]
        .filter((b) => b.revision > store().revision)
    }

    for (const r of rejected) {
      const op = sent[r.index]
      if (op) held.set(sig(op), r)
    }
    networkError = null
    retryDelay = 0
    if (applied.length) {
      emit({ savedAt: new Date() })
      onSaved?.()
    }
    if (rejected.length) onRejected?.(rejected.map((r) => ({ ...r, op: sent[r.index] })))
  }

  function handleError(error, sent) {
    const status = error?.response?.status
    if (status === 422) {
      // The batch itself was refused (should not happen): hold it like rejected ops.
      const errors = error.response.data?.errors
      const rejected = sent.map((op, index) => ({ index, type: op.type, key: op.key, reason: 'invalid', message: error.response.data?.message, errors }))
      rejected.forEach((r) => held.set(sig(sent[r.index]), r))
      onRejected?.(rejected.map((r) => ({ ...r, op: sent[r.index] })))
      return
    }
    networkError = status === 403 ? 'forbidden' : 'network'
    if (status === 403 || status === 401) return
    retryDelay = Math.min(retryDelay ? retryDelay * 2 : 2000, MAX_RETRY_MS)
    clearTimeout(retryTimer)
    retryTimer = setTimeout(() => flush(), retryDelay)
  }

  /** Sends the queue now. `keepalive`: page is being hidden/unloaded. */
  function flush({ keepalive = false } = {}) {
    clearTimeout(timer)
    timer = null
    if (!server || (disposed && !keepalive)) return Promise.resolve()
    if (inFlight && !keepalive) {
      again = true
      return inFlight
    }
    const { send } = plan()
    const toSend = inFlight ? send.filter((op) => !inFlightSigs.has(sig(op))) : send
    if (!toSend.length) {
      refresh()
      return inFlight || Promise.resolve()
    }
    const body = { client_id: clientId, base_revision: store().revision, ops: toSend }
    if (inFlight) {
      // Unloading while a save is running: fire and forget the rest.
      post(body, true).catch(() => {})
      return inFlight
    }
    clearTimeout(retryTimer)
    saveSeq++
    inFlightSigs = new Set(toSend.map(sig))
    inFlight = post(body, keepalive)
      .then((data) => handleResponse(toSend, data))
      .catch((error) => handleError(error, toSend))
      .finally(() => {
        inFlight = null
        inFlightSigs = new Set()
        refresh()
        if (again) {
          again = false
          flush()
        }
      })
    refresh()
    return inFlight
  }

  const unsubscribe = onLocalChange(({ delay }) => {
    schedule(delay)
    refresh()
  })

  return {
    getState: () => state,

    /** After (re)loading the form: the current store document is what the server has. */
    reset() {
      server = local()
      held.clear()
      approved.clear()
      focusHolds.clear()
      ownBatches = []
      networkError = null
      refresh()
    },

    schedule,
    flush,
    pendingOps: () => (server ? pendingOps() : []),
    /** Resolves when no save is in flight. */
    async idle() {
      while (inFlight) await inFlight
    },
    /** Increases with every save sent. */
    saveSeq: () => saveSeq,

    /** "Thử lại": resend everything, including ops the server rejected before. */
    retry() {
      held.clear()
      networkError = null
      retryDelay = 0
      return flush()
    },

    hasUnsaved: () => !!server && (inFlight !== null || pendingOps().length > 0),

    /** [Vẫn lưu] on the destructive banner. */
    approvePaused() {
      state.paused.forEach((p) => p.op.key && approved.add(p.op.key))
      return flush()
    },

    /** [Hoàn tác] on the destructive banner: puts the paused parts back to what the server has. */
    revertPaused() {
      let doc = local()
      for (const { op } of state.paused) {
        const saved = server.fields.find((f) => f.key === op.key)
        if (!saved) continue
        if (op.type === 'field.delete') {
          if (doc.fields.some((f) => f.key === op.key)) continue
          const at = server.fields.indexOf(saved)
          let after = null
          for (let j = at - 1; j >= 0; j--) {
            if (doc.fields.some((f) => f.key === server.fields[j].key)) {
              after = server.fields[j].key
              break
            }
          }
          doc = applyOps(doc, [{ type: 'field.insert', key: op.key, after_key: after, data: saved }])
        } else if (op.type === 'field.update') {
          doc = applyOps(doc, [{ type: 'field.update', key: op.key, set: invertSet(saved, op.set) }])
        }
      }
      store().commitDoc(doc, { label: 'Khôi phục thay đổi ảnh hưởng câu trả lời', delay: 0 })
      refresh()
    },

    /**
     * Ops from other users, one batch at a time in revision order (`revision` of the batch). Updates the
     * snapshot and applies them locally without history/dirty, except:
     * - props our own later batches set (already in the snapshot; they won on the server too),
     * - local values the user changed and has not saved yet (they win when sent),
     * - the prop of the input being typed in: held until blur, then applied if the user left it as it was.
     * Call only when no save is in flight (`idle()`), so the snapshot order matches the server's.
     */
    applyRemote(ops, { user = null, revision = null } = {}) {
      if (!server) return
      ownBatches = ownBatches.filter((b) => b.revision > store().revision)
      const doc = local()
      const pending = pendingOps()
      const later = revision == null ? [] : ownBatches.filter((b) => b.revision > revision).flatMap((b) => b.ops)
      const focus = focusedInput()
      const setBy = (list, op, k) => list.some((p) => p.type === op.type && target(p) === target(op) && Object.keys(p.set || {}).some((m) => propsOverlap(m, k)))
      const serverOps = []
      const localOps = []
      for (const op of ops) {
        if (op.type === 'field.move' && later.some((o) => (o.type === 'field.move' || o.type === 'field.insert') && o.key === op.key)) continue
        if (op.type !== 'field.update' && op.type !== 'form.update') {
          serverOps.push(op)
          localOps.push(op)
          continue
        }
        const t = target(op)
        const serverSet = {}
        const localSet = {}
        for (const [k, v] of Object.entries(op.set || {})) {
          if (setBy(later, op, k)) continue
          serverSet[k] = v
          if (setBy(pending, op, k)) continue
          const before = valueAt(doc, t, k)
          if (focus && focus.key === t && (focus.prop ? propsOverlap(focus.prop, k) : containsText(before, focus.text))) {
            focusHolds.set(`${t}|${k}`, { type: op.type, key: t, prop: k, local: before, scope: focus.scope })
            continue
          }
          localSet[k] = v
        }
        if (Object.keys(serverSet).length) serverOps.push({ ...op, set: serverSet })
        if (Object.keys(localSet).length) localOps.push({ ...op, set: localSet })
      }
      server = applyOps(server, serverOps)
      store().applyRemoteOps(localOps, { user, conflictOps: serverOps })
      refresh()
    },

    dispose() {
      disposed = true
      clearTimeout(timer)
      clearTimeout(retryTimer)
      unsubscribe()
      document.removeEventListener('focusin', onFocusChange)
      document.removeEventListener('focusout', onFocusChange)
    },
  }
}
