import { useCallback, useEffect, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { X, Link2, Lock, Globe, Mail, Copy, Send, Trash2 } from 'lucide-react'
import { collaboratorAPI, userAPI } from '../../services/api'
import { useFormStore } from '../../store/formStore'
import { UserAvatar } from '../UserMenu'
import Tooltip from './Tooltip'
import { ROLES, ROLE_LABELS, canShare, canManageOwners } from '../../utils/roles'
import { copyText } from '../../utils/clipboard'
import { limitForcesLogin, FORCED_LOGIN_HINT } from '../../utils/respondentAccess'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_QUERY = 3
const MAX_SUGGESTIONS = 8
const SEARCH_DELAY = 250
const REMOVE = 'remove'
const NO_MAIL = 'Chưa cấu hình email – hãy sao chép link mời để gửi'
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

const errorMessage = (error, fallback) => {
  const data = error?.response?.data
  return Object.values(data?.errors || {})[0]?.[0] || data?.message || fallback
}
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '')
const lower = (s) => (s || '').toLowerCase()

/** Keeps Tab inside the dialog, closes on Escape (unless a child handled it) and gives focus back on close. */
function useDialogFocus(ref, onEscape) {
  const escapeRef = useRef(onEscape)
  escapeRef.current = onEscape
  useEffect(() => {
    const opener = document.activeElement
    const node = ref.current
    const focusables = () => [...node.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && el.offsetParent !== null)
    ;(node.querySelector('[data-autofocus]') || focusables()[0] || node).focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (!e.defaultPrevented) {
          e.preventDefault()
          escapeRef.current()
        }
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (!node.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener?.isConnected) opener.focus()
    }
  }, [])
}

function IconAction({ label, icon: Icon, onClick, disabled, ...rest }) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className="p-2 rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
        {...rest}
      >
        <Icon className="w-4 h-4" />
      </button>
    </Tooltip>
  )
}

