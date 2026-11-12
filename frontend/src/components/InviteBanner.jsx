import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { invitationAPI } from '../services/api'
import { ROLE_LABELS } from '../utils/roles'

/** Reason of an unusable invite link: "invalid" (404), "expired" | "used" (410), "busy" (429), "error" (other). */
export const inviteErrorReason = (error) => {
  const status = error?.response?.status
  if (status === 404) return 'invalid'
  if (status === 410) return error.response.data?.reason || 'expired'
  if (status === 429) return 'busy'
  return 'error'
}

// The link info is throttled (30/min): Invite → Login/Register → Invite (and StrictMode) reuse one request.
const CACHE_MS = 60 * 1000
const cache = new Map()
const loadInvitation = (token) => {
  const hit = cache.get(token)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise
  const promise = invitationAPI.show(token).then((res) => res.data)
  promise.catch(() => cache.delete(token))
  cache.set(token, { at: Date.now(), promise })
  return promise
}

/** `GET /invitations/{token}` (public): `{info, reason}`; both null while loading or without a token. */
export function useInvitation(token) {
  const [state, setState] = useState({ info: null, reason: null })
  useEffect(() => {
    if (!token) return
    let cancelled = false
    setState({ info: null, reason: null })
    loadInvitation(token)
      .then((info) => !cancelled && setState({ info, reason: null }))
      .catch((error) => !cancelled && setState({ info: null, reason: inviteErrorReason(error) }))
    return () => { cancelled = true }
  }, [token])
  return state
}

/** "<inviter> mời bạn tham gia “<form>” với vai trò <role>." */
export default function InviteBanner({ info }) {
  if (!info) return null
  return (
    <div data-invite-banner className="mb-6 flex items-start gap-3 rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-900">
      <UserPlus className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary-600" />
      <p>
        {info.inviter?.name ? <strong>{info.inviter.name}</strong> : 'Bạn'}
        {info.inviter?.name ? ' mời bạn' : ' được mời'} tham gia biểu mẫu <strong>“{info.form?.title}”</strong> với vai trò{' '}
        <strong>{ROLE_LABELS[info.role] || info.role}</strong>.
      </p>
    </div>
  )
}
