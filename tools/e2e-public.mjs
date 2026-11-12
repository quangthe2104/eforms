// Headless check of the public form (phase 3). Run: node tools/e2e-public.mjs [--keep] [--shots]
// Needs: frontend dev server on http://eforms.test:5173, backend on http://eforms.test, local Chrome.
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

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

const { token } = JSON.parse(execFileSync(PHP, [join(ROOT, 'mint-token.php'), '1']).toString())
const api = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, data: text } }
}
const sql = (query) => execFileSync(PHP, [join(ROOT, 'db-peek.php'), query]).toString().trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l))

// ---------- Fixture form ----------
const K = Object.fromEntries(['em', 'gr', 'H', 'q3', 'q5', 'q5a', 'q6', 'q6a', 'sec3', 'q9', 'sec4', 'a2', 'a5'].map((k) => [k, randomUUID()]))
const inH = { random_group_key: K.H }
const fieldsSpec = [
  { key: K.em, type: 'email', label: 'Email của bạn', is_required: true },
  { key: K.gr, type: 'multiple_choice_grid', label: 'Câu 2 lưới', rows: ['R1', 'R2', 'R3'], columns: ['Biết', 'Chưa từng nghe nói'] },
  {
    key: K.H, type: 'random_section', label: 'PHẦN II', description: '<p>Giới thiệu phần II</p>',
    settings: {
      mode: 'same', pick_count: 1, variant_label: 'Sự kiện được lựa chọn là',
      variants: [{ key: 'v1', title: 'Sự kiện 1', description: 'Mô tả 1' }, { key: 'v2', title: 'Sự kiện 2' }, { key: 'v3', title: 'Sự kiện 3', description: 'Mô tả 3' }],
      filter: { field_key: K.gr, row_map: { v1: 'R1', v2: 'R2', v3: 'R3' }, exclude_columns: ['Chưa từng nghe nói'] },
    },
  },
  { ...inH, key: K.q3, type: 'checkbox', label: 'Câu 3 nhớ gì', options: ['A', 'B', 'X không nhớ'], settings: { max_select: 2, exclusive_options: ['X không nhớ'], other_option: { enabled: true, label: 'Khác (ghi rõ)' } } },
  { ...inH, key: K.q5, type: 'radio', label: 'Câu 5 liên hệ', options: ['Có', 'Không'] },
  { ...inH, key: K.q5a, type: 'checkbox', label: 'Câu 5a cụ thể', options: ['P', 'Q'], conditional_logic: { match: 'all', rules: [{ field_key: K.q5, operator: 'includes_any', values: ['Có'] }] } },
  { ...inH, key: K.q6, type: 'checkbox', label: 'Câu 6 lý do', options: ['L1', 'L2', 'L3', 'Không có'], settings: { exclusive_options: ['Không có'] } },
  { ...inH, key: K.q6a, type: 'radio', label: 'Câu 6a quan trọng nhất', is_required: true, settings: { piped_from: K.q6 } },
  { ...inH, key: K.sec3, type: 'section', label: 'PHẦN III' },
  { ...inH, key: K.q9, type: 'short_text', label: 'Câu 9 hình thức' },
  { key: K.sec4, type: 'section', label: 'PHẦN IV' },
  { key: K.a2, type: 'number', label: 'A2 tuổi', settings: { number: { digits: 2, min: 18, max: 99 } } },
  { key: K.a5, type: 'multiple_choice_grid', label: 'A5 tần suất', is_required: true, rows: ['S1', 'S2'], columns: ['Nhiều', 'Chưa'], settings: { require_all_rows: true } },
].map((f, order) => ({ ...f, order }))

