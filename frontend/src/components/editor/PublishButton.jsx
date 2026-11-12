import { useCallback, useRef, useState } from 'react'
import { Link2, EyeOff } from 'lucide-react'
import useDismiss from './useDismiss'

/** "Xuất bản" for drafts; "Đã xuất bản" opens a popover to stop/resume responses, copy the link or unpublish. */
export default function PublishButton({ status, busy, onChangeStatus, onCopyLink }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const buttonRef = useRef(null)
  const close = useCallback((reason) => {
    setOpen(false)
    if (reason === 'escape') buttonRef.current?.focus()
  }, [])
  useDismiss(ref, open, close)

  if (status === 'draft' || !status) {
    return (
      <button
        type="button"
        data-hdr="publish"
        disabled={busy}
        onClick={() => onChangeStatus('published')}
        className="px-3 md:px-5 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      >
        Xuất bản
      </button>
    )
  }

  const accepting = status === 'published'
  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        data-hdr="publish"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="px-3 md:px-4 py-2 rounded-md border border-gray-300 text-primary-700 text-sm font-medium hover:bg-primary-50 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        Đã xuất bản
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Tùy chọn xuất bản"
          data-publish-popover
          className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1rem)] bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-[60] space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <span id="accept-responses-label" className="text-sm font-medium text-gray-900">Nhận câu trả lời</span>
            <button
              type="button"
              role="switch"
              aria-checked={accepting}
              aria-labelledby="accept-responses-label"
              disabled={busy}
              onClick={() => onChangeStatus(accepting ? 'closed' : 'published')}
              className={`relative w-10 h-6 rounded-full transition-colors disabled:opacity-60 ${accepting ? 'bg-primary-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${accepting ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {accepting ? 'Người có đường liên kết có thể gửi câu trả lời.' : 'Biểu mẫu hiện không nhận câu trả lời mới.'}
          </p>
          <div className="border-t border-gray-100 pt-3 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => { onCopyLink(); close() }}
              className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 rounded hover:bg-gray-100"
            >
              <Link2 className="w-4 h-4" /> Sao chép liên kết
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => { onChangeStatus('draft'); close() }}
              className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 rounded hover:bg-gray-100 disabled:opacity-60"
            >
              <EyeOff className="w-4 h-4" /> Hủy xuất bản
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
