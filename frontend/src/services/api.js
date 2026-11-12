import axios from 'axios'
import { newKey } from '../utils/formStructure'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

/**
 * One per page load: lets the server skip this page's own changes (ops log, legacy endpoints).
 * Not kept in sessionStorage – a duplicated tab copies it, and both tabs would then skip each other's changes.
 * A reloaded page loads the form fresh, so it does not need the old id either.
 */
export const clientId = newKey()

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
})

// Helper function to get cookie value
const getCookie = (name) => {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop().split(';').shift())
  }
  return null
}

/** Headers the axios instance adds, for raw `fetch` calls (keepalive on page unload; use credentials: 'include'). */
export const authHeaders = () => {
  const token = localStorage.getItem('token')
  const xsrfToken = getCookie('XSRF-TOKEN')
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client-Id': clientId,
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(xsrfToken && { 'X-XSRF-TOKEN': xsrfToken }),
  }
}

const publicHeaders = () => {
  const token = localStorage.getItem('token')
  return { Accept: 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }
}

// Respondents may keep a form open longer than the session lives, so a 419 refreshes the CSRF cookie once.
const publicPost = async (path, data, retried = false) => {
  if (!getCookie('XSRF-TOKEN')) await getCsrfCookie()
  const xsrfToken = getCookie('XSRF-TOKEN')
  try {
    return await axios.post(`${API_URL}${path}`, data, {
      headers: { ...publicHeaders(), ...(xsrfToken && { 'X-XSRF-TOKEN': xsrfToken }) },
      withCredentials: true,
    })
  } catch (error) {
    if (error.response?.status !== 419 || retried) throw error
    await getCsrfCookie()
    return publicPost(path, data, true)
  }
}

// Request interceptor to add token and XSRF token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    config.headers['X-Client-Id'] = clientId
    
    // Add XSRF token from cookie
    const xsrfToken = getCookie('XSRF-TOKEN')
    if (xsrfToken) {
      config.headers['X-XSRF-TOKEN'] = xsrfToken
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Get CSRF cookie
export const getCsrfCookie = () => {
  const baseURL = API_URL.replace('/api', '')
  return axios.get(`${baseURL}/sanctum/csrf-cookie`, {
    withCredentials: true,
  })
}

// Auth APIs
export const authAPI = {
  register: async (data) => {
    await getCsrfCookie()
    return api.post('/register', data)
  },
  login: async (data) => {
    await getCsrfCookie()
    return api.post('/login', data)
  },
  logout: async () => {
    try {
      await getCsrfCookie()
      return api.post('/logout')
    } catch (error) {
      // Ignore CSRF errors, just clear client-side session
      console.log('Logout API error (ignored):', error.message)
      return Promise.resolve()
    }
  },
  me: () => api.get('/me'),
  updateProfile: (data) => api.put('/profile', data),
  changePassword: (data) => api.post('/change-password', data),
}

// Form APIs
export const formAPI = {
  getAll: (params) => api.get('/forms', { params }),
  getOne: (id) => api.get(`/forms/${id}`),
  create: (data) => api.post('/forms', data),
  update: (id, data) => api.put(`/forms/${id}`, data),
  delete: (id) => api.delete(`/forms/${id}`),
  duplicate: (id) => api.post(`/forms/${id}/duplicate`),
  getStatistics: (id) => api.get(`/forms/${id}/statistics`),
  ops: (id, data) => api.post(`/forms/${id}/ops`, data),
  changes: (id, params) => api.get(`/forms/${id}/changes`, { params }),
}

// Collaborator APIs
export const collaboratorAPI = {
  list: (formId) => api.get(`/forms/${formId}/collaborators`),
}

// Form Field APIs
export const fieldAPI = {
  create: (formId, data) => api.post(`/forms/${formId}/fields`, data),
  update: (formId, fieldId, data) => api.put(`/forms/${formId}/fields/${fieldId}`, data),
  delete: (formId, fieldId) => api.delete(`/forms/${formId}/fields/${fieldId}`),
  reorder: (formId, data) => api.post(`/forms/${formId}/fields/reorder`, data),
  bulkUpdate: (formId, data) => api.post(`/forms/${formId}/fields/bulk-update`, data),
}

// Response APIs
export const responseAPI = {
  getAll: (formId, params) => api.get(`/forms/${formId}/responses`, { params }),
  getSummary: (formId, variants) => api.get(`/forms/${formId}/responses/summary`, { params: variants ? { variants } : undefined }),
  getOne: (formId, responseId) => api.get(`/forms/${formId}/responses/${responseId}`),
  delete: (formId, responseId) => api.delete(`/forms/${formId}/responses/${responseId}`),
  
  // Public APIs (the login token is sent when present so account-based limits can recognise the user)
  getPublicForm: (slug, params) => axios.get(`${API_URL}/forms/public/${slug}`, {
    params,
    headers: publicHeaders(),
    withCredentials: true,
  }),
  assignVariants: (slug, data) => publicPost(`/forms/public/${slug}/assign`, data),
  checkIdentity: (slug, data) => publicPost(`/forms/public/${slug}/check-identity`, data),
  submitForm: async (slug, data) => {
    await getCsrfCookie()
    
    const formData = new FormData()
    if (data.token) formData.append('token', data.token)
    if (data.device_id) formData.append('device_id', data.device_id)
    
    // Handle file uploads
    Object.keys(data.answers).forEach(fieldId => {
      const value = data.answers[fieldId]
      if (value instanceof File) {
        formData.append(`answers[${fieldId}]`, value)
      } else if (Array.isArray(value)) {
        formData.append(`answers[${fieldId}]`, JSON.stringify(value))
      } else if (typeof value === 'object' && value !== null) {
        // For grid fields (objects like {"Row 1": "Col A", "Row 2": ["Col B"]})
        formData.append(`answers[${fieldId}]`, JSON.stringify(value))
      } else {
        formData.append(`answers[${fieldId}]`, value)
      }
    })
    
    const xsrfToken = getCookie('XSRF-TOKEN')
    
    return axios.post(`${API_URL}/forms/public/${slug}/submit`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(xsrfToken && { 'X-XSRF-TOKEN': xsrfToken }),
        ...publicHeaders(),
      },
      withCredentials: true,
    })
  },
}

// Export APIs
export const exportAPI = {
  exportResponses: (formId) => api.get(`/forms/${formId}/export`, {
    responseType: 'blob',
  }),
  exportSingleResponse: (formId, responseId) => api.get(`/forms/${formId}/responses/${responseId}/export`, {
    responseType: 'blob',
  }),
}

export default api

