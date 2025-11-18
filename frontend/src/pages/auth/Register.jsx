import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import { Mail, Lock, User as UserIcon, Loader } from 'lucide-react'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const { register, loading } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (password !== passwordConfirmation) {
      toast.error('Mật khẩu không khớp')
      return
    }

    const result = await register({
      name,
      email,
      password,
      password_confirmation: passwordConfirmation,
    })
    
    if (result.success) {
      toast.success('Đăng ký thành công!')
      navigate('/dashboard')
    } else {
      toast.error(result.error || 'Đăng ký thất bại')
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Tạo tài khoản</h2>
      <p className="text-gray-600 mb-8">Bắt đầu với eForms ngay hôm nay</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="form-label">Họ và Tên</label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input pl-10"
              placeholder="Nguyễn Văn A"
              required
            />
          </div>
        </div>

        <div>
          <label className="form-label">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input pl-10"
              placeholder="email@cua-ban.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="form-label">Mật khẩu</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pl-10"
              placeholder="••••••••"
              minLength={8}
              required
            />
          </div>
        </div>

        <div>
          <label className="form-label">Xác nhận mật khẩu</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              className="input pl-10"
              placeholder="••••••••"
              minLength={8}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full btn btn-primary flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              <span>Đang tạo tài khoản...</span>
            </>
          ) : (
            <span>Tạo tài khoản</span>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600 mt-6">
        Đã có tài khoản?{' '}
        <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
          Đăng nhập
        </Link>
      </p>
    </div>
  )
}

