import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formAPI } from '../../services/api'
import { Plus, Search, Trash2, Copy, Eye, Edit, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

export default function FormList() {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchForms()
  }, [statusFilter])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Biểu Mẫu Của Tôi</h1>
          <p className="text-gray-600 mt-1">Quản lý tất cả biểu mẫu của bạn tại một nơi</p>
        </div>
        <Link to="/forms/create" className="btn btn-primary flex items-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Tạo Biểu Mẫu</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm biểu mẫu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input md:w-48"
          >
            <option value="all">Tất Cả Trạng Thái</option>
            <option value="draft">Nháp</option>
            <option value="published">Đã Xuất Bản</option>
            <option value="closed">Đã Đóng</option>
          </select>
        </div>
      </div>

      {/* Forms Grid */}
      {filteredForms.length === 0 ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Không tìm thấy biểu mẫu</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ? 'Thử điều chỉnh tìm kiếm của bạn' : 'Bắt đầu bằng cách tạo biểu mẫu đầu tiên'}
          </p>
          {!searchTerm && (
            <Link to="/forms/create" className="btn btn-primary inline-flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Tạo Biểu Mẫu</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredForms.map((form) => (
            <div key={form.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{form.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{form.description || 'Không có mô tả'}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2 ${
                  form.status === 'published' 
                    ? 'bg-green-100 text-green-700' 
                    : form.status === 'draft'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {form.status === 'published' ? 'Đã xuất bản' : form.status === 'draft' ? 'Nháp' : 'Đã đóng'}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                <span className="flex items-center space-x-1">
                  <Eye className="w-4 h-4" />
                  <span>{form.responses?.length || 0} phản hồi</span>
                </span>
                <span>{form.fields?.length || 0} trường</span>
              </div>

                     <div className="flex items-center space-x-2">
                       <Link
                         to={`/forms/${form.id}/edit`}
                         className="flex-1 btn btn-secondary text-sm flex items-center justify-center space-x-1"
                       >
                         <Edit className="w-4 h-4" />
                         <span>Sửa</span>
                       </Link>
                       <Link
                         to={`/forms/${form.id}/responses`}
                         className="flex-1 btn btn-primary text-sm flex items-center justify-center space-x-1"
                       >
                         <Eye className="w-4 h-4" />
                         <span>Kết quả</span>
                       </Link>
                     </div>

              <div className="flex items-center space-x-2 mt-2">
                {form.status === 'published' && form.slug ? (
                  <button
                    onClick={() => copyFormLink(form.slug)}
                    className="flex-1 btn btn-secondary text-sm flex items-center justify-center space-x-1"
                    title="Sao chép liên kết biểu mẫu"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Chia sẻ</span>
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex-1 btn btn-secondary text-sm flex items-center justify-center space-x-1 opacity-50 cursor-not-allowed"
                    title={form.status !== 'published' ? 'Xuất bản biểu mẫu để chia sẻ' : 'Liên kết biểu mẫu không khả dụng'}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Chia sẻ</span>
                  </button>
                )}
                <button
                  onClick={() => handleDuplicate(form.id)}
                  className="btn btn-secondary text-sm p-2"
                  title="Nhân bản biểu mẫu"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(form.id)}
                  className="btn btn-danger text-sm p-2"
                  title="Xóa biểu mẫu"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

