// Headless check of the form builder (phase 2). Run: node tools/e2e-builder.mjs [--keep] [--shots]
// Needs: frontend dev server on http://eforms.test:5173, backend on http://eforms.test, local Chrome.
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PHP = 'D:\\wamp64\\bin\\php\\php8.3.14\\php.exe'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const APP = 'http://eforms.test:5173'
const API = 'http://eforms.test/api'
const KEEP = process.argv.includes('--keep')
const SHOTS = process.argv.includes('--shots')
const SHOT_DIR = join(ROOT, 'out')

const results = []
let step = 'start'
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail })

const { token, user } = JSON.parse(execFileSync(PHP, [join(ROOT, 'mint-token.php'), '1']).toString())
const api = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, data: text } }
}

const form = (await api('POST', '/forms', { title: 'E2E builder phase 2' })).data.form
await api('POST', `/forms/${form.id}/fields/bulk-update`, {
  fields: [
    { type: 'checkbox', label: 'Q nguồn', options: ['A', 'B', 'C'], order: 0 },
    { type: 'multiple_choice_grid', label: 'G lưới', rows: ['R1', 'R2', 'R3'], columns: ['Đã nghe', 'Chưa từng nghe nói'], order: 1 },
    { type: 'email', label: 'E email', order: 2 },
  ],
})

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && pageErrors.push(m.text()))
page.on('response', (r) => r.status() >= 400 && pageErrors.push(`${r.status()} ${r.url()}`))
page.on('dialog', (d) => d.accept())

const card = (label) => page.locator('.eforms-question', { hasText: label }).first()
const header = () => page.locator('.eforms-random-header').first()
const saveBtn = () => page.locator('button:visible', { has: page.locator('span', { hasText: /^Lưu$/ }) }).first()
const save = async () => {
  const wait = page.waitForResponse((r) => r.url().includes('/fields/bulk-update'), { timeout: 15000 })
  await saveBtn().click()
  const res = await wait
  await page.waitForTimeout(400)
  return res.status()
}
const openAdvanced = async (c) => {
  const toggle = c.getByRole('button', { name: /Tùy chọn nâng cao/ })
  await toggle.click()
}
const loadFields = async () => (await api('GET', `/forms/${form.id}`)).data.fields.sort((a, b) => a.order - b.order)
const shot = async (name, locator) => {
  if (!SHOTS) return
  mkdirSync(SHOT_DIR, { recursive: true })
  await locator.screenshot({ path: join(SHOT_DIR, `${name}.png`) })
}

