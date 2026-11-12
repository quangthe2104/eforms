import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useFormStore } from '../../store/formStore'
import ConditionEditor from './ConditionEditor'
import { GRID_TYPES, shortLabel, findHeader, isDifferentMode, variantsOf } from '../../utils/formStructure'

const toNumber = (value) => (value === '' || value == null ? undefined : Number(value))

/** Short descriptions of the advanced options in use, shown on collapsed cards. */
export function advancedSummary(field) {
  const s = field.settings || {}
  const items = []
  if (field.conditional_logic?.rules?.length) items.push('Hiển thị theo điều kiện')
  if (s.piped_from) items.push('Đáp án lấy từ câu trước')
  if (s.min_select && s.max_select && s.min_select === s.max_select) items.push(`Chọn đúng ${s.min_select}`)
  else {
    if (s.min_select) items.push(`Chọn tối thiểu ${s.min_select}`)
    if (s.max_select) items.push(`Chọn tối đa ${s.max_select}`)
  }
  if (s.exclusive_options?.length) items.push(`${s.exclusive_options.length} phương án loại trừ`)
  if (s.require_all_rows) items.push('Trả lời đủ mọi dòng')
  if (s.number && (s.number.digits || s.number.min != null || s.number.max != null)) {
    const parts = []
    if (s.number.digits) parts.push(`tối đa ${s.number.digits} chữ số`)
    if (s.number.min != null && s.number.max != null) parts.push(`từ ${s.number.min} đến ${s.number.max}`)
    else if (s.number.min != null) parts.push(`≥ ${s.number.min}`)
    else if (s.number.max != null) parts.push(`≤ ${s.number.max}`)
    items.push(`Số ${parts.join(', ')}`)
  }
  if (s.store_hash_only) items.push('Chỉ lưu mã băm')
  return items
}

function NumberInput({ value, onChange, min, placeholder }) {
  return (
    <input
      type="number"
      className="eforms-adv-input w-24"
      value={value ?? ''}
      min={min}
      placeholder={placeholder}
      onChange={(e) => onChange(toNumber(e.target.value))}
      onFocus={(e) => e.stopPropagation()}
    />
  )
}

