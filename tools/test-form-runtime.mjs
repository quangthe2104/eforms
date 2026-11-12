// Unit checks for frontend/src/utils/formRuntime.js. Run from repo root: node tools/test-form-runtime.mjs
import {
  buildInstances, evaluateForm, paginate, validateInstance, validatePages, submissionAnswers,
  filterAnswers, filterGroupsOnPage, makeChoiceValue, choicesOf, normalizePhone, isEmptyValue, pendingPageCount,
} from '../frontend/src/utils/formRuntime.js'

let failures = 0
let total = 0
const check = (name, cond) => { total++; if (!cond) { failures++; console.log('FAIL', name) } }
const O = '__other__'

let id = 0
const F = (key, type, extra = {}) => ({ id: ++id, key, type, order: id, settings: {}, conditional_logic: null, ...extra })
const rule = (field_key, values, operator = 'includes_any') => ({ match: 'all', rules: [{ field_key, operator, values }] })

const fields = [
  F('email', 'email', { is_required: true }),
  F('grid', 'multiple_choice_grid', { rows: ['R1', 'R2', 'R3'], columns: ['Biết', 'Chưa từng nghe nói'] }),
  F('H', 'random_section', { label: 'PHẦN II', settings: { mode: 'same', pick_count: 1, variants: [{ key: 'v1', title: 'Sự kiện 1' }, { key: 'v2', title: 'Sự kiện 2' }, { key: 'v3', title: 'Sự kiện 3' }], filter: { field_key: 'grid', exclude_columns: ['Chưa từng nghe nói'], row_map: { v1: 'R1', v2: 'R2', v3: 'R3' } } } }),
  F('q3', 'checkbox', { random_group_key: 'H', options: ['A', 'B', 'X'], settings: { exclusive_options: ['X'], max_select: 2, other_option: { enabled: true, label: 'Khác' } } }),
  F('q5', 'radio', { random_group_key: 'H', options: ['Yes', 'No'] }),
  F('q5a', 'checkbox', { random_group_key: 'H', options: ['P', 'Q'], conditional_logic: rule('q5', ['Yes']) }),
  F('q6', 'checkbox', { random_group_key: 'H', options: ['L1', 'L2', 'L3', 'None'], settings: { exclusive_options: ['None'], other_option: { enabled: true, label: 'Lý do khác' } } }),
  F('q6a', 'radio', { random_group_key: 'H', settings: { piped_from: 'q6' }, is_required: true }),
  F('sec2', 'section', { random_group_key: 'H', label: 'PHẦN III' }),
  F('q9', 'short_text', { random_group_key: 'H' }),
  F('a1', 'radio', { options: ['Nam', 'Nữ'] }),
  F('a2', 'number', { settings: { number: { digits: 2, min: 18, max: 99 } } }),
  F('a5', 'multiple_choice_grid', { rows: ['S1', 'S2'], columns: ['Nhiều', 'Chưa'], is_required: true, settings: { require_all_rows: true } }),
  F('a7', 'checkbox', { options: ['m', 'n', 'o', 'p'], settings: { min_select: 3, max_select: 3 } }),
]
const byKey = Object.fromEntries(fields.map((f) => [f.key, f]))
const k = (key, v) => (v ? `${byKey[key].id}@${v}` : String(byKey[key].id))

// Structure before / after assignment
let pages = paginate(evaluateForm(fields, {}, {}))
check('pending block is its own page', pages.length === 3 && pages[1].pending && pages[1].group === 'H')
check('first page holds email + grid', pages[0].items.map((i) => i.field.key).join() === 'email,grid')
check('after block a new page starts', pages[2].items[0].field.key === 'a1')

pages = paginate(evaluateForm(fields, { H: ['v2'] }, {}))
check('assigned block: 2 block pages + outer pages', pages.length === 4 && pages[1].variant === 'v2' && pages[2].variant === 'v2')
check('block page 1 opens with header', pages[1].items[0].field.type === 'random_section')
check('block page 2 opens with inner section', pages[2].items[0].field.key === 'sec2')
check('answer keys carry variant', pages[1].items[1].answerKey === k('q3', 'v2'))

const two = paginate(evaluateForm(fields, { H: ['v1', 'v3'] }, {}))
check('K=2 gives two passes over the block', two.length === 6 && two[1].variant === 'v1' && two[3].variant === 'v3')

// Header alone (block starts with a page break) merges with the next page
const alone = [F('h2', 'random_section', { settings: { variants: [{ key: 'a' }] } }), F('s', 'section', { random_group_key: 'h2' }), F('t', 'short_text', { random_group_key: 'h2' })]
const ap = paginate(evaluateForm(alone, { h2: ['a'] }, {}))
check('lonely header joins next page', ap.length === 1 && ap[0].items.map((i) => i.field.key).join() === 'h2,s,t')

