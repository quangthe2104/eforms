import { create } from 'zustand'
import { normalizeField, normalizeFields, cloneFields, blockEnd, insertAt, shortLabel } from '../utils/formStructure'
import {
  FORM_PROPS, THEME_KEYS, DEFAULT_THEME, applyOps, diffDocs, invertOps, mergeOps, typingSignature, describeOps,
  isNoop, opsConflict,
} from '../utils/ops'

const HISTORY_LIMIT = 100
const COALESCE_MS = 1000
const FORM_ATTRS = FORM_PROPS.filter((p) => p !== 'title' && p !== 'description')

const withOrder = (fields) => fields.map((field, index) => (field.order === index ? field : { ...field, order: index }))

/** The editable part of the store as an ops document (see utils/ops.js). */
export const docOf = (state) => ({
  fields: state.fields,
  form: {
    title: state.title,
    description: state.description,
    ...Object.fromEntries(FORM_ATTRS.map((p) => [p, state.currentForm?.[p]])),
  },
})

const fromDoc = (state, doc) => {
  const { title, description, ...attrs } = doc.form
  const form = state.currentForm
  // Same object when no attribute changed: the theme and everything derived from the form stay stable.
  const formChanged = form && Object.keys(attrs).some((k) => attrs[k] !== form[k])
  return {
    fields: doc.fields === state.fields ? state.fields : withOrder(doc.fields),
    title: title ?? '',
    description: description ?? '',
    currentForm: formChanged ? { ...form, ...attrs } : form,
  }
}

// Autosave subscribes here: every local change reports how soon it wants to be saved.
const changeListeners = new Set()
export const onLocalChange = (fn) => {
  changeListeners.add(fn)
  return () => changeListeners.delete(fn)
}

let entrySeq = 0
let batchId = 0
let batchScheduled = false

/**
 * Applies a new document locally. The ops are a diff of the old and new documents, so every action
 * (and undo/redo) produces exactly the changes autosave will send.
 */
function commit(set, get, nextDoc, { history = true, label, delay = 1500, coalesce = true } = {}) {
  const state = get()
  const prev = docOf(state)
  const ops = diffDocs(prev, nextDoc)
  if (!ops.length) return false
  const patch = fromDoc(state, nextDoc)

  if (history) {
    const now = Date.now()
    const sig = coalesce ? typingSignature(ops) : null
    const undo = state.undoStack.slice()
    const top = undo[undo.length - 1]
    const usable = top && !top.sealed && !top.conflict
    if (usable && top.batch === batchId) {
      // Several commits from one event (e.g. an option rename + the conditions using it) are one step.
      undo[undo.length - 1] = { ...top, ops: mergeOps(top.ops, ops), inverse: [...invertOps(prev, ops), ...top.inverse], at: now }
    } else if (usable && sig && top.sig === sig && now - top.at < COALESCE_MS) {
      const merged = { ...top, ops: mergeOps(top.ops, ops), at: now, batch: batchId, label: label || describeOps(ops, nextDoc, nextDoc) }
      if (isNoop(nextDoc, merged.inverse)) undo.pop()
      else undo[undo.length - 1] = merged
    } else {
      undo.push({
        id: ++entrySeq,
        ops,
        inverse: invertOps(prev, ops),
        label: label || describeOps(ops, prev, nextDoc),
        sig,
        at: now,
        batch: batchId,
      })
      if (undo.length > HISTORY_LIMIT) undo.shift()
    }
    if (!batchScheduled) {
      batchScheduled = true
      queueMicrotask(() => {
        batchId++
        batchScheduled = false
      })
    }
    patch.undoStack = undo
    patch.redoStack = []
  }

  set(patch)
  changeListeners.forEach((fn) => fn({ delay }))
  return true
}

const seal = (stack) => {
  if (!stack.length || stack[stack.length - 1].sealed) return stack
  const next = stack.slice()
  next[next.length - 1] = { ...next[next.length - 1], sealed: true }
  return next
}

