// Unit checks for frontend/src/utils/ops.js. Run from repo root: node tools/test-ops.mjs
import {
  applyOp, applyOps, invertOp, invertOps, diffDocs, diffFields, diffForm, applySet, invertSet, mergeOps, mergeSets,
  typingSignature, isNoop, opsConflict, describeOps, sameValue,
} from '../frontend/src/utils/ops.js'

let failures = 0
let total = 0
const check = (name, cond, detail) => {
  total++
  if (!cond) {
    failures++
    console.log('FAIL', name, detail !== undefined ? JSON.stringify(detail) : '')
  }
}
const keys = (doc) => doc.fields.map((f) => f.key).join(',')
const same = (a, b) => diffDocs(a, b).length === 0 && keys(a) === keys(b)

const base = () => ({
  fields: [
    { key: 'a', type: 'radio', label: 'Họ tên', options: ['x', 'y'], settings: { other_option: { enabled: true }, min_select: 1 }, validation_rules: { max: 5 } },
    { key: 'b', type: 'short_text', label: 'B', settings: {} },
    { key: 'c', type: 'checkbox', label: 'C', options: ['p'], settings: {}, conditional_logic: { rules: [{ field_key: 'a' }] } },
    { key: 'd', type: 'section', label: 'D', settings: {} },
  ],
  form: { title: 'T', description: '', primary_color: '#111111', settings: { a: 1 }, respondent_limit: { enabled: false, methods: ['device'] }, require_login: false },
})

/** apply → invert → apply inverse must give back the original doc. */
const roundTrip = (name, ops) => {
  const doc = base()
  const after = applyOps(doc, ops)
  const inverse = invertOps(doc, ops)
  const back = applyOps(after, inverse)
  check(`${name}: changes something`, !same(doc, after))
  check(`${name}: round-trip`, same(doc, back), { after: keys(after), back: keys(back), diff: diffDocs(doc, back) })
  // diff of before/after reproduces the same result
  check(`${name}: diff replays`, same(applyOps(doc, diffDocs(doc, after)), after), diffDocs(doc, after))
  return after
}

// ---- every op type
let d = roundTrip('insert after b', [{ type: 'field.insert', key: 'n', after_key: 'b', data: { type: 'short_text', label: 'N' } }])
check('insert position', keys(d) === 'a,b,n,c,d', keys(d))
d = roundTrip('insert first (after_key null)', [{ type: 'field.insert', key: 'n', after_key: null, data: { type: 'email' } }])
check('insert first position', keys(d) === 'n,a,b,c,d', keys(d))
d = applyOp(base(), { type: 'field.insert', key: 'n', after_key: 'zzz', data: { type: 'email' } })
check('insert unknown after_key → end', keys(d) === 'a,b,c,d,n', keys(d))
check('insert existing key is skipped', keys(applyOp(base(), { type: 'field.insert', key: 'a', after_key: null, data: {} })) === 'a,b,c,d')

d = roundTrip('delete middle', [{ type: 'field.delete', key: 'b' }])
check('delete result', keys(d) === 'a,c,d')
d = roundTrip('delete first', [{ type: 'field.delete', key: 'a' }])
const delInv = invertOp(base(), { type: 'field.delete', key: 'c' })[0]
check('delete inverse re-inserts after predecessor with data', delInv.type === 'field.insert' && delInv.after_key === 'b' && delInv.data.options[0] === 'p' && delInv.data.conditional_logic.rules[0].field_key === 'a', delInv)

d = roundTrip('update label', [{ type: 'field.update', key: 'a', set: { label: 'Tên' } }])
check('update applied', d.fields[0].label === 'Tên')
d = roundTrip('update type + options', [{ type: 'field.update', key: 'a', set: { type: 'checkbox', options: ['x'] } }])
roundTrip('update settings dotted (change entry)', [{ type: 'field.update', key: 'a', set: { 'settings.min_select': 2 } }])
d = roundTrip('update settings dotted (remove entry)', [{ type: 'field.update', key: 'a', set: { 'settings.other_option': null } }])
check('dotted null removes entry, keeps others', !('other_option' in d.fields[0].settings) && d.fields[0].settings.min_select === 1, d.fields[0].settings)
d = roundTrip('update settings dotted (new entry)', [{ type: 'field.update', key: 'b', set: { 'settings.piped_from': 'a' } }])
check('dotted creates entry', d.fields[1].settings.piped_from === 'a')
roundTrip('update validation_rules dotted', [{ type: 'field.update', key: 'a', set: { 'validation_rules.max': 9 } }])
d = roundTrip('update settings whole + dotted', [{ type: 'field.update', key: 'a', set: { 'settings.x': 1, settings: { y: 2 } } }])
check('whole applied before dotted', d.fields[0].settings.y === 2 && d.fields[0].settings.x === 1 && !d.fields[0].settings.min_select, d.fields[0].settings)
check('invertSet drops dotted when whole present', Object.keys(invertSet(base().fields[0], { 'settings.x': 1, settings: {} })).join() === 'settings')
roundTrip('update conditional_logic whole', [{ type: 'field.update', key: 'c', set: { conditional_logic: null } }])
check('update missing key skipped', applyOp(base(), { type: 'field.update', key: 'zz', set: { label: 'q' } }).fields.length === 4)

