import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formAPI } from '../services/api'
import { FileText, Plus, TrendingUp, Users, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalForms: 0,
    publishedForms: 0,
    totalResponses: 0,
    recentForms: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const response = await formAPI.getAll({ per_page: 5 })
      const forms = response.data.data || []
      
      const totalResponses = forms.reduce((sum, form) => 
        sum + (form.responses?.length || 0), 0
      )
      
      setStats({
        totalForms: forms.length,
        publishedForms: forms.filter(f => f.status === 'published').length,
        totalResponses,
        recentForms: forms.slice(0, 5),
      })
    } catch (error) {
      toast.error('Không thể tải dữ liệu dashboard')
    } finally {
      setLoading(false)
    }
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trang Chủ</h1>
          <p className="text-gray-600 mt-1">Chào mừng trở lại! Đây là tổng quan về các biểu mẫu của bạn.</p>
        </div>
        <Link to="/forms/create" className="btn btn-primary flex items-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Tạo Biểu Mẫu</span>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tổng Biểu Mẫu</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalForms}</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Đã Xuất Bản</p>
              <p className="text-3xl font-bold text-gray-900">{stats.publishedForms}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tổng Phản Hồi</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalResponses}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Forms */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Biểu Mẫu Gần Đây</h2>
          <Link to="/forms" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            Xem tất cả
          </Link>
        </div>

        {stats.recentForms.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Bạn chưa tạo biểu mẫu nào</p>
            <Link to="/forms/create" className="btn btn-primary inline-flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Tạo Biểu Mẫu Đầu Tiên</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {stats.recentForms.map((form) => (
              <div key={form.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{form.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{form.description || 'Không có mô tả'}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      form.status === 'published' 
                        ? 'bg-green-100 text-green-700' 
                        : form.status === 'draft'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {form.status === 'published' ? 'Đã xuất bản' : form.status === 'draft' ? 'Nháp' : 'Đã đóng'}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center space-x-1">
                      <Eye className="w-3 h-3" />
                      <span>{form.responses?.length || 0} phản hồi</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Link
                    to={`/forms/${form.id}/edit`}
                    className="btn btn-secondary text-sm"
                  >
                    Sửa
                  </Link>
                  <Link
                    to={`/forms/${form.id}/responses`}
                    className="btn btn-primary text-sm"
                  >
                    Kết quả
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

