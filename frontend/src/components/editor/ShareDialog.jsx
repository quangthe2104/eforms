import { useEffect, useState } from 'react'
import { X, Link2 } from 'lucide-react'
import { collaboratorAPI } from '../../services/api'
import { UserAvatar } from '../UserMenu'

const ROLE_LABELS = { owner: 'Chủ sở hữu', editor: 'Người chỉnh sửa', viewer: 'Người xem' }

/** Read-only first version of the share dialog: who has access. Inviting and role changes arrive in phase 6. */
export default function ShareDialog({ formId, onClose, onCopyLink }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    collaboratorAPI.list(formId).then((res) => setData(res.data)).catch(() => setError(true))
  }, [formId])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="share-title" data-share-dialog className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 id="share-title" className="text-lg font-medium text-gray-900">Chia sẻ</h2>
          <button type="button" aria-label="Đóng" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 pb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Những người có quyền truy cập</h3>
          {error && <p className="text-sm text-red-600">Không tải được danh sách.</p>}
          {!data && !error && <div className="spinner mx-auto my-4" />}
          <ul className="space-y-3 max-h-72 overflow-y-auto">
            {data?.collaborators?.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <UserAvatar user={c} size="w-8 h-8" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{c.name}{c.is_me && <span className="text-gray-500"> (bạn)</span>}</p>
                  <p className="text-xs text-gray-500 truncate">{c.email}</p>
                </div>
                <span className="text-sm text-gray-600">{ROLE_LABELS[c.role] || c.role}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-gray-500">Thêm người và đổi vai trò sẽ có trong bản cập nhật tới.</p>
        </div>
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onCopyLink} className="flex items-center gap-2 text-sm font-medium text-primary-700 hover:bg-primary-50 px-3 py-2 rounded-md">
            <Link2 className="w-4 h-4" /> Sao chép đường liên kết của người trả lời
          </button>
          <button type="button" onClick={onClose} className="btn btn-primary">Xong</button>
        </div>
      </div>
    </div>
  )
}
