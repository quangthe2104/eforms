// Unit checks for frontend/src/utils/formStructure.js. Run from repo root: node tools/test-form-structure.mjs
import {
  moveField, insertionPoint, removeFieldAt, cloneFields, updateChoiceReferences, destructiveChanges,
  isHiddenInBuilder, pruneReferences, newKey, sanitizeSettings,
} from '../frontend/src/utils/formStructure.js'

let failures = 0
const check = (name, cond) => { if (!cond) { failures++; console.log('FAIL', name) } }
const keys = (fs) => fs.map((f) => f.key).join(',')

const H = { key: 'H', type: 'random_section', settings: { mode: 'same', variants: [{ key: 'v1' }, { key: 'v2' }] } }
const base = () => [
  { key: 'a', type: 'radio', options: ['x', 'y'] },
  { key: 'g', type: 'multiple_choice_grid', rows: ['r1', 'r2'], columns: ['c1', 'c2'] },
  { ...H },
  { key: 'm1', type: 'checkbox', random_group_key: 'H', options: ['p'] },
  { key: 'm2', type: 'radio', random_group_key: 'H', conditional_logic: { match: 'all', rules: [{ field_key: 'm1', operator: 'includes_any', values: ['p'] }] } },
  { key: 'b', type: 'short_text', conditional_logic: { rules: [{ field_key: 'a', operator: 'includes_any', values: ['x'] }] } },
  { key: 'c', type: 'short_text' },
]

// Moving
let f = moveField(base(), 'a', 'm1', {})
check('outside item dropped inside block joins it', f.find((x) => x.key === 'a').random_group_key === 'H')
f = moveField(base(), 'm1', 'c', {})
check('member dropped after block leaves it', !f.find((x) => x.key === 'm1').random_group_key && keys(f).endsWith('c,m1'))
f = moveField(base(), 'c', 'b', {})
check('item dropped right after block tail stays outside', !f.find((x) => x.key === 'c').random_group_key && keys(f) === 'a,g,H,m1,m2,c,b')
f = moveField(base(), 'm2', 'b', {})
check('member dropped below an outside item leaves block', keys(f) === 'a,g,H,m1,b,m2,c' && !f.find((x) => x.key === 'm2').random_group_key)
f = moveField(base(), 'm1', 'm2', {})
check('member moved to block tail boundary stays member', keys(f) === 'a,g,H,m2,m1,b,c' && f.find((x) => x.key === 'm1').random_group_key === 'H')
f = moveField(base(), 'H', 'c', {})
check('header moves whole block down', keys(f) === 'a,g,b,c,H,m1,m2')
f = moveField(base(), 'H', 'a', {})
check('header moves whole block up', keys(f) === 'H,m1,m2,a,g,b,c')
f = moveField(base(), 'H', 'm1', {})
check('header dropped on own member is a no-op', keys(f) === keys(base()))

// Different mode: joining takes the active tab
const diff = base().map((x) => (x.key === 'H' ? { ...x, settings: { ...x.settings, mode: 'different' } } : x))
f = moveField(diff, 'a', 'm1', { H: 'v2' })
check('joining a different-mode block takes active tab', f.find((x) => x.key === 'a').variant_key === 'v2')
const withVariants = diff.map((x) => (x.key === 'm1' ? { ...x, variant_key: 'v1' } : x))
check('other-tab member hidden', isHiddenInBuilder(withVariants[3], withVariants, { H: 'v2' }))
check('shared member visible', !isHiddenInBuilder(withVariants[4], withVariants, { H: 'v2' }))

// Insertion
let p = insertionPoint(base(), 3, {})
check('insert after member joins block', p.at === 4 && p.groupKey === 'H')
p = insertionPoint(base(), 2, {})
check('insert with header active goes to block end', p.at === 5 && p.groupKey === 'H')
p = insertionPoint(base(), 3, {}, { isBlock: true })
check('new block never nests', p.at === 5 && p.groupKey === null)
p = insertionPoint(diff, 2, { H: 'v2' })
check('insert into different block uses tab', p.variantKey === 'v2')
p = insertionPoint(base(), null, {})
check('no active item appends', p.at === 7 && p.groupKey === null)

