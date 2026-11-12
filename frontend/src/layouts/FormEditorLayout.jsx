import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { formAPI, fieldAPI } from '../services/api'
import { useFormStore } from '../store/formStore'
import { destructiveChanges, shortLabel } from '../utils/formStructure'
import { captureFormThumbnail } from '../utils/captureFormThumbnail'
import EditorHeader from '../components/editor/EditorHeader'
import ShareDialog from '../components/editor/ShareDialog'
import FormTheme from '../components/FormTheme'

/** Editor state shared by the three tabs (Câu hỏi, Câu trả lời, Cài đặt). */
export const useEditor = () => useOutletContext()

const THEME_KEYS = [
  'primary_color', 'secondary_color', 'background_color', 'header_image',
  'font_family', 'header_font_size', 'question_font_size', 'text_font_size',
]
const DEFAULT_THEME = {
  primary_color: '#4285F4',
  secondary_color: '#C6DAFC',
  background_color: '#f9fafb',
  header_image: '',
  font_family: 'system-ui, -apple-system, sans-serif',
  header_font_size: '32px',
  question_font_size: '16px',
  text_font_size: '14px',
}
const STATUS_TOASTS = {
  published: 'Đã xuất bản biểu mẫu',
  closed: 'Biểu mẫu đã ngừng nhận câu trả lời',
  draft: 'Đã hủy xuất bản biểu mẫu',
}

const themeStorageKey = (id) => `previewTheme_${id}`
const readPreviewTheme = (id) => {
  try {
    return JSON.parse(localStorage.getItem(themeStorageKey(id)) || 'null')
  } catch {
    return null
  }
}
// Theme columns are null on forms that never had a theme; the update API rejects null for them.
const pickTheme = (src) => Object.fromEntries(THEME_KEYS.filter((k) => src?.[k] != null).map((k) => [k, src[k]]))

const copyText = (text) => {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const textarea = document.createElement('textarea')
  textarea.value = text
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
  return Promise.resolve()
}

const captureThumbnail = (form, fields, meta) => {
  setTimeout(() => {
    captureFormThumbnail({ ...pickTheme(form), title: meta.title, description: meta.description, fields }, form.id)
      .catch((error) => console.error('Error capturing thumbnail:', error))
  }, 500)
}

