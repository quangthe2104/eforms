// Respondent-side form logic. Mirrors backend App\Services\Forms\{FormStructure, ConditionEvaluator,
// SubmissionValidator} so the browser and the server agree on visibility, pages and validation.
import { NON_ANSWER_TYPES, OTHER_VALUE, GRID_TYPES, variantsOf, DEFAULT_VARIANT_LABEL } from './formStructure.js'

export const answerKey = (field, variant) => (variant == null ? String(field.id) : `${field.id}@${variant}`)

const isFile = (v) => typeof File !== 'undefined' && v instanceof File
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && !isFile(v)

export function isEmptyValue(value) {
  if (value == null) return true
  if (isFile(value)) return false
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.every(isEmptyValue)
  if (isPlainObject(value)) {
    if ('selected' in value) return choicesOf(value).selected.length === 0
    return Object.values(value).every(isEmptyValue)
  }
  return false
}

/** { selected: string[], other: string|null } for radio/checkbox/dropdown values in any shape. */
export function choicesOf(value) {
  let other = null
  let raw = value
  if (isPlainObject(value) && 'selected' in value) {
    other = typeof value.other === 'string' || typeof value.other === 'number' ? String(value.other).trim() || null : null
    raw = value.selected
  }
  let selected = []
  if (Array.isArray(raw)) selected = raw.filter((v) => v != null && typeof v !== 'object').map(String).filter((v) => v !== '')
  else if (raw != null && raw !== '' && typeof raw !== 'object') selected = [String(raw)]
  return { selected: [...new Set(selected)], other }
}

/** Builds the stored value of a choice question. Keeps the "Other" text while the option is toggled. */
export function makeChoiceValue(selected, other, multiple) {
  if (other != null && (other !== '' || selected.includes(OTHER_VALUE))) return { selected, other }
  return multiple ? selected : selected[0] ?? ''
}

export function conditionPasses(logic, resolve) {
  const rules = Array.isArray(logic?.rules) ? logic.rules.filter((r) => r && r.field_key) : []
  if (!rules.length) return true
  const results = rules.map((rule) => {
    const answer = resolve(rule.field_key)
    const answered = !isEmptyValue(answer)
    const values = (Array.isArray(rule.values) ? rule.values : []).map(String)
    const hit = answered && choicesOf(answer).selected.some((v) => values.includes(v))
    switch (rule.operator) {
      case 'answered': return answered
      case 'not_answered': return !answered
      case 'not_includes_any': return !hit
      default: return hit
    }
  })
  return logic.match === 'any' ? results.includes(true) : !results.includes(false)
}

const sortFields = (fields) =>
  [...(fields || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.id ?? 0) - (b.id ?? 0))

/**
 * Instances seen by a respondent. Blocks without an assignment yet appear as one `pending` instance,
 * so the page list knows where the block goes before the server draws its variants.
 */
export function buildInstances(fields, assignments = {}) {
  const sorted = sortFields(fields)
  const headers = Object.fromEntries(sorted.filter((f) => f.type === 'random_section' && f.key).map((f) => [f.key, f]))
  const out = []
  let forceNewPage = false

  for (const field of sorted) {
    if (field.random_group_key && headers[field.random_group_key]) continue

    if (field.type === 'random_section') {
      const assigned = Array.isArray(assignments?.[field.key]) ? assignments[field.key] : []
      if (!assigned.length) {
        out.push({ field, variant: null, group: field.key, answerKey: `pending:${field.key}`, pageStart: true, pending: true })
      }
      const different = field.settings?.mode === 'different'
      for (const variant of assigned) {
        out.push({ field, variant, group: field.key, answerKey: answerKey(field, variant), pageStart: true })
        for (const member of sorted) {
          if (member.random_group_key !== field.key) continue
          if (different && member.variant_key && member.variant_key !== variant) continue
          out.push({ field: member, variant, group: field.key, answerKey: answerKey(member, variant), pageStart: member.type === 'section' })
        }
      }
      forceNewPage = true
      continue
    }

    out.push({ field, variant: null, group: null, answerKey: answerKey(field, null), pageStart: field.type === 'section' || forceNewPage })
    forceNewPage = false
  }
  return out
}

const isPipedType = (field) => ['radio', 'dropdown'].includes(field.type) && !!field.settings?.piped_from

