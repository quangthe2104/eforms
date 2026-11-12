/**
 * Editor operations (plan §5.4): pure helpers shared by local edits, autosave and remote changes.
 *
 * A "doc" is `{ fields: [...], form: { title, description, ...theme, ...settings } }`.
 * Ops: field.insert {key, after_key, data} · field.update {key, set} · field.delete {key}
 *      field.move {key, after_key} · form.update {set}
 * In a `set`, "settings.<name>" (fields: also "validation_rules.<name>"; form: also "respondent_limit.<name>")
 * changes one first-level entry (null removes it); whole props are applied before dotted ones.
 */

export const FIELD_PROPS = [
  'type', 'label', 'description', 'image_url', 'video_url', 'placeholder', 'help_text', 'options', 'rows',
  'columns', 'validation_rules', 'is_required', 'conditional_logic', 'settings', 'random_group_key', 'variant_key',
]
export const FIELD_OBJECT_PROPS = ['settings', 'validation_rules']

export const THEME_KEYS = [
  'primary_color', 'secondary_color', 'background_color', 'header_image',
  'font_family', 'header_font_size', 'question_font_size', 'text_font_size',
]
export const DEFAULT_THEME = {
  primary_color: '#4285F4',
  secondary_color: '#C6DAFC',
  background_color: '#f9fafb',
  header_image: '',
  font_family: 'system-ui, -apple-system, sans-serif',
  header_font_size: '32px',
  question_font_size: '16px',
  text_font_size: '14px',
}
export const SETTINGS_KEYS = [
  'is_public', 'accept_responses', 'show_progress_bar', 'shuffle_questions', 'limit_responses', 'max_responses',
  'require_login', 'custom_thank_you_message', 'respondent_limit', 'settings',
]
export const FORM_PROPS = ['title', 'description', ...THEME_KEYS, ...SETTINGS_KEYS]
export const FORM_OBJECT_PROPS = ['settings', 'respondent_limit']

const FORM_KEY = '@form'

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

export function isEmptyValue(v) {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0) || (isPlainObject(v) && Object.keys(v).length === 0)
}

