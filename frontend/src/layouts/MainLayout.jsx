import { Outlet, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useFormBuilder } from '../contexts/FormBuilderContext'
import { FileText, LogOut, Key, User, Search, Settings, BarChart3, Share2, Eye, Save, MoreVertical, Copy, Trash2, EyeOff } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { formAPI } from '../services/api'

export default function MainLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [formMenuOpen, setFormMenuOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const userMenuRef = useRef(null)
  const mobileUserMenuRef = useRef(null)
  const formMenuRef = useRef(null)
  const mobileFormMenuRef = useRef(null)
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
      const target = event.target
      
      // Don't close if clicking inside any dropdown menu
      if (target.closest('.absolute.rounded-lg.shadow-xl')) {
        return
      }
      
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false)
      }
      if (mobileUserMenuRef.current && !mobileUserMenuRef.current.contains(target)) {
        setMobileUserMenuOpen(false)
      }
      if (formMenuRef.current && !formMenuRef.current.contains(target)) {
        setFormMenuOpen(false)
      }
      if (mobileFormMenuRef.current && !mobileFormMenuRef.current.contains(target)) {
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
          <div className="flex justify-between items-center h-16 gap-3">
            {/* Logo */}
            <Link to="/forms" className="flex items-center space-x-2 flex-shrink-0">
              <FileText className="w-8 h-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">eForms</span>
            </Link>

            {/* Search Box - Mobile (only on /forms page) */}
            {showSearch && (
              <div className="md:hidden flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm biểu mẫu..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Form Builder Actions - Mobile */}
            {isFormBuilder && formBuilderActions ? (
              <>
                {/* Mobile Header Actions */}
                <div className="md:hidden flex items-center gap-2 flex-shrink-0 ml-auto">
                  {/* Save Button */}
                  <button
                    onClick={formBuilderActions.handleSave}
                    disabled={formBuilderActions.saving}
                    className="flex items-center space-x-1 px-3 py-1.5 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    <Save className="w-4 h-4" />
                    <span className="text-xs">{formBuilderActions.saving ? 'Đang lưu...' : 'Lưu'}</span>
                  </button>

                  {/* Publish Button */}
                  {formBuilderActions.formData?.status === 'draft' && formBuilderActions.currentForm?.id && (
                    <button
                      onClick={formBuilderActions.handlePublish}
                      className="flex items-center space-x-1 px-3 py-1.5 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      <span className="text-xs">Xuất bản</span>
                    </button>
                  )}

                  {/* More Options Menu - Mobile */}
                  <div className="relative" ref={mobileFormMenuRef}>
                    <button
                      onClick={() => setFormMenuOpen(!formMenuOpen)}
                      className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Tùy chọn khác"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {/* Dropdown Menu - Mobile */}
                    {formMenuOpen && (
                      <div 
                        className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[100]" 
                        style={{ pointerEvents: 'auto', zIndex: 9999 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Share */}
                        {formBuilderActions.currentForm?.id && formBuilderActions.formData?.status === 'published' && formBuilderActions.currentForm.slug && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              formBuilderActions.copyFormLink(formBuilderActions.currentForm.slug)
                              setFormMenuOpen(false)
                            }}
                            className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <Share2 className="w-4 h-4" />
                            <span>Chia sẻ</span>
                          </button>
                        )}

                        {/* Preview */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (formBuilderActions.currentForm?.id) {
                              window.open(`/forms/${formBuilderActions.currentForm.id}/preview`, '_blank')
                            } else {
                              toast('Vui lòng lưu biểu mẫu trước khi xem trước')
                            }
                            setFormMenuOpen(false)
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Xem trước</span>
                        </button>

                        {/* Results */}
                        {formBuilderActions.currentForm?.id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              navigate(`/forms/${formBuilderActions.currentForm.id}/responses`)
                              setFormMenuOpen(false)
                            }}
                            className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <BarChart3 className="w-4 h-4" />
                            <span>Báo cáo</span>
                            {formBuilderActions.currentForm.responses?.length > 0 && (
                              <span className="ml-auto bg-primary-100 text-primary-700 text-xs font-medium px-2 py-0.5 rounded-full">
                                {formBuilderActions.currentForm.responses.length}
                              </span>
                            )}
                          </button>
                        )}

                        {/* Settings */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (formBuilderActions.currentForm?.id) {
                              formBuilderActions.setShowSettings(true)
                            } else {
                              toast('Vui lòng lưu biểu mẫu trước khi cài đặt')
                            }
                            setFormMenuOpen(false)
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          <span>Cài đặt</span>
                        </button>

                        <div className="border-t border-gray-200 my-1"></div>

                        {/* Duplicate */}
                        {formBuilderActions.currentForm?.id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleDuplicateForm()
                              setFormMenuOpen(false)
                            }}
                            className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                            <span>Nhân bản</span>
                          </button>
                        )}

                        {/* Unpublish */}
                        {formBuilderActions.formData?.status === 'published' && formBuilderActions.currentForm?.id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleUnpublishForm()
                              setFormMenuOpen(false)
                            }}
                            className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <EyeOff className="w-4 h-4" />
                            <span>Hủy xuất bản</span>
                          </button>
                        )}

                        {/* Delete */}
                        {formBuilderActions.currentForm?.id && (
                          <>
                            <div className="border-t border-gray-200 my-1"></div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleDeleteForm()
                                setFormMenuOpen(false)
                              }}
                              className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Xóa</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mobile Avatar for Form Builder */}
                  <div className="relative ml-2" ref={mobileUserMenuRef}>
                  <button
                    onClick={() => setMobileUserMenuOpen(!mobileUserMenuOpen)}
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

                  {/* Mobile User Dropdown for Form Builder */}
                  {mobileUserMenuOpen && (
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
                            setMobileUserMenuOpen(false)
                            navigate('/profile')
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <User className="w-4 h-4" />
                          <span>Thông tin cá nhân</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            setMobileUserMenuOpen(false)
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
                            setMobileUserMenuOpen(false)
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
                </div>

                {/* Desktop Actions */}
                <div className="hidden md:flex flex-1 items-center justify-end space-x-2">
                {/* Settings */}
                <button
                  onClick={() => {
                    if (formBuilderActions.currentForm?.id) {
                      formBuilderActions.setShowSettings(true)
                    } else {
                      toast('Vui lòng lưu biểu mẫu trước khi cài đặt')
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
                        toast('Vui lòng lưu biểu mẫu trước khi xem trước')
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
                      <div 
                        className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDuplicateForm()
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                          <span>Nhân bản</span>
                        </button>

                        {formBuilderActions.formData?.status === 'published' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleUnpublishForm()
                            }}
                            className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <EyeOff className="w-4 h-4" />
                            <span>Hủy xuất bản</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDeleteForm()
                          }}
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

            {/* Mobile Avatar Menu */}
            {(!isFormBuilder || !formBuilderActions) && (
              <div className="md:hidden relative" ref={mobileUserMenuRef}>
                <button
                  onClick={() => setMobileUserMenuOpen(!mobileUserMenuOpen)}
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

                {/* Mobile User Dropdown */}
                {mobileUserMenuOpen && (
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
                        setMobileUserMenuOpen(false)
                        navigate('/profile')
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>Thông tin cá nhân</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setMobileUserMenuOpen(false)
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
                        setMobileUserMenuOpen(false)
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
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}