export default function AdvancedOptions({ field, index, onUpdate }) {
  const [open, setOpen] = useState(false)
  const fields = useFormStore((s) => s.fields)
  const settings = field.settings || {}
  const type = field.type
  const options = field.options || []

  const setSettings = (patch) => {
    const next = { ...settings, ...patch }
    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined || patch[k] === null) delete next[k]
    })
    onUpdate({ settings: next })
  }

  const header = field.random_group_key ? findHeader(fields, field.random_group_key) : null
  const pipedSources = fields.slice(0, index).filter((f) => f.type === 'checkbox')
  const summary = advancedSummary(field)

  const minSelect = settings.min_select
  const maxSelect = settings.max_select
  const selectWarning =
    (minSelect && maxSelect && minSelect > maxSelect && 'Số tối thiểu đang lớn hơn số tối đa.') ||
    (maxSelect && maxSelect > options.length + (settings.other_option?.enabled ? 1 : 0) && 'Số tối đa lớn hơn số phương án.') ||
    null

  const number = settings.number || {}
  const setNumber = (patch) => {
    const next = { ...number, ...patch }
    Object.keys(next).forEach((k) => next[k] === undefined && delete next[k])
    setSettings({ number: Object.keys(next).length ? next : undefined })
  }

  return (
    <div className="eforms-adv mt-4 border-t border-gray-100 pt-3" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Tùy chọn nâng cao
        {!open && summary.length > 0 && (
          <span className="ml-2 text-xs font-normal text-gray-500">({summary.join(' · ')})</span>
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-4 pl-5">
          {header && isDifferentMode(header) && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              Thuộc phiên bản
              <select
                className="eforms-adv-input"
                value={field.variant_key || ''}
                onChange={(e) => onUpdate({ variant_key: e.target.value || null })}
              >
                <option value="">Dùng chung cho mọi phiên bản</option>
                {variantsOf(header).map((v) => (
                  <option key={v.key} value={v.key}>{v.title || v.key}</option>
                ))}
              </select>
            </div>
          )}

          {type === 'checkbox' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                <span>Chọn tối thiểu</span>
                <NumberInput value={minSelect} min={1} placeholder="—" onChange={(v) => setSettings({ min_select: v || undefined })} />
                <span>tối đa</span>
                <NumberInput value={maxSelect} min={1} placeholder="—" onChange={(v) => setSettings({ max_select: v || undefined })} />
                <span className="text-xs text-gray-500">Để trống nếu không giới hạn.</span>
              </div>
              {selectWarning && <p className="text-xs text-amber-600">{selectWarning}</p>}

              <div>
                <div className="text-sm text-gray-700 mb-1">Phương án loại trừ</div>
                <p className="text-xs text-gray-500 mb-1">
                  Chọn phương án loại trừ sẽ bỏ các phương án khác, và ngược lại.
                </p>
                <div className="flex flex-col gap-1">
                  {options.map((opt, i) => (
                    <label key={i} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(settings.exclusive_options || []).includes(opt)}
                        onChange={(e) => {
                          const list = settings.exclusive_options || []
                          const next = e.target.checked ? [...list, opt] : list.filter((o) => o !== opt)
                          setSettings({ exclusive_options: next.length ? next : undefined })
                        }}
                      />
                      {opt || `Tùy chọn ${i + 1}`}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(type === 'radio' || type === 'dropdown') && (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                Đáp án lấy từ câu trước
                <select
                  className="eforms-adv-input max-w-[22rem]"
                  value={settings.piped_from || ''}
                  onChange={(e) => setSettings({ piped_from: e.target.value || undefined })}
                >
                  <option value="">Không dùng</option>
                  {pipedSources.map((f) => (
                    <option key={f.key} value={f.key}>{shortLabel(f)}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500">
                Phương án là những lựa chọn người trả lời đã tích ở câu hộp kiểm nguồn. Nếu họ chỉ tích 1 lựa chọn,
                câu này được ẩn và tự ghi lựa chọn đó; nếu họ chọn phương án loại trừ hoặc không chọn gì, câu này ẩn và để trống.
              </p>
              {!pipedSources.length && (
                <p className="text-xs text-amber-600">Chưa có câu hộp kiểm nào đứng trước câu này.</p>
              )}
            </div>
          )}

          {GRID_TYPES.includes(type) && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.require_all_rows}
                onChange={(e) => setSettings({ require_all_rows: e.target.checked || undefined })}
              />
              Bắt buộc trả lời mọi dòng
              {!field.is_required && settings.require_all_rows && (
                <span className="text-xs text-amber-600">(chỉ áp dụng khi bật "Bắt buộc")</span>
              )}
            </label>
          )}

          {type === 'number' && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
              <span>Tối đa</span>
              <NumberInput value={number.digits} min={1} placeholder="—" onChange={(v) => setNumber({ digits: v || undefined })} />
              <span>chữ số (số nguyên). Giá trị từ</span>
              <NumberInput value={number.min} placeholder="—" onChange={(v) => setNumber({ min: v })} />
              <span>đến</span>
              <NumberInput value={number.max} placeholder="—" onChange={(v) => setNumber({ max: v })} />
              {number.min != null && number.max != null && number.min > number.max && (
                <span className="text-xs text-amber-600">Giá trị nhỏ nhất đang lớn hơn giá trị lớn nhất.</span>
              )}
            </div>
          )}

          {(type === 'email' || type === 'phone') && (
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!settings.store_hash_only}
                  onChange={(e) => setSettings({ store_hash_only: e.target.checked || undefined })}
                />
                Chỉ lưu mã băm (không lưu {type === 'email' ? 'email' : 'số điện thoại'})
              </label>
              <p className="text-xs text-gray-500 pl-6">
                Giá trị bị ẩn khỏi trang câu trả lời và file Excel, chỉ dùng để chặn trả lời trùng.
                {type === 'phone' && ' Số điện thoại phải là số di động Việt Nam 10 chữ số.'}
              </p>
            </div>
          )}

          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">Hiển thị theo điều kiện</div>
            <ConditionEditor
              index={index}
              logic={field.conditional_logic}
              onChange={(logic) => onUpdate({ conditional_logic: logic })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