/**
 * Walks the instances in order and decides what is visible, as the server does on submit.
 * Each returned instance gets `visible`, and piped questions get `piped: {options, other}`;
 * a piped question with exactly one choice gets `autoValue` and stays hidden.
 */
export function evaluateForm(fields, assignments, answers) {
  const instances = buildInstances(fields, assignments)
  const byKey = Object.fromEntries((fields || []).filter((f) => f.key).map((f) => [f.key, f]))
  const values = {}
  const hiddenGroups = new Set()
  let pageHidden = false

  const resolveFrom = (inst) => (fieldKey) => {
    const source = byKey[fieldKey]
    if (!source) return null
    let variant = null
    if (source.random_group_key) {
      variant = inst.group === source.random_group_key ? inst.variant : assignments?.[source.random_group_key]?.[0] ?? null
      if (variant == null) return null
    }
    return values[answerKey(source, variant)] ?? null
  }

  const pipedOptions = (field, resolve) => {
    const source = byKey[field.settings.piped_from]
    if (!source) return { options: [], other: null }
    const { selected, other } = choicesOf(resolve(source.key))
    const exclusive = (source.settings?.exclusive_options || []).map(String)
    if (selected.some((v) => exclusive.includes(v))) return { options: [], other: null }
    const labels = Object.fromEntries(selected.map((v) => [v, v === OTHER_VALUE ? otherDisplay(source, other) : v]))
    return { options: selected, other, labels }
  }

  return instances.map((inst) => {
    const { field } = inst
    const result = { ...inst, visible: true }

    if (inst.group && hiddenGroups.has(inst.group)) return { ...result, visible: false }
    if (inst.pageStart) pageHidden = false
    const resolve = resolveFrom(inst)

    if (field.type === 'random_section') {
      if (!conditionPasses(field.conditional_logic, resolve)) {
        hiddenGroups.add(inst.group)
        return { ...result, visible: false }
      }
      return result
    }
    if (field.type === 'section') {
      pageHidden = !conditionPasses(field.conditional_logic, resolve)
      return { ...result, visible: !pageHidden }
    }
    if (pageHidden || !conditionPasses(field.conditional_logic, resolve)) return { ...result, visible: false }
    if (NON_ANSWER_TYPES.includes(field.type)) return result

    if (isPipedType(field)) {
      const piped = pipedOptions(field, resolve)
      if (piped.options.length < 2) {
        if (piped.options.length === 1) {
          const option = piped.options[0]
          values[inst.answerKey] = option === OTHER_VALUE ? { selected: [OTHER_VALUE], other: piped.other } : option
          return { ...result, visible: false, piped, autoValue: values[inst.answerKey] }
        }
        return { ...result, visible: false, piped }
      }
      const value = answers?.[inst.answerKey]
      if (!isEmptyValue(value) && piped.options.includes(choicesOf(value).selected[0])) values[inst.answerKey] = value
      return { ...result, piped }
    }

    const value = answers?.[inst.answerKey]
    if (!isEmptyValue(value)) values[inst.answerKey] = value
    return result
  })
}

export const otherDisplay = (field, text) => {
  const label = field.settings?.other_option?.label || 'Khác'
  return text ? `${label}: ${text}` : label
}

/**
 * Groups evaluated instances into pages. A block's opening page carries the block header;
 * a header that would sit alone (block starts with a page break) joins the next page.
 */
export function paginate(evaluated) {
  const pages = []
  let current = null
  const start = (inst) => {
    current = { items: [], group: inst?.group ?? null, variant: inst?.variant ?? null, pending: !!inst?.pending }
    pages.push(current)
  }

  for (const inst of evaluated) {
    const headerAlone = current && current.items.length === 1 && current.items[0].field.type === 'random_section' && !current.pending
    const continuesBlock = headerAlone && inst.group === current.group && inst.variant === current.variant
    if ((inst.pageStart || !current) && !continuesBlock) start(inst)
    current.items.push(inst)
  }

  return pages
    .filter((p) => p.items.length)
    .map((page, index) => ({ ...page, index, visible: pageVisible(page) }))
}

/**
 * Pages a not-yet-drawn block will take once drawn, for the progress bar. Conditions on the
 * block's own page breaks are ignored; in "different" mode the longest variant counts.
 */
