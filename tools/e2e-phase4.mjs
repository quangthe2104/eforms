// Headless check of phase 4: preview, response detail, summary, Excel export, duplicate.
// Run: node tools/e2e-phase4.mjs [--keep] [--shots]
// Needs: frontend dev server on http://eforms.test:5173, backend on http://eforms.test, local Chrome.
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
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
const OUT = join(ROOT, 'out')
mkdirSync(OUT, { recursive: true })

const results = []
let step = 'start'
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail })

const { token, user } = JSON.parse(execFileSync(PHP, [join(ROOT, 'mint-token.php'), '1']).toString())
const call = async (method, path, body, auth = true) => {
  const res = await fetch(API + path, {
    method,
    headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, data: text } }
}

// ---------- Fixture forms ----------
const NEVER = 'Chưa từng nghe nói'
const K = Object.fromEntries(['em', 'ph', 'gr', 'H', 'q3', 'q5', 'q5a', 'sec3', 'q9', 'a2', 'D', 'shared', 'ownA', 'intro'].map((k) => [k, randomUUID()]))
const inH = { random_group_key: K.H }
const surveySpec = [
  { key: K.em, type: 'email', label: 'Email', is_required: true, settings: { store_hash_only: true } },
  { key: K.ph, type: 'phone', label: 'Điện thoại' },
  { key: K.gr, type: 'multiple_choice_grid', label: 'Câu 2 lưới', rows: ['R1', 'R2'], columns: ['Biết', NEVER] },
  {
    key: K.H, type: 'random_section', label: 'PHẦN II', description: '<p>Giới thiệu</p>',
    settings: {
      mode: 'same', pick_count: 1, variant_label: 'Sự kiện được lựa chọn là',
      variants: [{ key: 'v1', title: 'Sự kiện 1' }, { key: 'v2', title: 'Sự kiện 2' }],
      filter: { field_key: K.gr, row_map: { v1: 'R1', v2: 'R2' }, exclude_columns: [NEVER] },
    },
  },
  { ...inH, key: K.q3, type: 'checkbox', label: 'Câu 3 nhớ gì', options: ['A', 'B'], settings: { other_option: { enabled: true, label: 'Khác (ghi rõ)' } } },
  { ...inH, key: K.q5, type: 'radio', label: 'Câu 5 liên hệ', options: ['Có', 'Không'] },
  { ...inH, key: K.q5a, type: 'short_text', label: 'Câu 5a cụ thể', conditional_logic: { match: 'all', rules: [{ field_key: K.q5, operator: 'includes_any', values: ['Có'] }] } },
  { ...inH, key: K.sec3, type: 'section', label: 'PHẦN III' },
  { ...inH, key: K.q9, type: 'short_text', label: 'Câu 9 hình thức' },
  { key: randomUUID(), type: 'section', label: 'PHẦN IV' },
  { key: K.a2, type: 'number', label: 'A2 tuổi', settings: { number: { digits: 2, min: 18, max: 99 } } },
].map((f, order) => ({ ...f, order }))

const inD = { random_group_key: K.D }
const roundsSpec = [
  { key: K.intro, type: 'short_text', label: 'Mở đầu' },
  {
    key: K.D, type: 'random_section', label: 'Khối khác nhau',
    settings: { mode: 'different', pick_count: 2, variants: [{ key: 'a', title: 'Bản A' }, { key: 'b', title: 'Bản B' }, { key: 'c', title: 'Bản C' }] },
  },
  { ...inD, key: K.shared, type: 'radio', label: 'Câu chung', options: ['X', 'Y'] },
  { ...inD, key: K.ownA, type: 'short_text', label: 'Câu riêng A', variant_key: 'a' },
].map((f, order) => ({ ...f, order }))

const created = []
const makeForm = async (title, fields, extra = {}) => {
  const form = (await call('POST', '/forms', { title })).data.form
  created.push(form.id)
  const bulk = await call('POST', `/forms/${form.id}/fields/bulk-update`, { fields })
  if (bulk.status >= 300) throw new Error(`bulk-update ${bulk.status}: ${JSON.stringify(bulk.data).slice(0, 300)}`)
  const upd = await call('PUT', `/forms/${form.id}`, { status: 'published', is_public: true, accept_responses: true, ...extra })
  if (upd.status >= 300) throw new Error(`update ${upd.status}: ${JSON.stringify(upd.data).slice(0, 300)}`)
  const full = (await call('GET', `/forms/${form.id}`)).data
  return { id: form.id, slug: full.slug, ids: Object.fromEntries(full.fields.map((f) => [f.key, f.id])) }
}

