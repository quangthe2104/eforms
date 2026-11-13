import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CheckCircle, Loader, Lock, AlertTriangle, Info } from 'lucide-react'
import { responseAPI } from '../services/api'
import { normalizeFields } from '../utils/formStructure'
import {
  evaluateForm, paginate, validatePages, submissionAnswers, filterAnswers, filterGroupsOnPage, pendingPageCount,
} from '../utils/formRuntime'
import FormPageView from '../components/FormRenderer/FormPageView'
import { useFormTheme, FormFrame, PageProgress } from '../components/FormRenderer/FormChrome'

const DEVICE_KEY = 'eforms_device_id'
const CHECK_MESSAGE = 'Vui lòng kiểm tra lại các câu được đánh dấu.'

const readJSON = (store, key) => {
  try {
    return JSON.parse(store.getItem(key))
  } catch {
    return null
  }
}

const scrollToFirstError = () =>
  setTimeout(() => document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)

export default function PublicForm() {
  const { slug } = useParams()
  const tokenKey = `eforms_session:${slug}`
  const draftKey = `eforms_draft:${slug}`

  const [form, setForm] = useState(null)
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [deviceId, setDeviceId] = useState(null)
  const [token, setToken] = useState(null)
  const [assignments, setAssignments] = useState({})
  const [answers, setAnswers] = useState({})
  const [errors, setErrors] = useState({})
  const [pageIndex, setPageIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [assignError, setAssignError] = useState(null)
  const [blocked, setBlocked] = useState(null)
  const [notice, setNotice] = useState(null)
  const [submitted, setSubmitted] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    loadForm(() => active)
    return () => {
      active = false
    }
  }, [slug])

  useFormTheme(form)

  useEffect(() => {
    if (!form?.title) return
    const previous = document.title
    document.title = form.title
    return () => {
      document.title = previous
    }
  }, [form?.title])

  const rememberToken = (value) => {
    setToken(value || null)
    if (value) localStorage.setItem(tokenKey, value)
    else localStorage.removeItem(tokenKey)
  }

  /** `isActive` is false once the effect is cleaned up, so a superseded load never writes the device id or state. */
  const loadForm = async (isActive) => {
    setLoading(true)
    try {
      const storedDevice = localStorage.getItem(DEVICE_KEY)
      const { data } = await responseAPI.getPublicForm(slug, storedDevice ? { device_id: storedDevice } : undefined)
      if (!isActive()) return
      if (data.device_id) localStorage.setItem(DEVICE_KEY, data.device_id)
      const normalized = normalizeFields(data.fields)
      setDeviceId(data.device_id || storedDevice)
      setFields(normalized)
      setForm(data)

      const status = data.limit_status
      if (status?.status === 'limit_reached') {
        setBlocked({ message: status.message })
        return
      }

      let tok = localStorage.getItem(tokenKey)
      let assigned = {}
      let restored = {}
      if (status?.status === 'editing') {
        tok = status.token
        assigned = status.assignments || {}
        restored = status.answers || {}
        setNotice('Ông/Bà đã gửi câu trả lời cho biểu mẫu này. Câu trả lời trước đã được nạp lại để sửa; khi gửi, bản mới sẽ thay thế bản cũ.')
      } else if (tok && normalized.some((f) => f.type === 'random_section')) {
        try {
          const res = await responseAPI.assignVariants(slug, { token: tok, device_id: data.device_id, group_keys: [] })
          tok = res.data.token
          assigned = res.data.assignments || {}
        } catch {
          // Variants are drawn again when the respondent reaches the block.
        }
        if (!isActive()) return
      }

      const draft = readJSON(sessionStorage, draftKey)
      if (draft && (draft.token ?? null) === (tok ?? null)) {
        restored = { ...restored, ...(draft.answers || {}) }
        setPageIndex(draft.page || 0)
      }
      rememberToken(tok)
      setAssignments(assigned)
      setAnswers(restored)
    } catch {
      if (isActive()) setForm(null)
    } finally {
      if (isActive()) setLoading(false)
    }
  }

  const evaluated = useMemo(() => evaluateForm(fields, assignments, answers), [fields, assignments, answers])
  const pages = useMemo(() => paginate(evaluated), [evaluated])
  const headers = useMemo(
    () => Object.fromEntries(fields.filter((f) => f.type === 'random_section').map((f) => [f.key, f])),
    [fields]
  )
  const visibleIndexes = pages.filter((p) => p.visible).map((p) => p.index)
  const current = pages[pageIndex]
  const nextIndex = visibleIndexes.find((i) => i > pageIndex)
  const prevIndex = [...visibleIndexes].reverse().find((i) => i < pageIndex)

  useEffect(() => {
    if (!pages.length || current?.visible) return
    const fallback = [...visibleIndexes].reverse().find((i) => i < pageIndex) ?? visibleIndexes[0]
    if (fallback !== undefined && fallback !== pageIndex) setPageIndex(fallback)
  }, [pages, pageIndex])

  useEffect(() => {
    if (!form || submitted || blocked) return
    const plain = Object.fromEntries(Object.entries(answers).filter(([, v]) => !(v instanceof File)))
    sessionStorage.setItem(draftKey, JSON.stringify({ token, page: pageIndex, answers: plain }))
  }, [answers, pageIndex, token])

  useEffect(() => {
    if (current?.pending && current.visible && !busy && !assignError) assignGroups([current.group])
  }, [current?.pending, current?.group, busy, assignError])

  const goTo = (index) => {
    setPageIndex(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleChange = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const assignGroups = async (groupKeys) => {
    setBusy(true)
    setAssignError(null)
    try {
      const { data } = await responseAPI.assignVariants(slug, {
        token,
        device_id: deviceId,
        answers: filterAnswers(fields, groupKeys, answers),
        group_keys: groupKeys,
      })
      if (data.token) rememberToken(data.token)
      setAssignments((prev) => ({ ...prev, ...(data.assignments || {}) }))
      return true
    } catch (error) {
      if (error.response?.status === 403) {
        setBlocked({ title: 'Biểu mẫu đã đóng', message: error.response.data?.message })
      } else {
        setAssignError(error.response?.data?.message || 'Không kết nối được máy chủ. Vui lòng thử lại.')
      }
      return false
    } finally {
      setBusy(false)
    }
  }

  const limit = form?.respondent_limit
  const identityFields = limit
    ? ['email', 'phone'].filter((m) => limit.methods?.includes(m) && limit.field_keys?.[m]).map((m) => ({ method: m, key: limit.field_keys[m] }))
    : []

  /** Checks email/phone when leaving the page that asks for them; the server checks again on submit. */
  const checkIdentityOn = async (page) => {
    if (!identityFields.some(({ key }) => page.items.some((i) => i.field.key === key))) return true
    const values = {}
    for (const { method, key } of identityFields) {
      const at = pages.find((p) => p.items.some((i) => i.field.key === key))
      const inst = at?.items.find((i) => i.field.key === key)
      if (inst && at.index <= page.index) values[method] = inst.visible ? String(answers[inst.answerKey] ?? '') : ''
    }
    setBusy(true)
    try {
      const { data } = await responseAPI.checkIdentity(slug, { token, device_id: deviceId, values })
      if (data.status === 'limit_reached') {
        setBlocked({ message: data.message })
        return false
      }
      if (data.status === 'will_replace') setNotice(data.message)
      return true
    } catch (error) {
      if (error.response?.status === 429) {
        toast.error('Thao tác quá nhanh, vui lòng thử lại sau ít phút.')
        return false
      }
      return true
    } finally {
      setBusy(false)
    }
  }

  const handleNext = async () => {
    if (busy || !current) return
    const pageErrors = validatePages([current], answers)
    setErrors(pageErrors)
    if (Object.keys(pageErrors).length) {
      toast.error(CHECK_MESSAGE, { id: 'validation' })
      scrollToFirstError()
      return
    }
    if (!(await checkIdentityOn(current))) return

    const groups = filterGroupsOnPage(fields, current, assignments)
    if (groups.length && !(await assignGroups(groups))) {
      toast.error('Không kết nối được máy chủ. Vui lòng bấm "Tiếp theo" để thử lại.')
      return
    }
    if (nextIndex !== undefined) goTo(nextIndex)
  }

  const showErrors = (found) => {
    setErrors(found)
    const first = pages.find((p) => p.visible && p.items.some((i) => found[i.answerKey]))
    if (first && first.index !== pageIndex) goTo(first.index)
    scrollToFirstError()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (nextIndex !== undefined || submitting || busy) return

    const allErrors = validatePages(pages, answers)
    if (Object.keys(allErrors).length) {
      showErrors(allErrors)
      toast.error(CHECK_MESSAGE, { id: 'validation' })
      return
    }

    setSubmitting(true)
    try {
      const { data } = await responseAPI.submitForm(slug, { answers: submissionAnswers(pages, answers), token, device_id: deviceId })
      rememberToken(null)
      sessionStorage.removeItem(draftKey)
      setSubmitted({ edited: !!data.edited })
    } catch (error) {
      const status = error.response?.status
      const data = error.response?.data || {}
      if (status === 422 && data.errors) {
        const mapped = Object.fromEntries(
          Object.entries(data.errors)
            .filter(([k]) => k.startsWith('answers.'))
            .map(([k, v]) => [k.slice('answers.'.length), Array.isArray(v) ? v[0] : String(v)])
        )
        if (Object.keys(mapped).length) showErrors(mapped)
        toast.error(data.message || 'Một số câu trả lời chưa hợp lệ.')
      } else if (status === 409) {
        setBlocked({ message: data.message })
      } else if (status === 403) {
        setBlocked({ title: 'Biểu mẫu đã đóng', message: data.message })
      } else {
        toast.error(data.message || 'Không thể gửi biểu mẫu. Vui lòng thử lại.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const clearAnswers = () => {
    if (!confirm('Xóa hết câu trả lời đã điền?')) return
    setAnswers({})
    setErrors({})
    if (visibleIndexes.length) goTo(visibleIndexes[0])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!form) {
    return (
      <MessageScreen title="Không tìm thấy biểu mẫu" message="Biểu mẫu không tồn tại, chưa được xuất bản hoặc đã bị đóng." />
    )
  }

  const color = form.primary_color || '#4285F4'

  if (submitted) {
    return (
      <MessageScreen
        form={form}
        icon={<CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: form.primary_color || '#10b981' }} />}
        title={submitted.edited ? 'Đã cập nhật câu trả lời' : 'Trân trọng cảm ơn!'}
        message={form.custom_thank_you_message || 'Phản hồi của bạn đã được ghi nhận.'}
      />
    )
  }

  if (blocked) {
    return (
      <MessageScreen
        form={form}
        icon={<Info className="w-14 h-14 mx-auto mb-4" style={{ color }} />}
        title={blocked.title || form.title}
        message={blocked.message || 'Biểu mẫu này hiện không nhận câu trả lời.'}
      />
    )
  }

  if (form.accepting === false) {
    return (
      <MessageScreen
        form={form}
        icon={<Lock className="w-14 h-14 mx-auto mb-4 text-gray-400" />}
        title="Biểu mẫu đã đóng"
        message="Biểu mẫu này hiện không nhận câu trả lời."
      />
    )
  }

  if (form.require_login && !localStorage.getItem('token')) {
    return (
      <MessageScreen
        form={form}
        icon={<Lock className="w-14 h-14 mx-auto mb-4" style={{ color }} />}
        title="Cần đăng nhập"
        message="Vui lòng đăng nhập để trả lời biểu mẫu này."
        action={<Link to="/login" className="btn btn-primary mt-6 inline-block">Đăng nhập</Link>}
      />
    )
  }

  const totalVisible = visibleIndexes.reduce(
    (sum, i) => sum + (pages[i].pending ? pendingPageCount(pages[i].items[0].field, fields) : 1),
    0
  )
  const position = visibleIndexes.indexOf(pageIndex) + 1

  return (
    <FormFrame form={form} showDescription={pageIndex === visibleIndexes[0]}>
          {notice && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <PageProgress position={position} total={totalVisible} color={color} />

            {current?.pending ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-600">
                {assignError ? (
                  <>
                    <p className="text-red-600 mb-4">{assignError}</p>
                    <button type="button" className="btn btn-primary" onClick={() => setAssignError(null)}>
                      Thử lại
                    </button>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Loader className="w-5 h-5 animate-spin" /> Đang chuẩn bị nội dung…
                  </div>
                )}
              </div>
            ) : (
              current && (
                <FormPageView page={current} headers={headers} answers={answers} errors={errors} onChange={handleChange} theme={form} />
              )
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-3">
                {prevIndex !== undefined && (
                  <button
                    type="button"
                    onClick={() => goTo(prevIndex)}
                    disabled={busy || submitting}
                    className="btn flex items-center justify-center space-x-2 transition-all px-6 py-2.5 rounded font-medium border"
                    style={{ borderColor: color, color, backgroundColor: '#ffffff' }}
                  >
                    <span>Quay lại</span>
                  </button>
                )}

                {/* Distinct keys: reusing one DOM button would turn the "Tiếp theo" click into a submit on the last page. */}
                {nextIndex !== undefined ? (
                  !current?.pending && (
                    <button
                      key="next"
                      type="button"
                      onClick={handleNext}
                      disabled={busy}
                      className="btn flex items-center justify-center space-x-2 transition-all px-8 py-2.5 rounded font-medium"
                      style={{ backgroundColor: color, color: '#ffffff', opacity: busy ? 0.7 : 1 }}
                    >
                      {busy && <Loader className="w-4 h-4 animate-spin" />}
                      <span>Tiếp theo</span>
                    </button>
                  )
                ) : (
                  <button
                    key="submit"
                    type="submit"
                    disabled={submitting || busy}
                    className="btn flex items-center justify-center space-x-2 transition-all px-8 py-2.5 rounded font-medium"
                    style={{ backgroundColor: color, color: '#ffffff', opacity: submitting ? 0.7 : 1 }}
                  >
                    {submitting ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Đang gửi...</span>
                      </>
                    ) : (
                      <span>Gửi</span>
                    )}
                  </button>
                )}
              </div>

              <button type="button" onClick={clearAnswers} className="text-sm font-medium transition-colors" style={{ color }}>
                Xóa hết câu trả lời
              </button>
            </div>
          </form>
    </FormFrame>
  )
}

function MessageScreen({ form, icon, title, message, action }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: form?.background_color || '#f9fafb', fontFamily: form?.font_family || 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center" data-screen="message">
        {icon}
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: form?.primary_color || '#111827', fontSize: form?.header_font_size || '24px' }}
        >
          {title}
        </h2>
        <p className="text-gray-600 whitespace-pre-line" style={{ fontSize: form?.text_font_size || '14px' }}>
          {message}
        </p>
        {action}
      </div>
    </div>
  )
}
