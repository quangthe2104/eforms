import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { User, Mail, Building, Calendar, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Profile() {
  const { user, updateUser } = useAuthStore()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        organization: user.organization || '',
      })
    }
  }, [user])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Gọi API cập nhật thông tin
      // await userAPI.updateProfile(formData)
      // updateUser(formData)
      
      // Tạm thời giả lập
      setTimeout(() => {
        updateUser(formData)
        toast.success('Cập nhật thông tin thành công!')
        setLoading(false)
      }, 1000)
    } catch (error) {
      toast.error('Có lỗi xảy ra khi cập nhật thông tin')
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Kiểm tra kích thước (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 2MB')
      return
    }

    // Kiểm tra loại file
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh')
      return
    }

    try {
      // TODO: Upload ảnh lên server
      // const formData = new FormData()
      // formData.append('avatar', file)
      // const response = await userAPI.uploadAvatar(formData)
      // updateUser({ avatar: response.data.avatar })
      
      toast.success('Tải ảnh lên thành công!')
    } catch (error) {
      toast.error('Có lỗi xảy ra khi tải ảnh lên')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Thông tin cá nhân</h1>
        <p className="text-gray-600 mt-1">Quản lý thông tin tài khoản của bạn</p>
      </div>

      <div className="card">
        {/* Avatar Section */}
        <div className="flex items-center space-x-6 pb-8 border-b border-gray-200">
          <div className="relative">
            {user?.avatar ? (
              <img 
                src={user.avatar} 
                alt={user?.name}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-3xl">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <label 
              htmlFor="avatar-upload"
              className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full border-2 border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4 text-gray-600" />
              <input 
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </label>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{user?.name}</h3>
            <p className="text-sm text-gray-600">{user?.email}</p>
            <p className="text-xs text-gray-500 mt-1">Thành viên từ {new Date(user?.created_at || Date.now()).toLocaleDateString('vi-VN')}</p>
          </div>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Họ và tên
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="input"
              placeholder="Nhập họ và tên"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="input"
              placeholder="Nhập email"
              required
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">Email không thể thay đổi</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building className="w-4 h-4 inline mr-2" />
              Tổ chức / Công ty
            </label>
            <input
              type="text"
              name="organization"
              value={formData.organization}
              onChange={handleChange}
              className="input"
              placeholder="Nhập tên tổ chức / công ty (tùy chọn)"
            />
          </div>

          <div className="flex items-center space-x-4 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData({
                  name: user?.name || '',
                  email: user?.email || '',
                  organization: user?.organization || '',
                })
              }}
              className="btn btn-secondary"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

