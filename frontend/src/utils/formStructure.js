import { arrayMove } from '@dnd-kit/sortable'

export const CHOICE_TYPES = ['radio', 'checkbox', 'dropdown']
export const GRID_TYPES = ['multiple_choice_grid', 'checkbox_grid']
export const NON_ANSWER_TYPES = ['section', 'description', 'image', 'video', 'random_section']
export const OTHER_VALUE = '__other__'
export const DEFAULT_VARIANT_LABEL = 'Phiên bản được lựa chọn là'

const SETTINGS_BY_TYPE = {
  checkbox: ['min_select', 'max_select', 'exclusive_options', 'other_option'],
  radio: ['other_option', 'piped_from'],
  dropdown: ['other_option', 'piped_from'],
  multiple_choice_grid: ['require_all_rows'],
  checkbox_grid: ['require_all_rows'],
  number: ['number'],
  email: ['store_hash_only'],
  phone: ['store_hash_only'],
  random_section: ['mode', 'pick_count', 'variants', 'filter', 'variant_label'],
}

// crypto.randomUUID is unavailable on plain-http origins such as eforms.test.
export function newKey() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function newVariantKey() {
  return 'v' + newKey().replace(/-/g, '').slice(0, 10)
}

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : null)

export function normalizeField(field) {
  return {
    ...field,
    key: field.key || newKey(),
    settings: asObject(field.settings) || {},
    conditional_logic: asObject(field.conditional_logic),
  }
}

export function normalizeFields(fields) {
  return (fields || []).map(normalizeField)
}

export function sanitizeSettings(type, settings) {
  const allowed = SETTINGS_BY_TYPE[type] || []
  return Object.fromEntries(Object.entries(settings || {}).filter(([k]) => allowed.includes(k)))
}

export const isAnswerable = (field) => !!field && !NON_ANSWER_TYPES.includes(field.type)

export function groupKeyOf(field) {
  if (!field) return null
  return field.type === 'random_section' ? field.key : field.random_group_key || null
}

export function blockEnd(fields, headerIndex) {
  const key = fields[headerIndex]?.key
  let i = headerIndex
  while (i + 1 < fields.length && fields[i + 1].random_group_key === key) i++
  return i
}

export const findHeader = (fields, groupKey) => fields.find((f) => f.key === groupKey && f.type === 'random_section')

export const variantsOf = (header) => (Array.isArray(header?.settings?.variants) ? header.settings.variants : [])

export const isDifferentMode = (header) => header?.settings?.mode === 'different'

export function currentVariant(header, activeTabs) {
  const variants = variantsOf(header)
  const chosen = activeTabs?.[header?.key]
  return variants.some((v) => v.key === chosen) ? chosen : variants[0]?.key || null
}

/** Members of a different-mode block that belong to another tab are hidden in the builder. */
export function isHiddenInBuilder(field, fields, activeTabs) {
  if (!field.random_group_key || !field.variant_key) return false
  const header = findHeader(fields, field.random_group_key)
  if (!isDifferentMode(header)) return false
  return field.variant_key !== currentVariant(header, activeTabs)
}

/**
 * Where a new item goes when added from the sidebar: after the active item, joining its block.
 * Random sections never nest, so they go after the block containing the active item.
 */
export function insertionPoint(fields, activeIndex, activeTabs, { isBlock = false } = {}) {
  const active = activeIndex != null ? fields[activeIndex] : null
  if (!active) return { at: fields.length, groupKey: null, variantKey: null }

  const groupKey = groupKeyOf(active)
  if (!groupKey) return { at: activeIndex + 1, groupKey: null, variantKey: null }

  const headerIndex = fields.findIndex((f) => f.key === groupKey)
  if (isBlock) return { at: blockEnd(fields, headerIndex) + 1, groupKey: null, variantKey: null }

  const header = fields[headerIndex]
  const at = active.type === 'random_section' ? blockEnd(fields, headerIndex) + 1 : activeIndex + 1
  return { at, groupKey, variantKey: isDifferentMode(header) ? currentVariant(header, activeTabs) : null }
}