d = roundTrip('move to first', [{ type: 'field.move', key: 'c', after_key: null }])
check('move first order', keys(d) === 'c,a,b,d', keys(d))
d = roundTrip('move to end', [{ type: 'field.move', key: 'a', after_key: 'd' }])
check('move end order', keys(d) === 'b,c,d,a', keys(d))
d = roundTrip('move down one', [{ type: 'field.move', key: 'a', after_key: 'b' }])
check('move down order', keys(d) === 'b,a,c,d', keys(d))
check('move after itself ignored', keys(applyOp(base(), { type: 'field.move', key: 'a', after_key: 'a' })) === 'a,b,c,d')

d = roundTrip('form title', [{ type: 'form.update', set: { title: 'Mới' } }])
roundTrip('form theme', [{ type: 'form.update', set: { primary_color: '#222222', font_family: 'Arial' } }])
d = roundTrip('form settings dotted', [{ type: 'form.update', set: { 'settings.b': 2, 'respondent_limit.enabled': true } }])
check('form dotted keeps other entries', d.form.settings.a === 1 && d.form.settings.b === 2 && d.form.respondent_limit.methods[0] === 'device', d.form)

roundTrip('batch: insert, move, update, delete', [
  { type: 'field.insert', key: 'n', after_key: 'a', data: { type: 'radio', options: ['1'] } },
  { type: 'field.move', key: 'd', after_key: null },
  { type: 'field.update', key: 'n', set: { label: 'X' } },
  { type: 'field.delete', key: 'b' },
  { type: 'form.update', set: { description: 'mô tả' } },
])

// ---- diff
const reorder = (order) => ({ ...base(), fields: order.split(',').map((k) => base().fields.find((f) => f.key === k)) })
let ops = diffFields(base().fields, reorder('b,c,d,a').fields)
check('moving one item to the end = one move', ops.length === 1 && ops[0].type === 'field.move' && ops[0].key === 'a' && ops[0].after_key === 'd', ops)
ops = diffFields(base().fields, reorder('d,a,b,c').fields)
check('moving last to first = one move', ops.length === 1 && ops[0].key === 'd' && ops[0].after_key === null, ops)
ops = diffFields(base().fields, reorder('d,c,b,a').fields)
check('reverse = 3 moves and replays', ops.length === 3 && keys(applyOps(base(), ops)) === 'd,c,b,a', ops)
const objIdentity = base()
check('identical docs → no ops', diffDocs(objIdentity, { ...objIdentity }).length === 0)
check('null vs "" vs {} are the same', sameValue(null, '') && sameValue({}, null) && sameValue([], undefined) && !sameValue(false, null))
check('object key order ignored', sameValue({ a: 1, b: 2 }, { b: 2, a: 1 }))
ops = diffForm(base().form, { ...base().form, settings: { a: 1, c: 3 }, respondent_limit: { enabled: true, methods: ['device'] } })
check('form diff uses dotted entries', ops.length === 1 && ops[0].set['settings.c'] === 3 && ops[0].set['respondent_limit.enabled'] === true && !('settings' in ops[0].set), ops)
const fa = base()
const fb = { ...fa, fields: fa.fields.map((f) => (f.key === 'a' ? { ...f, settings: { other_option: { enabled: true } } } : f)) }
ops = diffDocs(fa, fb)
check('field settings entry removed → dotted null', ops.length === 1 && ops[0].set['settings.min_select'] === null, ops)
const fc = { ...fa, fields: fa.fields.map((f) => (f.key === 'b' ? { ...f, settings: { piped_from: 'a' } } : f)) }
ops = diffDocs(fa, fc)
check('empty settings → whole object sent', ops.length === 1 && ops[0].set.settings?.piped_from === 'a', ops)
const withId = { ...fa, fields: fa.fields.map((f) => ({ ...f, id: 7, order: 3 })) }
check('id/order are not diffed', diffDocs(fa, withId).length === 0)

