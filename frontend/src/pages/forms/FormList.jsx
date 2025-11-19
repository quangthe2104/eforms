import { useEffect, useState, useRef } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { formAPI } from '../../services/api'
import { Plus, Trash2, Copy, Edit, ChevronDown, MoreVertical, Share2, BarChart3, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import FormThumbnail from '../../components/FormThumbnail'

export default function FormList() {
  const navigate = useNavigate()
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const searchTerm = searchParams.get('search') || ''
  const [statusFilter, setStatusFilter] = useState('all')
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [activeMenuFormId, setActiveMenuFormId] = useState(null)
  const filterDropdownRef = useRef(null)
  const menuDropdownRef = useRef(null)

  useEffect(() => {
    fetchForms()
  }, [statusFilter])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setFilterDropdownOpen(false)
      }
      if (menuDropdownRef.current && !menuDropdownRef.current.contains(event.target)) {
        setActiveMenuFormId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchForms = async () => {
    try {
      const params = {}
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }
      
      const response = await formAPI.getAll(params)
      setForms(response.data.data || [])
    } catch (error) {
      toast.error('Không thể tải danh sách biểu mẫu')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn xóa biểu mẫu này?')) return
    
    try {
      await formAPI.delete(id)
      toast.success('Đã xóa biểu mẫu thành công')
      fetchForms()
    } catch (error) {
      toast.error('Không thể xóa biểu mẫu')
    }
  }

  const handleDuplicate = async (id) => {
    try {
      await formAPI.duplicate(id)
      toast.success('Đã nhân bản biểu mẫu thành công')
      fetchForms()
    } catch (error) {
      toast.error('Không thể nhân bản biểu mẫu')
    }
  }

  const copyFormLink = (slug) => {
    const link = `${window.location.origin}/f/${slug}`
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link)
        .then(() => toast.success('Đã sao chép liên kết biểu mẫu!'))
        .catch(() => toast.error('Không thể sao chép liên kết'))
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = link
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      toast.success('Đã sao chép liên kết biểu mẫu!')
    }
  }

  const filteredForms = forms.filter(form =>
    form.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    form.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const statusOptions = [
    { value: 'all', label: 'Tất Cả Trạng Thái' },
    { value: 'draft', label: 'Nháp' },
    { value: 'published', label: 'Đã Xuất Bản' },
    { value: 'closed', label: 'Đã Đóng' },
  ]

  const currentStatusLabel = statusOptions.find(opt => opt.value === statusFilter)?.label || 'Tất Cả Trạng Thái'

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Hôm nay'
    if (days === 1) return 'Hôm qua'
    if (days < 7) return `${days} ngày trước`
    if (days < 30) return `${Math.floor(days / 7)} tuần trước`
    if (days < 365) return `${Math.floor(days / 30)} tháng trước`
    return date.toLocaleDateString('vi-VN')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header and Filters */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Biểu mẫu của tôi</h1>
        
        {/* Custom Dropdown */}
        <div className="relative" ref={filterDropdownRef}>
          <button
            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
            className="text-sm text-gray-600 bg-transparent border-none outline-none cursor-pointer hover:text-gray-900 transition-colors flex items-center space-x-1"
          >
            <span>{currentStatusLabel}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${filterDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {filterDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setStatusFilter(option.value)
                    setFilterDropdownOpen(false)
                  }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    statusFilter === option.value
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Forms Grid - 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Create New Form Card */}
        <Link 
          to="/forms/create" 
          className="card hover:shadow-md transition-all hover:border-primary-300 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center min-h-[240px] group"
        >
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary-200 transition-colors">
            <Plus className="w-8 h-8 text-primary-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Tạo biểu mẫu mới</h3>
          <p className="text-sm text-gray-600">Bắt đầu từ biểu mẫu trống</p>
        </Link>

        {/* Existing Forms */}
        {filteredForms.length === 0 && searchTerm ? (
          <div className="col-span-full card text-center py-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Không tìm thấy biểu mẫu</h3>
            <p className="text-gray-600">Thử điều chỉnh tìm kiếm của bạn</p>
          </div>
        ) : (
          filteredForms.map((form) => (
            <div key={form.id} className="card hover:shadow-lg transition-all group overflow-hidden">
              {/* Thumbnail with Status Badge */}
              <div 
                onClick={() => navigate(`/forms/${form.id}/edit`)}
                className="w-full cursor-pointer relative overflow-hidden"
                style={{ 
                  aspectRatio: '16/9',
                  margin: '-24px -24px 16px -24px', // -24px = -p-6 để tràn ra ngoài card padding
                  padding: 0,
                  width: 'calc(100% + 48px)' // Bù padding card (24px mỗi bên)
                }}
                title={form.title}
              >
                <FormThumbnail form={form} />
                {/* Status Badge on Thumbnail - Minimalist */}
                {form.status === 'published' && (
                  <div className="absolute top-2 right-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm shadow-sm border border-green-500/20">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                    </div>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="space-y-2">
                {/* Title - Single Line */}
                <h3 
                  onClick={() => navigate(`/forms/${form.id}/edit`)}
                  className="font-semibold text-gray-900 line-clamp-1 cursor-pointer hover:text-primary-600 transition-colors"
                  title={form.title}
                >
                  {form.title}
                </h3>

                {/* Date */}
                <p className="text-xs text-gray-500">
                  {formatDate(form.updated_at || form.created_at)}
                </p>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-gray-100 flex items-stretch gap-2">
                  {/* Results Button with Count */}
                  <Link
                    to={`/forms/${form.id}/responses`}
                    className="btn btn-primary text-sm flex items-center justify-center space-x-1.5 py-2 px-4 min-w-[70px] h-[38px]"
                    title={`${form.responses?.length || 0} phản hồi`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span className="font-semibold">{form.responses?.length || 0}</span>
                  </Link>
                  
                  {/* Share Button */}
                  {form.status === 'published' && form.slug ? (
                    <button
                      onClick={() => copyFormLink(form.slug)}
                      className="flex-1 btn btn-secondary text-sm flex items-center justify-center space-x-1.5 py-2 h-[38px]"
                      title="Chia sẻ"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Chia sẻ</span>
                    </button>
                  ) : (
                    <button
                      disabled
                      className="flex-1 btn btn-secondary text-sm flex items-center justify-center space-x-1.5 py-2 h-[38px] opacity-50 cursor-not-allowed"
                      title="Xuất bản để chia sẻ"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Chia sẻ</span>
                    </button>
                  )}
                  
                  {/* More Menu */}
                  <div className="relative" ref={activeMenuFormId === form.id ? menuDropdownRef : null}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuFormId(activeMenuFormId === form.id ? null : form.id)
                      }}
                      className="btn btn-secondary text-sm w-[40px] h-[38px] flex items-center justify-center p-0"
                      title="Tùy chọn"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {activeMenuFormId === form.id && (
                      <div className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[100]">
                        <button
                          onClick={() => {
                            setActiveMenuFormId(null)
                            navigate(`/forms/${form.id}/edit`)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <Edit className="w-4 h-4" />
                          <span>Chỉnh sửa</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveMenuFormId(null)
                            handleDuplicate(form.id)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <Copy className="w-4 h-4" />
                          <span>Nhân bản</span>
                        </button>
                        <div className="border-t border-gray-200 my-1"></div>
                        <button
                          onClick={() => {
                            setActiveMenuFormId(null)
                            handleDelete(form.id)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