export function insertAt(fields, at, items) {
  const next = [...fields]
  next.splice(at, 0, ...items)
  return next
}

/** Drag result: blocks move as a unit; a moved question takes the block membership of where it lands. */
export function moveField(fields, activeKey, overKey, activeTabs) {
  const from = fields.findIndex((f) => f.key === activeKey)
  const to = fields.findIndex((f) => f.key === overKey)
  if (from < 0 || to < 0 || from === to) return fields
  const item = fields[from]

  if (item.type === 'random_section') {
    const end = blockEnd(fields, from)
    if (to >= from && to <= end) return fields
    const block = fields.slice(from, end + 1)
    const rest = [...fields.slice(0, from), ...fields.slice(end + 1)]
    const target = rest.findIndex((f) => f.key === overKey)
    const over = rest[target]
    let pos
    if (to > from) {
      const overGroup = groupKeyOf(over)
      pos = (overGroup ? blockEnd(rest, rest.findIndex((f) => f.key === overGroup)) : target) + 1
    } else {
      pos = over.random_group_key ? rest.findIndex((f) => f.key === over.random_group_key) : target
    }
    return insertAt(rest, pos, block)
  }

  const next = arrayMove(fields, from, to)
  const prevGroup = groupKeyOf(next[to - 1])
  const nextGroup = next[to + 1]?.random_group_key || null
  const own = item.random_group_key || null
  let group
  if (prevGroup === nextGroup) group = prevGroup
  else group = [prevGroup, nextGroup].includes(own) ? own : null

  let variantKey = null
  if (group) {
    const header = findHeader(next, group)
    if (isDifferentMode(header)) {
      variantKey = group === own ? item.variant_key || null : currentVariant(header, activeTabs)
    }
  }
  next[to] = { ...item, random_group_key: group, variant_key: variantKey }
  return next
}

/** Copies fields with fresh keys; references between the copied fields follow the copies. */
export function cloneFields(items, overrides = {}) {
  const keyMap = Object.fromEntries(items.map((f) => [f.key, newKey()]))
  const remap = (k) => (k && keyMap[k]) || k
  return items.map((f) => {
    const settings = { ...(f.settings || {}) }
    if (settings.piped_from) settings.piped_from = remap(settings.piped_from)
    if (settings.filter?.field_key) settings.filter = { ...settings.filter, field_key: remap(settings.filter.field_key) }
    const logic = f.conditional_logic?.rules
      ? { ...f.conditional_logic, rules: f.conditional_logic.rules.map((r) => ({ ...r, field_key: remap(r.field_key) })) }
      : f.conditional_logic
    const copy = { ...f, id: undefined, key: keyMap[f.key], settings, conditional_logic: logic, random_group_key: remap(f.random_group_key) }
    return { ...copy, ...(typeof overrides === 'function' ? overrides(f) : overrides) }
  })
}

/** Removes the field at index (a random section removes its whole block). */
export function removeFieldAt(fields, index) {
  const field = fields[index]
  if (!field) return fields
  const end = field.type === 'random_section' ? blockEnd(fields, index) : index
  return pruneReferences([...fields.slice(0, index), ...fields.slice(end + 1)])
}

/** Labels of the fields whose configuration points at any of the given keys. */
export function referencesTo(fields, keys) {
  const targets = new Set(keys)
  return fields
    .filter((f) => !targets.has(f.key))
    .filter((f) =>
      (f.conditional_logic?.rules || []).some((r) => targets.has(r.field_key)) ||
      targets.has(f.settings?.piped_from) ||
      targets.has(f.settings?.filter?.field_key)
    )
    .map((f) => f.label || '(chưa đặt tên)')
}