// ---- merge / typing coalescing
const t1 = [{ type: 'field.update', key: 'a', set: { label: 'H' } }]
const t2 = [{ type: 'field.update', key: 'a', set: { label: 'Ho' } }]
check('typing signature equal for same field+prop', typingSignature(t1) && typingSignature(t1) === typingSignature(t2))
check('different prop → different signature', typingSignature(t1) !== typingSignature([{ type: 'field.update', key: 'a', set: { description: 'x' } }]))
check('different field → different signature', typingSignature(t1) !== typingSignature([{ type: 'field.update', key: 'b', set: { label: 'x' } }]))
check('boolean toggles do not coalesce', typingSignature([{ type: 'field.update', key: 'a', set: { is_required: true } }]) === null)
check('options typing coalesces', typingSignature([{ type: 'field.update', key: 'a', set: { options: ['x'] } }]) !== null)
check('form title typing coalesces', typingSignature([{ type: 'form.update', set: { title: 'a' } }]) === 'form|title'.replace('form', '@form'))
check('multi-op change does not coalesce', typingSignature([...t1, ...t2]) === null)
const merged = mergeOps(t1, t2)
check('merge folds consecutive updates', merged.length === 1 && merged[0].set.label === 'Ho', merged)
// simulate a coalesced undo step: keep first inverse, merge forward ops
const doc0 = base()
const inv = invertOps(doc0, t1)
const doc2 = applyOps(applyOps(doc0, t1), t2)
check('coalesced step undoes to before first keystroke', applyOps(doc2, inv).fields[0].label === 'Họ tên')
check('isNoop detects a step typed back to the original', isNoop(applyOps(doc0, [{ type: 'field.update', key: 'a', set: { label: 'Họ tên' } }]), inv))
check('mergeSets: whole prop drops earlier dotted', JSON.stringify(mergeSets({ 'settings.a': 1, label: 'x' }, { settings: { b: 1 } })) === JSON.stringify({ label: 'x', settings: { b: 1 } }))
check('mergeSets: dotted after whole kept', Object.keys(mergeSets({ settings: { b: 1 } }, { 'settings.a': 1 })).length === 2)
check('merge does not fold different targets', mergeOps(t1, [{ type: 'field.update', key: 'b', set: { label: 'x' } }]).length === 2)
check('applySet does not mutate input', (() => { const o = { settings: { a: 1 } }; applySet(o, { 'settings.a': 2 }); return o.settings.a === 1 })())

// ---- conflicts (remote ops marking history, phase 5)
check('same field+prop conflicts', opsConflict(t1, [{ type: 'field.update', key: 'a', set: { label: 'z' } }]))
check('same field, other prop does not', !opsConflict(t1, [{ type: 'field.update', key: 'a', set: { description: 'z' } }]))
check('remote delete conflicts with any local edit', opsConflict(t1, [{ type: 'field.delete', key: 'a' }]))
check('settings whole vs dotted overlap', opsConflict([{ type: 'field.update', key: 'a', set: { 'settings.x': 1 } }], [{ type: 'field.update', key: 'a', set: { settings: {} } }]))
check('different settings entries do not overlap', !opsConflict([{ type: 'field.update', key: 'a', set: { 'settings.x': 1 } }], [{ type: 'field.update', key: 'a', set: { 'settings.y': 1 } }]))
check('form props conflict by name', opsConflict([{ type: 'form.update', set: { title: 'a' } }], [{ type: 'form.update', set: { title: 'b' } }]))

// ---- labels
const bd = base()
check('label delete', describeOps([{ type: 'field.delete', key: 'a' }], bd, applyOp(bd, { type: 'field.delete', key: 'a' })) === "Xóa câu hỏi 'Họ tên'")
check('label type change', describeOps([{ type: 'field.update', key: 'a', set: { type: 'checkbox' } }], bd, bd) === "Đổi loại câu hỏi 'Họ tên'")
check('label move', describeOps([{ type: 'field.move', key: 'b', after_key: null }], bd, bd) === "Di chuyển câu hỏi 'B'")
check('label title', describeOps([{ type: 'form.update', set: { title: 'x' } }], bd, bd) === 'Sửa tiêu đề biểu mẫu')
check('label theme', describeOps([{ type: 'form.update', set: { primary_color: '#000' } }], bd, bd) === 'Đổi giao diện')

console.log(`${total - failures}/${total} checks passed`)
process.exit(failures ? 1 : 0)