// Removal
f = removeFieldAt(base(), 2)
check('removing header removes block', keys(f) === 'a,g,b,c')
f = removeFieldAt(base(), 0)
check('removing condition source prunes rule', f.find((x) => x.key === 'b').conditional_logic === null)
const filtered = base().map((x) => (x.key === 'H' ? { ...x, settings: { ...x.settings, filter: { field_key: 'g' } } } : x))
f = removeFieldAt(filtered, 1)
check('removing filter source clears filter', f.find((x) => x.key === 'H').settings.filter === null)
check('pruneReferences keeps intact fields identical', pruneReferences(base()).every((x, i) => x === base()[i] || JSON.stringify(x) === JSON.stringify(base()[i])))

// Cloning remaps internal references
const block = base().slice(2, 5)
const copies = cloneFields(block)
check('clone gets new keys', copies.every((c, i) => c.key !== block[i].key && !c.id))
check('clone members point at cloned header', copies[1].random_group_key === copies[0].key)
check('clone conditions point at cloned source', copies[2].conditional_logic.rules[0].field_key === copies[1].key)
const tabCopies = cloneFields([block[1]], { variant_key: 'v2' })
check('clone override applies, external group kept', tabCopies[0].variant_key === 'v2' && tabCopies[0].random_group_key === 'H')

// Renames
f = updateChoiceReferences(base(), 'a', 'option', 'x', 'X')
check('option rename updates condition values', f.find((x) => x.key === 'b').conditional_logic.rules[0].values[0] === 'X')
f = updateChoiceReferences(base(), 'a', 'option', 'x', undefined)
check('option removal drops condition value', f.find((x) => x.key === 'b').conditional_logic.rules[0].values.length === 0)
const withFilter = base().map((x) => (x.key === 'H' ? { ...x, settings: { ...x.settings, filter: { field_key: 'g', row_map: { v1: 'r1', v2: 'r2' }, exclude_columns: ['c2'] } } } : x))
f = updateChoiceReferences(withFilter, 'g', 'column', 'c2', 'C2')
check('column rename updates excluded columns', f.find((x) => x.key === 'H').settings.filter.exclude_columns[0] === 'C2')
f = updateChoiceReferences(withFilter, 'g', 'row', 'r1', 'R1')
check('row rename updates row map', f.find((x) => x.key === 'H').settings.filter.row_map.v1 === 'R1')
f = updateChoiceReferences(withFilter, 'g', 'row', 'r2', undefined)
check('row removal unmaps variant', f.find((x) => x.key === 'H').settings.filter.row_map.v2 === '')

// Destructive diff
const saved = [{ id: 1, key: 'a', type: 'radio', label: 'A', options: ['x', 'y'] }, { id: 2, key: 'H', type: 'random_section', label: 'H', settings: { variants: [{ key: 'v1', title: 'V1' }, { key: 'v2', title: 'V2' }] } }, { id: 3, key: 'd', type: 'description', label: 'D' }]
const now = [{ id: 1, key: 'a', type: 'radio', label: 'A', options: ['x'] }, { id: 2, key: 'H', type: 'random_section', label: 'H', settings: { variants: [{ key: 'v1', title: 'V1' }] } }]
const changes = destructiveChanges(saved, now)
check('destructive diff finds removed option and variant only', changes.length === 2 && changes[0].includes('y') && changes[1].includes('V2'))

// Misc
check('uuid format', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(newKey()))
check('type change drops foreign settings', JSON.stringify(sanitizeSettings('radio', { max_select: 3, other_option: { enabled: true } })) === '{"other_option":{"enabled":true}}')

console.log(failures ? `${failures} check(s) failed` : 'All form-structure checks passed')
process.exit(failures ? 1 : 0)
