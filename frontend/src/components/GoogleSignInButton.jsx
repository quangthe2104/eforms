import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

// GoogleLogin needs the GoogleOAuthProvider that main.jsx only mounts when this is set.
export const googleEnabled = !!import.meta.env.VITE_GOOGLE_CLIENT_ID

/** "hoặc" divider + Google button under the email form. `redirectTo`: where to go after signing in. */
export default function GoogleSignInButton({ redirectTo = '/forms', text = 'signin_with' }) {
  const googleLogin = useAuthStore((s) => s.googleLogin)
  const navigate = useNavigate()
  const containerRef = useRef(null)
  // GIS renders a fixed-width iframe (200–400 px), so size it to the container once.
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (containerRef.current) setWidth(Math.min(400, Math.max(200, containerRef.current.offsetWidth)))
  }, [])

  if (!googleEnabled) return null

  const handleSuccess = async ({ credential }) => {
    if (!credential) {
      toast.error('Không nhận được thông tin đăng nhập từ Google')
      return
    }
    const result = await googleLogin(credential)
    if (result.success) {
      toast.success('Đăng nhập thành công!')
      navigate(redirectTo, { replace: true })
    } else {
      toast.error(result.error || 'Đăng nhập bằng Google thất bại')
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-6" aria-hidden="true">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-sm text-gray-500">hoặc</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      <div ref={containerRef} className="flex justify-center" data-google-signin>
        {width > 0 && (
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => toast.error('Không mở được cửa sổ đăng nhập Google. Kiểm tra trình chặn popup rồi thử lại.')}
            text={text}
            locale="vi"
            width={String(width)}
          />
        )}
      </div>
    </div>
  )
}