const created = []
const makeForm = async (title, fields, extra = {}) => {
  const form = (await api('POST', '/forms', { title })).data.form
  created.push(form.id)
  const bulk = await api('POST', `/forms/${form.id}/fields/bulk-update`, { fields })
  if (bulk.status >= 300) throw new Error(`bulk-update ${bulk.status}: ${JSON.stringify(bulk.data).slice(0, 300)}`)
  const upd = await api('PUT', `/forms/${form.id}`, { status: 'published', is_public: true, accept_responses: true, ...extra })
  if (upd.status >= 300) throw new Error(`update ${upd.status}: ${JSON.stringify(upd.data).slice(0, 300)}`)
  const full = (await api('GET', `/forms/${form.id}`)).data
  return { id: form.id, slug: full.slug, ids: Object.fromEntries(full.fields.map((f) => [f.key, f.id])) }
}

const survey = await makeForm('E2E public phase 3', fieldsSpec, {
  respondent_limit: { enabled: true, methods: ['email'], field_keys: { email: K.em }, match: 'any', max_per_person: 1, on_limit: 'block', message: 'Đã tham gia rồi, cảm ơn!' },
})
const legacy = await makeForm('E2E public legacy', [
  { type: 'short_text', label: 'Tên', is_required: true, order: 0 },
  { type: 'radio', label: 'Màu', options: ['Đỏ', 'Xanh'], order: 1 },
  { type: 'checkbox', label: 'Món', options: ['Phở', 'Bún'], order: 2 },
])

const editable = await makeForm('E2E public edit mode', [
  { type: 'short_text', label: 'Ý kiến', is_required: true, order: 0 },
], { respondent_limit: { enabled: true, methods: ['device'], match: 'any', max_per_person: 1, on_limit: 'edit' } })

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const pageErrors = []
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => pageErrors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && pageErrors.push(m.text()))
  page.on('response', (r) => r.status() >= 500 && pageErrors.push(`${r.status()} ${r.url()}`))
  page.on('dialog', (d) => d.accept())
  return page
}
const shot = async (page, name) => {
  if (!SHOTS) return
  mkdirSync(SHOT_DIR, { recursive: true })
  await page.screenshot({ path: join(SHOT_DIR, `${name}.png`), fullPage: true })
}

const card = (page, label) => page.locator('[data-answer-key]', { hasText: label }).first()
const box = (page, label, option) => card(page, label).getByRole('checkbox', { name: option, exact: true })
const radio = (page, label, option) => card(page, label).getByRole('radio', { name: option, exact: true })
const next = (page) => page.getByRole('button', { name: 'Tiếp theo' })
const submit = (page) => page.getByRole('button', { name: 'Gửi', exact: true })
const banner = (page) => page.locator('.eforms-block-banner')
const visible = async (page, label) => (await card(page, label).count()) > 0
const errorOf = async (page, label) => (await card(page, label).locator('[role=alert]').textContent().catch(() => null))?.trim()

const email = `e2e+${Date.now()}@test.vn`