/** Drops references to fields that no longer exist. */
export function pruneReferences(fields) {
  const keys = new Set(fields.map((f) => f.key))
  return fields.map((f) => {
    let changed = false
    let logic = f.conditional_logic
    if (logic?.rules?.some((r) => !keys.has(r.field_key))) {
      const rules = logic.rules.filter((r) => keys.has(r.field_key))
      logic = rules.length ? { ...logic, rules } : null
      changed = true
    }
    let settings = f.settings || {}
    if (settings.piped_from && !keys.has(settings.piped_from)) {
      settings = { ...settings }
      delete settings.piped_from
      changed = true
    }
    if (settings.filter?.field_key && !keys.has(settings.filter.field_key)) {
      settings = { ...settings, filter: null }
      changed = true
    }
    return changed ? { ...f, conditional_logic: logic, settings } : f
  })
}

const mapList = (list, fn) => (Array.isArray(list) ? list.map(fn).filter((v) => v !== undefined) : list)

/**
 * Keeps references in other fields in step with an option/row/column rename (newValue string)
 * or removal (newValue undefined) on the field `sourceKey`.
 */
export function updateChoiceReferences(fields, sourceKey, kind, oldValue, newValue) {
  const swap = (v) => (v === oldValue ? newValue : v)
  return fields.map((f) => {
    if (kind === 'option' && f.conditional_logic?.rules?.some((r) => r.field_key === sourceKey)) {
      return {
        ...f,
        conditional_logic: {
          ...f.conditional_logic,
          rules: f.conditional_logic.rules.map((r) => (r.field_key === sourceKey ? { ...r, values: mapList(r.values, swap) } : r)),
        },
      }
    }
    const filter = f.settings?.filter
    if (f.type === 'random_section' && filter?.field_key === sourceKey) {
      if (kind === 'column') {
        return { ...f, settings: { ...f.settings, filter: { ...filter, exclude_columns: mapList(filter.exclude_columns, swap) } } }
      }
      if (kind === 'row') {
        const rowMap = Object.fromEntries(Object.entries(filter.row_map || {}).map(([v, row]) => [v, row === oldValue ? newValue ?? '' : row]))
        return { ...f, settings: { ...f.settings, filter: { ...filter, row_map: rowMap } } }
      }
    }
    return f
  })
}

/** Choice values a condition can test, with display labels. */
export function choiceValues(field) {
  const values = (field.options || []).map((o) => ({ value: o, label: o }))
  if (field.settings?.other_option?.enabled) {
    values.push({ value: OTHER_VALUE, label: field.settings.other_option.label || 'Khác' })
  }
  return values
}

/** Edits that lose or orphan collected answers, compared with the last saved fields. */
export function destructiveChanges(savedFields, fields) {
  const byId = Object.fromEntries(fields.filter((f) => f.id).map((f) => [f.id, f]))
  const missing = (before, after) => (before || []).filter((v) => !(after || []).includes(v))
  const out = []
  for (const old of savedFields || []) {
    const now = byId[old.id]
    const name = `"${shortLabel(old, 50)}"`
    if (!now) {
      if (isAnswerable(old) || old.type === 'random_section') out.push(`Xóa câu ${name}`)
      continue
    }
    if (isAnswerable(old) && old.type !== now.type) out.push(`Đổi loại câu ${name}`)
    if (CHOICE_TYPES.includes(old.type)) {
      const removed = missing(old.options, now.options)
      if (removed.length) out.push(`Đổi/xóa phương án ở ${name}: ${removed.join(', ')}`)
    }
    if (GRID_TYPES.includes(old.type)) {
      const removed = [...missing(old.rows, now.rows), ...missing(old.columns, now.columns)]
      if (removed.length) out.push(`Đổi/xóa dòng hoặc cột ở ${name}: ${removed.join(', ')}`)
    }
    if (old.type === 'random_section') {
      const keys = variantsOf(now).map((v) => v.key)
      const removed = variantsOf(old).filter((v) => !keys.includes(v.key)).map((v) => v.title)
      if (removed.length) out.push(`Xóa phiên bản ở ${name}: ${removed.join(', ')}`)
    }
  }
  return out
}

export function shortLabel(field, max = 60) {
  const text = (field?.label || '(chưa đặt tên)').replace(/<[^>]+>/g, '').trim()
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}
