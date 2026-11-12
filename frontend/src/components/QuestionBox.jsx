import { useRef } from 'react'
import { Copy, Check } from 'lucide-react'
import ChartWrapper from './ChartWrapper'

export default function QuestionBox({ field, summary, group, onCopy, isCopied }) {
  const questionRef = useRef(null)

  // Only show copy button for fields with charts (not text lists or empty data)
  const showCopyButton = field.chart_type && 
                         field.chart_type !== 'none' && 
                         field.chart_type !== 'text_list' &&
                         field.data

  const base = field.base ?? summary.total_responses
  const variantTitle = group && field.variant_key ? group.variants.find((v) => v.key === field.variant_key)?.title : null
  const filterTitle = group?.filter ? group.variants.find((v) => v.key === group.filter)?.title : null
  const others = field.data?.other_values || []

  return (
    <div 
      ref={questionRef}
      data-question-id={field.field_id}
      className="eforms-question relative"
    >
      {/* Copy button - positioned at top right */}
      {showCopyButton && (
        <button
          onClick={onCopy}
          className="absolute top-4 right-4 flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors z-10"
          title="Sao chép toàn bộ nội dung"
        >
          {isCopied ? (
            <>
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-green-600">Đã sao chép!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Sao chép biểu đồ</span>
            </>
          )}
        </button>
      )}

      <div className="mb-4 pr-24">
        {group && (
          <p className="text-xs font-medium text-amber-700 mb-1" data-group-tag>
            {group.label}
            {variantTitle ? ` · chỉ phiên bản ${variantTitle}` : filterTitle ? ` · đang lọc: ${filterTitle}` : ''}
          </p>
        )}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {field.label}
        </h3>
        <p className="text-sm text-gray-600">
          {field.total_answers > 0 ? (
            <>
              {field.total_answers} câu trả lời
              {base > 0 && (
                <span className="ml-2">
                  ({Math.round((field.total_answers / base) * 100)}% {group ? 'số lượt được giao phần này' : 'tổng số phản hồi'})
                </span>
              )}
            </>
          ) : (
            '0 câu trả lời'
          )}
        </p>
      </div>
      
      {field.hidden ? (
        <p className="text-sm italic text-gray-500" data-hidden-note>
          Câu này chỉ lưu mã băm để chặn trả lời trùng, nội dung không được lưu.
        </p>
      ) : (
        <div className="mt-6">
          <ChartWrapper
            field={field}
            data={field.data}
            totalResponses={base}
          />
        </div>
      )}

      {others.length > 0 && (
        <details className="mt-4 text-sm" data-other-values>
          <summary className="cursor-pointer font-medium text-gray-700">
            Nội dung ghi ở “{field.data.other_label}” ({others.length})
          </summary>
          <ul className="mt-2 max-h-60 overflow-y-auto space-y-1 border-l-2 border-gray-200 pl-3 text-gray-700">
            {others.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
