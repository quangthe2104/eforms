import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Key, User } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import useDismiss from './editor/useDismiss'

export function UserAvatar({ user, size = 'w-9 h-9' }) {
  return user?.avatar ? (
    <img src={user.avatar} alt={user?.name} className={`${size} rounded-full object-cover flex-shrink-0`} />
  ) : (
    <div className={`${size} rounded-full bg-primary-600 text-white flex items-center justify-center font-medium text-sm flex-shrink-0`}>
      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
    </div>
  )
}

/** Account menu items, shared by the avatar dropdown and the editor's mobile ⋮ menu. */
export function useAccountActions() {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  return [
    { key: 'profile', label: 'Thông tin cá nhân', icon: User, onSelect: () => navigate('/profile') },
    { key: 'password', label: 'Đổi mật khẩu', icon: Key, onSelect: () => navigate('/change-password') },
    { key: 'logout', label: 'Đăng xuất', icon: LogOut, danger: true, onSelect: async () => { await logout(); navigate('/login') } },
  ]
}

export default function UserMenu({ className = '', hdr }) {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const actions = useAccountActions()

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        data-hdr={hdr}
        aria-label={`Tài khoản: ${user?.name || ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded-full hover:bg-gray-100 transition-colors"
      >
        <UserAvatar user={user} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[60]">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center space-x-3">
            <UserAvatar user={user} size="w-10 h-10" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                <span className="text-gray-500">Xin chào </span>{user?.name}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="py-1">
            {actions.map((a) => (
              <div key={a.key}>
                {a.danger && <div className="border-t border-gray-200 my-1" />}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { close(); a.onSelect() }}
                  className={`w-full flex items-center space-x-3 px-4 py-2 text-sm transition-colors ${a.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <a.icon className="w-4 h-4" />
                  <span>{a.label}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
