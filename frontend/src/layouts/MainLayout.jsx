import { Outlet, Link, useLocation, useSearchParams } from 'react-router-dom'
import { FileText, Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import UserMenu from '../components/UserMenu'

/** Shell for the form list and account pages. The form editor has its own layout (FormEditorLayout). */
export default function MainLayout() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')

  // Only show search on /forms page
  const showSearch = location.pathname === '/forms'

  // Sync search term with URL params
  useEffect(() => {
    setSearchTerm(searchParams.get('search') || '')
  }, [searchParams])

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchTerm(value)
    setSearchParams(value ? { search: value } : {})
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-3">
            <Link to="/forms" className="flex items-center space-x-2 flex-shrink-0">
              <FileText className="w-8 h-8 text-primary-600" />
              <span className="hidden sm:inline text-xl font-bold text-gray-900">eForms</span>
            </Link>

            {showSearch ? (
              <div className="flex-1 max-w-xl md:mx-8">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm biểu mẫu..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full pl-9 md:pl-10 pr-3 py-1.5 md:py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1"></div>
            )}

            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