const survey = await makeForm('E2E phase 4 survey', surveySpec, {
  respondent_limit: { enabled: true, methods: ['email'], field_keys: { email: K.em }, match: 'any', max_per_person: 1, on_limit: 'block', message: 'Đã tham gia' },
})
const rounds = await makeForm('E2E phase 4 rounds', roundsSpec)
const id = (k) => survey.ids[K[k]]

/** Draws through /assign (the grid answer steers the draw), then submits like the public form. */
const respond = async (grid, block, plain, submit = true) => {
  const assign = await call('POST', `/forms/public/${survey.slug}/assign`, { answers: { [id('gr')]: grid } }, false)
  const variant = assign.data.assignments?.[K.H]?.[0]
  if (!submit) return { variant }
  const answers = { [id('gr')]: grid, ...plain }
  for (const [k, v] of Object.entries(block)) answers[`${id(k)}@${variant}`] = v
  const res = await call('POST', `/forms/public/${survey.slug}/submit`, { answers, token: assign.data.token }, false)
  return { variant, status: res.status, responseId: res.data.response_id, body: res.data }
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const pageErrors = []
const requests = []
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => pageErrors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && pageErrors.push(m.text()))
  page.on('response', (r) => r.status() >= 500 && pageErrors.push(`${r.status()} ${r.url()}`))
  page.on('request', (r) => requests.push(r.url()))
  page.on('dialog', (d) => d.accept())
  await page.goto(APP + '/login')
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, { token, user })
  return page
}
const shot = async (page, name, locator) => {
  if (!SHOTS) return
  await (locator || page).screenshot({ path: join(OUT, `${name}.png`), ...(locator ? {} : { fullPage: true }) })
}
const card = (page, label) => page.locator('[data-answer-key]', { hasText: label }).first()
const next = (page) => page.getByRole('button', { name: 'Tiếp theo' })
const banner = (page) => page.locator('.eforms-block-banner')

