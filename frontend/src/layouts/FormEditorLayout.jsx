import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { formAPI } from '../services/api'
import { createAutosave } from '../services/autosave'
import { createLiveSync } from '../services/liveSync'
import { useFormStore } from '../store/formStore'
import { useAuthStore } from '../store/authStore'
import { shortLabel } from '../utils/formStructure'
import { THEME_KEYS, DEFAULT_THEME } from '../utils/ops'
import { captureFormThumbnail } from '../utils/captureFormThumbnail'
import EditorHeader from '../components/editor/EditorHeader'
import ShareDialog from '../components/editor/ShareDialog'
import DestructiveBanner from '../components/editor/DestructiveBanner'
import FormTheme from '../components/FormTheme'
import { ROLE_LABELS } from '../utils/roles'
import { copyText } from '../utils/clipboard'

/** Editor state shared by the three tabs (Câu hỏi, Câu trả lời, Cài đặt). */
export const useEditor = () => useOutletContext()

const STATUS_TOASTS = {
  published: 'Đã xuất bản biểu mẫu',
  closed: 'Biểu mẫu đã ngừng nhận câu trả lời',
  draft: 'Đã hủy xuất bản biểu mẫu',
}
const THUMBNAIL_EVERY_MS = 2 * 60 * 1000
const INITIAL_SAVE_STATE = { status: 'saved', savedAt: null, paused: [], error: null, unsaved: false }

const isTextInput = (el) => !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

const captureThumbnail = ({ currentForm: form, fields, title, description }) => {
  if (!form) return
  const data = { ...Object.fromEntries(THEME_KEYS.map((k) => [k, form[k]])), title, description, fields }
  setTimeout(() => {
    captureFormThumbnail(data, form.id).catch((error) => console.error('Error capturing thumbnail:', error))
  }, 500)
}

/** Field key an op/rejection points at (structure errors: "fields.<key>.<prop>"). */
const rejectedKey = (r) => {
  if (r.key) return r.key
  const path = Object.keys(r.errors || {})[0] || ''
  return path.match(/^fields\.([^.]+)\./)?.[1] || null
}

