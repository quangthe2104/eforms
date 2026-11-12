import { Plus, X } from 'lucide-react'
import { useFormStore } from '../../store/formStore'
import { CHOICE_TYPES, isAnswerable, choiceValues, shortLabel, findHeader, isDifferentMode } from '../../utils/formStructure'

const CHOICE_OPERATORS = [
  { value: 'includes_any', label: 'chọn một trong' },
  { value: 'not_includes_any', label: 'không chọn phương án nào trong' },
]
const ANSWER_OPERATORS = [
  { value: 'answered', label: 'đã trả lời' },
  { value: 'not_answered', label: 'chưa trả lời' },
]

/** Questions before `index` that a condition may depend on. */
function sourceFields(fields, index) {
  const self = fields[index]
  return fields.slice(0, index).filter((f) => {
    if (!isAnswerable(f)) return false
    // Inside a "different" block, another version's own questions are never answered alongside this one.
    if (f.random_group_key && f.variant_key && f.random_group_key === self.random_group_key) {
      const header = findHeader(fields, f.random_group_key)
      if (isDifferentMode(header) && self.variant_key && f.variant_key !== self.variant_key) return false
    }
    return true
  })
}

export default function ConditionEditor({ index, logic, onChange }) {
  const fields = useFormStore((s) => s.fields)
  const sources = sourceFields(fields, index)
  const rules = logic?.rules || []
  const enabled = rules.length > 0

  const update = (nextRules, match = logic?.match || 'all') => {
    onChange(nextRules.length ? { match, rules: nextRules } : null)
  }

  const newRule = () => {
    const source = sources[sources.length - 1]
    return {
      field_key: source?.key || '',
      operator: CHOICE_TYPES.includes(source?.type) ? 'includes_any' : 'answered',
      values: [],
    }
  }

  const setRule = (i, patch) => update(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  if (!sources.length) {
    return (
      <p className="text-xs text-gray-500">
        Điều kiện hiển thị cần một câu hỏi đứng trước câu này.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => update(e.target.checked ? [newRule()] : [])}
        />
        Chỉ hiển thị khi thỏa điều kiện
      </label>

      {enabled && (
        <div className="space-y-2 pl-6">
          {rules.length > 1 && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              Hiển thị khi
              <select
                className="eforms-adv-input"
                value={logic.match || 'all'}
                onChange={(e) => update(rules, e.target.value)}
              >
                <option value="all">thỏa tất cả điều kiện</option>
                <option value="any">thỏa ít nhất một điều kiện</option>
              </select>
            </div>
          )}

          {rules.map((rule, i) => {
            const source = sources.find((f) => f.key === rule.field_key)
            const isChoice = CHOICE_TYPES.includes(source?.type)
            const operators = isChoice ? [...CHOICE_OPERATORS, ...ANSWER_OPERATORS] : ANSWER_OPERATORS
            const needsValues = rule.operator === 'includes_any' || rule.operator === 'not_includes_any'
            return (
              <div key={i} className="eforms-condition-rule rounded border border-gray-200 bg-gray-50 p-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-gray-600">Câu</span>
                  <select
                    className="eforms-adv-input max-w-[22rem]"
                    value={rule.field_key}
                    onChange={(e) => {
                      const next = sources.find((f) => f.key === e.target.value)
                      setRule(i, {
                        field_key: e.target.value,
                        operator: CHOICE_TYPES.includes(next?.type) ? 'includes_any' : 'answered',
                        values: [],
                      })
                    }}
                  >
                    {!source && <option value={rule.field_key}>(câu không còn hợp lệ)</option>}
                    {sources.map((f) => (
                      <option key={f.key} value={f.key}>{shortLabel(f)}</option>
                    ))}
                  </select>
                  <select
                    className="eforms-adv-input"
                    value={rule.operator}
                    onChange={(e) => setRule(i, { operator: e.target.value })}
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="ml-auto text-gray-400 hover:text-red-600"
                    title="Xóa điều kiện"
                    onClick={() => update(rules.filter((_, j) => j !== i))}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {isChoice && needsValues && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {choiceValues(source).map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(rule.values || []).includes(value)}
                          onChange={(e) => {
                            const values = rule.values || []
                            setRule(i, { values: e.target.checked ? [...values, value] : values.filter((v) => v !== value) })
                          }}
                        />
                        {label}
                      </label>
                    ))}
                    {!(rule.values || []).length && (
                      <span className="text-xs text-amber-600">Chọn ít nhất một phương án.</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <button
            type="button"
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
            onClick={() => update([...rules, newRule()])}
          >
            <Plus className="w-4 h-4" /> Thêm điều kiện
          </button>
        </div>
      )}
    </div>
  )
}
