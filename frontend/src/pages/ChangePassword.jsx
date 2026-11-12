import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { authAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'

const MIN_LENGTH = 8

export default function ChangePassword() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()
  // Google-only accounts have no password yet: this page sets the first one.
  const settingFirst = user?.has_password === false
  const [errors, setErrors] = useState({})
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
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }))
  }

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const validatePassword = (password) => {
    // Kiểm tra độ dài tối thiểu
    if (password.length < MIN_LENGTH) {
      return `Mật khẩu phải có ít nhất ${MIN_LENGTH} ký tự`
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate
    if (!settingFirst && !formData.currentPassword) {
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

    if (!settingFirst && formData.currentPassword === formData.newPassword) {
      toast.error('Mật khẩu mới phải khác mật khẩu hiện tại')
      return
    }

    setLoading(true)
    setErrors({})

    try {
      await authAPI.changePassword({
        ...(!settingFirst && { current_password: formData.currentPassword }),
        password: formData.newPassword,
        password_confirmation: formData.confirmPassword,
      })
      updateUser({ has_password: true })
      toast.success(settingFirst ? 'Đặt mật khẩu thành công!' : 'Đổi mật khẩu thành công!')
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      navigate('/forms')
    } catch (error) {
      const data = error.response?.data
      const fieldErrors = data?.errors || {}
      setErrors({
        currentPassword: fieldErrors.current_password?.[0],
        newPassword: fieldErrors.password?.[0],
      })
      toast.error(
        fieldErrors.current_password?.[0] || fieldErrors.password?.[0] || data?.message ||
          (settingFirst ? 'Có lỗi xảy ra khi đặt mật khẩu' : 'Có lỗi xảy ra khi đổi mật khẩu')
      )
    } finally {
      setLoading(false)
    }
  }

  const title = settingFirst ? 'Đặt mật khẩu' : 'Đổi mật khẩu'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-600 mt-1">
          {settingFirst
            ? 'Tài khoản của bạn đang đăng nhập bằng Google. Đặt mật khẩu để có thể đăng nhập bằng email.'
            : 'Cập nhật mật khẩu để bảo mật tài khoản của bạn'}
        </p>
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
          {!settingFirst && (
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
                aria-invalid={!!errors.currentPassword || undefined}
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
            {errors.currentPassword && <p className="text-xs mt-1 text-red-600">{errors.currentPassword}</p>}
          </div>
          )}

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock className="w-4 h-4 inline mr-2" />
              {settingFirst ? 'Mật khẩu' : 'Mật khẩu mới'}
            </label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className="input pr-10"
                placeholder={`Nhập mật khẩu mới (tối thiểu ${MIN_LENGTH} ký tự)`}
                aria-invalid={!!errors.newPassword || undefined}
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
                  <div className={`h-1 flex-1 rounded ${formData.newPassword.length >= MIN_LENGTH ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </div>
                <p className={`text-xs mt-1 ${formData.newPassword.length >= MIN_LENGTH ? 'text-green-600' : 'text-red-600'}`}>
                  {formData.newPassword.length >= MIN_LENGTH ? 'Mật khẩu đủ mạnh' : 'Mật khẩu quá yếu'}
                </p>
              </div>
            )}
            {errors.newPassword && <p className="text-xs mt-1 text-red-600">{errors.newPassword}</p>}
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
              <li>• Sử dụng ít nhất {MIN_LENGTH} ký tự</li>
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
              {loading ? 'Đang cập nhật...' : title}
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