export function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  if (isPlainObject(v)) {
    return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`
  }
  return JSON.stringify(v ?? null)
}

/** Value equality that treats null / undefined / '' / [] / {} as the same "empty" (the server normalizes those). */
export function sameValue(a, b) {
  if (a === b) return true
  const ea = isEmptyValue(a)
  const eb = isEmptyValue(b)
  if (ea || eb) return ea && eb
  return stableStringify(a) === stableStringify(b)
}

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)))

// ---------------------------------------------------------------- sets

export function applySet(obj, set) {
  const out = { ...obj }
  const entries = Object.entries(set || {})
  for (const [prop, value] of entries) {
    if (!prop.includes('.')) out[prop] = clone(value)
  }
  for (const [path, value] of entries) {
    const dot = path.indexOf('.')
    if (dot < 0) continue
    const prop = path.slice(0, dot)
    const name = path.slice(dot + 1)
    const base = isPlainObject(out[prop]) ? { ...out[prop] } : {}
    if (value === null || value === undefined) delete base[name]
    else base[name] = clone(value)
    out[prop] = base
  }
  return out
}

export function invertSet(obj, set) {
  const inv = {}
  const keys = Object.keys(set || {})
  const whole = new Set(keys.filter((k) => !k.includes('.')))
  for (const path of keys) {
    const dot = path.indexOf('.')
    if (dot < 0) {
      inv[path] = clone(obj?.[path] ?? null)
      continue
    }
    const prop = path.slice(0, dot)
    if (whole.has(prop)) continue
    inv[path] = clone(obj?.[prop]?.[path.slice(dot + 1)] ?? null)
  }
  return inv
}

/** Changed props between two objects; object props are diffed per first-level entry when both sides are objects. */
export function diffSet(before, after, props, objectProps = []) {
  const set = {}
  for (const prop of props) {
    const b = before?.[prop]
    const a = after?.[prop]
    if (sameValue(b, a)) continue
    if (objectProps.includes(prop) && isPlainObject(b) && Object.keys(b).length && isPlainObject(a)) {
      for (const name of new Set([...Object.keys(b), ...Object.keys(a)])) {
        if (!sameValue(b[name], a[name])) set[`${prop}.${name}`] = a[name] === undefined ? null : clone(a[name])
      }
      continue
    }
    set[prop] = a === undefined ? null : clone(a)
  }
  return set
}

/** Merges set `b` into set `a` (b is later): a whole prop drops earlier dotted entries of that prop. */
export function mergeSets(a, b) {
  const out = { ...a }
  for (const key of Object.keys(b)) {
    if (!key.includes('.')) {
      for (const k of Object.keys(out)) if (k.startsWith(`${key}.`)) delete out[k]
    }
    out[key] = b[key]
  }
  return out
}

// ---------------------------------------------------------------- apply / invert

const indexOfKey = (fields, key) => fields.findIndex((f) => f.key === key)

/** Position right after `afterKey` (null = first, unknown = end). */
function insertIndex(fields, afterKey) {
  if (afterKey === null || afterKey === undefined) return 0
  const i = indexOfKey(fields, afterKey)
  return i < 0 ? fields.length : i + 1
}

/**
 * Applies one op. Ops that no longer fit (update/move/delete of a missing key, insert of an existing key)
 * are skipped, so undo/redo and remote ops can be applied to a state that moved on.
 */
export function applyOp(doc, op) {
  const fields = doc.fields
  switch (op?.type) {
    case 'field.insert': {
      if (!op.key || indexOfKey(fields, op.key) >= 0) return doc
      const at = insertIndex(fields, op.after_key)
      const field = { ...clone(op.data || {}), key: op.key }
      return { ...doc, fields: [...fields.slice(0, at), field, ...fields.slice(at)] }
    }
    case 'field.update': {
      const i = indexOfKey(fields, op.key)
      if (i < 0) return doc
      const next = fields.slice()
      next[i] = applySet(fields[i], op.set)
      return { ...doc, fields: next }
    }
    case 'field.delete': {
      const i = indexOfKey(fields, op.key)
      if (i < 0) return doc
      return { ...doc, fields: fields.filter((_, j) => j !== i) }
    }
    case 'field.move': {
      const i = indexOfKey(fields, op.key)
      if (i < 0 || op.after_key === op.key) return doc
      const field = fields[i]
      const rest = fields.filter((_, j) => j !== i)
      const at = insertIndex(rest, op.after_key)
      return { ...doc, fields: [...rest.slice(0, at), field, ...rest.slice(at)] }
    }
    case 'form.update':
      return { ...doc, form: applySet(doc.form || {}, op.set) }
    default:
      return doc
  }
}

export const applyOps = (doc, ops) => (ops || []).reduce(applyOp, doc)

const fieldData = (field) => Object.fromEntries(
  FIELD_PROPS.filter((p) => field[p] !== undefined).map((p) => [p, clone(field[p])])
)

/** Inverse of one op, given the doc *before* the op. */
export function invertOp(doc, op) {
  const fields = doc.fields
  const i = op.key ? indexOfKey(fields, op.key) : -1
  const prevKey = i > 0 ? fields[i - 1].key : null
  switch (op.type) {
    case 'field.insert':
      return i >= 0 ? [] : [{ type: 'field.delete', key: op.key }]
    case 'field.delete':
      return i < 0 ? [] : [{ type: 'field.insert', key: op.key, after_key: prevKey, data: { ...fieldData(fields[i]), ...(fields[i].id ? { id: fields[i].id } : {}) } }]
    case 'field.update':
      return i < 0 ? [] : [{ type: 'field.update', key: op.key, set: invertSet(fields[i], op.set) }]
    case 'field.move':
      return i < 0 ? [] : [{ type: 'field.move', key: op.key, after_key: prevKey }]
    case 'form.update':
      return [{ type: 'form.update', set: invertSet(doc.form || {}, op.set) }]
    default:
      return []
  }
}

/** Inverse of a list of ops (to be applied in the returned order), given the doc before them. */
export function invertOps(doc, ops) {
  const inverse = []
  let state = doc
  for (const op of ops) {
    inverse.unshift(...invertOp(state, op))
    state = applyOp(state, op)
  }
  return inverse
}

// ---------------------------------------------------------------- diff

/** Longest increasing subsequence of `seq` (returns the set of values kept in place). */
function lisSet(seq) {
  const tails = []
  const tailIdx = []
  const prev = new Array(seq.length)
  seq.forEach((v, i) => {
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (tails[mid] < v) lo = mid + 1
      else hi = mid
    }
    tails[lo] = v
    tailIdx[lo] = i
    prev[i] = lo > 0 ? tailIdx[lo - 1] : -1
  })
  const keep = new Set()
  let k = tailIdx[tails.length - 1]
  while (k !== undefined && k >= 0) {
    keep.add(seq[k])
    k = prev[k]
  }
  return keep
}

/** Ops turning field list `before` into `after`: deletes, then inserts/moves in final order, then updates. */
export function diffFields(before, after) {
  const ops = []
  if (before.length === after.length && before.every((f, i) => f === after[i] || f.key === after[i].key)) {
    before.forEach((old, i) => {
      if (old === after[i]) return
      const set = diffSet(old, after[i], FIELD_PROPS, FIELD_OBJECT_PROPS)
      if (Object.keys(set).length) ops.push({ type: 'field.update', key: old.key, set })
    })
    return ops
  }
  const afterKeys = new Set(after.map((f) => f.key))
  const beforeByKey = new Map(before.map((f) => [f.key, f]))

  for (const f of before) if (!afterKeys.has(f.key)) ops.push({ type: 'field.delete', key: f.key })

  const kept = before.filter((f) => afterKeys.has(f.key))
  const keptPos = new Map(kept.map((f, i) => [f.key, i]))
  const staying = lisSet(after.filter((f) => keptPos.has(f.key)).map((f) => keptPos.get(f.key)))

  after.forEach((f, i) => {
    const afterKey = i > 0 ? after[i - 1].key : null
    if (!beforeByKey.has(f.key)) {
      ops.push({ type: 'field.insert', key: f.key, after_key: afterKey, data: fieldData(f) })
    } else if (!staying.has(keptPos.get(f.key))) {
      ops.push({ type: 'field.move', key: f.key, after_key: afterKey })
    }
  })

  for (const f of after) {
    const old = beforeByKey.get(f.key)
    if (!old || old === f) continue
    const set = diffSet(old, f, FIELD_PROPS, FIELD_OBJECT_PROPS)
    if (Object.keys(set).length) ops.push({ type: 'field.update', key: f.key, set })
  }
  return ops
}

export function diffForm(before, after, props = FORM_PROPS) {
  if (before === after) return []
  const set = diffSet(before, after, props, FORM_OBJECT_PROPS)
  return Object.keys(set).length ? [{ type: 'form.update', set }] : []
}

export function diffDocs(before, after) {
  const ops = before.fields === after.fields ? [] : diffFields(before.fields, after.fields)
  return [...ops, ...diffForm(before.form, after.form)]
}

// ---------------------------------------------------------------- merge / coalesce

const targetOf = (op) => (op.type === 'form.update' ? FORM_KEY : op.key)

/** Appends `b` to `a`, folding an update into an immediately preceding update of the same target. */
export function mergeOps(a, b) {
  const out = a.slice()
  for (const op of b) {
    const last = out[out.length - 1]
    if (last && last.type === op.type && (op.type === 'field.update' || op.type === 'form.update') && targetOf(last) === targetOf(op)) {
      out[out.length - 1] = { ...last, set: mergeSets(last.set, op.set) }
    } else {
      out.push(op)
    }
  }
  return out
}

const TEXT_ARRAY_PROPS = ['options', 'rows', 'columns']

/** Single text-like update (typing, colour dragging): consecutive ones on the same props merge into one undo step. */
export function typingSignature(ops) {
  if (ops.length !== 1) return null
  const op = ops[0]
  if (op.type !== 'field.update' && op.type !== 'form.update') return null
  const keys = Object.keys(op.set)
  const textual = keys.every((k) => typeof op.set[k] === 'string' || op.set[k] === null || TEXT_ARRAY_PROPS.includes(k))
  return textual ? `${targetOf(op)}|${keys.sort().join(',')}` : null
}

/** True when applying `ops` changes nothing in `doc`. */
export function isNoop(doc, ops) {
  return diffDocs(doc, applyOps(doc, ops)).length === 0
}

// ---------------------------------------------------------------- conflicts (remote ops, phase 5)

/** What an op touches: `{key, prop}`; prop '*' = the whole field. */
export function touches(op) {
  switch (op.type) {
    case 'field.insert':
    case 'field.delete':
      return [{ key: op.key, prop: '*' }]
    case 'field.move':
      return [{ key: op.key, prop: '@order' }]
    case 'field.update':
      return Object.keys(op.set || {}).map((prop) => ({ key: op.key, prop }))
    case 'form.update':
      return Object.keys(op.set || {}).map((prop) => ({ key: FORM_KEY, prop }))
    default:
      return []
  }
}

const propsOverlap = (a, b) => a === '*' || b === '*' || a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`)

