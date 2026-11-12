import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { formAPI, responseAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Calendar, User, Globe, Shuffle, Fingerprint } from 'lucide-react'
import { format } from 'date-fns'
import { normalizeFields, NON_ANSWER_TYPES, OTHER_VALUE, GRID_TYPES } from '../../utils/formStructure'
import { evaluateForm, paginate, choicesOf, otherDisplay, variantInfo } from '../../utils/formRuntime'
import { decodeValue, answersByKey, responseAssignments, assignmentSummary, IDENTITY_LABELS } from '../../utils/responseView'

const getFieldTypeName = (type) => {
  const typeNames = {
    short_text: 'Văn Bản Ngắn',
    long_text: 'Văn Bản Dài',
    email: 'Email',
    number: 'Số',
    phone: 'Số Điện Thoại',
    url: 'Liên Kết',
    date: 'Ngày Tháng',
    time: 'Thời Gian',
    datetime: 'Ngày & Thời Gian',
    dropdown: 'Danh Sách Thả Xuống',
    radio: 'Lựa Chọn Duy Nhất',
    checkbox: 'Hộp Kiểm',
    multiple_choice_grid: 'Lưới Lựa Chọn Duy Nhất',
    checkbox_grid: 'Lưới Hộp Kiểm',
    file_upload: 'Tải Lên Tệp',
    rating: 'Đánh Giá',
    scale: 'Thang Điểm',
    section: 'Tiêu Đề Phần',
  }
  return typeNames[type] || type
}

const Muted = ({ children }) => <span className="text-gray-400 italic">{children}</span>
const Chip = ({ children }) => (
  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 text-primary-800">{children}</span>
)

