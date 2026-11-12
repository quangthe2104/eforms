import { AlertTriangle } from 'lucide-react'

/** Paused destructive changes on a form with responses (plan §4.6). */
export default function DestructiveBanner({ count, changes, onApprove, onRevert }) {
  const shown = changes.slice(0, 3).join('; ')
  const more = changes.length > 3 ? ` và ${changes.length - 3} thay đổi khác` : ''
  return (
    <div data-destructive-banner role="alert" className="sticky top-28 z-40 bg-amber-50 border-b border-amber-200">
      <div className="max-w-5xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-amber-900">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
        <span className="flex-1 min-w-[12rem]">
          Thay đổi này ảnh hưởng tới {count} câu trả lời đã thu: {shown}{more}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" data-banner="approve" onClick={onApprove} className="px-3 py-1 rounded-md bg-amber-600 text-white font-medium hover:bg-amber-700">
            Vẫn lưu
          </button>
          <button type="button" data-banner="revert" onClick={onRevert} className="px-3 py-1 rounded-md border border-amber-300 font-medium hover:bg-amber-100">
            Hoàn tác
          </button>
        </div>
      </div>
    </div>
  )
}