// Different mode: shared + own members
const diff = [
  F('D', 'random_section', { settings: { mode: 'different', variants: [{ key: 'x' }, { key: 'y' }] } }),
  F('shared', 'short_text', { random_group_key: 'D' }),
  F('onlyX', 'short_text', { random_group_key: 'D', variant_key: 'x' }),
  F('onlyY', 'short_text', { random_group_key: 'D', variant_key: 'y' }),
]
const di = buildInstances(diff, { D: ['y'] }).map((i) => i.field.key).join()
check('different mode keeps shared + own variant only', di === 'D,shared,onlyY')

// Conditions and piping
const A = (obj) => Object.fromEntries(Object.entries(obj).map(([key, v]) => [key, v]))
let ev = evaluateForm(fields, { H: ['v1'] }, A({ [k('q5', 'v1')]: 'No' }))
check('5a hidden when 5 = No', !ev.find((i) => i.field.key === 'q5a').visible)
ev = evaluateForm(fields, { H: ['v1'] }, A({ [k('q5', 'v1')]: 'Yes' }))
check('5a shown when 5 = Yes', ev.find((i) => i.field.key === 'q5a').visible)

const pipedWith = (q6) => evaluateForm(fields, { H: ['v1'] }, { [k('q6', 'v1')]: q6 }).find((i) => i.field.key === 'q6a')
check('6a hidden when 6 empty', !pipedWith(undefined).visible)
check('6a hidden + auto value with one choice', !pipedWith(['L2']).visible && pipedWith(['L2']).autoValue === 'L2')
check('6a hidden with exclusive pick', !pipedWith(['None']).visible && pipedWith(['None']).autoValue === undefined)
const p2 = pipedWith({ selected: ['L1', O], other: 'riêng' })
check('6a shown with 2 choices incl. other label', p2.visible && p2.piped.options.join() === `L1,${O}` && p2.piped.labels[O] === 'Lý do khác: riêng')
check('6a required: invalid piped choice rejected', validateInstance(p2, 'L3') === 'Vui lòng trả lời câu hỏi này.' && validateInstance(p2, 'L1') === null)

// Hidden section hides its page; hidden header hides the block
const hs = [F('c', 'radio', { options: ['y', 'n'] }), F('s1', 'section', { conditional_logic: rule('c', ['y']) }), F('t1', 'short_text', { is_required: true }), F('s2', 'section'), F('t2', 'short_text')]
const hp = paginate(evaluateForm(hs, {}, { [String(hs[0].id)]: 'n' }))
check('hidden section hides its page', hp.length === 3 && !hp[1].visible && hp[2].visible)
check('hidden page not validated', Object.keys(validatePages(hp, {})).length === 0)
const hh = [F('c2', 'radio', { options: ['y', 'n'] }), F('HB', 'random_section', { conditional_logic: rule('c2', ['y']), settings: { variants: [{ key: 'z' }] } }), F('m', 'short_text', { random_group_key: 'HB' })]
const hhp = paginate(evaluateForm(hh, {}, { [String(hh[0].id)]: 'n' }))
check('hidden pending block page is skipped', hhp[1].pending && !hhp[1].visible)
const allHidden = [F('c3', 'radio', { options: ['y'] }), F('s3', 'section'), F('only', 'short_text', { conditional_logic: rule('c3', ['y']) })]
check('page whose questions are all hidden is skipped', !paginate(evaluateForm(allHidden, {}, {}))[1].visible)

// Validation rules
const inst = (key, v) => ({ field: byKey[key], answerKey: k(key, v), visible: true })
check('max 2 enforced', validateInstance(inst('q3', 'v1'), ['A', 'B', O]) === 'Chỉ được chọn tối đa 2 phương án.')
check('exclusive alone ok', validateInstance(inst('q3', 'v1'), ['X']) === null)
check('exclusive with others rejected', /không thể chọn cùng/.test(validateInstance(inst('q3', 'v1'), ['X', 'A'])))
check('other needs text', validateInstance(inst('q3', 'v1'), { selected: [O], other: ' ' }) === 'Vui lòng ghi rõ nội dung phương án "Khác".')
check('other with text ok', validateInstance(inst('q3', 'v1'), { selected: [O], other: 'abc' }) === null)
check('exactly 3: 2 rejected', validateInstance(inst('a7'), ['m', 'n']) === 'Vui lòng chọn ít nhất 3 phương án.')
check('exactly 3: 3 ok', validateInstance(inst('a7'), ['m', 'n', 'o']) === null)
check('all rows required', validateInstance(inst('a5'), { S1: 'Nhiều' }) === 'Vui lòng trả lời tất cả các dòng.')
check('all rows answered ok', validateInstance(inst('a5'), { S1: 'Nhiều', S2: 'Chưa' }) === null)
check('required grid empty', validateInstance(inst('a5'), {}) === 'Vui lòng trả lời câu hỏi này.')
check('number range', validateInstance(inst('a2'), '17') === 'Vui lòng nhập số từ 18 đến 99.')
check('number digits', validateInstance(inst('a2'), '100') === 'Chỉ được nhập tối đa 2 chữ số.')
check('number integer', validateInstance(inst('a2'), '20.5') === 'Vui lòng nhập số nguyên.')
check('number ok', validateInstance(inst('a2'), '45') === null)
check('email invalid', validateInstance(inst('email'), 'abc@') === 'Email không hợp lệ.')
check('email required', validateInstance(inst('email'), '  ') === 'Vui lòng trả lời câu hỏi này.')
const phone = { field: { type: 'phone', settings: {} }, answerKey: 'p' }
check('phone +84 normalized and valid', normalizePhone('+84 912.345-678') === '0912345678' && validateInstance(phone, '+84 912 345 678') === null)
check('phone invalid', validateInstance(phone, '0123') !== null)

