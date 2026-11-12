import Tooltip from './Tooltip'

const COLORS = ['#1a73e8', '#d93025', '#188038', '#e37400', '#9334e6', '#00897b', '#c2185b', '#5f6368']
const MAX_SHOWN = 5

export const presenceColor = (userId) => COLORS[Math.abs(Number(userId) || 0) % COLORS.length]

const initials = (name) => {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  const first = words[0].charAt(0)
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : ''
  return (first + last).toUpperCase()
}

/** Other people who have the form open (`users`: [{user_id, name}], one entry per user, without me). */
export default function PresenceAvatars({ users = [] }) {
  const shown = users.slice(0, MAX_SHOWN)
  const rest = users.slice(MAX_SHOWN)
  return (
    <div data-hdr="presence" className="hidden md:flex items-center -space-x-1.5">
      {shown.map((u) => (
        <Tooltip key={u.user_id} label={u.name}>
          <span
            data-presence-user={u.user_id}
            className="w-8 h-8 rounded-full border-2 border-white text-white text-xs font-medium flex items-center justify-center"
            style={{ backgroundColor: presenceColor(u.user_id) }}
            aria-label={u.name}
            role="img"
          >
            {initials(u.name)}
          </span>
        </Tooltip>
      ))}
      {rest.length > 0 && (
        <Tooltip label={rest.map((u) => u.name).join(', ')}>
          <span
            className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 text-gray-700 text-xs font-medium flex items-center justify-center"
            aria-label={`${rest.length} người khác`}
            role="img"
          >
            +{rest.length}
          </span>
        </Tooltip>
      )}
    </div>
  )
}