/** "Thêm người theo tên hoặc email": suggestions from 3 characters, chips, role, notify + message. */
function AddPeople({ formId, myRole, collaborators, mailEnabled, onDone, onError }) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [recipients, setRecipients] = useState([])
  const [role, setRole] = useState('editor')
  const [notify, setNotify] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef(null)

  const q = query.trim()
  useEffect(() => {
    if (q.length < MIN_QUERY) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      userAPI.search(q, formId)
        .then((res) => !cancelled && setSuggestions(res.data.users || []))
        .catch(() => !cancelled && setSuggestions([]))
    }, SEARCH_DELAY)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [q, formId])

  const taken = new Set([...collaborators.map((c) => lower(c.email)), ...recipients.map((r) => lower(r.email))])
  const users = suggestions.filter((u) => !taken.has(lower(u.email))).slice(0, MAX_SUGGESTIONS)
  const isEmail = EMAIL_RE.test(q)
  const hasAccess = isEmail && collaborators.some((c) => lower(c.email) === lower(q))
  const chosen = isEmail && recipients.some((r) => lower(r.email) === lower(q))
  const options = [
    ...users.map((u) => ({ id: `u${u.id}`, user: u })),
    ...(isEmail && !hasAccess && !chosen && !users.some((u) => lower(u.email) === lower(q)) ? [{ id: 'invite', email: q }] : []),
  ]
  const listOpen = open && q.length >= MIN_QUERY
  const activeIndex = Math.min(active, options.length - 1)

  const choose = (option) => {
    if (!option) return
    const r = option.user ? { key: option.id, user_id: option.user.id, name: option.user.name, email: option.user.email } : { key: `e:${lower(option.email)}`, email: option.email }
    setRecipients((prev) => [...prev, r])
    setQuery('')
    setSuggestions([])
    setActive(0)
    inputRef.current?.focus()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!options.length) return
      e.preventDefault()
      setOpen(true)
      setActive((i) => (Math.max(0, Math.min(i, options.length - 1)) + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (options.length) choose(options[Math.max(0, activeIndex)])
    } else if (e.key === 'Escape' && listOpen) {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'Backspace' && !query && recipients.length) {
      setRecipients((prev) => prev.slice(0, -1))
    }
  }

  const send = async () => {
    setSending(true)
    onError(null)
    const links = []
    const failed = []
    const errors = []
    let added = 0
    let unsentNotice = false
    for (const r of recipients) {
      try {
        const { data } = await collaboratorAPI.add(formId, {
          ...(r.user_id ? { user_id: r.user_id } : { email: r.email }),
          role,
          notify,
          ...(notify && message.trim() && { message: message.trim() }),
        })
        if (data.type === 'invitation') {
          links.push({ email: data.invitation.email, url: data.invite_url, emailSent: !!data.email_sent })
        } else {
          added++
          if (notify && !data.email_sent) unsentNotice = true
        }
      } catch (error) {
        failed.push(r)
        errors.push(`${r.email}: ${errorMessage(error, 'Không thể chia sẻ')}`)
      }
    }
    setSending(false)
    setRecipients(failed)
    if (!failed.length) setMessage('')
    if (added) toast.success(`Đã chia sẻ với ${added} người${unsentNotice ? ' (chưa cấu hình email nên không gửi thông báo)' : ''}`)
    if (links.length) toast.success(links.length === 1 ? 'Đã tạo lời mời' : `Đã tạo ${links.length} lời mời`)
    if (errors.length) onError(errors.join('\n'))
    onDone(links)
  }

  const roleChoices = ROLES.filter((r) => r !== 'owner' || canManageOwners(myRole))

  return (
    <div className="space-y-3" data-share-add>
      <div className="relative">
        <label htmlFor={`${listId}-input`} className="sr-only">Thêm người theo tên hoặc email</label>
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md focus-within:border-primary-600 focus-within:ring-1 focus-within:ring-primary-600">
          {recipients.map((r) => (
            <span key={r.key} data-recipient={r.email} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-gray-100 text-sm text-gray-800">
              {r.name ? `${r.name} ` : ''}<span className="text-gray-500">{r.name ? `<${r.email}>` : r.email}</span>
              <button type="button" aria-label={`Bỏ ${r.email}`} onClick={() => setRecipients((prev) => prev.filter((x) => x.key !== r.key))} className="p-0.5 rounded-full hover:bg-gray-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            id={`${listId}-input`}
            data-autofocus
            data-share-input
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls={listId}
            aria-activedescendant={listOpen && options[activeIndex] ? `${listId}-${options[activeIndex].id}` : undefined}
            autoComplete="off"
            value={query}
            placeholder={recipients.length ? '' : 'Thêm người theo tên hoặc email'}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
              setActive(0)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            className="flex-1 min-w-[12rem] py-1 text-sm outline-none bg-transparent"
          />
        </div>
        {listOpen && (
          <ul id={listId} role="listbox" aria-label="Gợi ý" data-share-suggestions className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-72 overflow-y-auto py-1">
            {options.map((option, i) => (
              <li
                key={option.id}
                id={`${listId}-${option.id}`}
                role="option"
                aria-selected={i === activeIndex}
                data-suggestion={option.user ? option.user.email : 'invite'}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(option)}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${i === activeIndex ? 'bg-gray-100' : ''}`}
              >
                {option.user ? (
                  <>
                    <UserAvatar user={option.user} size="w-8 h-8" />
                    <span className="min-w-0">
                      <span className="block text-sm text-gray-900 truncate">{option.user.name}</span>
                      <span className="block text-xs text-gray-500 truncate">{option.user.email}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"><Mail className="w-4 h-4 text-gray-600" /></span>
                    <span className="text-sm text-gray-900 truncate">Mời {option.email}</span>
                  </>
                )}
              </li>
            ))}
            {!options.length && (
              <li role="presentation" className="px-3 py-2 text-sm text-gray-500" data-suggestion-empty>
                {hasAccess ? 'Người này đã có quyền truy cập.' : chosen ? 'Đã thêm vào danh sách gửi.' : 'Không tìm thấy người dùng. Nhập đầy đủ email để mời.'}
              </li>
            )}
          </ul>
        )}
      </div>

      {recipients.length > 0 && (
        <div className="space-y-3 rounded-md bg-gray-50 p-3" data-share-compose>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-700" htmlFor={`${listId}-role`}>Vai trò</label>
            <select id={`${listId}-role`} data-share-role value={role} onChange={(e) => setRole(e.target.value)} className="input py-1.5 w-auto text-sm">
              {roleChoices.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" data-share-notify checked={notify} onChange={(e) => setNotify(e.target.checked)} className="w-4 h-4" />
              Gửi email thông báo
            </label>
          </div>
          {notify && (
            <textarea
              aria-label="Lời nhắn"
              data-share-message
              rows={2}
              value={message}
              maxLength={1000}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Lời nhắn (không bắt buộc)"
              className="input text-sm"
            />
          )}
          {notify && !mailEnabled && (
            <p className="text-xs text-amber-700" data-no-mail>{NO_MAIL}. Người đã có tài khoản vẫn được thêm quyền ngay.</p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary text-sm" onClick={() => setRecipients([])} disabled={sending}>Hủy</button>
            <button type="button" data-share-send className="btn btn-primary text-sm flex items-center gap-1.5" onClick={send} disabled={sending}>
              <Send className="w-4 h-4" /> {sending ? 'Đang gửi…' : 'Gửi'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Role select of one person, locked per the permission table (plan §4.8); the server has the final say. */
function RoleControl({ person, myRole, ownerCount, busy, onChange, onLeave }) {
  const label = ROLE_LABELS[person.role] || person.role
  if (!canShare(myRole)) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600" data-role-text>{label}</span>
        {person.is_me && (
          <button type="button" data-leave onClick={onLeave} disabled={busy} className="text-xs text-red-600 hover:underline">Rời khỏi</button>
        )}
      </div>
    )
  }
  if (person.role === 'owner' && !canManageOwners(myRole)) {
    return (
      <Tooltip label="Chỉ chủ sở hữu mới đổi được vai trò này">
        <span className="flex items-center gap-1 text-sm text-gray-600" data-role-text data-locked tabIndex={0}>
          <Lock className="w-3.5 h-3.5" /> {label}
        </span>
      </Tooltip>
    )
  }
  const lastOwner = person.role === 'owner' && ownerCount <= 1
  return (
    <div className="text-right">
      <select
        aria-label={`Vai trò của ${person.name}`}
        data-role-select
        value={person.role}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm text-gray-700 bg-transparent border border-transparent hover:border-gray-300 rounded px-1 py-1 focus:border-primary-600 focus:outline-none"
      >
        {ROLES.map((r) => (
          <option key={r} value={r} disabled={(r === 'owner' && !canManageOwners(myRole)) || (lastOwner && r !== 'owner')}>
            {ROLE_LABELS[r]}
          </option>
        ))}
        <option disabled>──────────</option>
        <option value={REMOVE} disabled={lastOwner}>{person.is_me ? 'Rời khỏi biểu mẫu' : 'Gỡ quyền truy cập'}</option>
      </select>
      {lastOwner && <p className="text-[11px] text-gray-500" data-last-owner>Phải còn ít nhất một chủ sở hữu</p>}
    </div>
  )
}

/** Share dialog like Google Forms (plan §4.8): people, pending invitations, general access. */
/** Outside the editor pass `form` + `onUpdateSettings`; otherwise the editor store (autosave) is used. */
export default function ShareDialog({ formId, title, role, form: formProp, onUpdateSettings, onClose, onCopyLink, onRoleChanged, onLeft }) {
  const dialogRef = useRef(null)
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [links, setLinks] = useState([])
  const storeForm = useFormStore((s) => s.currentForm)
  const storeUpdateSettings = useFormStore((s) => s.updateSettings)
  const form = formProp || storeForm
  const updateSettings = onUpdateSettings || storeUpdateSettings
  const roleRef = useRef(role)
  roleRef.current = role
  useDialogFocus(dialogRef, onClose)

  const load = useCallback(async () => {
    try {
      const res = await collaboratorAPI.list(formId)
      setData(res.data)
      setLoadError(false)
      if (res.data.my_role && res.data.my_role !== roleRef.current) onRoleChanged?.(res.data.my_role)
    } catch {
      setLoadError(true)
    }
  }, [formId])
  useEffect(() => { load() }, [load])

  const myRole = data?.my_role || role
  const sharing = canShare(myRole)
  const collaborators = data?.collaborators || []
  const invitations = sharing ? data?.invitations || [] : []
  const ownerCount = collaborators.filter((c) => c.role === 'owner').length
  const mailEnabled = !!data?.mail_enabled

  const fail = (err, fallback) => {
    const message = errorMessage(err, fallback)
    setError(message)
    toast.error(message, { id: 'share-error' })
  }

  const addLinks = (next) => {
    if (next.length) setLinks((prev) => [...next, ...prev.filter((l) => !next.some((n) => lower(n.email) === lower(l.email)))])
  }

  const leave = async (person) => {
    if (!confirm('Bạn sẽ mất quyền truy cập biểu mẫu này. Rời khỏi biểu mẫu?')) return
    setBusyId(person.id)
    setError(null)
    try {
      await collaboratorAPI.remove(formId, person.id)
      toast.success('Bạn đã rời khỏi biểu mẫu')
      onLeft?.()
    } catch (err) {
      fail(err, 'Không thể rời khỏi biểu mẫu')
      setBusyId(null)
      load()
    }
  }

  const changeRole = async (person, next) => {
    if (next === person.role) return
    if (next === REMOVE && person.is_me) return leave(person)
    setBusyId(person.id)
    setError(null)
    try {
      if (next === REMOVE) {
        await collaboratorAPI.remove(formId, person.id)
        toast.success(`Đã gỡ quyền truy cập của ${person.name}`)
      } else {
        await collaboratorAPI.update(formId, person.id, next)
        if (person.is_me) onRoleChanged?.(next)
        toast.success(`${person.name}: ${ROLE_LABELS[next]}`)
      }
    } catch (err) {
      fail(err, 'Không thể đổi vai trò')
    }
    await load()
    setBusyId(null)
  }

  const renewInvitation = async (inv, send) => {
    setBusyId(`i${inv.id}`)
    setError(null)
    try {
      const { data: res } = await (send ? collaboratorAPI.resendInvitation : collaboratorAPI.invitationLink)(formId, inv.id)
      if (send && res.email_sent) {
        toast.success('Đã gửi lại lời mời')
      } else if (send) {
        addLinks([{ email: inv.email, url: res.invite_url, emailSent: false }])
        toast(`${NO_MAIL}. Đã tạo link mời mới.`, { id: 'invite-no-mail' })
      } else {
        addLinks([{ email: inv.email, url: res.invite_url, emailSent: false, copied: true }])
        await copyText(res.invite_url).catch(() => {})
        toast.success('Đã sao chép link mời mới. Link mời trước đó không còn dùng được.', { id: 'invite-copied' })
      }
    } catch (err) {
      fail(err, 'Không thể tạo link mời')
    }
    await load()
    setBusyId(null)
  }

  const cancelInvitation = async (inv) => {
    setBusyId(`i${inv.id}`)
    setError(null)
    try {
      await collaboratorAPI.cancelInvitation(formId, inv.id)
      setLinks((prev) => prev.filter((l) => lower(l.email) !== lower(inv.email)))
      toast.success('Đã hủy lời mời')
    } catch (err) {
      fail(err, 'Không thể hủy lời mời')
    }
    await load()
    setBusyId(null)
  }

  const copyInvite = (link) => copyText(link.url)
    .then(() => toast.success('Đã sao chép link mời', { id: 'invite-copied' }))
    .catch(() => toast.error('Không thể sao chép liên kết'))

  // General access for respondents: the same `require_login` the Settings tab edits (store → autosave).
  const forced = limitForcesLogin(form?.respondent_limit)
  const loginRequired = !!form?.require_login || forced
  const canEditForm = myRole !== 'viewer'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        tabIndex={-1}
        data-share-dialog
        data-my-role={myRole}
        className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col outline-none"
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
          <h2 id="share-title" className="text-lg font-medium text-gray-900 truncate">Chia sẻ “{title || 'Biểu mẫu không có tiêu đề'}”</h2>
          <button type="button" aria-label="Đóng" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-4 space-y-5 overflow-y-auto">
          {error && (
            <p role="alert" data-share-error className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 whitespace-pre-line">{error}</p>
          )}
          {!sharing && data && <p className="text-sm text-gray-500" data-share-readonly>Bạn chỉ có quyền xem danh sách người có quyền truy cập.</p>}

          {sharing && (
            <AddPeople
              formId={formId}
              myRole={myRole}
              collaborators={collaborators}
              mailEnabled={mailEnabled}
              onError={setError}
              onDone={(newLinks) => {
                addLinks(newLinks)
                load()
              }}
            />
          )}

          {links.length > 0 && (
            <section aria-label="Đường liên kết mời" data-invite-links className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
              {links.some((l) => !l.emailSent) && <p className="text-sm text-amber-800" data-no-mail>{NO_MAIL}</p>}
              {links.map((link) => (
                <div key={link.email} className="space-y-1" data-invite-link={link.email}>
                  <p className="text-xs text-gray-600">Link mời cho {link.email} (hết hiệu lực khi tạo link mới):</p>
                  <div className="flex gap-2">
                    <input readOnly aria-label={`Link mời cho ${link.email}`} value={link.url} data-invite-url onFocus={(e) => e.target.select()} className="input py-1 text-xs flex-1 min-w-0" />
                    <button type="button" onClick={() => copyInvite(link)} className="btn btn-secondary text-xs flex items-center gap-1 py-1">
                      <Copy className="w-3.5 h-3.5" /> Sao chép
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section aria-labelledby="share-people">
            <h3 id="share-people" className="text-sm font-medium text-gray-700 mb-2">Những người có quyền truy cập</h3>
            {loadError && <p className="text-sm text-red-600">Không tải được danh sách.</p>}
            {!data && !loadError && <div className="spinner mx-auto my-4" />}
            <ul className="space-y-3" data-collaborators>
              {collaborators.map((c) => (
                <li key={c.id} className="flex items-center gap-3" data-collaborator={c.email} data-role={c.role}>
                  <UserAvatar user={c} size="w-8 h-8" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{c.name}{c.is_me && <span className="text-gray-500"> (bạn)</span>}</p>
                    <p className="text-xs text-gray-500 truncate">{c.email}</p>
                  </div>
                  <RoleControl
                    person={c}
                    myRole={myRole}
                    ownerCount={ownerCount}
                    busy={busyId === c.id}
                    onChange={(next) => changeRole(c, next)}
                    onLeave={() => leave(c)}
                  />
                </li>
              ))}
            </ul>
          </section>

          {invitations.length > 0 && (
            <section aria-labelledby="share-invitations">
              <h3 id="share-invitations" className="text-sm font-medium text-gray-700 mb-2">Lời mời đang chờ</h3>
              {!mailEnabled && <p className="text-xs text-amber-700 mb-2">{NO_MAIL}.</p>}
              <ul className="space-y-2" data-invitations>
                {invitations.map((inv) => {
                  const locked = inv.role === 'owner' && !canManageOwners(myRole)
                  const busy = busyId === `i${inv.id}`
                  return (
                    <li key={inv.id} className="flex items-center gap-3" data-invitation={inv.email}>
                      <span className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"><Mail className="w-4 h-4 text-gray-600" /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{inv.email}</p>
                        <p className="text-xs text-gray-500">
                          {ROLE_LABELS[inv.role]} ·{' '}
                          {inv.expired ? <span className="text-red-600">Đã hết hạn</span> : `Hết hạn ${formatDate(inv.expires_at)}`}
                        </p>
                      </div>
                      <IconAction label="Sao chép link mời (link cũ sẽ ngừng hoạt động)" icon={Link2} disabled={locked || busy} onClick={() => renewInvitation(inv, false)} data-invite-action="link" />
                      <IconAction label="Gửi lại lời mời" icon={Send} disabled={locked || busy} onClick={() => renewInvitation(inv, true)} data-invite-action="resend" />
                      <IconAction label="Hủy lời mời" icon={Trash2} disabled={locked || busy} onClick={() => cancelInvitation(inv)} data-invite-action="cancel" />
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="share-general" data-general-access>
            <h3 id="share-general" className="text-sm font-medium text-gray-700 mb-2">Quyền truy cập chung</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><Lock className="w-4 h-4 text-gray-600" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">Người chỉnh sửa: <span className="font-medium">Hạn chế</span></p>
                  <p className="text-xs text-gray-500">Chỉ những người có quyền truy cập ở trên mới mở được biểu mẫu để chỉnh sửa.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${loginRequired ? 'bg-gray-100' : 'bg-green-100'}`}>
                  {loginRequired ? <Lock className="w-4 h-4 text-gray-600" /> : <Globe className="w-4 h-4 text-green-700" />}
                </span>
                <div className="flex-1 min-w-0">
                  <label htmlFor="share-respondents" className="text-sm text-gray-900">Người trả lời</label>
                  <select
                    id="share-respondents"
                    data-respondent-access
                    value={loginRequired ? 'login' : 'anyone'}
                    disabled={!canEditForm || forced}
                    onChange={(e) => updateSettings({ require_login: e.target.value === 'login' }, { delay: 0 })}
                    className="block mt-1 text-sm text-gray-800 border border-gray-300 rounded px-2 py-1 disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="anyone">Bất kỳ ai có đường liên kết</option>
                    <option value="login">Yêu cầu đăng nhập</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500" data-respondent-hint>
                    {forced ? FORCED_LOGIN_HINT : loginRequired ? 'Người trả lời phải đăng nhập tài khoản eForms.' : 'Ai có đường liên kết đều trả lời được.'}
                  </p>
                  {form?.is_public === false && (
                    <p className="mt-1 text-xs text-amber-700">"Biểu mẫu công khai" đang tắt trong Cài đặt nên người trả lời chưa mở được biểu mẫu.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" data-share-copy-link onClick={onCopyLink} className="flex items-center gap-2 text-sm font-medium text-primary-700 hover:bg-primary-50 px-3 py-2 rounded-md">
            <Link2 className="w-4 h-4" /> Sao chép đường liên kết của người trả lời
          </button>
          <button type="button" data-share-done onClick={onClose} className="btn btn-primary">Xong</button>
        </div>
      </div>
    </div>
  )
}
