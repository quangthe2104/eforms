import { useEffect, useRef, useState } from 'react'
import { responseAPI } from '../services/api'
import toast from 'react-hot-toast'
import html2canvas from 'html2canvas'
import { Shuffle } from 'lucide-react'
import QuestionBox from './QuestionBox'

const groupsByKey = (summary) => Object.fromEntries((summary.groups || []).map((g) => [g.key, g]))

/** Question list with each random section's card placed before its first question. */
function withGroupCards(summary) {
  const groups = groupsByKey(summary)
  const placed = new Set()
  const out = []
  for (const field of summary.fields) {
    const group = groups[field.group_key]
    if (group && !placed.has(group.key)) {
      placed.add(group.key)
      out.push({ group })
    }
    out.push({ field })
  }
  for (const group of summary.groups || []) if (!placed.has(group.key)) out.push({ group })
  return out
}

/** Assigned / submitted counts per variant, and the filter for the block's questions. */
function VariantStats({ group, onFilter }) {
  return (
    <div className="eforms-question" data-variant-stats={group.key}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-amber-600" />
            {group.label}
          </h3>
          <p className="text-sm text-gray-600">
            Phần ngẫu nhiên · {group.mode === 'different' ? 'câu hỏi khác nhau theo phiên bản' : 'câu hỏi giống nhau'} · mỗi người{' '}
            {group.pick_count} phiên bản
          </p>
        </div>
        <label className="text-sm text-gray-700 flex items-center gap-2">
          Lọc các câu trong phần này theo phiên bản
          <select
            className="rounded border border-gray-300 px-2 py-1"
            value={group.filter || ''}
            onChange={(e) => onFilter(group.key, e.target.value)}
            aria-label={`Lọc theo phiên bản của ${group.label}`}
          >
            <option value="">Tất cả phiên bản</option>
            {group.variants.map((v) => (
              <option key={v.key} value={v.key}>
                {v.title}
                {v.deleted ? ' (đã xóa)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <table className="min-w-full text-sm border border-gray-200">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="text-left px-3 py-2 border-b">Phiên bản</th>
            <th className="text-right px-3 py-2 border-b" title="Gồm cả người đã được giao nhưng chưa gửi (trong 30 ngày gần nhất)">
              Được giao
            </th>
            <th className="text-right px-3 py-2 border-b">Đã gửi</th>
          </tr>
        </thead>
        <tbody>
          {group.variants.map((v) => (
            <tr key={v.key} className={group.filter === v.key ? 'bg-amber-50 font-medium' : ''}>
              <td className="px-3 py-1.5 border-b">
                {v.title}
                {v.deleted && <span className="text-gray-400"> (đã xóa)</span>}
              </td>
              <td className="px-3 py-1.5 border-b text-right tabular-nums">{v.assigned}</td>
              <td className="px-3 py-1.5 border-b text-right tabular-nums">{v.submitted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function FormSummary({ formId }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({})
  const [copiedFields, setCopiedFields] = useState({}) // Track which field was copied
  const latestRequest = useRef(0)

  useEffect(() => {
    fetchSummary(filter)
  }, [formId, filter])

  const fetchSummary = async (variants) => {
    const request = ++latestRequest.current
    try {
      if (!summary) setLoading(true)
      const response = await responseAPI.getSummary(formId, Object.keys(variants).length ? variants : undefined)
      if (request === latestRequest.current) setSummary(response.data)
    } catch (error) {
      console.error('Error fetching summary:', error)
      toast.error('Không thể tải dữ liệu báo cáo')
    } finally {
      if (request === latestRequest.current) setLoading(false)
    }
  }

  const setGroupFilter = (groupKey, variantKey) =>
    setFilter((prev) => {
      const next = { ...prev }
      if (variantKey) next[groupKey] = variantKey
      else delete next[groupKey]
      return next
    })

  const handleCopyQuestionBox = async (fieldId) => {
    try {
      const questionElement = document.querySelector(`[data-question-id="${fieldId}"]`)
      if (!questionElement) {
        toast.error('Không tìm thấy nội dung để sao chép')
        return
      }

      // Wait a bit for chart to fully render
      await new Promise(resolve => setTimeout(resolve, 800))
      
      const canvas = await html2canvas(questionElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
      })

      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('Không thể tạo ảnh')
          return
        }

        // Check if clipboard API is available
        if (!navigator.clipboard || !navigator.clipboard.write || !window.ClipboardItem) {
          toast.error('Clipboard API không khả dụng. Vui lòng sử dụng HTTPS hoặc trình duyệt hỗ trợ Clipboard API.')
          return
        }

        try {
          // Copy to clipboard
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob
            })
          ])
          setCopiedFields(prev => ({ ...prev, [fieldId]: true }))
          toast.success('Đã sao chép vào clipboard! Bạn có thể dán (Ctrl+V) vào tài liệu.')
          setTimeout(() => {
            setCopiedFields(prev => {
              const newState = { ...prev }
              delete newState[fieldId]
              return newState
            })
          }, 3000)
        } catch (err) {
          console.error('Error copying to clipboard:', err)
          toast.error('Không thể sao chép vào clipboard. Vui lòng sử dụng HTTPS hoặc kiểm tra quyền truy cập clipboard.')
        }
      }, 'image/png')
    } catch (error) {
      console.error('Error copying question box:', error)
      toast.error('Không thể sao chép nội dung')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  if (!summary || !summary.fields || summary.fields.length === 0) {
    return (
      <div className="card text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có dữ liệu</h3>
        <p className="text-gray-600">
          Chưa có phản hồi nào để hiển thị báo cáo
        </p>
      </div>
    )
  }

  return (
    <div className="eforms-content">
      <div className="eforms-main">
        <div className="eforms-container space-y-4">
          {summary.fields.length === 0 ? (
            <div className="eforms-header">
              <div className="eforms-header-content text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có dữ liệu</h3>
                <p className="text-gray-600">
                  Chưa có câu hỏi nào có câu trả lời để hiển thị báo cáo
                </p>
              </div>
            </div>
          ) : (
            withGroupCards(summary).map((item) =>
              item.group ? (
                <VariantStats key={`group-${item.group.key}`} group={item.group} onFilter={setGroupFilter} />
              ) : (
                <QuestionBox
                  key={item.field.field_id}
                  field={item.field}
                  summary={summary}
                  group={groupsByKey(summary)[item.field.group_key]}
                  onCopy={() => handleCopyQuestionBox(item.field.field_id)}
                  isCopied={copiedFields[item.field.field_id]}
                />
              )
            )
          )}
        </div>
      </div>
    </div>
  )
}

