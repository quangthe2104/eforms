import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertCircle, LogOut } from 'lucide-react'
import { invitationAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import InviteBanner, { inviteErrorReason, useInvitation } from '../components/InviteBanner'

const ERRORS = {
  invalid: ['Lời mời không hợp lệ', 'Lời mời không hợp lệ hoặc đã bị hủy. Hãy nhờ người mời gửi lại lời mời.'],
  expired: ['Lời mời đã hết hạn', 'Lời mời chỉ có hiệu lực 7 ngày. Hãy nhờ người mời gửi lại lời mời.'],
  used: ['Lời mời đã được sử dụng', 'Mỗi lời mời chỉ dùng được một lần. Nếu bạn đã nhận lời mời, hãy mở biểu mẫu từ danh sách biểu mẫu.'],
  busy: ['Thử lại sau ít phút', 'Có quá nhiều lần mở lời mời trong thời gian ngắn. Hãy đợi một phút rồi tải lại trang.'],
  error: ['Không mở được lời mời', 'Đã có lỗi khi tải lời mời. Hãy thử tải lại trang.'],
}

const lower = (s) => (s || '').toLowerCase()

/**
 * /invite/:token (plan §4.8): signed in with the invited email → accept and open the form;
 * other account → ask to sign out; signed out → Register (new email) or Login (existing account).
 */
export default function Invite() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuthStore()
  const { info, reason: loadReason } = useInvitation(token)
  const [acceptReason, setAcceptReason] = useState(null)
  const [wrongEmail, setWrongEmail] = useState(null)
  const acceptingRef = useRef(false)
  const reason = loadReason || acceptReason

  useEffect(() => {
    if (!info) return
    if (!isAuthenticated) {
      const t = encodeURIComponent(token)
      navigate(info.has_account ? `/login?invite=${t}&email=${encodeURIComponent(info.email)}` : `/register?invite=${t}`, { replace: true })
      return
    }
    if (lower(user?.email) !== lower(info.email)) {
      setWrongEmail(info.email)
      return
    }
    if (acceptingRef.current) return
    acceptingRef.current = true
    invitationAPI.accept(token)
      .then((res) => {
        toast.success('Đã nhận lời mời')
        navigate(`/forms/${res.data.form_id}/edit`, { replace: true })
      })
      .catch((error) => {
        acceptingRef.current = false
        const status = error.response?.status
        if (status === 401) logout()
        else if (status === 403 && error.response.data?.reason === 'wrong_email') setWrongEmail(error.response.data.email || info.email)
        else setAcceptReason(inviteErrorReason(error))
      })
  }, [info, isAuthenticated, user?.email, token])

  if (reason) {
    const [heading, text] = ERRORS[reason] || ERRORS.error
    return (
      <div data-invite-error={reason} className="text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">{heading}</h2>
        <p className="text-gray-600 mb-6">{text}</p>
        <Link to={isAuthenticated ? '/forms' : '/login'} className="btn btn-primary inline-block">
          {isAuthenticated ? 'Về danh sách biểu mẫu' : 'Đăng nhập'}
        </Link>
      </div>
    )
  }

  if (wrongEmail) {
    return (
      <div data-invite-wrong className="text-center">
        <InviteBanner info={info} />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Lời mời gửi tới {wrongEmail}</h2>
        <p className="text-gray-600 mb-6">
          Bạn đang đăng nhập bằng <strong>{user?.email}</strong>. Hãy đăng xuất rồi đăng nhập (hoặc đăng ký) bằng {wrongEmail} để nhận lời mời.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button type="button" data-invite-logout onClick={() => { setWrongEmail(null); logout() }} className="btn btn-primary flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
          <Link to="/forms" className="btn btn-secondary">Về danh sách biểu mẫu</Link>
        </div>
      </div>
    )
  }

  return (
    <div data-invite-loading className="text-center py-6">
      <div className="spinner mx-auto mb-4" />
      <p className="text-gray-600">Đang mở lời mời…</p>
    </div>
  )
}
