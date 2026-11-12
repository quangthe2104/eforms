import { create } from 'zustand'
import { normalizeField, normalizeFields, cloneFields, blockEnd, insertAt } from '../utils/formStructure'

const withOrder = (fields) => fields.map((field, index) => ({ ...field, order: index }))

export const useFormStore = create((set) => ({
  currentForm: null,
  fields: [],
  isDirty: false,
  // Title/description are edited from both the header and the title card, so they live here.
  title: '',
  description: '',
  metaDirty: false,

  /** Fresh load of a form into the editor: drops every local change. */
  loadForm: (form) => set({
    currentForm: form,
    fields: normalizeFields(form?.fields),
    isDirty: false,
    title: form?.title || '',
    description: form?.description || '',
    metaDirty: false,
  }),

  setCurrentForm: (form) => set((state) => {
    // Only update fields if not dirty (no unsaved changes)
    if (!state.isDirty) {
      return { 
        currentForm: form, 
        fields: normalizeFields(form?.fields),
        isDirty: false 
      }
    } else {
      return { 
        currentForm: form,
        // Keep existing fields when there are unsaved changes
        fields: state.fields,
        isDirty: true
      }
    }
  }),

  /** Merges server-side form attributes (status, settings…) without touching the edited fields. */
  patchForm: (patch) => set((state) => ({ currentForm: state.currentForm ? { ...state.currentForm, ...patch } : state.currentForm })),

  setMeta: (patch) => set({ ...patch, metaDirty: true }),

  markMetaSaved: (sent) => set((state) => ({
    metaDirty: state.title !== sent.title || state.description !== sent.description,
  })),

  /** After a save: adopt the server ids of saved fields; stay dirty if edits happened meanwhile. */
  applySavedFields: (form, savedFields, sentFields) => set((state) => {
    const idByKey = Object.fromEntries((savedFields || []).map((f) => [f.key, f.id]))
    const fields = state.fields.map((f) => (idByKey[f.key] ? { ...f, id: idByKey[f.key] } : f))
    return { currentForm: form, fields, isDirty: state.fields !== sentFields }
  }),
  
  setFields: (fields) => set({ fields: withOrder(fields), isDirty: true }),
  
  addField: (field) => set((state) => ({
    fields: [...state.fields, { ...normalizeField(field), order: state.fields.length }],
    isDirty: true,
  })),

  insertFields: (at, newFields) => set((state) => ({
    fields: withOrder(insertAt(state.fields, at, newFields.map(normalizeField))),
    isDirty: true,
  })),
  
  updateField: (index, updates) => set((state) => ({
    fields: state.fields.map((field, i) => 
      i === index ? { ...field, ...updates } : field
    ),
    isDirty: true,
  })),
  
  removeField: (index) => set((state) => ({
    fields: withOrder(state.fields.filter((_, i) => i !== index)),
    isDirty: true,
  })),
  
  duplicateField: (index) => set((state) => {
    const field = state.fields[index]
    const end = field.type === 'random_section' ? blockEnd(state.fields, index) : index
    const copies = cloneFields(state.fields.slice(index, end + 1))
    return {
      fields: withOrder(insertAt(state.fields, end + 1, copies)),
      isDirty: true,
    }
  }),
  
  reorderFields: (newFields) => set({
    fields: withOrder(newFields),
    isDirty: true,
  }),
  
  resetForm: () => set({
    currentForm: null,
    fields: [],
    isDirty: false,
    title: '',
    description: '',
    metaDirty: false,
  }),
  
  markAsSaved: () => set({ isDirty: false }),
}))