export function pendingPageCount(header, fields) {
  const members = sortFields(fields).filter((f) => f.random_group_key === header.key)
  const variantKeys = variantsOf(header).map((v) => v.key)
  const different = header.settings?.mode === 'different'
  const pagesFor = (variant) => {
    const own = members.filter((m) => !m.variant_key || !different || m.variant_key === variant)
    const breaks = own.filter((m) => m.type === 'section').length
    return 1 + breaks - (own[0]?.type === 'section' ? 1 : 0)
  }
  const perVariant = Math.max(1, ...(different ? variantKeys : [null]).map(pagesFor))
  const pick = Math.max(1, Math.min(parseInt(header.settings?.pick_count, 10) || 1, variantKeys.length || 1))
  return pick * perVariant
}

const PAGE_HEADS = ['section', 'random_section']

/** A page shows when its headings are visible and it has no questions or at least one visible one. */
function pageVisible(page) {
  if (page.items.some((i) => PAGE_HEADS.includes(i.field.type) && !i.visible)) return false
  const body = page.items.filter((i) => !PAGE_HEADS.includes(i.field.type))
  return !body.length || body.some((i) => i.visible)
}

export function variantInfo(header, variantKey) {
  const variant = variantsOf(header).find((v) => v.key === variantKey)
  return {
    title: variant?.title || '',
    description: variant?.description || '',
    label: (header?.settings?.variant_label || '').trim() || DEFAULT_VARIANT_LABEL,
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizePhone(phone) {
  let p = String(phone ?? '').replace(/[\s.\-()]/g, '')
  if (p.startsWith('+84')) p = '0' + p.slice(3)
  else if (p.startsWith('84') && p.length === 11) p = '0' + p.slice(2)
  return p
}

export const isValidPhone = (normalized) => /^0[35789]\d{8}$/.test(normalized)

/** First validation error for a visible instance, or null. Messages match the server. */
export function validateInstance(inst, value) {
  const { field } = inst
  const s = field.settings || {}

  if (field.type === 'file_upload') {
    return field.is_required && !isFile(value) ? 'Vui lòng tải lên tệp.' : null
  }

  if (inst.piped) {
    const choice = choicesOf(value).selected[0]
    const valid = choice != null && inst.piped.options.includes(choice)
    if (!valid) return field.is_required ? 'Vui lòng trả lời câu hỏi này.' : null
    return null
  }

  if (isEmptyValue(value)) return field.is_required ? 'Vui lòng trả lời câu hỏi này.' : null

  switch (field.type) {
    case 'radio':
    case 'dropdown': {
      const { selected, other } = choicesOf(value)
      if (selected.length !== 1) return 'Chỉ được chọn một phương án.'
      if (selected[0] === OTHER_VALUE && !other) return 'Vui lòng ghi rõ nội dung phương án "Khác".'
      return null
    }
    case 'checkbox': {
      const { selected, other } = choicesOf(value)
      const exclusive = (s.exclusive_options || []).map(String)
      const hit = selected.filter((v) => exclusive.includes(v))
      if (hit.length && selected.length > 1) return `Phương án "${hit[0]}" không thể chọn cùng các phương án khác.`
      const min = parseInt(s.min_select, 10) || 0
      const max = parseInt(s.max_select, 10) || 0
      if (min > 0 && selected.length < min && !hit.length) return `Vui lòng chọn ít nhất ${min} phương án.`
      if (max > 0 && selected.length > max) return `Chỉ được chọn tối đa ${max} phương án.`
      if (selected.includes(OTHER_VALUE) && !other) return 'Vui lòng ghi rõ nội dung phương án "Khác".'
      return null
    }
    case 'multiple_choice_grid':
    case 'checkbox_grid': {
      if (field.is_required && s.require_all_rows && missingRows(field, value).length) return 'Vui lòng trả lời tất cả các dòng.'
      return null
    }
    case 'email':
      return EMAIL_RE.test(String(value).trim()) ? null : 'Email không hợp lệ.'
    case 'phone':
      return isValidPhone(normalizePhone(value)) ? null : 'Số điện thoại di động không hợp lệ (10 chữ số, ví dụ 0912345678).'
    case 'number':
      return numberError(s.number || {}, value)
    case 'url':
      try {
        new URL(String(value).trim())
        return null
      } catch {
        return 'Đường dẫn không hợp lệ.'
      }
    default:
      return null
  }
}

export function missingRows(field, value) {
  const v = isPlainObject(value) ? value : {}
  return (field.rows || []).filter((row) => isEmptyValue(v[row]))
}

function numberError({ digits, min, max }, value) {
  const text = String(value).trim().replace(',', '.')
  if (text === '' || !Number.isFinite(Number(text))) return 'Vui lòng nhập một số.'
  const d = parseInt(digits, 10) || 0
  if (d > 0) {
    if (!/^-?\d+$/.test(text)) return 'Vui lòng nhập số nguyên.'
    if (text.replace('-', '').length > d) return `Chỉ được nhập tối đa ${d} chữ số.`
  }
  const n = Number(text)
  const hasMin = min !== '' && min != null && Number.isFinite(Number(min))
  const hasMax = max !== '' && max != null && Number.isFinite(Number(max))
  if (hasMin && n < Number(min)) return hasMax ? `Vui lòng nhập số từ ${min} đến ${max}.` : `Vui lòng nhập số không nhỏ hơn ${min}.`
  if (hasMax && n > Number(max)) return hasMin ? `Vui lòng nhập số từ ${min} đến ${max}.` : `Vui lòng nhập số không lớn hơn ${max}.`
  return null
}

/** Errors for the visible answerable instances of the given pages, keyed by answer key. */
export function validatePages(pages, answers) {
  const errors = {}
  for (const page of pages) {
    if (!page.visible || page.pending) continue
    for (const inst of page.items) {
      if (!inst.visible || NON_ANSWER_TYPES.includes(inst.field.type)) continue
      const error = validateInstance(inst, answers[inst.answerKey])
      if (error) errors[inst.answerKey] = error
    }
  }
  return errors
}

/**
 * Prefills questions that have a default answer (settings.default_value) and were never answered.
 * Returns `answers` itself when nothing changes, so it can run in an effect without looping;
 * a respondent who clears the box keeps '' and is not prefilled again.
 */
export function withDefaultAnswers(pages, answers) {
  let next = answers
  for (const page of pages) {
    if (page.pending) continue
    for (const inst of page.items) {
      const value = inst.field.settings?.default_value
      if (typeof value !== 'string' || value === '' || answers[inst.answerKey] !== undefined) continue
      if (next === answers) next = { ...answers }
      next[inst.answerKey] = value
    }
  }
  return next
}

/** Answers to send: visible questions only; "Other" text dropped when "Other" is not picked. */
export function submissionAnswers(pages, answers) {
  const out = {}
  for (const page of pages) {
    if (!page.visible || page.pending) continue
    for (const inst of page.items) {
      if (!inst.visible || NON_ANSWER_TYPES.includes(inst.field.type)) continue
      const value = answers[inst.answerKey]
      if (isEmptyValue(value)) continue
      out[inst.answerKey] = cleanValue(inst.field, value)
    }
  }
  return out
}

function cleanValue(field, value) {
  if (['radio', 'dropdown', 'checkbox'].includes(field.type) && isPlainObject(value) && 'selected' in value) {
    const { selected, other } = choicesOf(value)
    if (selected.includes(OTHER_VALUE)) return { selected, other: other || '' }
    return field.type === 'checkbox' ? selected : selected[0] ?? ''
  }
  if (GRID_TYPES.includes(field.type) && isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => !isEmptyValue(v)))
  }
  return value
}

/** Answers of the filter questions of the given blocks, keyed by field id, for `/assign`. */
export function filterAnswers(fields, groupKeys, answers) {
  const out = {}
  for (const header of (fields || []).filter((f) => f.type === 'random_section' && groupKeys.includes(f.key))) {
    const source = (fields || []).find((f) => f.key === header.settings?.filter?.field_key)
    const value = source ? answers?.[String(source.id)] : null
    if (source && !isEmptyValue(value)) out[String(source.id)] = value
  }
  return out
}

/** Keys of blocks whose filter question sits on the given page and that have no variants yet. */
export function filterGroupsOnPage(fields, page, assignments) {
  if (!page) return []
  const keys = new Set(page.items.map((i) => i.field.key))
  return (fields || [])
    .filter((f) => f.type === 'random_section' && !assignments?.[f.key]?.length && keys.has(f.settings?.filter?.field_key))
    .map((f) => f.key)
}
