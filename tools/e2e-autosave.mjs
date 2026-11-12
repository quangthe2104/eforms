// Headless check of autosave, save indicator, undo/redo and the destructive-change banner (plan phase 4).
// Run: node tools/e2e-autosave.mjs [--keep]
// Needs: frontend dev server on http://eforms.test:5173, backend on http://eforms.test, local Chrome.
// Prints failures only + a one-line total; details go to tools/out/e2e-autosave.json.
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PHP = 'D:\\wamp64\\bin\\php\\php8.3.14\\php.exe'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const APP = 'http://eforms.test:5173'
const API = 'http://eforms.test/api'
const KEEP = process.argv.includes('--keep')
const OUT = join(ROOT, 'out')
mkdirSync(OUT, { recursive: true })

const results = []
let step = 'start'
const check = (name, ok, detail = '') => results.push({ step, name, ok: !!ok, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) })

const php = (...args) => JSON.parse(execFileSync(PHP, args.map(String)).toString())
const owner = php(join(ROOT, 'mint-token.php'), 1)

const api = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${owner.token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, data: text } }
}
const makeForm = async (title, fields) => {
  const form = (await api('POST', '/forms', { title })).data.form
  await api('POST', `/forms/${form.id}/fields/bulk-update`, { fields: fields.map((f, order) => ({ is_required: false, ...f, order })) })
  return form
}
const serverForm = async (id) => (await api('GET', `/forms/${id}`)).data
const serverFields = async (id) => (await serverForm(id)).fields.sort((a, b) => a.order - b.order)

const formA = await makeForm('E2E autosave', [
  { type: 'short_text', label: 'Họ tên' },
  { type: 'radio', label: 'Chọn một', options: ['A', 'B'] },
  { type: 'short_text', label: 'Ghi chú' },
])
const formB = await makeForm('E2E autosave có câu trả lời', [
  { type: 'radio', label: 'Màu', options: ['Đỏ', 'Xanh'] },
  { type: 'short_text', label: 'Nhận xét' },
])
const seeded = php(join(ROOT, 'add-response.php'), formB.id, 2)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
const pageErrors = []
const requests = []
page.on('pageerror', (e) => pageErrors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && pageErrors.push(m.text()))
page.on('response', (r) => r.status() >= 400 && pageErrors.push(`${r.status()} ${r.request().method()} ${r.url()}`))
page.on('request', (r) => r.url().startsWith(API) && r.method() !== 'GET' && requests.push({ method: r.method(), url: r.url(), at: Date.now(), headers: r.headers(), body: r.postData() }))
page.on('dialog', (d) => d.accept())

const card = (label) => page.locator('.eforms-question', { hasText: label }).first()
const indicator = () => page.locator('[data-hdr=save-indicator]')
const indicatorState = () => indicator().getAttribute('data-state')
const opsResponse = (formId, timeout = 8000) => {
  const p = page.waitForResponse((r) => r.url().endsWith(`/forms/${formId}/ops`) && r.request().method() === 'POST', { timeout })
  p.catch(() => {})
  return p
}
const waitSaved = async (timeout = 8000) => {
  await page.locator('[data-hdr=save-indicator][data-state=saved]').waitFor({ timeout }).catch(() => {})
  return indicatorState()
}
const tooltipOf = async (locator) => {
  await page.mouse.move(0, 0)
  await locator.hover()
  const tip = page.locator('[role=tooltip]')
  await tip.first().waitFor({ timeout: 2000 }).catch(() => {})
  const text = (await tip.count()) ? await tip.first().textContent() : null
  await page.mouse.move(0, 0)
  return text
}
/** Selects a question card (a click on the card body may land on an inner control). */
const activate = async (label) => {
  const c = card(label)
  if (!((await c.getAttribute('class')) || '').includes('active')) await c.locator('div.eforms-question-input').click()
  return c
}
/** Opens the label input of a question card and replaces its text. */
const editLabel = async (label, text, { replace = true } = {}) => {
  const c = await activate(label)
  await c.locator('div.eforms-question-input').click()
  const input = page.locator('input.eforms-question-input')
  await input.waitFor()
  if (replace) await input.fill(text)
  else {
    await input.press('End')
    await input.type(text)
  }
  return input
}
const blurAll = () => page.evaluate(() => document.activeElement?.blur())
const clickBlank = () => page.mouse.click(30, 600)
const goto = async (path, waitFor) => {
  await page.goto(APP + path)
  await page.locator(waitFor).first().waitFor({ timeout: 15000 })
}

