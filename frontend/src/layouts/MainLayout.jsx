import { Outlet, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useFormBuilder } from '../contexts/FormBuilderContext'
import { FileText, LogOut, Menu, X, Key, User, Search, Settings, BarChart3, Share2, Eye, Save, MoreVertical, Copy, Trash2, EyeOff } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { formAPI } from '../services/api'

export default function MainLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [formMenuOpen, setFormMenuOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const userMenuRef = useRef(null)
  const formMenuRef = useRef(null)
  const { formBuilderActions } = useFormBuilder()
  
  // Only show search on /forms page
  const showSearch = location.pathname === '/forms'
  // Check if in form builder
  const isFormBuilder = location.pathname.startsWith('/forms/') && (location.pathname.includes('/edit') || location.pathname.includes('/create'))

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
      if (formMenuRef.current && !formMenuRef.current.contains(event.target)) {
        setFormMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sync search term with URL params
  useEffect(() => {
    setSearchTerm(searchParams.get('search') || '')
  }, [searchParams])

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchTerm(value)
    
    // Update URL params
    if (value) {
      setSearchParams({ search: value })
    } else {
      setSearchParams({})
    }
  }

  // Form actions
  const handleDuplicateForm = async () => {
    if (!formBuilderActions?.currentForm?.id) return
    
    try {
      const response = await formAPI.duplicate(formBuilderActions.currentForm.id)
      toast.success('Đã nhân bản biểu mẫu')
      navigate(`/forms/${response.data.form.id}/edit`)
      setFormMenuOpen(false)
    } catch (error) {
      toast.error('Không thể nhân bản biểu mẫu')
    }
  }

  const handleDeleteForm = async () => {
    if (!formBuilderActions?.currentForm?.id) return
    
    if (confirm('Bạn có chắc chắn muốn xóa biểu mẫu này?')) {
      try {
        await formAPI.delete(formBuilderActions.currentForm.id)
        toast.success('Đã xóa biểu mẫu')
        navigate('/forms')
        setFormMenuOpen(false)
      } catch (error) {
        toast.error('Không thể xóa biểu mẫu')
      }
    }
  }

  const handleUnpublishForm = async () => {
    if (!formBuilderActions?.currentForm?.id) return
    
    try {
      await formAPI.update(formBuilderActions.currentForm.id, { status: 'draft' })
      toast.success('Đã hủy xuất bản biểu mẫu')
      setFormMenuOpen(false)
      // Reload to update status
      window.location.reload()
    } catch (error) {
      toast.error('Không thể hủy xuất bản biểu mẫu')
    }
  }

  return (
    <div className={`min-h-screen ${!isFormBuilder ? 'bg-gray-50' : ''}`}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/forms" className="flex items-center space-x-2">
              <FileText className="w-8 h-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">eForms</span>
            </Link>

            {/* Form Builder Actions */}
            {isFormBuilder && formBuilderActions ? (
              <>
                <div className="hidden md:flex flex-1 items-center justify-end space-x-2">
                {/* Settings */}
                <button
                  onClick={() => {
                    if (formBuilderActions.currentForm?.id) {
                      formBuilderActions.setShowSettings(true)
                    } else {
                      toast.info('Vui lòng lưu biểu mẫu trước khi cài đặt')
                    }
                  }}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Cài đặt"
                >
                  <Settings className="w-5 h-5" />
                </button>

                  {/* Results */}
                  {formBuilderActions.currentForm?.id && (
                    <button
                      onClick={() => navigate(`/forms/${formBuilderActions.currentForm.id}/responses`)}
                      className="flex items-center space-x-1.5 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Xem kết quả"
                    >
                      <BarChart3 className="w-5 h-5" />
                      <span className="text-sm font-medium">
                        {formBuilderActions.currentForm.responses?.length || 0}
                      </span>
                    </button>
                  )}

                  {/* Share */}
                  {formBuilderActions.currentForm?.id && formBuilderActions.formData?.status === 'published' && formBuilderActions.currentForm.slug && (
                    <button
                      onClick={() => formBuilderActions.copyFormLink(formBuilderActions.currentForm.slug)}
                      className="flex items-center space-x-1.5 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Chia sẻ"
                    >
                      <Share2 className="w-5 h-5" />
                      <span className="text-sm">Chia sẻ</span>
                    </button>
                  )}

                  {/* Preview */}
                  <button
                    onClick={() => {
                      if (formBuilderActions.currentForm?.id) {
                        window.open(`/forms/${formBuilderActions.currentForm.id}/preview`, '_blank')
                      } else {
                        toast.info('Vui lòng lưu biểu mẫu trước khi xem trước')
                      }
                    }}
                    className="flex items-center space-x-1.5 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Xem trước"
                  >
                    <Eye className="w-5 h-5" />
                    <span className="text-sm">Xem trước</span>
                  </button>
                  
                  {/* Save */}
                  <button
                    onClick={formBuilderActions.handleSave}
                    disabled={formBuilderActions.saving}
                    className="flex items-center space-x-1.5 px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-5 h-5" />
                    <span className="text-sm">{formBuilderActions.saving ? 'Đang lưu...' : 'Lưu'}</span>
                  </button>

                  {/* Publish */}
                  {formBuilderActions.formData?.status === 'draft' && formBuilderActions.currentForm?.id && (
                    <button
                      onClick={formBuilderActions.handlePublish}
                      className="flex items-center space-x-1.5 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <span className="text-sm">Xuất bản</span>
                    </button>
                  )}
                </div>

                {/* More Options Menu */}
                {formBuilderActions.currentForm?.id && (
                  <div className="hidden md:block relative" ref={formMenuRef}>
                    <button
                      onClick={() => setFormMenuOpen(!formMenuOpen)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-2"
                      title="Tùy chọn khác"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {/* Dropdown Menu */}
                    {formMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                        <button
                          onClick={handleDuplicateForm}
                          className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                          <span>Nhân bản</span>
                        </button>

                        {formBuilderActions.formData?.status === 'published' && (
                          <button
                            onClick={handleUnpublishForm}
                            className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <EyeOff className="w-4 h-4" />
                            <span>Hủy xuất bản</span>
                          </button>
                        )}

                        <button
                          onClick={handleDeleteForm}
                          className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : showSearch ? (
              /* Search Box - Desktop (only on /forms page) */
              <div className="hidden md:block flex-1 max-w-xl mx-8">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm biểu mẫu..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            ) : (
              /* Spacer */
              <div className="flex-1"></div>
            )}

            {/* User Menu - Desktop */}
            <div className="hidden md:block relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                {user?.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user?.name}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium text-sm">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
              </button>

              {/* User Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      {user?.avatar ? (
                        <img 
                          src={user.avatar} 
                          alt={user?.name}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium flex-shrink-0">
                          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          <span className="text-gray-500">Xin chào </span>{user?.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        navigate('/profile')
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>Thông tin cá nhân</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        navigate('/change-password')
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Key className="w-4 h-4" />
                      <span>Đổi mật khẩu</span>
                    </button>
                    
                    <div className="border-t border-gray-200 my-1"></div>
                    
                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        handleLogout()
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200">
            <div className="px-4 py-4 space-y-2">
              {/* Search Box - Mobile (only on /forms page) */}
              {showSearch && (
                <div className="mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm biểu mẫu..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
              
              <div className="px-3 py-3 bg-gray-50 rounded-lg border border-gray-200 mb-3">
                <div className="flex items-center space-x-3">
                  {user?.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt={user?.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium flex-shrink-0">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      <span className="text-gray-500">Xin chào </span>{user?.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{user?.email}</p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  navigate('/profile')
                }}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                <User className="w-4 h-4" />
                <span className="text-sm">Thông tin cá nhân</span>
              </button>
              
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  navigate('/change-password')
                }}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                <Key className="w-4 h-4" />
                <span className="text-sm">Đổi mật khẩu</span>
              </button>
              
              <div className="border-t border-gray-200 pt-2 mt-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    handleLogout()
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Đăng xuất</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}

