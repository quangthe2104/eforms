import { create } from 'zustand'

export const useFormStore = create((set) => ({
  currentForm: null,
  fields: [],
  isDirty: false,

  setCurrentForm: (form) => set((state) => {
    // Only update fields if not dirty (no unsaved changes)
    if (!state.isDirty) {
      return { 
        currentForm: form, 
        fields: form?.fields || [],
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
  
  duplicateField: (index) => set((state) => {
    const field = state.fields[index]
    const newField = { ...field, id: undefined }
    const newFields = [...state.fields]
    newFields.splice(index + 1, 0, newField)
    return {
      fields: newFields.map((f, i) => ({ ...f, order: i })),
      isDirty: true,
    }
  }),
  
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