try {
  step = 'setup'
  check('response seeded', seeded.count === 2, seeded)
  await page.goto(APP + '/login')
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, owner)

  // 1. Edit a question: pending/saving → saved, persisted after reload, no Save button, no bulk-update.
  step = '1 edit'
  await goto(`/forms/${formA.id}/edit`, '.eforms-question')
  check('no Save button', (await page.locator('[data-hdr=save]').count()) === 0)
  check('undo disabled initially', await page.locator('[data-hdr=undo]').isDisabled())
  const firstOps = opsResponse(formA.id)
  await editLabel('Họ tên', 'Họ và tên')
  const typedAt = Date.now()
  const s1 = await indicatorState()
  check('indicator shows saving while pending', s1 === 'pending' || s1 === 'saving', s1)
  check('pending text is "Đang lưu…"', (await indicator().getAttribute('aria-label')) === 'Đang lưu…')
  const r1 = await firstOps
  const opsReq = requests.find((r) => r.url.endsWith(`/forms/${formA.id}/ops`))
  check('ops sent after ~1.5 s debounce', opsReq && opsReq.at - typedAt >= 1100, opsReq ? opsReq.at - typedAt : 'none')
  const body1 = JSON.parse(r1.request().postData() || '{}')
  check('ops body: one field.update of label', body1.ops?.length === 1 && body1.ops[0].type === 'field.update' && Object.keys(body1.ops[0].set).join() === 'label', body1.ops)
  check('client_id in body and X-Client-Id header', !!body1.client_id && opsReq?.headers['x-client-id'] === body1.client_id)
  check('ops response 200', r1.status() === 200)
  check('indicator saved', (await waitSaved()) === 'saved')
  const savedLabel = await indicator().getAttribute('aria-label')
  check('saved text "Đã lưu lúc HH:mm"', /^Đã lưu lúc \d{2}:\d{2}$/.test(savedLabel || ''), savedLabel)
  const savedTip = await tooltipOf(indicator())
  check('saved tooltip has full date', /^Đã lưu lúc \d{2}:\d{2}:\d{2} \d{2}\/\d{2}\/\d{4}$/.test(savedTip || ''), savedTip)
  check('no bulk-update from editor', !requests.some((r) => r.url.includes('bulk-update')))
  check('label on server', (await serverFields(formA.id))[0].label === 'Họ và tên')
  await page.reload()
  await card('Họ và tên').waitFor({ timeout: 10000 }).catch(() => {})
  check('label persisted after reload', (await card('Họ và tên').count()) === 1)

  // 2. Undo/redo with the header buttons (+ tooltips).
  step = '2 undo buttons'
  check('history empty after reload', await page.locator('[data-hdr=undo]').isDisabled())
  await activate('Ghi chú')
  let saveP = opsResponse(formA.id)
  await card('Ghi chú').locator('button[title="Xóa"]').click()
  check('question deleted', (await card('Ghi chú').count()) === 0)
  check('undo tooltip names the step', (await tooltipOf(page.locator('[data-hdr=undo]'))) === "Hoàn tác: Xóa câu hỏi 'Ghi chú'")
  check('redo disabled', await page.locator('[data-hdr=redo]').isDisabled())
  await saveP
  await waitSaved()
  check('delete saved', !(await serverFields(formA.id)).some((f) => f.label === 'Ghi chú'))
  saveP = opsResponse(formA.id)
  await page.locator('[data-hdr=undo]').click()
  check('undo restores question', (await card('Ghi chú').count()) === 1)
  check('redo tooltip names the step', (await tooltipOf(page.locator('[data-hdr=redo]'))) === "Làm lại: Xóa câu hỏi 'Ghi chú'")
  await saveP
  await waitSaved()
  let fields = await serverFields(formA.id)
  check('undo saved (question back, last)', fields.map((f) => f.label).join('|') === 'Họ và tên|Chọn một|Ghi chú', fields.map((f) => f.label))
  saveP = opsResponse(formA.id)
  await page.locator('[data-hdr=redo]').click()
  check('redo deletes again', (await card('Ghi chú').count()) === 0)
  await saveP
  await waitSaved()
  check('redo saved', !(await serverFields(formA.id)).some((f) => f.label === 'Ghi chú'))

  // 3. Shortcuts outside inputs; inside an input the app must not undo/redo.
  step = '3 shortcuts'
  await clickBlank()
  await blurAll()
  await page.keyboard.press('Control+z')
  check('Ctrl+Z undoes', (await card('Ghi chú').count()) === 1)
  await page.keyboard.press('Control+Shift+z')
  check('Ctrl+Shift+Z redoes', (await card('Ghi chú').count()) === 0)
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+y')
  check('Ctrl+Y redoes', (await card('Ghi chú').count()) === 0)
  await page.keyboard.press('Control+z')
  check('Ctrl+Z again restores', (await card('Ghi chú').count()) === 1)
  // Now undo stack is empty and redo holds the delete; inside an input neither shortcut may reach the app.
  const c1 = await activate('Chọn một')
  await c1.locator('div.eforms-question-input').click()
  const labelInput = page.locator('input.eforms-question-input')
  await labelInput.waitFor()
  await labelInput.press('Control+y')
  check('Ctrl+Y in input does not redo', (await card('Ghi chú').count()) === 1)
  await labelInput.press('Control+Shift+z')
  check('Ctrl+Shift+Z in input does not redo', (await card('Ghi chú').count()) === 1)
  check('redo button still enabled', !(await page.locator('[data-hdr=redo]').isDisabled()))
  await blurAll()
  const g = await activate('Ghi chú')
  await g.locator('label', { hasText: 'Bắt buộc' }).click()
  const requiredTip = await tooltipOf(page.locator('[data-hdr=undo]'))
  check('required toggle is an undo step', requiredTip === "Hoàn tác: Sửa câu hỏi 'Ghi chú'", requiredTip)
  const c2 = await activate('Chọn một')
  await c2.locator('div.eforms-question-input').click()
  await page.locator('input.eforms-question-input').press('Control+z')
  check('Ctrl+Z in input does not undo', (await page.locator('[data-hdr=redo]').isDisabled()) && (await tooltipOf(page.locator('[data-hdr=undo]'))) === requiredTip)
  await blurAll()
  await page.waitForTimeout(1800)
  await waitSaved()
  check('restored question saved', (await serverFields(formA.id)).some((f) => f.label === 'Ghi chú'))

  // Typing coalesces into one step: undo reverts the whole word.
  step = '3b coalesce'
  await editLabel('Ghi chú', ' thêm', { replace: false })
  await blurAll()
  check('typing = one undo step', (await tooltipOf(page.locator('[data-hdr=undo]'))) === "Hoàn tác: Sửa câu hỏi 'Ghi chú thêm'")
  await page.locator('[data-hdr=undo]').click()
  check('undo reverts whole typed word', (await card('Ghi chú thêm').count()) === 0 && (await card('Ghi chú').count()) === 1)
  await page.waitForTimeout(1800)
  await waitSaved()
  check('label back on server', (await serverFields(formA.id)).some((f) => f.label === 'Ghi chú'))

  // 4. Theme autosaves (no localStorage preview), undo covers it.
  step = '4 theme'
  saveP = opsResponse(formA.id)
  await page.locator('[data-hdr=theme]').click()
  await page.locator('button[title="Teal"]').click()
  const themeRes = await saveP
  const themeBody = JSON.parse(themeRes.request().postData() || '{}')
  check('theme sent as form.update', themeBody.ops?.some((o) => o.type === 'form.update' && o.set.primary_color === '#009688'), themeBody.ops)
  const themed = await serverForm(formA.id)
  check('theme on server', themed.primary_color === '#009688' && themed.background_color !== '#f9fafb', [themed.primary_color, themed.background_color])
  check('no previewTheme in localStorage', await page.evaluate(() => !Object.keys(localStorage).some((k) => k.startsWith('previewTheme_'))))
  check('undo tooltip theme', (await tooltipOf(page.locator('[data-hdr=undo]'))) === 'Hoàn tác: Đổi giao diện')
  await page.keyboard.press('Escape')
  await page.reload()
  await page.locator('.eforms-question').first().waitFor()
  const primary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--theme-primary').trim())
  check('theme persisted after reload', primary.toLowerCase() === '#009688', primary)

  // 5. Settings tab: toggles save at once, text after the debounce; not in undo history.
  step = '5 settings'
  await page.locator('[data-tab=settings]').click()
  await page.locator('[data-settings-tab]').waitFor()
  const undoBefore = await page.locator('[data-hdr=undo]').isDisabled()
  saveP = opsResponse(formA.id, 4000)
  const toggledAt = Date.now()
  await page.locator('label', { hasText: 'Hiển Thị Thanh Tiến Trình' }).locator('input').check()
  const toggleRes = await saveP
  check('toggle saved immediately', toggleRes && Date.now() - toggledAt < 1500, Date.now() - toggledAt)
  check('toggle on server', (await serverForm(formA.id)).show_progress_bar === true)
  check('settings not in undo history', (await page.locator('[data-hdr=undo]').isDisabled()) === undoBefore)
  saveP = opsResponse(formA.id)
  await page.locator('textarea[placeholder="Cảm ơn bạn đã gửi phản hồi!"]').fill('Cảm ơn nhiều!')
  const textRes = await saveP
  const textBody = JSON.parse(textRes?.request().postData() || '{}')
  check('thank-you text saved', textBody.ops?.[0]?.set?.custom_thank_you_message === 'Cảm ơn nhiều!', textBody.ops)
  check('no Lưu Cài Đặt button', (await page.getByRole('button', { name: 'Lưu Cài Đặt' }).count()) === 0)
  await page.reload()
  await page.locator('[data-settings-tab]').waitFor()
  check('toggle persisted after reload', await page.locator('label', { hasText: 'Hiển Thị Thanh Tiến Trình' }).locator('input').isChecked())

  // 6. Pagehide flush: edit then reload / navigate away before the debounce.
  step = '6 pagehide'
  await goto(`/forms/${formA.id}/edit`, '.eforms-question')
  await editLabel('Chọn một', 'Chọn một nhanh')
  await page.reload()
  await page.locator('.eforms-question').first().waitFor()
  await page.waitForTimeout(500)
  let label2 = (await serverFields(formA.id))[1]?.label
  if (label2 !== 'Chọn một nhanh') {
    await page.reload()
    await page.locator('.eforms-question').first().waitFor()
  }
  check('edit + immediate reload persisted', (await card('Chọn một nhanh').count()) === 1, label2)
  await editLabel('Chọn một nhanh', 'Chọn một rời trang')
  await page.goto('about:blank')
  await new Promise((r) => setTimeout(r, 1000))
  label2 = (await serverFields(formA.id))[1]?.label
  check('edit + navigate away persisted', label2 === 'Chọn một rời trang', label2)

  // 7. Rejected op: message, the question gets selected, op kept until retry.
  step = '7 rejected'
  await goto(`/forms/${formA.id}/edit`, '.eforms-question')
  const keyA = (await serverFields(formA.id))[0].key
  let rejectedOnce = false
  await page.route(`**/api/forms/${formA.id}/ops`, async (route) => {
    if (rejectedOnce) return route.continue()
    rejectedOnce = true
    const sent = JSON.parse(route.request().postData() || '{}')
    const index = Math.max(0, (sent.ops || []).findIndex((o) => o.key === keyA))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ revision: 0, applied: [], rejected: [{ index, type: 'field.update', key: keyA, reason: 'invalid', message: 'Dữ liệu không hợp lệ', errors: { 'set.label': ['Nhãn quá dài (E2E).'] } }] }),
    })
  })
  saveP = opsResponse(formA.id)
  await editLabel('Họ và tên', 'Họ và tên lỗi')
  await activate('Ghi chú')
  await saveP
  await page.locator('[data-hdr=save-indicator][data-state=error]').waitFor({ timeout: 3000 }).catch(() => {})
  check('indicator error after rejection', (await indicatorState()) === 'error')
  check('indicator text "Không lưu được – Thử lại"', ((await indicator().getAttribute('aria-label')) || '').startsWith('Không lưu được – Thử lại'))
  const toastText = await page.locator('[role=status]').allTextContents()
  check('rejection message shown', toastText.some((t) => t.includes('Nhãn quá dài (E2E).') && t.includes('Họ và tên lỗi')), toastText)
  check('offending question selected', ((await card('Họ và tên lỗi').getAttribute('class')) || '').includes('active'))
  await page.waitForTimeout(2000)
  check('rejected op not resent automatically', requests.filter((r) => r.url.endsWith(`/forms/${formA.id}/ops`) && r.body?.includes('Họ và tên lỗi')).length === 1)
  saveP = opsResponse(formA.id)
  await indicator().click()
  await saveP
  check('retry saves', (await waitSaved()) === 'saved' && (await serverFields(formA.id))[0].label === 'Họ và tên lỗi')
  await page.unroute(`**/api/forms/${formA.id}/ops`)

  // 8. Destructive change on a form with responses: banner, other edits still save, [Hoàn tác], [Vẫn lưu].
  step = '8 destructive'
  await goto(`/forms/${formB.id}/edit`, '.eforms-question')
  const removeXanh = async () => {
    const c = await activate('Màu')
    await c.locator('.eforms-option', { hasText: /^\s*Xanh\s*×?\s*$/ }).locator('.eforms-option-remove').click()
  }
  await removeXanh()
  const banner = page.locator('[data-destructive-banner]')
  await banner.waitFor({ timeout: 3000 }).catch(() => {})
  const bannerText = (await banner.count()) ? await banner.innerText() : ''
  check('banner shown with count', bannerText.includes('Thay đổi này ảnh hưởng tới 2 câu trả lời đã thu') && bannerText.includes('Xanh'), bannerText)
  saveP = opsResponse(formB.id)
  await editLabel('Nhận xét', 'Nhận xét mới')
  const nonDestructive = await saveP
  const ndBody = JSON.parse(nonDestructive?.request().postData() || '{}')
  check('non-destructive edit still sent', ndBody.ops?.some((o) => o.set?.label === 'Nhận xét mới') && !ndBody.ops.some((o) => 'options' in (o.set || {})), ndBody.ops)
  await page.waitForTimeout(400)
  let fb = await serverFields(formB.id)
  check('server: label saved, options untouched', fb[1].label === 'Nhận xét mới' && fb[0].options.join() === 'Đỏ,Xanh', fb.map((f) => [f.label, f.options]))
  check('indicator paused', (await indicatorState()) === 'paused')
  check('paused text', (await indicator().getAttribute('aria-label')) === 'Có thay đổi chưa lưu')
  await banner.locator('[data-banner=revert]').click()
  check('[Hoàn tác] hides banner', (await banner.count()) === 0)
  check('[Hoàn tác] restores option', (await card('Màu').innerText()).includes('Xanh'))
  await page.waitForTimeout(1800)
  fb = await serverFields(formB.id)
  check('server options still intact', fb[0].options.join() === 'Đỏ,Xanh', fb[0].options)
  await removeXanh()
  await banner.waitFor({ timeout: 3000 }).catch(() => {})
  saveP = opsResponse(formB.id)
  await banner.locator('[data-banner=approve]').click()
  await saveP
  await waitSaved()
  fb = await serverFields(formB.id)
  check('[Vẫn lưu] saves the destructive change', fb[0].options.join() === 'Đỏ', fb[0].options)
  check('banner gone after save', (await banner.count()) === 0)
} catch (e) {
  check('script ran to completion', false, `step ${step}: ${e.message.split('\n')[0]}`)
  await page.screenshot({ path: join(OUT, 'e2e-autosave-failure.png') }).catch(() => {})
} finally {
  step = 'end'
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '))
  await context.close().catch(() => {})
  await browser.close()
  if (!KEEP) {
    await api('DELETE', `/forms/${formA.id}`)
    await api('DELETE', `/forms/${formB.id}`)
  }
  execFileSync(PHP, [join(ROOT, 'mint-token.php'), '1', '--revoke'])
}

writeFileSync(join(OUT, 'e2e-autosave.json'), JSON.stringify({ forms: [formA.id, formB.id], results, pageErrors }, null, 2))
const failed = results.filter((r) => !r.ok)
for (const r of failed) console.log(`FAIL [${r.step}] ${r.name}${r.detail ? `  — ${r.detail.slice(0, 300)}` : ''}`)
console.log(`${results.length - failed.length}/${results.length} checks passed${KEEP ? ` (forms ${formA.id}, ${formB.id} kept)` : ''}`)
process.exit(failed.length ? 1 : 0)
