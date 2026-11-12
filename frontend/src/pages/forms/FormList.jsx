import { useEffect, useState, useRef } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { formAPI } from '../../services/api'
import { Plus, Trash2, Copy, Edit, Eye, ChevronDown, MoreVertical, UserPlus, Link2, BarChart3, CheckCircle, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import FormThumbnail from '../../components/FormThumbnail'
import Tooltip from '../../components/editor/Tooltip'
import ShareDialog from '../../components/editor/ShareDialog'
import { ROLE_LABELS } from '../../utils/roles'
import { copyText } from '../../utils/clipboard'
import { useAuthStore } from '../../store/authStore'

// `GET /forms?filter=`: "mine" = I am an owner, "shared" = I am an editor/viewer.
const OWNERSHIP_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'mine', label: 'Của tôi' },
  { value: 'shared', label: 'Được chia sẻ' },
]

export default function FormList() {
  const navigate = useNavigate()
  const myId = useAuthStore((s) => s.user?.id)
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const searchTerm = searchParams.get('search') || ''
  const ownership = OWNERSHIP_FILTERS.some((f) => f.value === searchParams.get('filter')) ? searchParams.get('filter') : 'all'
  const [statusFilter, setStatusFilter] = useState('all')
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [activeMenuFormId, setActiveMenuFormId] = useState(null)
  const [shareFormId, setShareFormId] = useState(null)
  const filterDropdownRef = useRef(null)
  const menuDropdownRef = useRef(null)

  useEffect(() => {
    fetchForms()
  }, [statusFilter, ownership])

  const setOwnership = (value) => {
    const next = new URLSearchParams(searchParams)
    if (value === 'all') next.delete('filter')
    else next.set('filter', value)
    setSearchParams(next, { replace: true })
  }

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
      if (ownership !== 'all') params.filter = ownership
      
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

  const copyFormLink = (form) => {
    if (form.status === 'draft' || !form.slug) {
      toast('Biểu mẫu chưa được xuất bản', { id: 'copy-link' })
      return
    }
    copyText(`${window.location.origin}/f/${form.slug}`)
      .then(() => toast.success('Đã sao chép liên kết biểu mẫu!', { id: 'copy-link' }))
      .catch(() => toast.error('Không thể sao chép liên kết'))
  }

  const patchListForm = (id, patch) => setForms((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))

  const updateShareSettings = async (patch) => {
    const id = shareFormId
    const keys = Object.keys(patch)
    const pick = (obj) => Object.fromEntries(keys.map((k) => [k, obj?.[k]]))
    const before = pick(forms.find((f) => f.id === id))
    patchListForm(id, patch)
    try {
      const res = await formAPI.update(id, patch)
      patchListForm(id, pick(res.data.form))
    } catch {
      patchListForm(id, before)
      toast.error('Không thể lưu cài đặt')
    }
  }

  const shareForm = forms.find((f) => f.id === shareFormId)

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900">Biểu mẫu</h1>
          <div role="group" aria-label="Lọc theo quyền sở hữu" className="inline-flex rounded-full border border-gray-300 p-0.5 bg-white">
            {OWNERSHIP_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                data-filter={f.value}
                aria-pressed={ownership === f.value}
                onClick={() => setOwnership(f.value)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${ownership === f.value ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        
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
        ) : filteredForms.length === 0 && ownership === 'shared' ? (
          <div className="col-span-full md:col-span-1 lg:col-span-2 xl:col-span-3 card text-center py-12" data-forms-empty>
            <Users className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có biểu mẫu nào được chia sẻ với bạn</h3>
            <p className="text-gray-600">Khi ai đó thêm bạn làm người chỉnh sửa hoặc người xem, biểu mẫu sẽ hiện ở đây.</p>
          </div>
        ) : (
          filteredForms.map((form) => {
            const role = form.my_role || 'owner'
            const shared = role !== 'owner' || (form.collaborators_count || 0) > 1
            const ownerName = form.owner && form.owner.id !== myId ? form.owner.name : null
            const sharedLabel = role === 'owner'
              ? `Đã chia sẻ với ${(form.collaborators_count || 1) - 1} người`
              : `Được chia sẻ với bạn${ownerName ? ` · Chủ sở hữu: ${ownerName}` : ''}`
            const published = form.status === 'published' && !!form.slug
            return (
            <div key={form.id} data-form-card={form.id} data-my-role={role} className="card hover:shadow-lg transition-all group overflow-hidden">
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

                {/* Date, sharing, my role */}
                <div className="flex items-center gap-2 text-xs text-gray-500 min-w-0">
                  {shared && (
                    <Tooltip label={sharedLabel}>
                      <span data-shared-icon tabIndex={0} aria-label={sharedLabel} className="flex-shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                        <Users className="w-3.5 h-3.5 text-gray-500" />
                      </span>
                    </Tooltip>
                  )}
                  <span className="truncate">{formatDate(form.updated_at || form.created_at)}</span>
                  <span data-role-badge className={`ml-auto flex-shrink-0 px-1.5 py-0.5 rounded ${role === 'owner' ? 'bg-primary-50 text-primary-700' : role === 'editor' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABELS[role]}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-gray-100 flex items-stretch gap-1.5">
                  {/* Results Button with Count */}
                  <Link
                    to={`/forms/${form.id}/responses`}
                    className="btn btn-primary text-sm flex items-center justify-center space-x-1.5 py-2 px-3 h-[38px] flex-shrink-0"
                    title={`${form.responses?.length || 0} phản hồi`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span className="font-semibold">{form.responses?.length || 0}</span>
                  </Link>

                  {/* Respondent link */}
                  <button
                    type="button"
                    data-card-action="copy-link"
                    onClick={() => copyFormLink(form)}
                    disabled={!published}
                    className="btn btn-secondary w-[36px] h-[38px] flex items-center justify-center p-0 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={published ? 'Sao chép đường liên kết của người trả lời' : 'Xuất bản để lấy đường liên kết'}
                    aria-label="Sao chép đường liên kết của người trả lời"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>

                  {/* Collaborators */}
                  <button
                    type="button"
                    data-card-action="share"
                    onClick={() => setShareFormId(form.id)}
                    className="flex-1 min-w-0 btn btn-secondary text-sm flex items-center justify-center gap-1.5 py-2 px-2 h-[38px]"
                    title="Chia sẻ với người chỉnh sửa"
                  >
                    <UserPlus className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">Chia sẻ</span>
                  </button>

                  {/* More Menu */}
                  <div className="relative" ref={activeMenuFormId === form.id ? menuDropdownRef : null}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuFormId(activeMenuFormId === form.id ? null : form.id)
                      }}
                      className="btn btn-secondary text-sm w-[36px] h-[38px] flex items-center justify-center p-0"
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
                          {role === 'viewer' ? <Eye className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                          <span>{role === 'viewer' ? 'Mở (chỉ xem)' : 'Chỉnh sửa'}</span>
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
                        {/* Only owners may delete (plan §4.8) */}
                        {role === 'owner' && (
                          <>
                            <div className="border-t border-gray-200 my-1"></div>
                            <button
                              data-card-action="delete"
                              onClick={() => {
                                setActiveMenuFormId(null)
                                handleDelete(form.id)
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Xóa</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )
          })
        )}
      </div>

      {shareForm && (
        <ShareDialog
          formId={shareForm.id}
          title={shareForm.title}
          role={shareForm.my_role || 'owner'}
          form={shareForm}
          onUpdateSettings={updateShareSettings}
          onClose={() => {
            setShareFormId(null)
            fetchForms()
          }}
          onCopyLink={() => copyFormLink(shareForm)}
          onRoleChanged={(next) => patchListForm(shareForm.id, { my_role: next })}
          onLeft={() => {
            setShareFormId(null)
            fetchForms()
          }}
        />
      )}
    </div>
  )
}