export const useFormStore = create((set, get) => {
  const commitFields = (fields, opts) => commit(set, get, { ...docOf(get()), fields }, opts)
  const commitForm = (patch, opts) => {
    const doc = docOf(get())
    return commit(set, get, { ...doc, form: { ...doc.form, ...patch } }, opts)
  }

  /** Undo/redo: applies the stored ops to the current state and saves the resulting diff. */
  const travel = (from, to) => {
    const state = get()
    const stack = state[from].slice()
    const entry = stack.pop()
    if (!entry) return null
    if (entry.conflict) {
      set({ [from]: stack })
      return { entry, conflict: entry.conflict }
    }
    const ops = from === 'undoStack' ? entry.inverse : entry.ops
    commit(set, get, applyOps(docOf(state), ops), { history: false, delay: 1500 })
    set({ [from]: seal(stack), [to]: [...get()[to], { ...entry, sealed: true }] })
    return { entry }
  }

  return {
    currentForm: null,
    fields: [],
    // Title/description are edited from both the header and the title card, so they live here.
    title: '',
    description: '',
    revision: 0,
    undoStack: [],
    redoStack: [],

    /** Fresh load of a form into the editor: drops every local change and the history. */
    loadForm: (form) => set({
      // Theme columns are null on forms that never had a theme; the API rejects null for them.
      currentForm: form ? { ...form, ...Object.fromEntries(THEME_KEYS.map((k) => [k, form[k] ?? DEFAULT_THEME[k]])) } : form,
      fields: normalizeFields(form?.fields),
      title: form?.title || '',
      description: form?.description || '',
      revision: form?.revision || 0,
      undoStack: [],
      redoStack: [],
    }),

    /** Merges server-side form attributes (status, slug, responses…). Not an edit: no ops, no history. */
    patchForm: (patch) => set((state) => ({ currentForm: state.currentForm ? { ...state.currentForm, ...patch } : state.currentForm })),

    /** Values the server decided (new field ids, forced settings): not edits. */
    adoptServerValues: ({ ids = {}, form = null } = {}) => set((state) => {
      const patch = {}
      if (Object.keys(ids).length) {
        patch.fields = state.fields.map((f) => (ids[f.key] && f.id !== ids[f.key] ? { ...f, id: ids[f.key] } : f))
      }
      if (form) Object.assign(patch, fromDoc(state, { fields: state.fields, form: { ...docOf(state).form, ...form } }))
      return patch
    }),

    /** Phase 5 poll: the revision whose changes have all been applied. */
    setRevision: (revision) => set((state) => (revision > state.revision ? { revision } : {})),
    /** After our own batch: only when no other client's batch came in between (the poll must still fetch those). */
    advanceRevision: (revision) => set((state) => (revision === state.revision + 1 ? { revision } : {})),

    /** Generic local edit of the whole document (used by autosave to revert paused destructive changes). */
    commitDoc: (doc, opts) => commit(set, get, doc, opts),

    setMeta: (patch) => commitForm(patch),
    setTheme: (patch) => commitForm(patch, { label: 'Đổi giao diện' }),
    /** Settings tab: saved like any change but outside undo/redo (plan §4.9). */
    updateSettings: (patch, { delay = 1500 } = {}) => commitForm(patch, { history: false, delay }),

    setFields: (fields, opts) => commitFields(fields, opts),

    addField: (field) => commitFields([...get().fields, normalizeField(field)]),

    insertFields: (at, newFields, opts) => commitFields(insertAt(get().fields, at, newFields.map(normalizeField)), opts),

    updateField: (index, updates) => commitFields(get().fields.map((field, i) => (i === index ? { ...field, ...updates } : field))),

    removeField: (index) => commitFields(get().fields.filter((_, i) => i !== index)),

    duplicateField: (index) => {
      const fields = get().fields
      const field = fields[index]
      const isBlock = field.type === 'random_section'
      const end = isBlock ? blockEnd(fields, index) : index
      const copies = cloneFields(fields.slice(index, end + 1))
      const what = isBlock ? 'phần ngẫu nhiên' : 'câu hỏi'
      return commitFields(insertAt(fields, end + 1, copies), { label: `Nhân bản ${what} '${shortLabel(field, 40)}'` })
    },

    reorderFields: (newFields) => commitFields(newFields),

    undo: () => travel('undoStack', 'redoStack'),
    redo: () => travel('redoStack', 'undoStack'),

    /** Ends the current typing step (blur, pause). */
    breakCoalesce: () => set((state) => {
      const undoStack = seal(state.undoStack)
      return undoStack === state.undoStack ? {} : { undoStack }
    }),

    /**
     * Ops from other users (phase 5): applied without history and without marking anything to save.
     * History entries touching the same field/prop are marked so undo skips them with a toast.
     * Use `autosave.applyRemote` – it also updates the server snapshot and keeps unsaved local values.
     */
    applyRemoteOps: (ops, { user = null, conflictOps = ops } = {}) => set((state) => {
      const mark = (stack) => stack.map((e) => (!e.conflict && opsConflict([...e.ops, ...e.inverse], conflictOps) ? { ...e, conflict: { user } } : e))
      return {
        ...fromDoc(state, applyOps(docOf(state), ops)),
        undoStack: mark(state.undoStack),
        redoStack: mark(state.redoStack),
      }
    }),

    resetForm: () => set({
      currentForm: null,
      fields: [],
      title: '',
      description: '',
      revision: 0,
      undoStack: [],
      redoStack: [],
    }),
  }
})
