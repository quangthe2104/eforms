import { create } from 'zustand'
import { authAPI } from '../services/api'

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,
  error: null,

  login: async (credentials) => {
    set({ loading: true, error: null })
    try {
      const response = await authAPI.login(credentials)
      const { user, token } = response.data
      
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('token', token)
      
      set({ user, token, isAuthenticated: true, loading: false })
      return { success: true }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed'
      set({ error: errorMessage, loading: false })
      return { success: false, error: errorMessage }
    }
  },

  register: async (data) => {
    set({ loading: true, error: null })
    try {
      const response = await authAPI.register(data)
      const { user, token } = response.data
      
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('token', token)
      
      set({ user, token, isAuthenticated: true, loading: false })
      return { success: true }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Registration failed'
      set({ error: errorMessage, loading: false })
      return { success: false, error: errorMessage }
    }
  },

  logout: () => {
    // Clear client-side session immediately without calling API
    // This avoids CSRF token issues and provides instant logout
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    set({ user: null, token: null, isAuthenticated: false })
  },

  updateUser: (userData) => {
    set((state) => {
      const updatedUser = { ...state.user, ...userData }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      return { user: updatedUser }
    })
  },

  clearError: () => set({ error: null }),
}))

