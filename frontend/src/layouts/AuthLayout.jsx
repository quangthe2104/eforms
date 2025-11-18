import { Outlet, Link } from 'react-router-dom'
import { FileText } from 'lucide-react'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center space-x-2 mb-8">
          <FileText className="w-12 h-12 text-primary-600" />
          <span className="text-3xl font-bold text-gray-900">eForms</span>
        </Link>

        {/* Auth Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <Outlet />
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-6">
          © 2024 eForms. All rights reserved.
        </p>
      </div>
    </div>
  )
}

