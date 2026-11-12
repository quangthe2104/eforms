import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import { Mail, Lock, User as UserIcon, Loader } from 'lucide-react'
import InviteBanner, { useInvitation } from '../../components/InviteBanner'
import GoogleSignInButton from '../../components/GoogleSignInButton'

export default function Register() {
  const [searchParams] = useSearchParams()
  const invite = searchParams.get('invite')
  const { info, reason } = useInvitation(invite)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const { register, loading } = useAuthStore()
  const navigate = useNavigate()
  // Invited: the email is the invitation's and cannot be changed (the server checks it matches).
  const emailLocked = !!invite

  useEffect(() => {
    if (!invite) return
    const t = encodeURIComponent(invite)
    // Unusable link: the invite page explains why. Existing account: sign in instead.
    if (reason) navigate(`/invite/${t}`, { replace: true })
    else if (info?.has_account) navigate(`/login?invite=${t}&email=${encodeURIComponent(info.email)}`, { replace: true })
    else if (info) setEmail(info.email)
  }, [invite, info, reason])

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
      ...(invite && { invite_token: invite }),
    })
    
    if (result.success) {
      const formId = result.data?.form_id
      toast.success(formId ? 'Đăng ký thành công! Đã nhận lời mời.' : 'Đăng ký thành công!')
      if (formId) navigate(`/forms/${formId}/edit`, { replace: true })
      else navigate(invite ? `/invite/${encodeURIComponent(invite)}` : '/forms', { replace: true })
    } else {
      toast.error(result.error || 'Đăng ký thất bại')
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Tạo tài khoản</h2>
      <p className="text-gray-600 mb-8">
        {invite ? 'Tạo tài khoản để nhận lời mời' : 'Bắt đầu với eForms ngay hôm nay'}
      </p>
      <InviteBanner info={info} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="form-label" htmlFor="register-name">Họ và Tên</label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="register-name"
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
          <label className="form-label" htmlFor="register-email">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => !emailLocked && setEmail(e.target.value)}
              readOnly={emailLocked}
              aria-describedby={emailLocked ? 'register-email-locked' : undefined}
              data-invite-email={emailLocked || undefined}
              className={`input pl-10 ${emailLocked ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''}`}
              placeholder="Nhập email của bạn"
              required
            />
            {emailLocked && <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />}
          </div>
          {emailLocked && (
            <p id="register-email-locked" className="mt-1 text-xs text-gray-500">Email của lời mời, không đổi được.</p>
          )}
        </div>

        <div>
          <label className="form-label" htmlFor="register-password">Mật khẩu</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="register-password"
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
          <label className="form-label" htmlFor="register-password-confirmation">Xác nhận mật khẩu</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="register-password-confirmation"
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
          disabled={loading || (emailLocked && !info)}
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

      <GoogleSignInButton redirectTo={invite ? `/invite/${encodeURIComponent(invite)}` : '/forms'} text="signup_with" />

      <p className="text-center text-sm text-gray-600 mt-6">
        Đã có tài khoản?{' '}
        <Link to={invite ? `/login?invite=${encodeURIComponent(invite)}` : '/login'} className="text-primary-600 hover:text-primary-700 font-medium">
          Đăng nhập
        </Link>
      </p>
    </div>
  )
}

