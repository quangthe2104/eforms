// Headless end-to-end check of the 12.11.26 survey (phase 5). Run: node tools/e2e-survey.mjs [--keep] [--shots]
// Imports a fresh copy with `artisan survey:import-1211`, publishes it, fills it in the browser
// (4 pages, conditions, limits, reload, duplicate email), then checks the stored data, summary,
// Excel export, preview and builder. Needs the frontend dev server, backend and local Chrome.
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const BACKEND = join(ROOT, '..', 'backend')
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
const call = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, data: text } }
}
const sql = (query) => execFileSync(PHP, [join(ROOT, 'db-peek.php'), query, '200']).toString().trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l))

// ---------- Fixture: a fresh import of the survey ----------
const imported = JSON.parse(execFileSync(PHP, ['artisan', 'survey:import-1211', '--json', '--user=1', '--title=E2E survey 1211'], { cwd: BACKEND }).toString())
const K = imported.keys
const pub = await call('PUT', `/forms/${imported.id}`, { status: 'published', is_public: true, accept_responses: true })
if (pub.status >= 300) throw new Error(`publish ${pub.status}`)
const full = (await call('GET', `/forms/${imported.id}`)).data
const ids = Object.fromEntries(full.fields.map((f) => [f.key, f.id]))
const field = (code) => full.fields.find((f) => f.key === K[code])
const slug = imported.slug

const UNHEARD = 'Chưa từng nghe nói'
const BLOCK_TITLE = field('block').label
const EVENT4 = 'Chiến thắng Điện Biên Phủ (07/05/1954)'
const LIMIT_MSG = 'Ông/Bà đã tham gia khảo sát này. Xin cảm ơn!'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const pageErrors = []
const newPage = async (login = false) => {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => pageErrors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && pageErrors.push(m.text()))
  page.on('response', (r) => r.status() >= 500 && pageErrors.push(`${r.status()} ${r.url()}`))
  page.on('dialog', (d) => d.accept())
  if (login) {
    await page.goto(APP + '/login')
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    }, { token, user })
  }
  return page
}
const shot = async (page, name) => SHOTS && page.screenshot({ path: join(OUT, `survey-${name}.png`), fullPage: true })

const card = (page, label) => page.locator('[data-answer-key]', { hasText: label }).first()
const box = (page, label, option) => card(page, label).getByRole('checkbox', { name: option, exact: true })
const radio = (page, label, option) => card(page, label).getByRole('radio', { name: option, exact: true })
const otherText = (page, label) => card(page, label).getByLabel('Nội dung phương án khác')
const next = (page) => page.getByRole('button', { name: 'Tiếp theo' })
const submit = (page) => page.getByRole('button', { name: 'Gửi', exact: true })
const banner = (page) => page.locator('.eforms-block-banner')
const visible = async (page, label) => (await card(page, label).count()) > 0
const errorOf = async (page, label) => (await card(page, label).locator('[role=alert]').textContent().catch(() => null))?.trim()
const progress = async (page) => (await page.locator('form').innerText()).match(/Trang \d+ \/ \d+/)?.[0]
const gridRows = (code) => field(code).rows
const fillGrid = async (page, code, pick) => {
  for (const [i, row] of gridRows(code).entries()) {
    const col = pick(i)
    if (col) await page.getByLabel(`${row}: ${col}`, { exact: true }).check()
  }
}

const emailA = `survey+${Date.now()}@test.vn`
let responseA = null

