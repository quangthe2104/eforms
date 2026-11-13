import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader, X, RotateCcw } from 'lucide-react'
import { formAPI } from '../../services/api'
import { normalizeFields, variantsOf, shortLabel } from '../../utils/formStructure'
import { evaluateForm, paginate, validatePages, withDefaultAnswers } from '../../utils/formRuntime'
import FormPageView from '../../components/FormRenderer/FormPageView'
import { useFormTheme, FormFrame, PageProgress } from '../../components/FormRenderer/FormChrome'

const CHECK_MESSAGE = 'Vui lòng kiểm tra lại các câu được đánh dấu.'

const pickCount = (header) => {
  const count = variantsOf(header).length
  return Math.max(1, Math.min(parseInt(header.settings?.pick_count, 10) || 1, Math.max(1, count)))
}

/** First K variants of every block; the author changes them with the pickers in the preview bar. */
const defaultAssignments = (fields) =>
  Object.fromEntries(
    fields
      .filter((f) => f.type === 'random_section' && f.key)
      .map((f) => [f.key, variantsOf(f).slice(0, pickCount(f)).map((v) => v.key)])
  )

const scrollToFirstError = () =>
  setTimeout(() => document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)

export default function FormPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState({})
  const [answers, setAnswers] = useState({})
  const [errors, setErrors] = useState({})
  const [pageIndex, setPageIndex] = useState(0)

  useEffect(() => {
    let active = true
    formAPI
      .getOne(id)
      .then(({ data }) => {
        if (!active) return
        const normalized = normalizeFields(data.fields)
        setForm(data)
        setFields(normalized)
        setAssignments(defaultAssignments(normalized))
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        toast.error('Không thể tải biểu mẫu')
        navigate('/forms')
      })
    return () => {
      active = false
    }
  }, [id])

  useFormTheme(form)

  const blocks = useMemo(() => fields.filter((f) => f.type === 'random_section' && f.key), [fields])
  const headers = useMemo(() => Object.fromEntries(blocks.map((f) => [f.key, f])), [blocks])
  const evaluated = useMemo(() => evaluateForm(fields, assignments, answers), [fields, assignments, answers])
  const pages = useMemo(() => paginate(evaluated), [evaluated])
  const visibleIndexes = pages.filter((p) => p.visible).map((p) => p.index)
  const current = pages[pageIndex]
  const nextIndex = visibleIndexes.find((i) => i > pageIndex)
  const prevIndex = [...visibleIndexes].reverse().find((i) => i < pageIndex)

  useEffect(() => {
    setAnswers((prev) => withDefaultAnswers(pages, prev))
  }, [pages])

  useEffect(() => {
    if (!pages.length || current?.visible) return
    const fallback = [...visibleIndexes].reverse().find((i) => i < pageIndex) ?? visibleIndexes[0]
    if (fallback !== undefined && fallback !== pageIndex) setPageIndex(fallback)
  }, [pages, pageIndex])

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

  /** Picking a variant already used in another round swaps the two rounds. */
  const pickVariant = (groupKey, round, variantKey) => {
    setAssignments((prev) => {
      const list = [...(prev[groupKey] || [])]
      const taken = list.indexOf(variantKey)
      if (taken !== -1 && taken !== round) list[taken] = list[round]
      list[round] = variantKey
      return { ...prev, [groupKey]: list }
    })
    setErrors({})
  }

  const handleNext = () => {
    if (!current) return
    const pageErrors = validatePages([current], answers)
    setErrors(pageErrors)
    if (Object.keys(pageErrors).length) {
      toast.error(CHECK_MESSAGE, { id: 'validation' })
      scrollToFirstError()
      return
    }
    if (nextIndex !== undefined) goTo(nextIndex)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (nextIndex !== undefined) return
    const allErrors = validatePages(pages, answers)
    setErrors(allErrors)
    if (Object.keys(allErrors).length) {
      const first = pages.find((p) => p.visible && p.items.some((i) => allErrors[i.answerKey]))
      if (first && first.index !== pageIndex) goTo(first.index)
      scrollToFirstError()
      toast.error(CHECK_MESSAGE, { id: 'validation' })
      return
    }
    toast.success('Câu trả lời hợp lệ. Đây là chế độ xem trước nên biểu mẫu không được gửi.')
  }

  const restart = () => {
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

  if (!form) return null

  const color = form.primary_color || '#4285F4'
  const totalVisible = visibleIndexes.length
  const position = visibleIndexes.indexOf(pageIndex) + 1

  return (
    <>
      <div className="bg-yellow-50 border-b border-yellow-200 py-3 px-4 sticky top-0 z-50" data-preview-bar>
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-yellow-800">Chế độ xem trước</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={restart}
                className="flex items-center space-x-2 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-300 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-sm">Làm lại</span>
              </button>
              <button
                type="button"
                onClick={() => (window.opener ? window.close() : navigate(`/forms/${id}/edit`))}
                className="flex items-center space-x-2 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
                <span className="text-sm">Đóng</span>
              </button>
            </div>
          </div>
          {blocks.map((header) => (
            <VariantPicker key={header.key} header={header} assigned={assignments[header.key] || []} onPick={pickVariant} />
          ))}
        </div>
      </div>

      <FormFrame form={form} showDescription={pageIndex === visibleIndexes[0]}>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <PageProgress position={position} total={totalVisible} color={color} />

          {current?.pending ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-600">
              Phần ngẫu nhiên “{shortLabel(current.items[0]?.field)}” chưa có phiên bản nào nên người trả lời sẽ không thấy phần này.
            </div>
          ) : (
            current && <FormPageView page={current} headers={headers} answers={answers} errors={errors} onChange={handleChange} theme={form} />
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-3">
              {prevIndex !== undefined && (
                <button
                  type="button"
                  onClick={() => goTo(prevIndex)}
                  className="btn flex items-center justify-center space-x-2 transition-all px-6 py-2.5 rounded font-medium border"
                  style={{ borderColor: color, color, backgroundColor: '#ffffff' }}
                >
                  <span>Quay lại</span>
                </button>
              )}
              {/* Distinct keys: reusing one DOM button would turn the "Tiếp theo" click into a submit on the last page. */}
              {nextIndex !== undefined ? (
                <button
                  key="next"
                  type="button"
                  onClick={handleNext}
                  className="btn flex items-center justify-center space-x-2 transition-all px-8 py-2.5 rounded font-medium"
                  style={{ backgroundColor: color, color: '#ffffff' }}
                >
                  <span>Tiếp theo</span>
                </button>
              ) : (
                <button
                  key="submit"
                  type="submit"
                  className="btn flex items-center justify-center space-x-2 transition-all px-8 py-2.5 rounded font-medium"
                  style={{ backgroundColor: color, color: '#ffffff' }}
                >
                  <span>Gửi (xem trước)</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </FormFrame>
    </>
  )
}

function VariantPicker({ header, assigned, onPick }) {
  const variants = variantsOf(header)
  if (!variants.length) return null
  const rounds = pickCount(header)
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-yellow-900">
      <span className="font-medium">{shortLabel(header, 40) || 'Phần ngẫu nhiên'}:</span>
      {Array.from({ length: rounds }, (_, round) => (
        <label key={round} className="flex items-center gap-1">
          {rounds > 1 && <span>Lượt {round + 1}</span>}
          <select
            className="rounded border border-yellow-300 bg-white px-2 py-1 text-gray-800 max-w-xs"
            value={assigned[round] || ''}
            onChange={(e) => onPick(header.key, round, e.target.value)}
            aria-label={`Phiên bản ${rounds > 1 ? `lượt ${round + 1} ` : ''}của ${header.label || 'phần ngẫu nhiên'}`}
          >
            {variants.map((v, i) => (
              <option key={v.key} value={v.key}>
                {v.title || `Phiên bản ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  )
}
