// Reading stored responses back into the respondent's view (see backend App\Services\Forms\AnswerValue).
import { variantsOf } from './formStructure.js'

export const IDENTITY_LABELS = { device: 'Thiết bị', email: 'Email', phone: 'Điện thoại', account: 'Tài khoản' }

/** Undoes the JSON-in-a-string shape that older multipart submissions stored. */
export function decodeValue(value) {
  let v = value
  while (typeof v === 'string' && /^[[{]/.test(v.trim())) {
    try {
      const parsed = JSON.parse(v)
      if (parsed === v) break
      v = parsed
    } catch {
      break
    }
  }
  return v
}

/** Stored answers keyed like submissions: `field_id`, or `field_id@variant` inside random sections. */
export function answersByKey(response) {
  const out = {}
  for (const answer of response?.answers || []) {
    const key = answer.variant_key ? `${answer.field_id}@${answer.variant_key}` : String(answer.field_id)
    out[key] = answer
  }
  return out
}

/** Recorded assignment, or one rebuilt from the variant keys of the answers (older responses). */
export function responseAssignments(fields, response) {
  const recorded = response?.assignments
  if (recorded && typeof recorded === 'object' && !Array.isArray(recorded) && Object.keys(recorded).length) return recorded
  const byId = Object.fromEntries((fields || []).map((f) => [String(f.id), f]))
  const out = {}
  for (const answer of response?.answers || []) {
    const group = byId[String(answer.field_id)]?.random_group_key
    if (!group || !answer.variant_key) continue
    out[group] = out[group] || []
    if (!out[group].includes(answer.variant_key)) out[group].push(answer.variant_key)
  }
  return out
}

export function variantTitle(header, key) {
  const variants = variantsOf(header)
  const index = variants.findIndex((v) => v.key === key)
  if (index === -1) return `${key} (đã xóa)`
  return variants[index].title || `Phiên bản ${index + 1}`
}

/** "PHẦN II: Sự kiện 3" for every block of the form that the response was assigned. */
export function assignmentSummary(fields, response) {
  const assignments = responseAssignments(fields, response)
  return (fields || [])
    .filter((f) => f.type === 'random_section' && assignments[f.key]?.length)
    .map((header) => ({
      key: header.key,
      label: (header.label || 'Phần ngẫu nhiên').replace(/<[^>]+>/g, '').trim(),
      titles: assignments[header.key].map((v) => variantTitle(header, v)),
    }))
}
