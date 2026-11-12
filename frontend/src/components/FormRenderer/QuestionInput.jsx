import { OTHER_VALUE } from '../../utils/formStructure'
import { choicesOf, makeChoiceValue, missingRows } from '../../utils/formRuntime'

const optionList = (field, piped) => {
  if (piped) return piped.options.map((v) => ({ value: v, label: piped.labels?.[v] ?? v }))
  const list = (field.options || []).map((o) => ({ value: o, label: o }))
  if (field.settings?.other_option?.enabled) {
    list.push({ value: OTHER_VALUE, label: field.settings.other_option.label || 'Khác', isOther: true })
  }
  return list
}

export function choiceHint(field) {
  if (field.type !== 'checkbox') return null
  const min = parseInt(field.settings?.min_select, 10) || 0
  const max = parseInt(field.settings?.max_select, 10) || 0
  if (min && max && min === max) return `Chọn đúng ${min} phương án.`
  if (min && max) return `Chọn từ ${min} đến ${max} phương án.`
  if (max) return `Chọn tối đa ${max} phương án.`
  if (min) return `Chọn ít nhất ${min} phương án.`
  return null
}

function OtherInput({ value, onChange, disabled, invalid }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Xin ghi rõ"
      className={`input mt-2 ${invalid ? 'border-red-400' : ''}`}
      aria-label="Nội dung phương án khác"
    />
  )
}

/**
 * Input for one question instance. `name` must be unique per instance (answer key),
 * `piped` replaces the options of a question whose choices come from an earlier answer.
 */
export default function QuestionInput({ field, name, value, onChange, error, piped }) {
  const text = (type, extra = {}) => (
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || ''}
      className="input"
      {...extra}
    />
  )

  switch (field.type) {
    case 'short_text':
      return text('text', { placeholder: field.placeholder || 'Câu trả lời của bạn' })
    case 'long_text':
      return (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || 'Câu trả lời của bạn'}
          className="input"
          rows="4"
        />
      )
    case 'email':
      return text('email', { autoComplete: 'email' })
    case 'phone':
      return text('tel', { inputMode: 'tel', autoComplete: 'tel', placeholder: field.placeholder || '0912345678' })
    case 'url':
      return text('url')
    case 'date':
      return text('date')
    case 'time':
      return text('time')
    case 'datetime':
      return text('datetime-local')
    case 'number': {
      const n = field.settings?.number || {}
      const digits = parseInt(n.digits, 10) || 0
      return text('text', {
        inputMode: digits ? 'numeric' : 'decimal',
        maxLength: digits ? digits + 1 : undefined,
        placeholder: field.placeholder || (n.min != null && n.max != null && n.min !== '' && n.max !== '' ? `${n.min} – ${n.max}` : ''),
        className: 'input max-w-xs',
      })
    }

    case 'radio':
    case 'dropdown':
      return <SingleChoice field={field} name={name} value={value} onChange={onChange} error={error} piped={piped} />
    case 'checkbox':
      return <MultiChoice field={field} value={value} onChange={onChange} error={error} />
    case 'multiple_choice_grid':
    case 'checkbox_grid':
      return <Grid field={field} name={name} value={value} onChange={onChange} error={error} />

    case 'file_upload':
      return <input type="file" onChange={(e) => onChange(e.target.files[0] || null)} className="input" />

    case 'rating': {
      const rating = parseInt(value, 10) || 0
      return (
        <div className="flex space-x-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className={`text-3xl transition-colors ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
            >
              ★
            </button>
          ))}
        </div>
      )
    }

    case 'scale':
      return (
        <div className="space-y-2">
          <input type="range" min="1" max="10" value={value || 5} onChange={(e) => onChange(e.target.value)} className="w-full" />
          <div className="flex justify-between text-sm text-gray-600">
            <span>1</span>
            <span className="font-semibold">{value || 5}</span>
            <span>10</span>
          </div>
        </div>
      )

    default:
      return null
  }
}