export default function ResponseDetail() {
  const { id, responseId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [id, responseId])

  const fetchData = async () => {
    try {
      const [formRes, responseRes] = await Promise.all([formAPI.getOne(id), responseAPI.getOne(id, responseId)])
      setForm(formRes.data)
      setResponse(responseRes.data)
    } catch (error) {
      toast.error('Không thể tải chi tiết phản hồi')
      navigate(`/forms/${id}/responses`)
    } finally {
      setLoading(false)
    }
  }

  const fields = useMemo(() => normalizeFields(form?.fields || []), [form])
  const byKey = useMemo(() => Object.fromEntries(fields.filter((f) => f.key).map((f) => [f.key, f])), [fields])
  const stored = useMemo(() => answersByKey(response), [response])
  const pages = useMemo(() => {
    const values = Object.fromEntries(
      Object.entries(stored)
        .filter(([, a]) => a.value != null)
        .map(([k, a]) => [k, decodeValue(a.value)])
    )
    return paginate(evaluateForm(fields, responseAssignments(fields, response), values))
  }, [fields, stored, response])
  const assigned = useMemo(() => assignmentSummary(fields, response), [fields, response])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  const identities = response?.identity_methods || []
  let number = 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={() => navigate(`/forms/${id}/responses`)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chi Tiết Phản Hồi</h1>
          <p className="text-sm text-gray-600">{form?.title}</p>
        </div>
      </div>

      {/* Response Info Card */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Thông Tin Phản Hồi</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoItem icon={<Calendar className="w-5 h-5 text-primary-600" />} tone="bg-primary-100" label="Thời gian gửi">
            {response?.submitted_at ? format(new Date(response.submitted_at), 'dd/MM/yyyy HH:mm:ss') : 'N/A'}
          </InfoItem>
          <InfoItem icon={<User className="w-5 h-5 text-blue-600" />} tone="bg-blue-100" label="Người gửi">
            {response?.user?.name || response?.user?.email || 'Ẩn danh'}
          </InfoItem>
          <InfoItem icon={<Globe className="w-5 h-5 text-green-600" />} tone="bg-green-100" label="Địa chỉ IP">
            {response?.ip_address || 'N/A'}
          </InfoItem>
          <InfoItem icon={<span className="text-lg font-bold text-purple-600">#{response?.id}</span>} tone="bg-purple-100" label="Mã phản hồi">
            Response ID: {response?.id}
          </InfoItem>
          {assigned.length > 0 && (
            <InfoItem icon={<Shuffle className="w-5 h-5 text-amber-600" />} tone="bg-amber-100" label="Phiên bản được giao">
              <span data-assigned-variants>
                {assigned.map((a) => (
                  <span key={a.key} className="block">
                    {a.label}: {a.titles.join(', ')}
                  </span>
                ))}
              </span>
            </InfoItem>
          )}
          {identities.length > 0 && (
            <InfoItem icon={<Fingerprint className="w-5 h-5 text-teal-600" />} tone="bg-teal-100" label="Căn cứ nhận diện">
              {identities.map((m) => IDENTITY_LABELS[m] || m).join(', ')}
            </InfoItem>
          )}
        </div>
      </div>

      {/* Answers */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Câu Trả Lời</h2>
        <div className="space-y-8">
          {pages.map((page) => {
            const items = page.items.filter((i) => !NON_ANSWER_TYPES.includes(i.field.type))
            const heading = pageHeading(page, fields)
            if (!items.length && !heading) return null
            return (
              <section key={page.index} className="space-y-8">
                {heading}
                {items.map((inst) => {
                  number += 1
                  return (
                    <div key={inst.answerKey} className="border-b border-gray-200 pb-8 last:border-b-0 last:pb-0" data-answer-key={inst.answerKey}>
                      <div className="mb-4">
                        <div className="flex items-start space-x-3">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm flex-shrink-0">
                            {number}
                          </span>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {inst.field.label}
                              {inst.field.is_required && <span className="text-red-500 ml-1">*</span>}
                            </h3>
                            {inst.field.help_text && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{inst.field.help_text}</p>}
                            <p className="text-xs text-gray-500 mt-1">
                              Loại: <span className="font-medium">{getFieldTypeName(inst.field.type)}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-11 p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 shadow-sm" data-answer>
                        <AnswerCell inst={inst} page={page} answer={stored[inst.answerKey]} byKey={byKey} />
                      </div>
                    </div>
                  )
                })}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function InfoItem({ icon, tone, label, children }) {
  return (
    <div className="flex items-center space-x-3">
      <div className={`w-10 h-10 ${tone} rounded-lg flex items-center justify-center shrink-0`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <div className="font-medium text-gray-900">{children}</div>
      </div>
    </div>
  )
}

/** Page break title, or the block + variant the page belongs to. */
function pageHeading(page, fields) {
  const section = page.items.find((i) => i.field.type === 'section')
  const header = page.group ? fields.find((f) => f.key === page.group) : null
  if (!section && !header) return null

  let variantLine = null
  if (header && page.pending) variantLine = <Muted>Không được giao phiên bản nào</Muted>
  else if (header && page.variant) {
    const info = variantInfo(header, page.variant)
    variantLine = (
      <>
        {info.label}: <strong data-variant-title>{info.title || `${page.variant} (đã xóa)`}</strong>
      </>
    )
  }

  return (
    <div className="rounded-lg bg-gray-50 border-l-4 border-primary-500 px-4 py-3" data-page-heading>
      {header && <p className="font-semibold text-gray-900">{header.label || 'Phần ngẫu nhiên'}</p>}
      {variantLine && <p className="text-sm text-gray-700 mt-0.5">{variantLine}</p>}
      {section && <p className={header ? 'text-sm text-gray-700 mt-1' : 'font-semibold text-gray-900'}>{section.field.label}</p>}
      {!page.visible && <p className="text-xs text-gray-500 mt-1">(Trang này không hiển thị với người trả lời)</p>}
    </div>
  )
}

function AnswerCell({ inst, page, answer, byKey }) {
  const { field } = inst
  if (answer && (answer.hidden || field.settings?.store_hash_only)) return <Muted>(đã ẩn — chỉ lưu mã băm để chặn trùng)</Muted>

  const hasValue = answer && (answer.file_path || answer.value != null)
  if (!hasValue) return <Muted>{inst.visible && page.visible ? 'Không có câu trả lời' : '(không hiển thị)'}</Muted>

  return (
    <>
      <AnswerValue field={field} answer={answer} byKey={byKey} />
      {inst.autoValue !== undefined && <p className="text-xs text-gray-500 mt-2">Tự ghi từ câu trước (chỉ có một lựa chọn).</p>}
    </>
  )
}

function AnswerValue({ field, answer, byKey }) {
  if (answer.file_path) {
    return (
      <a
        href={answer.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
      >
        <span>Xem tệp đã tải lên</span>
      </a>
    )
  }

  const value = decodeValue(answer.value)

  if (['radio', 'dropdown', 'checkbox'].includes(field.type)) {
    const { selected, other } = choicesOf(value)
    const source = (field.settings?.piped_from && byKey[field.settings.piped_from]) || field
    const labels = selected.map((v) => (v === OTHER_VALUE ? otherDisplay(source, other) : v))
    if (field.type === 'checkbox') {
      return (
        <div className="space-y-2">
          {labels.map((label, idx) => (
            <div key={idx} className="flex items-center space-x-3 p-2 bg-white rounded-lg">
              <div className="w-5 h-5 bg-primary-600 rounded flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-900">{label}</span>
            </div>
          ))}
        </div>
      )
    }
    return (
      <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm bg-primary-100 text-primary-800 font-medium">{labels.join(', ')}</span>
    )
  }

  if (GRID_TYPES.includes(field.type) && value && typeof value === 'object' && !Array.isArray(value)) {
    const rows = [...(field.rows || []), ...Object.keys(value).filter((r) => !(field.rows || []).includes(r))]
    return (
      <div className="space-y-3">
        {rows.map((row) => {
          const cell = value[row]
          const items = (Array.isArray(cell) ? cell : [cell]).filter((v) => v != null && v !== '')
          return (
            <div key={row} className="border-l-4 border-primary-500 pl-4 py-2 bg-white">
              <div className="font-semibold text-gray-900 mb-1">{row}</div>
              <div className="flex flex-wrap gap-2">{items.length ? items.map((item, idx) => <Chip key={idx}>{item}</Chip>) : <Muted>—</Muted>}</div>
            </div>
          )
        })}
      </div>
    )
  }

  if (value && typeof value === 'object') return <span className="text-gray-900">{JSON.stringify(value)}</span>
  if (field.type === 'long_text') return <div className="text-gray-900 whitespace-pre-wrap leading-relaxed">{String(value)}</div>
  return <span className="text-gray-900">{String(value)}</span>
}