/** True when `remoteOps` changed something `localOps` also changed (same field + overlapping prop, or a deleted field). */
export function opsConflict(localOps, remoteOps) {
  const remote = remoteOps.flatMap(touches)
  return localOps.flatMap(touches).some((l) => remote.some((r) => r.key === l.key && propsOverlap(l.prop, r.prop)))
}

// ---------------------------------------------------------------- labels

const plain = (text, max = 40) => {
  const t = String(text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || '(chưa đặt tên)'
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/** Human description of a local change, used for undo/redo tooltips ("Xóa câu hỏi 'Họ tên'"). */
export function describeOps(ops, before, after) {
  const find = (doc, key) => doc.fields.find((f) => f.key === key)
  const name = (key) => `'${plain((find(after, key) || find(before, key))?.label)}'`
  const of = (type) => ops.filter((o) => o.type === type)
  const isSection = (key) => (find(before, key) || find(after, key))?.type === 'random_section'

  const deletes = of('field.delete')
  if (deletes.length) {
    const header = deletes.find((o) => isSection(o.key))
    if (header) return `Xóa phần ngẫu nhiên ${name(header.key)}`
    return deletes.length === 1 ? `Xóa câu hỏi ${name(deletes[0].key)}` : `Xóa ${deletes.length} câu hỏi`
  }
  const inserts = of('field.insert')
  if (inserts.length) {
    const header = inserts.find((o) => isSection(o.key))
    if (header) return `Thêm phần ngẫu nhiên ${name(header.key)}`
    return inserts.length === 1 ? `Thêm câu hỏi ${name(inserts[0].key)}` : `Thêm ${inserts.length} câu hỏi`
  }
  const updates = of('field.update')
  const typeChange = updates.find((o) => 'type' in o.set)
  if (typeChange) return `Đổi loại câu hỏi ${name(typeChange.key)}`
  const moves = of('field.move')
  if (moves.length) return moves.length === 1 ? `Di chuyển câu hỏi ${name(moves[0].key)}` : 'Sắp xếp lại câu hỏi'
  if (updates.length) {
    const sectionUpdate = updates.find((o) => isSection(o.key))
    if (sectionUpdate) return `Sửa phần ngẫu nhiên ${name(sectionUpdate.key)}`
    return updates.length === 1 ? `Sửa câu hỏi ${name(updates[0].key)}` : `Sửa ${updates.length} câu hỏi`
  }
  const form = of('form.update')[0]
  if (form) {
    const keys = Object.keys(form.set)
    if (keys.includes('title')) return 'Sửa tiêu đề biểu mẫu'
    if (keys.includes('description')) return 'Sửa mô tả biểu mẫu'
    if (keys.some((k) => THEME_KEYS.includes(k))) return 'Đổi giao diện'
    return 'Sửa cài đặt'
  }
  return 'Thay đổi'
}
