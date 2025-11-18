import { create } from 'zustand'

export const useFormStore = create((set) => ({
  currentForm: null,
  fields: [],
  isDirty: false,

  setCurrentForm: (form) => set({ currentForm: form, fields: form?.fields || [] }),
  
  setFields: (fields) => set({ fields, isDirty: true }),
  
  addField: (field) => set((state) => ({
    fields: [...state.fields, { ...field, order: state.fields.length }],
    isDirty: true,
  })),
  
  updateField: (index, updates) => set((state) => ({
    fields: state.fields.map((field, i) => 
      i === index ? { ...field, ...updates } : field
    ),
    isDirty: true,
  })),
  
  removeField: (index) => set((state) => ({
    fields: state.fields.filter((_, i) => i !== index),
    isDirty: true,
  })),
  
  reorderFields: (newFields) => set({
    fields: newFields.map((field, index) => ({ ...field, order: index })),
    isDirty: true,
  }),
  
  resetForm: () => set({
    currentForm: null,
    fields: [],
    isDirty: false,
  }),
  
  markAsSaved: () => set({ isDirty: false }),
}))

