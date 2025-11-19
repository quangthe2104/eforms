import { createContext, useContext, useState } from 'react'

const FormBuilderContext = createContext()

export function FormBuilderProvider({ children }) {
  const [formBuilderActions, setFormBuilderActions] = useState(null)

  return (
    <FormBuilderContext.Provider value={{ formBuilderActions, setFormBuilderActions }}>
      {children}
    </FormBuilderContext.Provider>
  )
}

export function useFormBuilder() {
  const context = useContext(FormBuilderContext)
  if (!context) {
    throw new Error('useFormBuilder must be used within FormBuilderProvider')
  }
  return context
}

