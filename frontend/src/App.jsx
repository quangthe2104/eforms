import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'

// Layouts
import MainLayout from './layouts/MainLayout'
import AuthLayout from './layouts/AuthLayout'
import FormEditorLayout from './layouts/FormEditorLayout'

// Pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import FormList from './pages/forms/FormList'
import CreateForm from './pages/forms/CreateForm'
import FormBuilder from './components/FormBuilder'
import FormResponses from './pages/forms/FormResponses'
import ResponseDetail from './pages/forms/ResponseDetail'
import FormSettingsTab from './pages/forms/FormSettingsTab'
import FormPreview from './pages/forms/FormPreview'
import PublicForm from './pages/PublicForm'
import Invite from './pages/Invite'
import Profile from './pages/Profile'
import ChangePassword from './pages/ChangePassword'
import NotFound from './pages/NotFound'

// Protected Route Component: Login returns to the page the user was going to.
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()
  return isAuthenticated ? children : <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
}

// Public Route Component: redirects users who arrive signed in. After signing in on the page itself the page
// decides where to go (an invite goes to the form, not to /forms), so this only checks on arrival.
function PublicRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  const [searchParams] = useSearchParams()
  const [signedInOnArrival] = useState(isAuthenticated)
  if (!signedInOnArrival) return children
  const invite = searchParams.get('invite')
  return <Navigate to={invite ? `/invite/${encodeURIComponent(invite)}` : '/forms'} replace />
}

function App() {
  return (
    <Router>
      {/* Bottom, like Google Forms: top-right toasts covered the editor header buttons. Offset clears the mobile builder toolbar. */}
      <Toaster position="bottom-center" containerStyle={{ bottom: 72 }} />
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
          {/* Works signed in or out (accepts, or sends to Login/Register) */}
          <Route path="/invite/:token" element={<Invite />} />
        </Route>

        {/* Protected Routes */}
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/forms" element={<FormList />} />
          <Route path="/forms/create" element={<CreateForm />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/change-password" element={<ChangePassword />} />
        </Route>

        {/* Form editor: one layout (header + form state) around the three tabs */}
        <Route path="/forms/:id" element={<ProtectedRoute><FormEditorLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="edit" replace />} />
          <Route path="edit" element={<FormBuilder />} />
          <Route path="responses" element={<FormResponses />} />
          <Route path="responses/:responseId" element={<ResponseDetail />} />
          <Route path="settings" element={<FormSettingsTab />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  )
}

export default App
