import { AlertCircle, Cloud, CloudOff, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import Tooltip from './Tooltip'

/** Autosave state next to the title (plan §4.4). `state` comes from services/autosave.js. */
export default function SaveIndicator({ state, onRetry }) {
  const { status, savedAt } = state || {}
  let Icon = Cloud
  let text = ''
  let tip = 'Mọi thay đổi đã được lưu'
  let spin = false

  if (status === 'saving' || status === 'dirty') {
    Icon = Loader2
    spin = true
    text = 'Đang lưu…'
    tip = text
  } else if (status === 'paused') {
    Icon = CloudOff
    text = 'Có thay đổi chưa lưu'
    tip = 'Thay đổi ảnh hưởng tới câu trả lời đã thu đang chờ bạn xác nhận'
  } else if (status === 'error') {
    Icon = AlertCircle
    text = 'Không lưu được – Thử lại'
    tip = state.error === 'rejected'
      ? 'Một số thay đổi không hợp lệ. Sửa lại hoặc bấm để thử lại'
      : state.error === 'forbidden'
        ? 'Bạn không có quyền sửa biểu mẫu này'
        : 'Mất kết nối. Đang tự thử lại – bấm để thử ngay'
  } else if (savedAt) {
    text = `Đã lưu lúc ${format(savedAt, 'HH:mm')}`
    tip = `Đã lưu lúc ${format(savedAt, 'HH:mm:ss dd/MM/yyyy')}`
  }

  const dataState = status === 'dirty' ? 'pending' : status || 'saved'
  const className = `flex items-center gap-1 text-xs whitespace-nowrap rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
    status === 'error' ? 'text-red-600 hover:underline' : 'text-gray-500'
  }`
  const content = (
    <>
      <Icon className={`w-4 h-4 ${spin ? 'animate-spin' : ''}`} />
      {text && <span className="hidden lg:inline">{text}</span>}
    </>
  )

  return (
    <Tooltip label={tip}>
      {status === 'error' ? (
        <button type="button" data-hdr="save-indicator" data-state={dataState} aria-label={`${text}. ${tip}`} className={className} onClick={onRetry}>
          {content}
        </button>
      ) : (
        <span data-hdr="save-indicator" data-state={dataState} tabIndex={0} aria-label={text || tip} className={className}>
          {content}
        </span>
      )}
    </Tooltip>
  )
}
