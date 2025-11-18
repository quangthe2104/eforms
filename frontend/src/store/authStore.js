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

  logout: async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
      set({ user: null, token: null, isAuthenticated: false })
    }
  },

  updateUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user))
    set({ user })
  },

  clearError: () => set({ error: null }),
}))

