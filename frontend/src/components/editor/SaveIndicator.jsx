import { Cloud, CloudOff, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import Tooltip from './Tooltip'

/**
 * Save state next to the title. Phase 3 feeds it from the explicit save;
 * autosave (phase 4) will add the "paused" and "error/retry" states.
 */
export default function SaveIndicator({ saving, dirty, savedAt }) {
  let Icon = Cloud
  let text = ''
  let tip = 'Mọi thay đổi đã được lưu'
  if (saving) {
    Icon = Loader2
    text = 'Đang lưu…'
    tip = text
  } else if (dirty) {
    Icon = CloudOff
    text = 'Có thay đổi chưa lưu'
    tip = text
  } else if (savedAt) {
    text = `Đã lưu lúc ${format(savedAt, 'HH:mm')}`
    tip = `Đã lưu lúc ${format(savedAt, 'HH:mm:ss dd/MM/yyyy')}`
  }

  return (
    <Tooltip label={tip}>
      <span
        data-hdr="save-indicator"
        data-state={saving ? 'saving' : dirty ? 'dirty' : 'saved'}
        tabIndex={0}
        aria-label={tip}
        className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <Icon className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
        {text && <span className="hidden lg:inline">{text}</span>}
      </span>
    </Tooltip>
  )
}
