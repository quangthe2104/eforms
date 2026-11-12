import Tooltip from './Tooltip'

const COLORS = ['#1a73e8', '#d93025', '#188038', '#e37400', '#9334e6', '#00897b', '#c2185b', '#5f6368']

export const presenceColor = (userId) => COLORS[Math.abs(Number(userId) || 0) % COLORS.length]

/** People currently viewing the form; filled by live sync in phase 5 (`users`: [{user_id, name}]). */
export default function PresenceAvatars({ users = [] }) {
  return (
    <div data-hdr="presence" className="hidden md:flex items-center -space-x-1.5">
      {users.map((u) => (
        <Tooltip key={u.user_id} label={u.name}>
          <span
            className="w-8 h-8 rounded-full border-2 border-white text-white text-sm font-medium flex items-center justify-center"
            style={{ backgroundColor: presenceColor(u.user_id) }}
            aria-label={u.name}
          >
            {u.name?.charAt(0)?.toUpperCase() || '?'}
          </span>
        </Tooltip>
      ))}
    </div>
  )
}
