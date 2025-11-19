import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { FormBuilderProvider } from './contexts/FormBuilderContext'

// Layouts
import MainLayout from './layouts/MainLayout'
import AuthLayout from './layouts/AuthLayout'

// Pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import FormList from './pages/forms/FormList'
import FormBuilder from './components/FormBuilder'
import FormResponses from './pages/forms/FormResponses'
import ResponseDetail from './pages/forms/ResponseDetail'
import FormPreview from './pages/forms/FormPreview'
import PublicForm from './pages/PublicForm'
import Profile from './pages/Profile'
import ChangePassword from './pages/ChangePassword'
import NotFound from './pages/NotFound'

// Protected Route Component
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" />
}

// Public Route Component (redirect if authenticated)
function PublicRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return !isAuthenticated ? children : <Navigate to="/forms" />
}

function App() {
  return (
    <Router>
      <FormBuilderProvider>
        <Toaster position="top-right" />
        <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/forms" />} />
        <Route path="/f/:slug" element={<PublicForm />} />
        
        {/* Preview Route (Protected but no layout) */}
        <Route path="/forms/:id/preview" element={<ProtectedRoute><FormPreview /></ProtectedRoute>} />
        
        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        </Route>

        {/* Protected Routes */}
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/forms" element={<FormList />} />
          <Route path="/forms/:id/responses" element={<FormResponses />} />
          <Route path="/forms/:id/responses/:responseId" element={<ResponseDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/change-password" element={<ChangePassword />} />
        </Route>

        {/* Form Builder Routes (with MainLayout) */}
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/forms/create" element={<FormBuilder />} />
          <Route path="/forms/:id/edit" element={<FormBuilder />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </FormBuilderProvider>
    </Router>
  )
}

export default App