export default function FormEditorLayout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const currentForm = useFormStore((s) => s.currentForm)
  const isDirty = useFormStore((s) => s.isDirty)
  const metaDirty = useFormStore((s) => s.metaDirty)
  const title = useFormStore((s) => s.title)
  const { loadForm, resetForm, patchForm, setMeta, setCurrentForm, applySavedFields, markAsSaved, markMetaSaved } = useFormStore.getState()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [savedAt, setSavedAt] = useState(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [showTheme, setShowTheme] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [previewTheme, setPreviewTheme] = useState(() => readPreviewTheme(id))
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(null)

  const isEditTab = pathname.endsWith('/edit')
  const role = currentForm?.my_role || 'editor'
  const canEdit = role !== 'viewer'
  const dirty = isDirty || metaDirty || !!previewTheme

  useEffect(() => {
    let cancelled = false
    resetForm()
    setLoading(true)
    setSavedAt(null)
    setActiveQuestionIndex(null)
    setPreviewTheme(readPreviewTheme(id))
    formAPI.getOne(id)
      .then((res) => !cancelled && loadForm(res.data))
      .catch(() => {
        if (cancelled) return
        toast.error('Không thể tải biểu mẫu')
        navigate('/forms', { replace: true })
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [id])

  useEffect(() => () => resetForm(), [])

  useEffect(() => {
    if (!isEditTab) setShowTheme(false)
  }, [isEditTab])

  // Temporary explicit save (phase 3). Phase 4 replaces it with the ops queue in services/autosave.js.
  const save = useCallback(async () => {
    const { fields: currentFields, isDirty: fieldsDirty, currentForm: latestForm, title, description } = useFormStore.getState()
    if (!latestForm || savingRef.current) return false
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề biểu mẫu')
      return false
    }

    const responseCount = latestForm.responses?.length || 0
    if (fieldsDirty && responseCount > 0) {
      const changes = destructiveChanges(latestForm.fields, currentFields)
      if (changes.length) {
        const list = changes.slice(0, 8).map((c) => `• ${c}`).join('\n')
        const more = changes.length > 8 ? `\n• … và ${changes.length - 8} thay đổi khác` : ''
        const ok = confirm(
          `Biểu mẫu đã có ${responseCount} câu trả lời. Các thay đổi sau có thể làm mất hoặc lệch dữ liệu đã thu:\n\n${list}${more}\n\nVẫn lưu?`
        )
        if (!ok) return false
      }
    }

    savingRef.current = true
    setSaving(true)
    try {
      const pendingTheme = readPreviewTheme(id)
      const themeData = pickTheme(pendingTheme || latestForm)
      const meta = { title, description }
      const response = await formAPI.update(id, { ...meta, settings: latestForm.settings || {}, ...themeData })
      const form = { ...latestForm, ...response.data.form }
      THEME_KEYS.forEach((k) => themeData[k] !== undefined && (form[k] = themeData[k]))

      let savedFields = latestForm.fields || []
      if (fieldsDirty) {
        const res = await fieldAPI.bulkUpdate(id, { fields: currentFields })
        savedFields = res.data.fields
      }
      const completeForm = { ...form, responses: latestForm.responses, fields: savedFields }

      if (pendingTheme) {
        localStorage.removeItem(themeStorageKey(id))
        setPreviewTheme(null)
      }
      // New fields only get their database ids here; without them the next save would recreate them.
      if (fieldsDirty) {
        applySavedFields(completeForm, savedFields, currentFields)
      } else {
        setCurrentForm(completeForm)
        markAsSaved()
      }
      markMetaSaved(meta)
      setSavedAt(new Date())
      toast.success('Đã lưu biểu mẫu thành công')
      captureThumbnail(completeForm, savedFields, meta)
      return true
    } catch (error) {
      console.error('Error saving form:', error)
      const errors = error.response?.status === 422 ? error.response.data?.errors : null
      if (errors) {
        const entries = Object.entries(errors)
        const lines = entries.slice(0, 3).map(([path, messages]) => {
          const match = path.match(/^fields\.(\d+)\./)
          const field = match ? currentFields[Number(match[1])] : null
          return field ? `"${shortLabel(field, 40)}": ${messages[0]}` : messages[0]
        })
        toast.error(`Không thể lưu biểu mẫu:\n${lines.join('\n')}`, { duration: 8000 })
        const first = entries[0]?.[0].match(/^fields\.(\d+)\./)
        if (first) {
          setActiveQuestionIndex(Number(first[1]))
          if (!isEditTab) navigate(`/forms/${id}/edit`)
        }
      } else {
        toast.error('Không thể lưu biểu mẫu')
      }
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [id, isEditTab])

  useEffect(() => {
    if (!canEdit) return
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [canEdit, save])

  const saveSettings = useCallback(async (settings) => {
    // The respondent limit may point at questions that exist only in the builder so far.
    if (useFormStore.getState().isDirty && !(await save())) return false
    try {
      const response = await formAPI.update(id, settings)
      const saved = response.data.form || {}
      patchForm({
        ...settings,
        require_login: saved.require_login ?? settings.require_login,
        respondent_limit: saved.respondent_limit ?? settings.respondent_limit,
      })
      toast.success('Đã lưu cài đặt biểu mẫu')
      return true
    } catch {
      toast.error('Không thể lưu cài đặt')
      return false
    }
  }, [id, save])

  const changeStatus = useCallback(async (status) => {
    const { currentForm: latest, isDirty: fieldsDirty, metaDirty: titleDirty } = useFormStore.getState()
    if (!latest) return false
    const publishing = status === 'published' && latest.status === 'draft'
    if (publishing && (fieldsDirty || titleDirty || readPreviewTheme(id)) && !(await save())) return false
    setStatusBusy(true)
    try {
      const response = await formAPI.update(id, { status })
      const saved = response.data.form || {}
      patchForm({ status: saved.status ?? status, slug: saved.slug ?? latest.slug })
      toast.success(latest.status === 'closed' && status === 'published' ? 'Biểu mẫu đã nhận câu trả lời trở lại' : STATUS_TOASTS[status])
      if (publishing) {
        const { title, description, currentForm: form } = useFormStore.getState()
        captureThumbnail(form, form.fields || [], { title, description })
      }
      return true
    } catch {
      toast.error('Không thể cập nhật trạng thái biểu mẫu')
      return false
    } finally {
      setStatusBusy(false)
    }
  }, [id, save])

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
    window.open(`/forms/${id}/preview`, '_blank')
    if (dirty) toast('Bản xem trước hiển thị nội dung đã lưu gần nhất', { id: 'preview-dirty' })
  }, [id, dirty])

  const openTheme = useCallback(() => {
    if (!isEditTab) navigate(`/forms/${id}/edit`)
    setShowTheme(true)
  }, [id, isEditTab])

  const handlePreviewTheme = useCallback((next) => {
    // FormTheme reports its initial values on open; that alone is not a change.
    const saved = useFormStore.getState().currentForm
    if (THEME_KEYS.every((k) => (next?.[k] || DEFAULT_THEME[k]) === (saved?.[k] || DEFAULT_THEME[k]))) {
      setPreviewTheme(null)
      localStorage.removeItem(themeStorageKey(id))
      return
    }
    setPreviewTheme(next)
    localStorage.setItem(themeStorageKey(id), JSON.stringify(next))
  }, [id])

  const duplicate = useCallback(async () => {
    try {
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
      await formAPI.delete(id)
      toast.success('Đã xóa biểu mẫu')
      navigate('/forms')
    } catch {
      toast.error('Không thể xóa biểu mẫu')
    }
  }, [id])

  const goHome = useCallback((e) => {
    if (canEdit && dirty && !confirm('Có thay đổi chưa lưu. Vẫn rời trang?')) e.preventDefault()
  }, [canEdit, dirty])

  const theme = useMemo(() => {
    const src = previewTheme || currentForm
    return Object.fromEntries(THEME_KEYS.map((k) => [k, src?.[k] || DEFAULT_THEME[k]]))
  }, [previewTheme, currentForm])

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
    save,
    saveSettings,
    saving,
    savedAt,
    dirty,
    changeStatus,
    statusBusy,
    copyLink,
    openPreview,
    openShare: () => setShowShare(true),
    duplicate,
    remove,
    goHome,
    presence: [],
    activeQuestionIndex,
    setActiveQuestionIndex,
    responseCount: currentForm?.responses?.length || 0,
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.background_color }}>
      <EditorHeader editor={editor} />

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
        <FormTheme theme={theme} onClose={() => setShowTheme(false)} onPreview={handlePreviewTheme} />
      )}
      {showShare && (
        <ShareDialog formId={id} onClose={() => setShowShare(false)} onCopyLink={copyLink} />
      )}
    </div>
  )
}