// Choice value helpers
check('other text kept while unticked', JSON.stringify(makeChoiceValue(['A'], 'x', true)) === '{"selected":["A"],"other":"x"}')
check('plain array without other', JSON.stringify(makeChoiceValue(['A'], null, true)) === '["A"]')
check('choicesOf radio string', choicesOf('Yes').selected.join() === 'Yes')
check('empty selected is empty', isEmptyValue({ selected: [], other: 'x' }))

// Submission payload
const answers = {
  [k('email')]: 'a@b.vn',
  [k('q3', 'v1')]: { selected: ['A'], other: 'leftover' },
  [k('q5', 'v1')]: 'No',
  [k('q5a', 'v1')]: ['P'],
  [k('q6', 'v1')]: ['L1'],
  [k('a5')]: { S1: 'Nhiều', S2: '' },
}
const payload = submissionAnswers(paginate(evaluateForm(fields, { H: ['v1'] }, answers)), answers)
check('hidden 5a not sent', !(k('q5a', 'v1') in payload))
check('other text dropped when other not picked', JSON.stringify(payload[k('q3', 'v1')]) === '["A"]')
check('auto piped 6a not sent', !(k('q6a', 'v1') in payload))
check('empty grid rows dropped', JSON.stringify(payload[k('a5')]) === '{"S1":"Nhiều"}')

// Assignment helpers
const p0 = paginate(evaluateForm(fields, {}, {}))[0]
check('filter group detected on page', filterGroupsOnPage(fields, p0, {}).join() === 'H')
check('no filter group once assigned', filterGroupsOnPage(fields, p0, { H: ['v1'] }).length === 0)
check('filter answers only send filter field', JSON.stringify(filterAnswers(fields, ['H'], { [k('email')]: 'x@y.z', [k('grid')]: { R1: 'Biết' } })) === JSON.stringify({ [k('grid')]: { R1: 'Biết' } }))

// Progress estimate for a block that is not drawn yet
const H = fields.find((f) => f.key === 'H')
check('pending block counts its inner pages', pendingPageCount(H, fields) === 2)
check('pending block × pick count', pendingPageCount({ ...H, settings: { ...H.settings, pick_count: 2 } }, fields) === 4)
const lead = [F('H2', 'random_section', { settings: { mode: 'same', variants: [{ key: 'a' }] } }), F('s1', 'section', { random_group_key: 'H2' }), F('x', 'short_text', { random_group_key: 'H2' })]
check('leading break merges with block header', pendingPageCount(lead[0], lead) === 1)
const perVariant = [
  F('H3', 'random_section', { settings: { mode: 'different', variants: [{ key: 'a' }, { key: 'b' }] } }),
  F('d1', 'short_text', { random_group_key: 'H3', variant_key: 'a' }),
  F('d2', 'short_text', { random_group_key: 'H3', variant_key: 'b' }),
  F('d3', 'section', { random_group_key: 'H3', variant_key: 'b' }),
  F('d4', 'short_text', { random_group_key: 'H3', variant_key: 'b' }),
]
check('different mode uses the longest variant', pendingPageCount(perVariant[0], perVariant) === 2)
const pages0 = paginate(evaluateForm(fields, {}, {}))
const estimate = pages0.filter((p) => p.visible).reduce((s, p) => s + (p.pending ? pendingPageCount(p.items[0].field, fields) : 1), 0)
const drawn = paginate(evaluateForm(fields, { H: ['v1'] }, {})).filter((p) => p.visible).length
check('estimate before the draw equals page count after it', estimate === drawn)

console.log(`${total - failures}/${total} checks passed`)
process.exit(failures ? 1 : 0)