try {
  // 1. Seed responses through the public API.
  step = '1'
  const r1 = await respond({ R1: NEVER, R2: 'Biết' }, { q3: { selected: ['A', '__other__'], other: 'Ghi rõ 1' }, q5: 'Không', q9: 'phim' }, { [id('em')]: 'a@x.vn', [id('ph')]: '0912 345 678', [id('a2')]: '30' })
  const r2 = await respond({ R1: 'Biết', R2: NEVER }, { q3: ['B'], q5: 'Có', q5a: 'chi tiết' }, { [id('em')]: 'b@x.vn', [id('a2')]: '40' })
  const r3 = await respond({ R1: NEVER }, {}, {}, false)
  check('1 seeded responses', r1.status === 201 && r2.status === 201, `${r1.status} ${JSON.stringify(r1.body).slice(0, 200)} | ${r2.status}`)
  check('1 filter steered the draw', r1.variant === 'v2' && r2.variant === 'v1' && r3.variant === 'v2', `${r1.variant} ${r2.variant} ${r3.variant}`)

  // 2. Summary API: per-variant counts and the variant filter.
  step = '2'
  const sum = (await call('GET', `/forms/${survey.id}/responses/summary`)).data
  const stats = Object.fromEntries((sum.groups?.[0]?.variants || []).map((v) => [v.key, `${v.assigned}/${v.submitted}`]))
  check('2 assigned/submitted per variant', stats.v1 === '1/1' && stats.v2 === '2/1', JSON.stringify(stats))
  const filtered = (await call('GET', `/forms/${survey.id}/responses/summary?variants[${K.H}]=v2`)).data
  const q3 = filtered.fields.find((f) => f.field_id === id('q3'))
  check('2 filter narrows block question', q3?.total_answers === 1 && q3?.base === 1 && q3?.data?.other_values?.[0] === 'Ghi rõ 1', JSON.stringify(q3).slice(0, 300))
  check('2 hash-only email has no data', filtered.fields.find((f) => f.field_id === id('em'))?.hidden === true)

  // 3. Excel export layout.
  step = '3'
  const xres = await fetch(`${API}/forms/${survey.id}/export`, { headers: { Authorization: `Bearer ${token}` } })
  const xfile = join(OUT, 'e2e-phase4.xlsx')
  writeFileSync(xfile, Buffer.from(await xres.arrayBuffer()))
  const sheet = JSON.parse(execFileSync(PHP, [join(ROOT, 'xlsx-peek.php'), xfile]).toString())
  const head = sheet.rows[0].map((c) => c.v)
  const expectedHead = ['Mã câu trả lời', 'Thời gian gửi', 'Người dùng', 'Địa chỉ IP', 'Căn cứ nhận diện', 'Email', 'Điện thoại', 'Câu 2 lưới – R1', 'Câu 2 lưới – R2',
    'PHẦN II – phiên bản', 'Câu 3 nhớ gì', 'Câu 3 nhớ gì – Khác (ghi rõ)', 'Câu 5 liên hệ', 'Câu 5a cụ thể', 'Câu 9 hình thức', 'A2 tuổi']
  check('3 export headings', JSON.stringify(head) === JSON.stringify(expectedHead), JSON.stringify(head))
  const row = Object.fromEntries(head.map((h, i) => [h, sheet.rows[1]?.[i]]))
  check('3 row 1 values', row['PHẦN II – phiên bản']?.v === 'Sự kiện 2' && row['Câu 3 nhớ gì']?.v === 'A, Khác (ghi rõ)' && row['Câu 3 nhớ gì – Khác (ghi rõ)']?.v === 'Ghi rõ 1', JSON.stringify(sheet.rows[1]).slice(0, 400))
  check('3 hidden email, phone keeps 0, identity', row['Email']?.v === '(đã ẩn)' && row['Điện thoại']?.v === '0912345678' && row['Điện thoại']?.t === 's' && row['Căn cứ nhận diện']?.v === 'email')
  check('3 number stays numeric', row['A2 tuổi']?.t === 'n' && row['A2 tuổi']?.v === 30)

  // 4. Preview: variant picker, validation, conditions, no /assign.
  step = '4'
  let page = await newPage()
  requests.length = 0
  await page.goto(`${APP}/forms/${survey.id}/preview`)
  await card(page, 'Email').waitFor()
  const picker = page.getByLabel('Phiên bản của PHẦN II')
  check('4 picker defaults to first variant', (await picker.inputValue()) === 'v1')
  await next(page).click()
  check('4 preview validates required', /Vui lòng trả lời câu hỏi này/.test(await card(page, 'Email').innerText()))
  await card(page, 'Email').locator('input').fill('xem@truoc.vn')
  await next(page).click()
  await banner(page).waitFor()
  check('4 banner shows picked variant', /Sự kiện được lựa chọn là: Sự kiện 1/.test(await banner(page).innerText()))
  await picker.selectOption('v2')
  check('4 switching variant updates banner', /Sự kiện 2/.test(await banner(page).innerText()))
  check('4 condition hides 5a', (await card(page, 'Câu 5a').count()) === 0)
  await card(page, 'Câu 5 liên hệ').getByRole('radio', { name: 'Có', exact: true }).check()
  check('4 condition shows 5a', (await card(page, 'Câu 5a').count()) === 1)
  await shot(page, 'p4-preview-block', page.locator('body'))
  await next(page).click()
  await card(page, 'Câu 9').waitFor()
  check('4 block page 2 reminder', /Sự kiện 2/.test(await banner(page).innerText()))
  await next(page).click()
  await page.getByRole('button', { name: 'Gửi (xem trước)' }).click()
  await page.getByText('Câu trả lời hợp lệ').first().waitFor({ timeout: 5000 })
  check('4 preview never calls assign/submit', !requests.some((u) => /\/forms\/public\//.test(u)), requests.filter((u) => /public/.test(u)).join(' '))
  await page.context().close()

  // 5. Preview of a "different" block with 2 rounds.
  step = '5'
  page = await newPage()
  await page.goto(`${APP}/forms/${rounds.id}/preview`)
  await card(page, 'Mở đầu').waitFor()
  const round1 = page.getByLabel('Phiên bản lượt 1 của Khối khác nhau')
  const round2 = page.getByLabel('Phiên bản lượt 2 của Khối khác nhau')
  check('5 two pickers with defaults', (await round1.inputValue()) === 'a' && (await round2.inputValue()) === 'b')
  await round2.selectOption('a')
  check('5 picking a used variant swaps rounds', (await round1.inputValue()) === 'b' && (await round2.inputValue()) === 'a')
  await next(page).click()
  await banner(page).waitFor()
  const firstRound = await page.locator('form').innerText()
  check('5 round 1 = Bản B without own question', /Bản B/.test(firstRound) && !/Câu riêng A/.test(firstRound))
  await next(page).click()
  await card(page, 'Câu riêng A').waitFor({ timeout: 5000 })
  check('5 round 2 = Bản A with own question', /Bản A/.test(await banner(page).innerText()))
  await page.context().close()

  // 6. Response detail.
  step = '6'
  page = await newPage()
  await page.goto(`${APP}/forms/${survey.id}/responses/${r1.responseId}`)
  await page.locator('[data-assigned-variants]').waitFor()
  check('6 assigned variant in info', /PHẦN II: Sự kiện 2/.test(await page.locator('[data-assigned-variants]').innerText()))
  check('6 identity methods', /Căn cứ nhận diện\s*Email/.test(await page.locator('.card').first().innerText()))
  const ans = async (label) => (await page.locator('[data-answer-key]', { hasText: label }).first().locator('[data-answer]').innerText()).trim()
  check('6 other text shown', /Khác \(ghi rõ\): Ghi rõ 1/.test(await ans('Câu 3 nhớ gì')))
  check('6 hidden question marked', (await ans('Câu 5a')) === '(không hiển thị)')
  check('6 hash-only marked', /đã ẩn/.test(await ans('Email')))
  check('6 phone stored normalized', (await ans('Điện thoại')) === '0912345678')
  check('6 page heading shows variant', (await page.locator('[data-variant-title]').first().innerText()) === 'Sự kiện 2')
  await shot(page, 'p4-response-detail')

  // 7. Summary tab: variant table, filter through the UI, other texts, hidden note; list column.
  step = '7'
  await page.goto(`${APP}/forms/${survey.id}/responses`)
  const statsCard = page.locator(`[data-variant-stats="${K.H}"]`)
  await statsCard.waitFor()
  check('7 variant table rows', /Sự kiện 1\s*1\s*1/.test(await statsCard.innerText()) && /Sự kiện 2\s*2\s*1/.test(await statsCard.innerText()), await statsCard.innerText())
  const filterReq = page.waitForResponse((r) => r.url().includes('/responses/summary') && decodeURIComponent(r.url()).includes(`variants[${K.H}]=v2`))
  await page.getByLabel('Lọc theo phiên bản của PHẦN II').selectOption('v2')
  await filterReq
  const q3Box = page.locator(`[data-question-id="${id('q3')}"]`)
  await q3Box.locator('[data-group-tag]', { hasText: 'đang lọc: Sự kiện 2' }).waitFor({ timeout: 5000 })
  check('7 filtered box shows 1 answer', /1 câu trả lời/.test(await q3Box.innerText()))
  await q3Box.locator('[data-other-values] summary').click()
  check('7 other texts listed', /Ghi rõ 1/.test(await q3Box.locator('[data-other-values]').innerText()))
  check('7 hash-only note', (await page.locator(`[data-question-id="${id('em')}"] [data-hidden-note]`).count()) === 1)
  await shot(page, 'p4-summary')
  await page.getByRole('button', { name: 'Cá nhân' }).click()
  const list = page.locator('table', { hasText: 'Thời gian gửi' })
  await list.waitFor()
  const table = await list.innerText()
  check('7 list shows variant column', /Phiên bản/i.test(table) && /Sự kiện 2/.test(table) && /Sự kiện 1/.test(table), table.slice(0, 300))
  await page.context().close()

  // 8. Duplicate keeps a working structure with new keys.
  step = '8'
  const dup = await call('POST', `/forms/${survey.id}/duplicate`)
  const copyId = dup.data.form?.id
  if (copyId) created.push(copyId)
  const copy = (await call('GET', `/forms/${copyId}`)).data
  const byLabel = Object.fromEntries(copy.fields.map((f) => [f.label, f]))
  const oldKeys = new Set(Object.values(K))
  check('8 duplicate has new keys', copy.fields.every((f) => !oldKeys.has(f.key)))
  check('8 duplicate references remapped',
    byLabel['PHẦN II'].settings.filter.field_key === byLabel['Câu 2 lưới'].key &&
    byLabel['Câu 3 nhớ gì'].random_group_key === byLabel['PHẦN II'].key &&
    byLabel['Câu 5a cụ thể'].conditional_logic.rules[0].field_key === byLabel['Câu 5 liên hệ'].key &&
    copy.respondent_limit.field_keys.email === byLabel['Email'].key)
  page = await newPage()
  await page.goto(`${APP}/forms/${copyId}/preview`)
  await card(page, 'Email').locator('input').fill('c@x.vn')
  await next(page).click()
  await banner(page).waitFor()
  check('8 duplicate previews its block', /Sự kiện 1/.test(await banner(page).innerText()))
  await page.context().close()
} catch (e) {
  check(`crashed at step ${step}`, false, e.message.split('\n')[0])
} finally {
  await browser.close()
  if (!KEEP) for (const formId of created) await call('DELETE', `/forms/${formId}`)
  execFileSync(PHP, [join(ROOT, 'mint-token.php'), '1', '--revoke'])
}

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
const failed = results.filter((r) => !r.ok)
for (const r of failed) console.log(`FAIL ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
console.log(`${results.length - failed.length}/${results.length} checks passed${KEEP ? ` (kept forms ${created.join(', ')})` : ''}`)
process.exit(failed.length ? 1 : 0)
