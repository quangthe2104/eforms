import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ChangePassword() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const validatePassword = (password) => {
    // Kiểm tra độ dài tối thiểu
    if (password.length < 6) {
      return 'Mật khẩu phải có ít nhất 6 ký tự'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate
    if (!formData.currentPassword) {
      toast.error('Vui lòng nhập mật khẩu hiện tại')
      return
    }

    const passwordError = validatePassword(formData.newPassword)
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Mật khẩu mới và xác nhận mật khẩu không khớp')
      return
    }

    if (formData.currentPassword === formData.newPassword) {
      toast.error('Mật khẩu mới phải khác mật khẩu hiện tại')
      return
    }

    setLoading(true)

    try {
      // TODO: Gọi API đổi mật khẩu
      // await userAPI.changePassword({
      //   current_password: formData.currentPassword,
      //   new_password: formData.newPassword,
      // })
      
      // Tạm thời giả lập
      setTimeout(() => {
        toast.success('Đổi mật khẩu thành công!')
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
        setLoading(false)
        // Redirect về trang forms sau 1s
        setTimeout(() => {
          navigate('/forms')
        }, 1000)
      }, 1000)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi đổi mật khẩu')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Đổi mật khẩu</h1>
        <p className="text-gray-600 mt-1">Cập nhật mật khẩu để bảo mật tài khoản của bạn</p>
      </div>

      <div className="card">
        <div className="flex items-center space-x-3 pb-6 border-b border-gray-200">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Bảo mật tài khoản</h3>
            <p className="text-sm text-gray-600">Đảm bảo mật khẩu của bạn mạnh và an toàn</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock className="w-4 h-4 inline mr-2" />
              Mật khẩu hiện tại
            </label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                className="input pr-10"
                placeholder="Nhập mật khẩu hiện tại"
                required
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock className="w-4 h-4 inline mr-2" />
              Mật khẩu mới
            </label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className="input pr-10"
                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                required
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {formData.newPassword && (
              <div className="mt-2">
                <div className="flex items-center space-x-2 text-xs">
                  <div className={`h-1 flex-1 rounded ${formData.newPassword.length >= 6 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </div>
                <p className={`text-xs mt-1 ${formData.newPassword.length >= 6 ? 'text-green-600' : 'text-red-600'}`}>
                  {formData.newPassword.length >= 6 ? 'Mật khẩu đủ mạnh' : 'Mật khẩu quá yếu'}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock className="w-4 h-4 inline mr-2" />
              Xác nhận mật khẩu mới
            </label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="input pr-10"
                placeholder="Nhập lại mật khẩu mới"
                required
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {formData.confirmPassword && (
              <p className={`text-xs mt-1 ${formData.newPassword === formData.confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                {formData.newPassword === formData.confirmPassword ? 'Mật khẩu khớp' : 'Mật khẩu không khớp'}
              </p>
            )}
          </div>

          {/* Security Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Mẹo bảo mật:</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Sử dụng ít nhất 6 ký tự</li>
              <li>• Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt</li>
              <li>• Không sử dụng thông tin cá nhân dễ đoán</li>
              <li>• Không sử dụng mật khẩu đã dùng ở nơi khác</li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex items-center space-x-4 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/forms')}
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

