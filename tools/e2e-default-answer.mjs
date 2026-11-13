// Default answers: text typed into a question's answer box in the builder is saved (settings.default_value),
// prefilled on the respondent page, editable, not re-filled after the respondent clears it, and stored on submit.
// Run: node tools/e2e-default-answer.mjs [--keep]   (needs the Vite dev server, backend and local Chrome)
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PHP = 'D:\\wamp64\\bin\\php\\php8.3.14\\php.exe'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const APP = 'http://eforms.test:5173'
const API = 'http://eforms.test/api'
const KEEP = process.argv.includes('--keep')
const LIST = '1.\n2.\n3.'

const { token, user } = JSON.parse(execFileSync(PHP, [join(ROOT, 'mint-token.php'), '1']).toString())
const call = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}
const sql = (q) => execFileSync(PHP, [join(ROOT, 'db-peek.php'), q, '50']).toString().trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l))

const results = []
const check = (name, ok, detail = '') => results.push({ check: name, ok: ok ? 'PASS' : 'FAIL', detail: String(detail).slice(0, 70) })

const created = await call('POST', '/forms', { title: 'E2E default answer' })
const form = created.data.form || created.data
for (const [order, f] of [
  { type: 'long_text', label: 'Q dài' },
  { type: 'short_text', label: 'Q ngắn', settings: { default_value: 'Hà Nội' } },
  { type: 'section', label: 'Phần 2' },
  { type: 'short_text', label: 'Q trang 2' },
].entries()) await call('POST', `/forms/${form.id}/fields`, { ...f, order, is_required: false })
// The legacy POST /fields ignores settings (the builder saves through /ops), so seed this one directly.
sql(`UPDATE form_fields SET settings='{"default_value":"Hà Nội"}' WHERE form_id=${form.id} AND label='Q ngắn'`)
const fieldsOf = async () => (await call('GET', `/forms/${form.id}`)).data.fields
const byLabel = (fields, label) => fields.find((f) => f.label === label)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
try {
  const page = await browser.newPage()

  // 1. Builder: type the default answer into the answer box of "Q dài".
  await page.goto(APP + '/login')
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, { token, user })
  await page.goto(`${APP}/forms/${form.id}/edit`)
  const card = page.locator('.eforms-question', { hasText: 'Q dài' }).first()
  await card.waitFor()
  await card.getByText('Q dài').first().click()
  const box = card.locator('[data-prop=default_value]')
  await box.waitFor({ timeout: 5000 }).catch(async () => {
    throw new Error(`default box missing; boxes on page=${await page.locator('[data-prop=default_value]').count()} cards=${await page.locator('.eforms-question').count()}`)
  })
  if (await box.isDisabled()) {
    await box.click({ force: true }).catch(() => {})
    await page.waitForTimeout(300)
  }
  if (await box.isDisabled()) throw new Error('default box disabled after clicking the card')
  await box.fill(LIST)
  await page.locator('[data-hdr=save-indicator][data-state=saved]').waitFor({ timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const saved = byLabel(await fieldsOf(), 'Q dài')?.settings?.default_value
  check('builder saves default answer', saved === LIST, JSON.stringify(saved))

  // 2. Respondent page: prefilled, editable, cleared stays cleared.
  await call('PUT', `/forms/${form.id}`, { status: 'published', is_public: true, accept_responses: true })
  const slug = (await call('GET', `/forms/${form.id}`)).data.slug
  const r = await browser.newPage()
  await r.goto(`${APP}/f/${slug}`)
  const longBox = r.locator('textarea').first()
  const shortBox = r.locator('input[type=text]').first()
  await longBox.waitFor()
  check('long text prefilled', (await longBox.inputValue()) === LIST, JSON.stringify(await longBox.inputValue()))
  check('short text prefilled', (await shortBox.inputValue()) === 'Hà Nội', await shortBox.inputValue())

  await longBox.fill('1. Điện Biên Phủ\n2.\n3.')
  await shortBox.fill('')
  await r.getByText('Tiếp theo').click()
  await r.getByText('Quay lại').click()
  await longBox.waitFor()
  check('edit kept after page change', (await longBox.inputValue()) === '1. Điện Biên Phủ\n2.\n3.', JSON.stringify(await longBox.inputValue()))
  check('cleared box not refilled', (await shortBox.inputValue()) === '', await shortBox.inputValue())

  await r.getByText('Tiếp theo').click()
  await r.getByRole('button', { name: 'Gửi' }).click()
  await r.getByText('Trân trọng cảm ơn!').waitFor({ timeout: 10000 })
  const fields = await fieldsOf()
  const rows = sql(`SELECT a.field_id fid, a.value FROM response_answers a JOIN form_responses r ON r.id=a.response_id WHERE r.form_id=${form.id}`)
  const stored = (label) => rows.find((x) => String(x.fid) === String(byLabel(fields, label).id))?.value
  check('edited default stored', String(stored('Q dài') ?? '').includes('Điện Biên Phủ'), stored('Q dài'))
  check('cleared default not stored', stored('Q ngắn') == null, stored('Q ngắn'))
} catch (e) {
  check('run', false, e.message.split('\n')[0])
} finally {
  await browser.close()
  if (!KEEP) await call('DELETE', `/forms/${form.id}`)
}

console.table(results)
process.exit(results.every((x) => x.ok === 'PASS') ? 0 : 1)