try {
  // 1. Page 1: intro, email, Câu 1, Câu 2 steering the draw to event 4.
  step = '1'
  let page = await newPage()
  await page.goto(`${APP}/f/${slug}`)
  await card(page, 'Email của Ông/Bà').waitFor()
  const intro = await page.locator('body').innerText()
  check('1 intro mentions email use', /chỉ dùng để tránh trả lời trùng lặp/.test(intro))
  check('1 Câu 1 instructions shown', /Chưa nhớ được/.test(intro) && /PHẦN I\. NHẬN THỨC/.test(intro))
  check('1 progress 1/4', (await progress(page)) === 'Trang 1 / 4', await progress(page))
  check('1 Câu 2 help text', /Xin đánh dấu một phương án cho mỗi sự kiện/.test(await card(page, 'Câu 2.').innerText()))
  await next(page).click()
  check('1 email required', (await errorOf(page, 'Email của Ông/Bà')) === 'Vui lòng trả lời câu hỏi này.')
  await card(page, 'Email của Ông/Bà').locator('input').fill(emailA)
  await card(page, 'Câu 1.').locator('textarea').fill('Cách mạng tháng Tám\nChưa nhớ được')
  await fillGrid(page, 'q2', (i) => (i === 3 ? 'Biết những nội dung cơ bản' : UNHEARD))
  await shot(page, 'p1')
  const assignRes = page.waitForResponse((r) => r.url().includes('/assign') && r.status() !== 419)
  await next(page).click()
  const assigned = await (await assignRes).json()
  check('1 draw honours Câu 2 (only event 4 heard of)', JSON.stringify(assigned.assignments?.[K.block]) === '["v4"]', JSON.stringify(assigned))

  // 2. Page 2 – Phần II.
  step = '2'
  await banner(page).waitFor()
  const bannerText = await banner(page).innerText()
  check('2 banner: part title, intro, event, instruction', bannerText.includes('PHẦN II') && /lựa chọn ngẫu nhiên một sự kiện/.test(bannerText)
    && bannerText.includes(`Sự kiện được lựa chọn là: ${EVENT4}`) && /chỉ tập trung vào sự kiện này/.test(bannerText), bannerText)
  check('2 progress 2/4', (await progress(page)) === 'Trang 2 / 4', await progress(page))
  check('2 Câu 3 help text', /Có thể chọn nhiều phương án/.test(await card(page, 'Câu 3.').innerText()))
  check('2 Câu 4 max hint', /Chọn tối đa 3 phương án/.test(await card(page, 'Câu 4.').innerText()))

  await box(page, 'Câu 3.', 'Bối cảnh và những điều kiện dẫn đến sự kiện').check()
  await box(page, 'Câu 3.', 'Tôi không nhớ hoặc chưa có đủ thông tin về sự kiện này').check()
  check('2 Câu 3 exclusive clears others', !(await box(page, 'Câu 3.', 'Bối cảnh và những điều kiện dẫn đến sự kiện').isChecked()))
  await box(page, 'Câu 3.', 'Những diễn biến chính của sự kiện').check()
  check('2 Câu 3 other option clears exclusive', !(await box(page, 'Câu 3.', 'Tôi không nhớ hoặc chưa có đủ thông tin về sự kiện này').isChecked()))
  await box(page, 'Câu 3.', 'Nội dung khác (xin ghi rõ)').check()
  await card(page, 'Nếu được, xin Ông/Bà viết').locator('textarea').fill('Trận đánh 56 ngày đêm')

  for (const o of ['Học tập tại nhà trường, sách giáo khoa và tài liệu giáo dục', 'Mạng xã hội và các nền tảng thông tin trực tuyến', 'Tham quan bảo tàng, di tích và địa điểm lịch sử']) {
    await box(page, 'Câu 4.', o).check()
  }
  check('2 Câu 4 max 3 locks a 4th option', await box(page, 'Câu 4.', 'Gia đình, cha mẹ, ông bà và người thân kể lại').isDisabled())

  await radio(page, 'Câu 5.', 'Ít cảm nhận được mối liên hệ với bản thân hoặc cộng đồng của mình').check()
  check('2 5a hidden for option 5', !(await visible(page, '5a. Nếu có mối liên hệ')))
  await radio(page, 'Câu 5.', 'Rất gần gũi, có mối liên hệ trực tiếp').check()
  check('2 5a shown for option 1', await visible(page, '5a. Nếu có mối liên hệ'))
  await box(page, '5a. Nếu có mối liên hệ', 'Sự kiện gắn với bản sắc và lịch sử dân tộc').check()

  await box(page, 'Câu 6.', 'Để hiểu biết về lịch sử hình thành và phát triển của đất nước').check()
  check('2 6a hidden with one reason', !(await visible(page, '6a. Trong những lý do trên')))
  await box(page, 'Câu 6.', 'Để truyền lại kiến thức, câu chuyện và ký ức lịch sử cho các thế hệ sau').check()
  check('2 6a lists the 2 picked reasons', (await card(page, '6a. Trong những lý do trên').getByRole('radio').count()) === 2)
  await radio(page, '6a. Trong những lý do trên', 'Để truyền lại kiến thức, câu chuyện và ký ức lịch sử cho các thế hệ sau').check()

  await box(page, 'Câu 7.', 'Giúp xã hội không quên những sự kiện quan trọng trong quá khứ').check()
  await radio(page, '7a. Ông/Bà đánh giá', 'Rất có ý nghĩa').check()
  await box(page, 'Câu 8.', 'Tự hào').check()
  await box(page, 'Câu 8.', 'Biết ơn').check()
  await radio(page, '8a. Việc tiếp xúc', 'Khác').check()

  await next(page).click()
  check('2 Câu 3 "other" text required', (await errorOf(page, 'Câu 3.')) === 'Vui lòng ghi rõ nội dung phương án "Khác".')
  check('2 8a "other" text required', (await errorOf(page, '8a. Việc tiếp xúc')) === 'Vui lòng ghi rõ nội dung phương án "Khác".')
  await otherText(page, 'Câu 3.').fill('Tướng Võ Nguyên Giáp')
  await otherText(page, '8a. Việc tiếp xúc').fill('Thêm tự hào')
  await shot(page, 'p2')

  await page.reload()
  await banner(page).waitFor()
  check('2 reload keeps event', (await banner(page).innerText()).includes(EVENT4))
  check('2 reload keeps answers', (await radio(page, '6a. Trong những lý do trên', 'Để truyền lại kiến thức, câu chuyện và ký ức lịch sử cho các thế hệ sau').isChecked())
    && (await otherText(page, 'Câu 3.').inputValue()) === 'Tướng Võ Nguyên Giáp')
  await next(page).click()

  // 3. Page 3 – Phần III (same event).
  step = '3'
  await card(page, 'Câu 9.').waitFor()
  const reminder = await banner(page).innerText()
  check('3 reminder repeats event without intro', reminder.includes(EVENT4) && !/lựa chọn ngẫu nhiên/.test(reminder), reminder)
  check('3 PHẦN III heading', /PHẦN III\. TIẾP NHẬN/.test(await page.locator('form').innerText()))
  check('3 progress 3/4', (await progress(page)) === 'Trang 3 / 4', await progress(page))
  await box(page, 'Câu 9.', 'Phim tài liệu, chương trình truyền hình và các sản phẩm nghệ thuật').check()
  await box(page, 'Câu 10.', 'Đọc báo, xem tin hoặc theo dõi nội dung truyền thông về sự kiện').check()
  check('3 10a hidden after an activity', !(await visible(page, '10a. Nếu chưa tham gia')))
  await box(page, 'Câu 10.', 'Không nhớ rõ').check()
  check('3 Câu 10 exclusive clears activity', !(await box(page, 'Câu 10.', 'Đọc báo, xem tin hoặc theo dõi nội dung truyền thông về sự kiện').isChecked()))
  check('3 10a shown for "Không nhớ rõ"', await visible(page, '10a. Nếu chưa tham gia'))
  await box(page, '10a. Nếu chưa tham gia', 'Không có thời gian hoặc điều kiện tham gia').check()
  await box(page, '10a. Nếu chưa tham gia', 'Địa điểm tổ chức không thuận tiện').check()
  check('3 10a max 2', await box(page, '10a. Nếu chưa tham gia', 'Không có đủ thông tin về hoạt động kỷ niệm').isDisabled())
  await next(page).click()

  // 4. Page 4 – Phần IV and submit.
  step = '4'
  await card(page, 'A1. Giới tính').waitFor()
  check('4 no banner outside block', (await banner(page).count()) === 0)
  check('4 progress 4/4', (await progress(page)) === 'Trang 4 / 4', await progress(page))
  await radio(page, 'A1. Giới tính', 'Nữ').check()
  await card(page, 'A2. Tuổi').locator('input').fill('17')
  await radio(page, 'A3. Nơi ở', 'Đô thị').check()
  await radio(page, 'A3a. Khu vực', 'Miền Trung').check()
  await radio(page, 'A4. Nghề nghiệp', 'Khác (ghi rõ)').check()
  await otherText(page, 'A4. Nghề nghiệp').fill('Nghiên cứu viên')
  await fillGrid(page, 'a5', (i) => (i < 16 ? ['Nghe nhiều', 'Vài lần', 'Chưa'][i % 3] : null))
  await box(page, 'A6. Ông/Bà biết đến', 'Mạng xã hội (Facebook, TikTok, YouTube...)').check()
  await box(page, 'A7. Ba vấn đề', 'Tên đường phố bị trùng, sai').check()
  await box(page, 'A7. Ba vấn đề', 'Phát huy giá trị của các khu di tích').check()
  await radio(page, 'A8. Ông/Bà có thường xuyên', 'Thỉnh thoảng').check()
  await submit(page).click()
  check('4 age range 18–99', (await errorOf(page, 'A2. Tuổi')) === 'Vui lòng nhập số từ 18 đến 99.')
  check('4 A5 needs every row', (await errorOf(page, 'A5. Ông/Bà đã từng')) === 'Vui lòng trả lời tất cả các dòng.')
  check('4 A7 needs exactly 3', (await errorOf(page, 'A7. Ba vấn đề')) === 'Vui lòng chọn ít nhất 3 phương án.')
  await card(page, 'A2. Tuổi').locator('input').fill('45')
  await page.getByLabel(`${gridRows('a5')[16]}: Vài lần`, { exact: true }).check()
  await box(page, 'A7. Ba vấn đề', 'Việc đặt tên cho các công trình công cộng lớn').check()
  check('4 A7 locks a 4th option', await box(page, 'A7. Ba vấn đề', 'Mất tên đường phố, địa danh truyền thống').isDisabled())
  await shot(page, 'p4')
  const subRes = page.waitForResponse((r) => r.url().includes('/submit') && r.status() !== 419)
  await submit(page).click()
  const sub = await subRes
  check('4 submit accepted', sub.status() === 201, `${sub.status()} ${(await sub.text()).slice(0, 300)}`)
  await page.locator('[data-screen="message"]').waitFor()
  check('4 thank-you message', /Xin chân thành cảm ơn Ông\/Bà đã tham gia khảo sát!/.test(await page.locator('[data-screen="message"]').innerText()))
  await page.context().close()

  // 5. Stored data.
  step = '5'
  ;[responseA] = sql(`SELECT id, assignments FROM form_responses WHERE form_id=${imported.id} ORDER BY id DESC LIMIT 1`)
  const rows = sql(`SELECT field_id, variant_key, value FROM response_answers WHERE response_id=${responseA.id}`)
  const ans = (code) => rows.find((r) => String(r.field_id) === String(ids[K[code]]))
  const val = (code) => JSON.parse(ans(code)?.value ?? 'null')
  check('5 assignment stored', JSON.parse(responseA.assignments)?.[K.block]?.[0] === 'v4', responseA.assignments)
  check('5 email stored as typed', val('email') === emailA)
  check('5 block answers tagged v4', ['q3', 'q4', 'q9', 'q10'].every((c) => ans(c)?.variant_key === 'v4'))
  check('5 Câu 3 {selected, other}', val('q3')?.selected?.join('|') === 'Những diễn biến chính của sự kiện|__other__' && val('q3')?.other === 'Tướng Võ Nguyên Giáp', ans('q3')?.value)
  check('5 6a piped answer', val('q6a') === 'Để truyền lại kiến thức, câu chuyện và ký ức lịch sử cho các thế hệ sau')
  check('5 A5 has 17 rows', Object.keys(val('a5') || {}).length === 17)
  check('5 A7 has 3 choices', (val('a7') || []).length === 3)
  check('5 A2 stored', String(val('a2')) === '45')
  check('5 Câu 1 single multi-line answer', val('q1')?.replace(/\r\n/g, '\n') === 'Cách mạng tháng Tám\nChưa nhớ được', ans('q1')?.value)

  // 6. Same email on another device is blocked when leaving page 1.
  step = '6'
  page = await newPage()
  await page.goto(`${APP}/f/${slug}`)
  await card(page, 'Email của Ông/Bà').locator('input').fill(` ${emailA.toUpperCase()} `)
  const idRes = page.waitForResponse((r) => r.url().includes('/check-identity') && r.status() !== 419, { timeout: 8000 })
  await next(page).click()
  check('6 check-identity limit_reached', (await (await idRes).json()).status === 'limit_reached')
  await page.locator('[data-screen="message"]').waitFor({ timeout: 8000 })
  check('6 block message shown', (await page.locator('[data-screen="message"]').innerText()).includes(LIMIT_MSG))
  await page.context().close()

  // 7. Shortest path: heard of nothing, only the required questions.
  step = '7'
  page = await newPage()
  await page.goto(`${APP}/f/${slug}`)
  await card(page, 'Email của Ông/Bà').locator('input').fill(`survey2+${Date.now()}@test.vn`)
  await fillGrid(page, 'q2', () => UNHEARD)
  await next(page).click()
  await banner(page).waitFor()
  check('7 all unheard still draws an event', /Sự kiện được lựa chọn là: \S/.test(await banner(page).innerText()))
  await next(page).click()
  await card(page, 'Câu 9.').waitFor()
  await next(page).click()
  await card(page, 'A1. Giới tính').waitFor()
  await fillGrid(page, 'a5', () => 'Chưa')
  const sub7 = page.waitForResponse((r) => r.url().includes('/submit') && r.status() !== 419)
  await submit(page).click()
  check('7 minimal submit accepted', (await sub7).status() === 201)
  await page.context().close()
  const [r7] = sql(`SELECT id FROM form_responses WHERE form_id=${imported.id} ORDER BY id DESC LIMIT 1`)
  const n7 = sql(`SELECT COUNT(*) n FROM response_answers WHERE response_id=${r7.id} AND field_id IN (${ids[K.q5a]}, ${ids[K.q6a]}, ${ids[K.q10a]})`)[0].n
  check('7 hidden 5a/6a/10a not stored', Number(n7) === 0, String(n7))

  // 8. Summary and Excel.
  step = '8'
  const sum = (await call('GET', `/forms/${imported.id}/responses/summary`)).data
  const v4 = (sum.groups?.[0]?.variants || []).find((v) => v.key === 'v4')
  check('8 summary counts event 4', v4?.submitted >= 1 && (sum.groups[0].variants || []).length === 10, JSON.stringify(sum.groups?.[0]?.variants?.slice(0, 4)))
  const xres = await fetch(`${API}/forms/${imported.id}/export`, { headers: { Authorization: `Bearer ${token}` } })
  const xfile = join(OUT, 'e2e-survey.xlsx')
  writeFileSync(xfile, Buffer.from(await xres.arrayBuffer()))
  const sheet = JSON.parse(execFileSync(PHP, [join(ROOT, 'xlsx-peek.php'), xfile]).toString())
  const head = sheet.rows[0].map((c) => c.v)
  writeFileSync(join(OUT, 'e2e-survey-headings.txt'), head.join('\n'))
  const mustHave = ['Căn cứ nhận diện', field('email').label, `${BLOCK_TITLE} – phiên bản`, `${field('q3').label} – Nội dung khác (xin ghi rõ)`, `${field('a4').label} – Khác (ghi rõ)`,
    ...gridRows('q2').map((r) => `${field('q2').label} – ${r}`), ...gridRows('a5').map((r) => `${field('a5').label} – ${r}`)]
  check('8 export has 69 columns (grid rows split)', head.length === 69, `${head.length} (see out/e2e-survey-headings.txt)`)
  check('8 export key headings', mustHave.every((h) => head.includes(h)), mustHave.filter((h) => !head.includes(h)).join(' | '))
  check('8 no columns for headings', !head.some((h) => /^PHẦN (I|III|IV)\./.test(h)) && head.includes(field('q1').label))
  const rowA = sheet.rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]?.v]))).find((r) => String(r['Mã câu trả lời']) === String(responseA.id))
  check('8 row A: event, email, age, identity', rowA?.[`${BLOCK_TITLE} – phiên bản`] === EVENT4 && rowA?.[field('email').label] === emailA
    && rowA?.[field('a2').label] === 45 && rowA?.['Căn cứ nhận diện'] === 'email', JSON.stringify(rowA)?.slice(0, 300))
  check('8 row A: grid cells', rowA?.[`${field('q2').label} – ${gridRows('q2')[3]}`] === 'Biết những nội dung cơ bản'
    && rowA?.[`${field('a5').label} – ${gridRows('a5')[16]}`] === 'Vài lần')

  // 9. Preview with the variant picker; builder shows and edits help text.
  step = '9'
  page = await newPage(true)
  await page.goto(`${APP}/forms/${imported.id}/preview`)
  await card(page, 'Email của Ông/Bà').waitFor()
  const picker = page.locator('select').first()
  check('9 preview picker lists 10 events', (await picker.locator('option').count()) === 10)
  await picker.selectOption('v9')
  await card(page, 'Email của Ông/Bà').locator('input').fill('preview@test.vn')
  await next(page).click()
  await banner(page).waitFor()
  check('9 preview shows picked event', (await banner(page).innerText()).includes('Hội nghị Văn hóa toàn quốc lần thứ nhất'))
  await page.goto(`${APP}/forms/${imported.id}/edit`)
  const q3Card = page.locator('.eforms-question', { hasText: 'Câu 3. Ông/Bà ghi nhớ' }).first()
  await q3Card.waitFor()
  check('9 builder shows help text', /Có thể chọn nhiều phương án/.test(await q3Card.innerText()))
  await q3Card.click()
  const help = q3Card.getByLabel('Hướng dẫn dưới câu hỏi')
  check('9 builder help text editable', (await help.inputValue()).startsWith('Ngoài tên gọi hoặc ngày kỷ niệm'))
  await shot(page, 'builder')
  await page.context().close()
} catch (e) {
  check(`crashed at step ${step}`, false, e.message.split('\n')[0])
} finally {
  await browser.close()
  if (!KEEP) await call('DELETE', `/forms/${imported.id}`)
  execFileSync(PHP, [join(ROOT, 'mint-token.php'), '1', '--revoke'])
}

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
const failed = results.filter((r) => !r.ok)
for (const r of failed) console.log(`FAIL ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
console.log(`${results.length - failed.length}/${results.length} checks passed${KEEP ? ` (kept form ${imported.id})` : ''}`)
process.exit(failed.length ? 1 : 0)