export default function FormEditorLayout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const currentForm = useFormStore((s) => s.currentForm)
  const title = useFormStore((s) => s.title)
  const undoLabel = useFormStore((s) => s.undoStack[s.undoStack.length - 1]?.label || null)
  const redoLabel = useFormStore((s) => s.redoStack[s.redoStack.length - 1]?.label || null)
  const { loadForm, resetForm, patchForm, setMeta, setTheme, updateSettings } = useFormStore.getState()

  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState(INITIAL_SAVE_STATE)
  const [statusBusy, setStatusBusy] = useState(false)
  const [showTheme, setShowTheme] = useState(false)
  const [showShare, setShowShare] = useState(false)
  // The selection follows the question (by key), so remote inserts/moves above it do not shift it.
  const [activeKey, setActiveKey] = useState(null)
  const [presenceRows, setPresenceRows] = useState([])
  const myId = useAuthStore((s) => s.user?.id)
  const autosaveRef = useRef(null)
  const syncRef = useRef(null)
  const thumbDirtyRef = useRef(false)
  const activeKeyRef = useRef(null)
  const activeIndex = useFormStore((s) => (activeKey ? s.fields.findIndex((f) => f.key === activeKey) : -1))
  const activeQuestionIndex = activeIndex >= 0 ? activeIndex : null
  activeKeyRef.current = activeQuestionIndex != null ? activeKey : null
  const setActiveQuestionIndex = useCallback((index) => {
    setActiveKey(index == null ? null : useFormStore.getState().fields[index]?.key ?? null)
  }, [])

  const isEditTab = pathname.endsWith('/edit')
  const isEditTabRef = useRef(isEditTab)
  isEditTabRef.current = isEditTab
  const role = currentForm?.my_role || 'editor'
  const canEdit = role !== 'viewer'

  // A live downgrade to viewer must not leave a question selected (with its editing controls) or the theme panel open.
  useEffect(() => {
    if (canEdit) return
    setActiveKey(null)
    setShowTheme(false)
  }, [canEdit])

  const selectField = useCallback((key) => {
    const index = useFormStore.getState().fields.findIndex((f) => f.key === key)
    if (index < 0) return
    setActiveQuestionIndex(index)
    if (!isEditTabRef.current) navigate(`/forms/${id}/edit`)
    setTimeout(() => document.querySelector(`[data-field-key="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
  }, [id])

  const handleRejected = useCallback((rejected) => {
    const fields = useFormStore.getState().fields
    const lines = rejected.slice(0, 3).map((r) => {
      const key = rejectedKey(r)
      const field = key ? fields.find((f) => f.key === key) : null
      const message = Object.values(r.errors || {})[0]?.[0] || r.message || 'Dữ liệu không hợp lệ'
      return field ? `"${shortLabel(field, 40)}": ${message}` : message
    })
    toast.error(`Không thể lưu biểu mẫu:\n${lines.join('\n')}`, { id: 'save-rejected', duration: 8000 })
    const key = rejected.map(rejectedKey).find(Boolean)
    if (key) selectField(key)
  }, [selectField])

  // Load the form once per id; autosave lives as long as the editor.
  useEffect(() => {
    let cancelled = false
    resetForm()
    setLoading(true)
    setSaveState(INITIAL_SAVE_STATE)
    setActiveQuestionIndex(null)
    setPresenceRows([])
    thumbDirtyRef.current = false
    const autosave = createAutosave({
      formId: id,
      onState: (s) => !cancelled && setSaveState(s),
      onRejected: (r) => !cancelled && handleRejected(r),
      onSaved: () => { thumbDirtyRef.current = true },
    })
    autosaveRef.current = autosave
    const sync = createLiveSync({
      formId: id,
      autosave,
      getActiveField: () => activeKeyRef.current,
      onPresence: (rows) => !cancelled && setPresenceRows(rows),
      onRole: (next) => !cancelled && toast(`Vai trò của bạn đã đổi thành ${ROLE_LABELS[next] || next}`, { id: 'role-changed' }),
      onFatal: (status) => {
        if (cancelled) return
        setPresenceRows([])
        toast.error(status === 404 ? 'Biểu mẫu không còn tồn tại' : 'Bạn không còn quyền truy cập biểu mẫu này', { id: 'sync-fatal' })
      },
    })
    syncRef.current = sync
    formAPI.getOne(id)
      .then((res) => {
        if (cancelled) return
        loadForm(res.data)
        autosave.reset()
        sync.start()
      })
      .catch(() => {
        if (cancelled) return
        toast.error('Không thể tải biểu mẫu')
        navigate('/forms', { replace: true })
      })
      .finally(() => !cancelled && setLoading(false))

    const thumbTimer = setInterval(() => {
      if (!thumbDirtyRef.current) return
      thumbDirtyRef.current = false
      captureThumbnail(useFormStore.getState())
    }, THUMBNAIL_EVERY_MS)

    return () => {
      cancelled = true
      clearInterval(thumbTimer)
      sync.dispose()
      if (syncRef.current === sync) syncRef.current = null
      // Leaving the editor: send what is left and refresh the thumbnail before the store is cleared.
      autosave.flush()
      if (thumbDirtyRef.current) captureThumbnail(useFormStore.getState())
      autosave.dispose()
      if (autosaveRef.current === autosave) autosaveRef.current = null
      resetForm()
    }
  }, [id])

  useEffect(() => {
    if (!isEditTab) setShowTheme(false)
  }, [isEditTab])

  // Selection is presence: tell the others soon.
  const selectedKey = activeKeyRef.current
  useEffect(() => {
    syncRef.current?.poke()
  }, [selectedKey])

  // Other people (one entry per user, tabs merged; never me) and who has which question selected.
  const presence = useMemo(() => {
    const users = new Map()
    for (const row of presenceRows) {
      if (row.user_id === myId) continue
      const user = users.get(row.user_id) || { user_id: row.user_id, name: row.name, fields: [] }
      if (row.active_field_key && !user.fields.includes(row.active_field_key)) user.fields.push(row.active_field_key)
      users.set(row.user_id, user)
    }
    return [...users.values()]
  }, [presenceRows, myId])
  const presenceByField = useMemo(() => {
    const map = {}
    for (const user of presence) for (const key of user.fields) (map[key] ||= []).push(user)
    return map
  }, [presence])

  // Switching tab sends the queue right away.
  useEffect(() => {
    autosaveRef.current?.flush()
  }, [pathname])

  // Hidden/unloaded page: send with keepalive. Block leaving only when changes cannot be sent.
  useEffect(() => {
    const onHide = () => autosaveRef.current?.flush({ keepalive: true })
    const onVisibility = () => document.visibilityState === 'hidden' && onHide()
    const onBeforeUnload = (e) => {
      const s = autosaveRef.current?.getState()
      if (s?.unsaved && (s.status === 'error' || s.status === 'paused')) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  const undo = useCallback(() => travel('undo'), [])
  const redo = useCallback(() => travel('redo'), [])
  function travel(direction) {
    const result = useFormStore.getState()[direction]()
    if (!result) return
    if (result.conflict) {
      const name = result.conflict.user?.name || 'người khác'
      toast(`Không thể ${direction === 'undo' ? 'hoàn tác' : 'làm lại'} vì ${name} đã thay đổi nội dung này`, { id: 'undo-conflict' })
      return
    }
    const key = result.entry.ops.find((op) => op.key)?.key
    const index = key ? useFormStore.getState().fields.findIndex((f) => f.key === key) : -1
    if (index >= 0) setActiveQuestionIndex(index)
  }

  // Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z outside text inputs (inside them the browser undoes the text).
  useEffect(() => {
    if (!canEdit) return
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTextInput(e.target) || isTextInput(document.activeElement)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      }
    }
    // Typing steps end when the input loses focus.
    const onFocusOut = (e) => isTextInput(e.target) && useFormStore.getState().breakCoalesce()
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [canEdit, undo, redo])

  const changeStatus = useCallback(async (status) => {
    const latest = useFormStore.getState().currentForm
    if (!latest) return false
    const publishing = status === 'published' && latest.status === 'draft'
    if (publishing) await autosaveRef.current?.flush()
    setStatusBusy(true)
    try {
      // accept_responses is no longer editable (status is the switch); clear a legacy "off" so it cannot block responses.
      const response = await formAPI.update(id, { status, ...(status === 'published' && latest.accept_responses === false && { accept_responses: true }) })
      const saved = response.data.form || {}
      patchForm({ status: saved.status ?? status, slug: saved.slug ?? latest.slug, accept_responses: saved.accept_responses ?? latest.accept_responses })
      if (saved.revision != null) useFormStore.getState().advanceRevision(saved.revision)
      toast.success(latest.status === 'closed' && status === 'published' ? 'Biểu mẫu đã nhận câu trả lời trở lại' : STATUS_TOASTS[status])
      if (publishing) captureThumbnail(useFormStore.getState())
      return true
    } catch {
      toast.error('Không thể cập nhật trạng thái biểu mẫu')
      return false
    } finally {
      setStatusBusy(false)
    }
  }, [id])

  const copyLink = useCallback(() => {
    const form = useFormStore.getState().currentForm
    if (!form) return
    if (form.status === 'draft' || !form.slug) {
      toast((t) => (
        <span className="flex items-center gap-3">
          Biểu mẫu chưa được xuất bản
          {canEdit && (
            <button
              type="button"
              className="font-medium text-primary-600 hover:text-primary-700"
              onClick={() => { toast.dismiss(t.id); changeStatus('published') }}
            >
              Xuất bản
            </button>
          )}
        </span>
      ), { id: 'not-published' })
      return
    }
    copyText(`${window.location.origin}/f/${form.slug}`)
      .then(() => toast.success('Đã sao chép liên kết biểu mẫu!'))
      .catch(() => toast.error('Không thể sao chép liên kết'))
  }, [canEdit, changeStatus])

  const openPreview = useCallback(() => {
    const url = `/forms/${id}/preview`
    const autosave = autosaveRef.current
    if (!autosave?.hasUnsaved()) {
      window.open(url, '_blank')
      return
    }
    // Open synchronously (popup blockers), point it at the preview once the queue is saved.
    const win = window.open('about:blank', '_blank')
    autosave.flush().finally(() => {
      if (win) win.location.href = url
      else window.open(url, '_blank')
      if (autosave.getState().paused.length) toast('Bản xem trước chưa có các thay đổi đang tạm dừng', { id: 'preview-dirty' })
    })
  }, [id])

  const openTheme = useCallback(() => {
    if (!isEditTab) navigate(`/forms/${id}/edit`)
    setShowTheme(true)
  }, [id, isEditTab])

  const handleThemeChange = useCallback((next) => {
    // FormTheme reports its initial values on open; only real differences are changes.
    const saved = useFormStore.getState().currentForm
    const patch = Object.fromEntries(THEME_KEYS
      .filter((k) => next?.[k] !== undefined && (next[k] || DEFAULT_THEME[k]) !== (saved?.[k] || DEFAULT_THEME[k]))
      .map((k) => [k, next[k]]))
    if (Object.keys(patch).length) setTheme(patch)
  }, [])

  const duplicate = useCallback(async () => {
    try {
      await autosaveRef.current?.flush()
      const response = await formAPI.duplicate(id)
      toast.success('Đã nhân bản biểu mẫu')
      navigate(`/forms/${response.data.form.id}/edit`)
    } catch {
      toast.error('Không thể nhân bản biểu mẫu')
    }
  }, [id])

  const remove = useCallback(async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa biểu mẫu này?')) return
    try {
      autosaveRef.current?.dispose()
      await formAPI.delete(id)
      toast.success('Đã xóa biểu mẫu')
      navigate('/forms')
    } catch {
      toast.error('Không thể xóa biểu mẫu')
    }
  }, [id])

  const blocked = saveState.unsaved && (saveState.status === 'error' || saveState.status === 'paused')
  const goHome = useCallback((e) => {
    if (canEdit && blocked && !confirm('Có thay đổi chưa lưu được. Vẫn rời trang?')) e.preventDefault()
  }, [canEdit, blocked])

  const theme = useMemo(
    () => Object.fromEntries(THEME_KEYS.map((k) => [k, currentForm?.[k] || DEFAULT_THEME[k]])),
    [currentForm],
  )

  const pausedChanges = saveState.paused.flatMap((p) => p.changes)
  const responseCount = currentForm?.responses?.length || 0

  const editor = {
    id,
    form: currentForm,
    role,
    canEdit,
    readOnly: !canEdit,
    isOwner: role === 'owner',
    title,
    setTitle: (value) => setMeta({ title: value }),
    theme,
    showTheme,
    openTheme,
    saveState,
    retrySave: () => autosaveRef.current?.retry(),
    flushSave: () => autosaveRef.current?.flush(),
    /** Settings tab: toggles save at once (`delay: 0`), text/number after 1.5 s. Not in undo history. */
    updateSettings,
    /** Ops from other users (live sync goes through autosave.applyRemote). */
    applyRemoteOps: (ops, meta) => autosaveRef.current?.applyRemote(ops, meta),
    undo,
    redo,
    undoLabel,
    redoLabel,
    changeStatus,
    statusBusy,
    copyLink,
    openPreview,
    openShare: () => setShowShare(true),
    duplicate,
    remove,
    goHome,
    presence,
    presenceByField,
    activeQuestionIndex,
    setActiveQuestionIndex,
    responseCount,
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.background_color }}>
      <EditorHeader editor={editor} />
      {canEdit && pausedChanges.length > 0 && (
        <DestructiveBanner
          count={responseCount}
          changes={pausedChanges}
          onApprove={() => autosaveRef.current?.approvePaused()}
          onRevert={() => autosaveRef.current?.revertPaused()}
        />
      )}

      {loading || !currentForm ? (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="spinner"></div>
        </div>
      ) : isEditTab ? (
        <Outlet context={editor} />
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet context={editor} />
        </main>
      )}

      {showTheme && canEdit && (
        <FormTheme theme={theme} onClose={() => setShowTheme(false)} onPreview={handleThemeChange} />
      )}
      {showShare && currentForm && (
        <ShareDialog
          formId={id}
          title={title}
          role={role}
          onClose={() => setShowShare(false)}
          onCopyLink={copyLink}
          onRoleChanged={(next) => patchForm({ my_role: next })}
          onLeft={() => {
            setShowShare(false)
            navigate('/forms', { replace: true })
          }}
        />
      )}
    </div>
  )
}