try {
  await page.goto(APP + '/login')
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, { token, user })
  await page.goto(`${APP}/forms/${form.id}/edit`)
  await card('E email').waitFor()

  // 1. Random section after the email question, with filter and versions named after the grid rows.
  step = '1'
  await card('E email').click()
  await page.locator('button[title="Thêm phần ngẫu nhiên"]').click()
  await header().waitFor()
  await header().getByText('Lọc phiên bản theo câu trước').click()
  await header().getByRole('button', { name: 'Đặt tên phiên bản theo các dòng' }).click()
  await header().locator('label', { hasText: 'Chưa từng nghe nói' }).locator('input').check()
  await header().locator('input[type=number]').fill('2')
  await shot('random-header', header())
  await page.getByRole('button', { name: 'Thêm câu hỏi vào phần' }).click()

  // 2. Advanced options on the checkbox question.
  step = '2'
  const q = card('Q nguồn')
  await q.click()
  await openAdvanced(q)
  await q.locator('.eforms-adv input[type=number]').nth(1).fill('2')
  await q.locator('.eforms-adv label', { hasText: /^C$/ }).locator('input').check()
  await q.getByRole('button', { name: 'thêm "Khác (ghi rõ)"' }).click()
  await shot('checkbox-advanced', q)

  // 3. Condition on the first block question: show when "Q nguồn" includes A.
  step = '3'
  const members = page.locator('.eforms-block-member .eforms-question')
  await members.first().click()
  await openAdvanced(members.first())
  await members.first().getByText('Chỉ hiển thị khi thỏa điều kiện').click()
  const ruleBox = members.first().locator('.eforms-condition-rule').first()
  await ruleBox.locator('select').first().selectOption({ label: 'Q nguồn' })
  await ruleBox.locator('label', { hasText: /^A$/ }).locator('input').check()
  await shot('member-condition', members.first())

  // 4. Respondent limit by email (settings saves pending fields first).
  step = '4'
  await page.locator('button[title="Cài đặt"]').click()
  await page.getByText('Giới Hạn Mỗi Người Trả Lời').click()
  await page.locator('label', { hasText: 'Lấy từ một câu Email' }).locator('input').check()
  const fieldsSave = page.waitForResponse((r) => r.url().includes('/fields/bulk-update'))
  const settingsSave = page.waitForResponse((r) => r.url().endsWith(`/forms/${form.id}`) && r.request().method() === 'PUT' && r.request().postData()?.includes('respondent_limit'))
  await page.getByRole('button', { name: 'Lưu Cài Đặt' }).click()
  check('settings saved pending fields first', (await fieldsSave).status() === 200)
  check('settings saved', (await settingsSave).status() === 200)
  await page.waitForTimeout(800)

  let saved = await loadFields()
  const types = saved.map((f) => f.type).join(',')
  check('field order', types === 'checkbox,multiple_choice_grid,email,random_section,radio,radio', types)
  const head = saved.find((f) => f.type === 'random_section')
  const hs = head?.settings || {}
  check('versions named from rows', (hs.variants || []).map((v) => v.title).join('|') === 'R1|R2|R3', JSON.stringify(hs.variants))
  check('pick count 2', hs.pick_count === 2)
  check('filter field = grid', hs.filter?.field_key === saved[1].key)
  check('row map by order', (hs.variants || []).map((v) => hs.filter?.row_map?.[v.key]).join('|') === 'R1|R2|R3', JSON.stringify(hs.filter?.row_map))
  check('excluded column', JSON.stringify(hs.filter?.exclude_columns) === '["Chưa từng nghe nói"]')
  const blockMembers = saved.filter((f) => f.random_group_key === head?.key)
  check('two block members', blockMembers.length === 2)
  const qs = saved[0].settings || {}
  check('checkbox max 2', qs.max_select === 2)
  check('checkbox exclusive C', JSON.stringify(qs.exclusive_options) === '["C"]')
  check('checkbox other option', qs.other_option?.enabled === true)
  const rule = blockMembers[0]?.conditional_logic?.rules?.[0]
  check('member condition', rule?.field_key === saved[0].key && JSON.stringify(rule?.values) === '["A"]', JSON.stringify(blockMembers[0]?.conditional_logic))
  const limit = (await api('GET', `/forms/${form.id}`)).data.respondent_limit || {}
  check('respondent limit', limit.enabled && limit.methods?.includes('email') && limit.field_keys?.email === saved[2].key, JSON.stringify(limit))

  // 5. Rename option A -> A1, save again: ids must survive and the condition must follow the rename.
  step = '5'
  const idsBefore = saved.map((f) => f.id).join(',')
  await q.click()
  await q.locator('.eforms-option-input', { hasText: /^A$/ }).click()
  await page.keyboard.type('A1')
  await page.keyboard.press('Tab')
  check('second save ok', (await save()) === 200)
  saved = await loadFields()
  check('field ids stable across saves', saved.map((f) => f.id).join(',') === idsBefore, `${idsBefore} -> ${saved.map((f) => f.id).join(',')}`)
  const member = saved.find((f) => f.random_group_key && f.conditional_logic)
  check('condition follows rename', JSON.stringify(member?.conditional_logic?.rules?.[0]?.values) === '["A1"]', JSON.stringify(member?.conditional_logic))

  // 6. Different mode: add a question to the second version's tab.
  step = '6'
  await header().click()
  await header().getByText('Câu hỏi khác nhau', { exact: true }).click()
  await header().locator('.eforms-variant-tab', { hasText: 'R2' }).click()
  await page.getByRole('button', { name: 'Thêm câu hỏi vào phần' }).click()
  await shot('different-mode', page.locator('.eforms-main'))
  check('third save ok', (await save()) === 200)
  saved = await loadFields()
  const h2 = saved.find((f) => f.type === 'random_section')
  const v2 = h2.settings.variants[1].key
  check('mode different', h2.settings.mode === 'different')
  check('new member in version 2', saved.some((f) => f.random_group_key === h2.key && f.variant_key === v2))
  await header().locator('.eforms-variant-tab', { hasText: 'R1' }).click()
  const visibleInR1 = await page.locator('.eforms-block-member').count()
  check('tab R1 hides R2-only question', visibleInR1 === 2, `visible members: ${visibleInR1}`)

  // 7. Reload: builder renders saved structure without errors.
  step = '7'
  await page.reload()
  await header().waitFor()
  check('reload renders block', (await page.locator('.eforms-block-member').count()) >= 2)
} catch (e) {
  check('script ran to completion', false, `step ${step}: ${e.message.split('\n')[0]}`)
  mkdirSync(SHOT_DIR, { recursive: true })
  await page.screenshot({ path: join(SHOT_DIR, 'failure.png') }).catch(() => {})
} finally {
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
  await browser.close()
  if (!KEEP) await api('DELETE', `/forms/${form.id}`)
  execFileSync(PHP, [join(ROOT, 'mint-token.php'), '1', '--revoke'])
}

const failed = results.filter((r) => !r.ok)
for (const r of failed) console.log(`FAIL  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`)
console.log(`${results.length - failed.length}/${results.length} checks passed${KEEP ? ` (form ${form.id} kept)` : ''}`)
process.exit(failed.length ? 1 : 0)