try {
  // 1. Page 1: required email, grid filter, assignment on leaving the page.
  step = '1'
  let page = await newPage()
  await page.goto(`${APP}/f/${survey.slug}`)
  await card(page, 'Email của bạn').waitFor()
  await next(page).click()
  check('1 empty required email blocked', (await errorOf(page, 'Email của bạn')) === 'Vui lòng trả lời câu hỏi này.')
  await card(page, 'Email của bạn').locator('input').fill(email)
  await page.getByLabel('R1: Chưa từng nghe nói').check()
  await page.getByLabel('R2: Chưa từng nghe nói').check()
  await page.getByLabel('R3: Biết').check()
  const assignRes = page.waitForResponse((r) => r.url().includes('/assign'))
  await next(page).click()
  const assignJson = await (await assignRes).json()
  check('1 assign excludes unheard rows', JSON.stringify(assignJson.assignments?.[K.H]) === '["v3"]', JSON.stringify(assignJson))
  await banner(page).waitFor()
  const bannerText = await banner(page).innerText()
  check('1 banner shows block intro + variant', /PHẦN II/.test(bannerText) && /Giới thiệu phần II/.test(bannerText) && /Sự kiện được lựa chọn là: Sự kiện 3/.test(bannerText) && /Mô tả 3/.test(bannerText), bannerText)
  check('1 progress counts effective pages', /Trang 2 \/ 4/.test(await page.locator('form').innerText()))

  // 2. Block page 1: limits, exclusive, other, condition, piped.
  step = '2'
  await box(page, 'Câu 3', 'A').check()
  await box(page, 'Câu 3', 'B').check()
  check('2 max 2 disables further options', await box(page, 'Câu 3', 'Khác (ghi rõ)').isDisabled())
  await box(page, 'Câu 3', 'X không nhớ').check()
  check('2 exclusive clears others', !(await box(page, 'Câu 3', 'A').isChecked()) && !(await box(page, 'Câu 3', 'B').isChecked()))
  await box(page, 'Câu 3', 'A').check()
  check('2 picking another clears exclusive', !(await box(page, 'Câu 3', 'X không nhớ').isChecked()))
  await box(page, 'Câu 3', 'Khác (ghi rõ)').check()
  await radio(page, 'Câu 5', 'Không').check()
  check('2 5a hidden when 5 = Không', !(await visible(page, 'Câu 5a')))
  await radio(page, 'Câu 5', 'Có').check()
  check('2 5a shown when 5 = Có', await visible(page, 'Câu 5a'))
  await box(page, 'Câu 6', 'L1').check()
  check('2 6a hidden with one choice', !(await visible(page, 'Câu 6a')))
  await box(page, 'Câu 6', 'L2').check()
  check('2 6a shown with picked options only', (await card(page, 'Câu 6a').getByRole('radio').count()) === 2)
  await next(page).click()
  check('2 "other" text required', (await errorOf(page, 'Câu 3')) === 'Vui lòng ghi rõ nội dung phương án "Khác".')
  check('2 piped required', (await errorOf(page, 'Câu 6a')) === 'Vui lòng trả lời câu hỏi này.')
  await card(page, 'Câu 3').getByLabel('Nội dung phương án khác').fill('Điều khác')
  await radio(page, 'Câu 6a', 'L2').check()
  await shot(page, 'public-block-page')

  // Reload keeps the variant, the answers and the page.
  await page.reload()
  await banner(page).waitFor()
  check('2 reload keeps variant', /Sự kiện 3/.test(await banner(page).innerText()))
  check('2 reload keeps answers', (await radio(page, 'Câu 6a', 'L2').isChecked()) && (await card(page, 'Câu 3').getByLabel('Nội dung phương án khác').inputValue()) === 'Điều khác')
  await next(page).click()

  // 3. Block page 2: reminder banner.
  step = '3'
  await card(page, 'Câu 9').waitFor()
  const reminder = await banner(page).innerText()
  check('3 reminder repeats variant, no intro', /Sự kiện 3/.test(reminder) && !/Giới thiệu phần II/.test(reminder), reminder)
  await card(page, 'Câu 9').locator('input').fill('Xem phim')
  await next(page).click()

  // 4. Last page: number range, all rows, submit.
  step = '4'
  await card(page, 'A2 tuổi').waitFor()
  check('4 no banner outside block', (await banner(page).count()) === 0)
  await card(page, 'A2 tuổi').locator('input').fill('17')
  await page.getByLabel('S1: Nhiều').check()
  await submit(page).click()
  check('4 number range enforced', (await errorOf(page, 'A2 tuổi')) === 'Vui lòng nhập số từ 18 đến 99.')
  check('4 all rows enforced', (await errorOf(page, 'A5 tần suất')) === 'Vui lòng trả lời tất cả các dòng.')
  await card(page, 'A2 tuổi').locator('input').fill('45')
  await page.getByLabel('S2: Chưa').check()
  const submitRes = page.waitForResponse((r) => r.url().includes('/submit'))
  await submit(page).click()
  const sub = await submitRes
  check('4 submit accepted', sub.status() === 201, String(sub.status()))
  await page.locator('[data-screen="message"]').waitFor()
  check('4 thank-you screen', /Cảm ơn/.test(await page.locator('[data-screen="message"]').innerText()))
  check('4 session token cleared', (await page.evaluate((s) => localStorage.getItem(`eforms_session:${s}`), survey.slug)) === null)

  const [resp] = sql(`SELECT id, assignments FROM form_responses WHERE form_id=${survey.id} ORDER BY id DESC LIMIT 1`)
  const rows = sql(`SELECT field_id, variant_key, value FROM response_answers WHERE response_id=${resp.id}`)
  const ans = (name) => rows.find((r) => String(r.field_id) === String(survey.ids[K[name]]))
  check('4 stored assignment', JSON.parse(resp.assignments)?.[K.H]?.[0] === 'v3', resp.assignments)
  check('4 block answers tagged with variant', ans('q3')?.variant_key === 'v3')
  const q3 = JSON.parse(ans('q3')?.value || 'null')
  check('4 other stored as {selected, other}', q3?.selected?.join() === 'A,__other__' && q3?.other === 'Điều khác', ans('q3')?.value)
  check('4 piped answer stored', JSON.parse(ans('q6a')?.value || 'null') === 'L2')
  check('4 hidden/unanswered 5a not stored', !ans('q5a'))
  check('4 grid stored', JSON.stringify(JSON.parse(ans('a5')?.value || 'null')) === '{"S1":"Nhiều","S2":"Chưa"}')
  await page.context().close()

  // 5. Same email on a new device is blocked when leaving page 1.
  step = '5'
  page = await newPage()
  await page.goto(`${APP}/f/${survey.slug}`)
  await card(page, 'Email của bạn').locator('input').fill(`  ${email.toUpperCase()} `)
  // A first 419 can happen in dev: StrictMode loads the form twice and the second response swaps the session cookie.
  const identityRes = page.waitForResponse((r) => r.url().includes('/check-identity') && r.status() !== 419, { timeout: 8000 })
  await next(page).click()
  const identity = await identityRes
  check('5 check-identity says limit_reached', (await identity.json()).status === 'limit_reached', `${identity.status()} ${(await identity.text()).slice(0, 200)}`)
  await page.locator('[data-screen="message"]').waitFor({ timeout: 8000 })
  check('5 duplicate email blocked with message', /Đã tham gia rồi, cảm ơn!/.test(await page.locator('[data-screen="message"]').innerText()))
  await page.context().close()

  // 6. Single piped choice is written by the server; exclusive in source leaves it empty.
  step = '6'
  page = await newPage()
  await page.goto(`${APP}/f/${survey.slug}`)
  await card(page, 'Email của bạn').locator('input').fill(`e2e2+${Date.now()}@test.vn`)
  await next(page).click()
  await banner(page).waitFor()
  check('6 no filter answers: any variant', /Sự kiện [123]/.test(await banner(page).innerText()))
  await box(page, 'Câu 6', 'L3').check()
  check('6 single choice hides 6a', !(await visible(page, 'Câu 6a')))
  await next(page).click()
  await card(page, 'Câu 9').waitFor()
  await page.getByRole('button', { name: 'Quay lại' }).click()
  await banner(page).waitFor()
  const variantBefore = await banner(page).innerText()
  await page.getByRole('button', { name: 'Quay lại' }).click()
  await page.getByLabel('R1: Chưa từng nghe nói').check()
  await next(page).click()
  await banner(page).waitFor()
  check('6 changing filter after draw keeps variant', (await banner(page).innerText()) === variantBefore)
  await next(page).click()
  await next(page).click()
  await page.getByLabel('S1: Nhiều').check()
  await page.getByLabel('S2: Nhiều').check()
  const sub6 = page.waitForResponse((r) => r.url().includes('/submit'))
  await submit(page).click()
  check('6 submit accepted', (await sub6).status() === 201)
  const [r6] = sql(`SELECT id FROM form_responses WHERE form_id=${survey.id} ORDER BY id DESC LIMIT 1`)
  const piped6 = sql(`SELECT value FROM response_answers WHERE response_id=${r6.id} AND field_id=${survey.ids[K.q6a]}`)[0]
  check('6 server wrote the single piped choice', JSON.parse(piped6?.value || 'null') === 'L3', JSON.stringify(piped6))
  await page.context().close()

  // 7. A form without the new features still works.
  step = '7'
  page = await newPage()
  await page.goto(`${APP}/f/${legacy.slug}`)
  await card(page, 'Tên').waitFor()
  await submit(page).click()
  check('7 legacy required check', (await errorOf(page, 'Tên')) === 'Vui lòng trả lời câu hỏi này.')
  await card(page, 'Tên').locator('input').fill('An')
  await radio(page, 'Màu', 'Xanh').check()
  await box(page, 'Món', 'Phở').check()
  await box(page, 'Món', 'Bún').check()
  const sub7 = page.waitForResponse((r) => r.url().includes('/submit'))
  await submit(page).click()
  check('7 legacy submit accepted', (await sub7).status() === 201)
  const [r7] = sql(`SELECT id FROM form_responses WHERE form_id=${legacy.id} ORDER BY id DESC LIMIT 1`)
  const vals7 = sql(`SELECT value FROM response_answers WHERE response_id=${r7.id} ORDER BY field_id`).map((r) => JSON.parse(r.value))
  check('7 legacy values stored', JSON.stringify(vals7) === JSON.stringify(['An', 'Xanh', ['Phở', 'Bún']]), JSON.stringify(vals7))
  await page.context().close()

  // 8. "Allow edit" by device: reopening loads the previous answer and the new one replaces it.
  step = '8'
  page = await newPage()
  await page.goto(`${APP}/f/${editable.slug}`)
  await card(page, 'Ý kiến').locator('input').fill('Lần đầu')
  const sub8 = page.waitForResponse((r) => r.url().includes('/submit'))
  await submit(page).click()
  check('8 first submit accepted', (await sub8).status() === 201)
  await page.locator('[data-screen="message"]').waitFor()
  await page.goto(`${APP}/f/${editable.slug}`)
  await card(page, 'Ý kiến').waitFor()
  check('8 reopen shows editing notice', /nạp lại để sửa/.test(await page.locator('[role=status]').innerText().catch(() => '')))
  check('8 reopen loads previous answer', (await card(page, 'Ý kiến').locator('input').inputValue()) === 'Lần đầu')
  await card(page, 'Ý kiến').locator('input').fill('Lần hai')
  const sub8b = page.waitForResponse((r) => r.url().includes('/submit'))
  await submit(page).click()
  const res8 = await sub8b
  const body8 = await res8.text()
  check('8 resubmit edits', res8.status() === 201 && JSON.parse(body8).edited === true, `${res8.status()} ${body8.slice(0, 200)}`)
  await page.locator('[data-screen="message"]').waitFor()
  check('8 updated screen', /Đã cập nhật/.test(await page.locator('[data-screen="message"]').innerText()))
  const r8 = sql(`SELECT r.id, a.value FROM form_responses r JOIN response_answers a ON a.response_id=r.id WHERE r.form_id=${editable.id}`)
  check('8 one response, new value', r8.length === 1 && JSON.parse(r8[0].value) === 'Lần hai', JSON.stringify(r8))
  await page.context().close()
} catch (e) {
  check(`crashed at step ${step}`, false, e.message.split('\n')[0])
} finally {
  await browser.close()
  if (!KEEP) for (const id of created) await api('DELETE', `/forms/${id}`)
  execFileSync(PHP, [join(ROOT, 'mint-token.php'), '1', '--revoke'])
}

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
const failed = results.filter((r) => !r.ok)
for (const r of failed) console.log(`FAIL ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
console.log(`${results.length - failed.length}/${results.length} checks passed${KEEP ? ` (kept forms ${created.join(', ')})` : ''}`)
process.exit(failed.length ? 1 : 0)
