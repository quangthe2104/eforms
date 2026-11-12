import { useState } from 'react'
import { GripVertical, Copy, Trash2, Shuffle, Plus, ChevronDown, ChevronRight, SeparatorHorizontal } from 'lucide-react'
import { useSortable, SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import toast from 'react-hot-toast'
import { useFormStore } from '../../store/formStore'
import RichTextEditor from './RichTextEditor'
import ConditionEditor from './ConditionEditor'
import Tooltip from '../editor/Tooltip'
import {
  GRID_TYPES, newVariantKey, blockEnd, cloneFields, insertAt, pruneReferences, removeFieldAt,
  referencesTo, variantsOf, shortLabel, DEFAULT_VARIANT_LABEL,
} from '../../utils/formStructure'

const stop = (e) => e.stopPropagation()

export default function RandomSectionCard({ field, index, isActive, onClick, theme, activeVariant, onSelectVariant, hasResponses }) {
  const { updateField, setFields, duplicateField } = useFormStore()
  const fields = useFormStore((s) => s.fields)
  const [showCondition, setShowCondition] = useState(false)
  const [copySource, setCopySource] = useState('')

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.key })
  const variantSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const settings = field.settings || {}
  const variants = variantsOf(field)
  const mode = settings.mode || 'same'
  const pickCount = settings.pick_count || 1
  const filter = settings.filter || null
  const members = fields.filter((f) => f.random_group_key === field.key)
  const ownCount = (vKey) => members.filter((f) => f.variant_key === vKey).length
  const sharedCount = members.filter((f) => !f.variant_key).length

  const gridSources = fields.slice(0, index).filter((f) => GRID_TYPES.includes(f.type) && !f.random_group_key)
  const filterSource = filter?.field_key ? fields.find((f) => f.key === filter.field_key) : null
  const sourceRows = filterSource?.rows || []
  const rowFor = (v, i) => filter?.row_map?.[v.key] ?? sourceRows[i] ?? ''

  const setSettings = (patch) => updateField(index, { settings: { ...settings, ...patch } })
  const accent = theme?.primary_color || '#4285F4'

  const replaceFields = (mapper) => {
    const current = useFormStore.getState().fields
    setFields(pruneReferences(mapper(current)))
  }

  const updateVariant = (vKey, patch) => {
    setSettings({ variants: variants.map((v) => (v.key === vKey ? { ...v, ...patch } : v)) })
  }

  const addVariant = () => {
    const variant = { key: newVariantKey(), title: `Phiên bản ${variants.length + 1}`, description: '' }
    const patch = { variants: [...variants, variant] }
    if (filter) {
      patch.filter = { ...filter, row_map: { ...(filter.row_map || {}), [variant.key]: sourceRows[variants.length] ?? '' } }
    }
    setSettings(patch)
  }

  const removeVariant = (variant) => {
    const own = ownCount(variant.key)
    let message = own
      ? `Xóa phiên bản "${variant.title}" cùng ${own} câu hỏi riêng của phiên bản này?`
      : `Xóa phiên bản "${variant.title}"?`
    if (hasResponses) message += '\n\nBiểu mẫu đã có câu trả lời: các câu trả lời đã gửi cho phiên bản này sẽ không còn được hiển thị đầy đủ.'
    if (!confirm(message)) return

    const nextVariants = variants.filter((v) => v.key !== variant.key)
    const nextSettings = { ...settings, variants: nextVariants, pick_count: Math.min(pickCount, Math.max(1, nextVariants.length)) }
    if (filter?.row_map) {
      const rowMap = { ...filter.row_map }
      delete rowMap[variant.key]
      nextSettings.filter = { ...filter, row_map: rowMap }
    }
    replaceFields((current) => current
      .filter((f) => !(f.random_group_key === field.key && f.variant_key === variant.key))
      .map((f) => (f.key === field.key ? { ...f, settings: nextSettings } : f)))
  }

  const handleVariantDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const from = variants.findIndex((v) => v.key === active.id)
    const to = variants.findIndex((v) => v.key === over.id)
    setSettings({ variants: arrayMove(variants, from, to) })
  }

  const changeMode = (nextMode) => {
    if (nextMode === mode) return
    if (nextMode === 'different') {
      setSettings({ mode: nextMode })
      return
    }
    const specific = members.filter((f) => f.variant_key)
    const keep = specific.filter((f) => f.variant_key === activeVariant)
    const dropped = specific.length - keep.length
    if (dropped > 0) {
      const title = variants.find((v) => v.key === activeVariant)?.title || ''
      if (!confirm(`Chuyển sang "Câu hỏi giống nhau": giữ bộ câu hỏi của phiên bản "${title}" làm bộ chung và xóa ${dropped} câu hỏi riêng của các phiên bản khác?`)) return
    }
    replaceFields((current) => current
      .filter((f) => !(f.random_group_key === field.key && f.variant_key && f.variant_key !== activeVariant))
      .map((f) => {
        if (f.key === field.key) return { ...f, settings: { ...settings, mode: nextMode } }
        if (f.random_group_key === field.key) return { ...f, variant_key: null }
        return f
      }))
  }

  const defaultRowMap = (rows) => Object.fromEntries(variants.map((v, i) => [v.key, rows[i] ?? '']))

  const setFilterSource = (key) => {
    if (!key) {
      setSettings({ filter: null })
      return
    }
    const source = fields.find((f) => f.key === key)
    setSettings({ filter: { field_key: key, row_map: defaultRowMap(source?.rows || []), exclude_columns: [] } })
  }

  const variantsFromRows = () => {
    if (!sourceRows.length) return
    if (!confirm(`Đặt tên phiên bản theo ${sourceRows.length} dòng của câu lọc (thêm phiên bản nếu còn thiếu)?`)) return
    const next = sourceRows.map((row, i) => (variants[i]
      ? { ...variants[i], title: row }
      : { key: newVariantKey(), title: row, description: '' }))
    const all = [...next, ...variants.slice(sourceRows.length)]
    setSettings({
      variants: all,
      filter: { ...filter, row_map: Object.fromEntries(all.map((v, i) => [v.key, sourceRows[i] ?? ''])) },
    })
  }

  const copyQuestionsFrom = (sourceKey) => {
    setCopySource('')
    if (!sourceKey) return
    const current = useFormStore.getState().fields
    const items = current.filter((f) => f.random_group_key === field.key && f.variant_key === sourceKey)
    if (!items.length) {
      toast.error('Phiên bản này chưa có câu hỏi riêng để sao chép')
      return
    }
    const copies = cloneFields(items, { variant_key: activeVariant })
    const headerIndex = current.findIndex((f) => f.key === field.key)
    setFields(insertAt(current, blockEnd(current, headerIndex) + 1, copies))
    toast.success(`Đã sao chép ${copies.length} câu hỏi`)
  }

  const handleDelete = () => {
    const current = useFormStore.getState().fields
    const blockKeys = [field.key, ...members.map((f) => f.key)]
    const dependents = referencesTo(current, blockKeys)
    let message = `Xóa phần ngẫu nhiên này cùng ${members.length} câu hỏi bên trong?`
    if (dependents.length) message += `\n\nCác thiết lập dựa trên phần này sẽ bị gỡ ở: ${dependents.map((l) => `"${shortLabel({ label: l }, 40)}"`).join(', ')}.`
    if (confirm(message)) setFields(removeFieldAt(current, index))
  }

  const summary = [
    mode === 'different' ? 'Câu hỏi khác nhau' : 'Câu hỏi giống nhau',
    `${variants.length} phiên bản`,
    `mỗi người ${pickCount} phiên bản`,
    filterSource ? `lọc theo "${shortLabel(filterSource, 40)}"` : null,
    field.conditional_logic?.rules?.length ? 'hiển thị theo điều kiện' : null,
  ].filter(Boolean)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      onClick={onClick}
      className={`eforms-question eforms-random-header ${isActive ? 'active' : ''}`}
    >
      <div className="h-1.5 rounded-t-lg -mx-6 -mt-6 mb-4" style={{ background: accent }} />
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: accent }}>
        <Shuffle className="w-4 h-4" /> Phần ngẫu nhiên
      </div>

      {isActive ? (
        <>
          <input
            type="text"
            data-prop="label"
            value={field.label || ''}
            onChange={(e) => updateField(index, { label: e.target.value })}
            onFocus={stop}
            className="w-full text-xl font-medium text-gray-900 px-3 py-2 outline-none bg-transparent border-b-2 border-transparent focus:border-current"
            placeholder="Tiêu đề phần ngẫu nhiên"
          />
          <div className="mt-2" data-prop="description">
            <RichTextEditor
              value={field.description || ''}
              onChange={(html) => updateField(index, { description: html })}
              placeholder="Mô tả chung của phần (tùy chọn)"
              className="w-full text-sm text-gray-600 px-3 py-2 outline-none bg-transparent resize-none transition-all"
              theme={theme}
              isMultiline={true}
              onFocus={stop}
            />
          </div>

          <div className="mt-5 space-y-5" onClick={stop}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-700">
              <span className="font-medium">Chế độ</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={mode === 'same'} onChange={() => changeMode('same')} />
                Câu hỏi giống nhau
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={mode === 'different'} onChange={() => changeMode('different')} />
                Câu hỏi khác nhau
              </label>
            </div>
            <p className="text-xs text-gray-500 -mt-3">
              {mode === 'same'
                ? 'Mọi phiên bản dùng chung một bộ câu hỏi; mỗi trang của phần nhắc lại tên phiên bản đang trả lời.'
                : 'Mỗi phiên bản có bộ câu hỏi riêng (chọn phiên bản ở thanh bên dưới để soạn). Câu "dùng chung" hiện ở mọi phiên bản.'}
            </p>

            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span className="font-medium">Mỗi người trả lời</span>
              <input
                type="number"
                className="eforms-adv-input w-20"
                min={1}
                max={Math.max(1, variants.length)}
                value={pickCount}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10)
                  setSettings({ pick_count: Math.min(Math.max(1, value || 1), Math.max(1, variants.length)) })
                }}
              />
              <span>phiên bản (bốc ngẫu nhiên)</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
              <span className="font-medium">Nhãn trước tên phiên bản</span>
              <input
                type="text"
                className="eforms-adv-input flex-1 min-w-[16rem]"
                value={settings.variant_label ?? ''}
                placeholder={DEFAULT_VARIANT_LABEL}
                onChange={(e) => setSettings({ variant_label: e.target.value })}
              />
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Phiên bản ({variants.length})</div>
              <DndContext sensors={variantSensors} collisionDetection={closestCenter} onDragEnd={handleVariantDragEnd}>
                <SortableContext items={variants.map((v) => v.key)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {variants.map((v, i) => (
                      <SortableVariant
                        key={v.key}
                        variant={v}
                        number={i + 1}
                        canRemove={variants.length > 1}
                        questionCount={mode === 'different' ? ownCount(v.key) : null}
                        onChange={(patch) => updateVariant(v.key, patch)}
                        onRemove={() => removeVariant(v)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <button type="button" onClick={addVariant} className="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
                <Plus className="w-4 h-4" /> Thêm phiên bản
              </button>
            </div>

            <div className="rounded border border-gray-200 p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!filter}
                  disabled={!gridSources.length}
                  onChange={(e) => setFilterSource(e.target.checked ? gridSources[gridSources.length - 1]?.key : '')}
                />
                Lọc phiên bản theo câu trước
              </label>
              {!gridSources.length && (
                <p className="text-xs text-gray-500">Cần một câu dạng bảng (lưới) đứng trước phần này và nằm ngoài phần ngẫu nhiên.</p>
              )}
              {filter && (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    Câu lọc
                    <select className="eforms-adv-input max-w-[24rem]" value={filter.field_key || ''} onChange={(e) => setFilterSource(e.target.value)}>
                      {!filterSource && <option value={filter.field_key || ''}>(câu không còn hợp lệ)</option>}
                      {gridSources.map((f) => <option key={f.key} value={f.key}>{shortLabel(f)}</option>)}
                    </select>
                    {sourceRows.length > 0 && (
                      <button type="button" className="text-sm text-primary-600 hover:text-primary-700" onClick={variantsFromRows}>
                        Đặt tên phiên bản theo các dòng
                      </button>
                    )}
                  </div>

                  {filterSource && (
                    <>
                      <div>
                        <div className="text-sm text-gray-700 mb-1">Ghép phiên bản với dòng của câu lọc</div>
                        <div className="space-y-1">
                          {variants.map((v, i) => (
                            <div key={v.key} className="grid grid-cols-2 gap-2 items-center text-sm">
                              <span className="truncate text-gray-700" title={v.title}>{v.title || `Phiên bản ${i + 1}`}</span>
                              <select
                                className="eforms-adv-input"
                                value={rowFor(v, i)}
                                onChange={(e) => setSettings({ filter: { ...filter, row_map: { ...(filter.row_map || {}), [v.key]: e.target.value } } })}
                              >
                                <option value="">(không ghép, luôn có thể được bốc)</option>
                                {sourceRows.map((row, r) => <option key={r} value={row}>{row}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-700 mb-1">Không bốc phiên bản khi dòng tương ứng được trả lời là</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {(filterSource.columns || []).map((col) => (
                            <label key={col} className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={(filter.exclude_columns || []).includes(col)}
                                onChange={(e) => {
                                  const list = filter.exclude_columns || []
                                  setSettings({ filter: { ...filter, exclude_columns: e.target.checked ? [...list, col] : list.filter((c) => c !== col) } })
                                }}
                              />
                              {col}
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Nếu không còn đủ phiên bản hợp lệ, hệ thống bốc thêm từ các phiên bản còn lại cho đủ số lượng.
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div>
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
                onClick={() => setShowCondition(!showCondition)}
              >
                {showCondition ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Hiển thị theo điều kiện
              </button>
              {showCondition && (
                <div className="mt-2 pl-5">
                  <ConditionEditor index={index} logic={field.conditional_logic} onChange={(logic) => updateField(index, { conditional_logic: logic })} />
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-xl font-medium text-gray-900 px-3 py-1">{field.label || 'Phần ngẫu nhiên'}</h2>
          {field.description && (
            <div className="text-sm text-gray-600 px-3 py-1" dangerouslySetInnerHTML={{ __html: field.description }} />
          )}
          <p className="text-xs text-gray-500 px-3 mt-1">{summary.join(' · ')}</p>
        </>
      )}

      {mode === 'different' && (
        <div className="mt-4 border-t border-gray-100 pt-3" onClick={stop}>
          <div className="text-xs text-gray-500 mb-2">
            Đang soạn câu hỏi cho phiên bản{sharedCount > 0 ? ` (kèm ${sharedCount} câu dùng chung)` : ''}:
          </div>
          <div className="flex flex-wrap gap-2">
            {variants.map((v, i) => (
              <button
                key={v.key}
                type="button"
                onClick={() => onSelectVariant(v.key)}
                className="eforms-variant-tab"
                style={v.key === activeVariant ? { borderColor: accent, color: accent, background: `${accent}14` } : undefined}
              >
                {v.title || `Phiên bản ${i + 1}`} <span className="opacity-60">({ownCount(v.key)})</span>
              </button>
            ))}
          </div>
          {variants.length > 1 && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <Copy className="w-4 h-4" />
              <select className="eforms-adv-input" value={copySource} onChange={(e) => copyQuestionsFrom(e.target.value)}>
                <option value="">Sao chép bộ câu hỏi từ phiên bản…</option>
                {variants.filter((v) => v.key !== activeVariant).map((v) => (
                  <option key={v.key} value={v.key}>{v.title} ({ownCount(v.key)} câu)</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {isActive && (
        <div className="eforms-question-footer">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Tooltip label="Di chuyển cả phần">
                <button type="button" {...attributes} {...listeners} className="eforms-action-btn" aria-label="Di chuyển cả phần">
                  <GripVertical className="w-5 h-5" />
                </button>
              </Tooltip>
              <Tooltip label="Nhân bản cả phần">
                <button type="button" onClick={(e) => { stop(e); duplicateField(index) }} className="eforms-action-btn" aria-label="Nhân bản cả phần">
                  <Copy className="w-5 h-5" />
                </button>
              </Tooltip>
              <Tooltip label="Xóa cả phần">
                <button type="button" onClick={(e) => { stop(e); handleDelete() }} className="eforms-action-btn text-red-600 hover:bg-red-50" aria-label="Xóa cả phần">
                  <Trash2 className="w-5 h-5" />
                </button>
              </Tooltip>
            </div>
            <p className="text-sm text-gray-500 italic text-right">Mỗi phiên bản bắt đầu ở trang mới</p>
          </div>
        </div>
      )}
    </div>
  )
}

function SortableVariant({ variant, number, canRemove, questionCount, onChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: variant.key })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-start gap-2 rounded border border-gray-200 bg-white p-2"
    >
      <button {...attributes} {...listeners} className="mt-2 cursor-grab text-gray-400 hover:text-gray-600" onClick={stop}>
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-5">{number}.</span>
          <input
            type="text"
            value={variant.title || ''}
            onChange={(e) => onChange({ title: e.target.value })}
            onFocus={stop}
            className="eforms-adv-input flex-1"
            placeholder={`Phiên bản ${number}`}
          />
          {questionCount != null && <span className="text-xs text-gray-500 whitespace-nowrap">{questionCount} câu riêng</span>}
        </div>
        <textarea
          value={variant.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          onFocus={stop}
          rows={1}
          className="eforms-adv-input w-full ml-7 text-xs"
          style={{ width: 'calc(100% - 1.75rem)' }}
          placeholder="Mô tả phiên bản (tùy chọn)"
        />
      </div>
      {canRemove && (
        <Tooltip label="Xóa phiên bản">
          <button type="button" onClick={onRemove} className="eforms-option-remove mt-1" aria-label="Xóa phiên bản">×</button>
        </Tooltip>
      )}
    </div>
  )
}

export function BlockFooter({ header, onAddQuestion, onAddPageBreak, theme }) {
  const accent = theme?.primary_color || '#4285F4'
  return (
    <div className="eforms-block-footer" style={{ borderColor: accent }}>
      <span className="text-xs text-gray-500">Hết phần ngẫu nhiên “{shortLabel(header, 40)}”</span>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onAddQuestion} className="flex items-center gap-1 text-sm" style={{ color: accent }}>
          <Plus className="w-4 h-4" /> Thêm câu hỏi vào phần
        </button>
        <button type="button" onClick={onAddPageBreak} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
          <SeparatorHorizontal className="w-4 h-4" /> Ngắt trang trong phần
        </button>
      </div>
    </div>
  )
}