function SingleChoice({ field, name, value, onChange, error, piped }) {
  const { selected, other } = choicesOf(value)
  const current = selected[0] ?? ''
  const options = optionList(field, piped)
  const otherText = isOtherText(value)
  const pick = (choice) => onChange(makeChoiceValue(choice ? [choice] : [], otherText, false))
  const setOther = (t) => onChange(makeChoiceValue([OTHER_VALUE], t, false))
  const showOther = !piped && current === OTHER_VALUE
  const otherInvalid = showOther && !other && !!error

  if (field.type === 'dropdown') {
    return (
      <div>
        <select value={current} onChange={(e) => pick(e.target.value)} className="input">
          <option value="">Chọn một tùy chọn</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {showOther && <OtherInput value={otherText} onChange={setOther} invalid={otherInvalid} />}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {options.map((o) => (
        <div key={o.value}>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name={`q-${name}`}
              value={o.value}
              checked={current === o.value}
              onChange={() => pick(o.value)}
              className="w-4 h-4 mt-0.5 shrink-0 text-primary-600"
            />
            <span>{o.label}</span>
          </label>
          {o.isOther && showOther && (
            <div className="pl-6">
              <OtherInput value={otherText} onChange={setOther} invalid={otherInvalid} />
            </div>
          )}
        </div>
      ))}
      {current && !field.is_required && (
        <button type="button" onClick={() => pick('')} className="text-xs text-gray-500 hover:text-gray-700 underline">
          Bỏ chọn
        </button>
      )}
    </div>
  )
}

const isOtherText = (value) => (value && typeof value === 'object' && !Array.isArray(value) && typeof value.other === 'string' ? value.other : null)

function MultiChoice({ field, value, onChange, error }) {
  const { selected, other } = choicesOf(value)
  const s = field.settings || {}
  const exclusive = (s.exclusive_options || []).map(String)
  const max = parseInt(s.max_select, 10) || 0
  const otherText = isOtherText(value)
  const options = optionList(field, null)
  const full = max > 0 && selected.length >= max

  const toggle = (choice, checked) => {
    let next
    if (!checked) next = selected.filter((v) => v !== choice)
    else if (exclusive.includes(choice)) next = [choice]
    else next = [...selected.filter((v) => !exclusive.includes(v)), choice]
    onChange(makeChoiceValue(next, otherText, true))
  }

  return (
    <div className="space-y-2">
      {options.map((o) => {
        const checked = selected.includes(o.value)
        const blocked = !checked && full && !exclusive.includes(o.value)
        return (
          <div key={o.value}>
            <label className={`flex items-start gap-2 ${blocked ? 'cursor-not-allowed text-gray-400' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                value={o.value}
                checked={checked}
                disabled={blocked}
                onChange={(e) => toggle(o.value, e.target.checked)}
                className="w-4 h-4 mt-0.5 shrink-0 text-primary-600"
              />
              <span>{o.label}</span>
            </label>
            {o.isOther && checked && (
              <div className="pl-6">
                <OtherInput
                  value={otherText}
                  onChange={(t) => onChange(makeChoiceValue(selected, t, true))}
                  invalid={!other && !!error}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Grid({ field, name, value, onChange, error }) {
  if (!field.rows?.length || !field.columns?.length) return null
  const multi = field.type === 'checkbox_grid'
  const current = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const missing = error ? new Set(missingRows(field, current)) : new Set()

  const set = (row, column, checked) => {
    if (!multi) return onChange({ ...current, [row]: column })
    const rowValues = Array.isArray(current[row]) ? current[row] : []
    onChange({ ...current, [row]: checked ? [...rowValues, column] : rowValues.filter((v) => v !== column) })
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-medium text-gray-700"></th>
            {field.columns.map((column) => (
              <th key={column} className="border-b border-gray-300 px-3 py-3 text-center text-sm font-medium text-gray-700">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {field.rows.map((row, rowIdx) => (
            <tr key={row} className={missing.has(row) ? 'bg-red-50' : 'hover:bg-gray-50'}>
              <td className="border-b border-gray-300 px-4 py-3 text-sm text-gray-700">{row}</td>
              {field.columns.map((column) => (
                <td key={column} className="border-b border-gray-300 px-3 py-3 text-center">
                  <input
                    type={multi ? 'checkbox' : 'radio'}
                    name={`q-${name}-r${rowIdx}`}
                    value={column}
                    aria-label={`${row}: ${column}`}
                    checked={multi ? !!current[row]?.includes?.(column) : current[row] === column}
                    onChange={(e) => set(row, column, e.target.checked)}
                    className="w-4 h-4"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
