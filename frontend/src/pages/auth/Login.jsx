import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import { Mail, Lock, Loader } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, loading } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const result = await login({ email, password })
    
    if (result.success) {
      toast.success('Đăng nhập thành công!')
      navigate('/forms')
    } else {
      toast.error(result.error || 'Đăng nhập thất bại')
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Chào mừng trở lại</h2>
      <p className="text-gray-600 mb-8">Đăng nhập vào tài khoản của bạn để tiếp tục</p>

      <form onSubmit={handleSubmit} className="space-y-6">
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
              <span>Đang đăng nhập...</span>
            </>
          ) : (
            <span>Đăng nhập</span>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600 mt-6">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
          Đăng ký
        </Link>
      </p>
    </div>
  )
}

