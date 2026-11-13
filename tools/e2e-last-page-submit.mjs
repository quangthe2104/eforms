// Regression check for the respondent page: the tab title is the form title, and clicking "Tiếp theo" on the
// second-to-last page must open the last page, not submit the form.
// Builds a 3-page form with no required questions, clicks through it in headless Chrome, and reports whether
// a response was stored before the respondent pressed "Gửi". Run: node tools/e2e-last-page-submit.mjs [--keep]
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PHP = 'D:\\wamp64\\bin\\php\\php8.3.14\\php.exe'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const APP = process.env.APP || 'http://eforms.test:5173'
const API = 'http://eforms.test/api'
const KEEP = process.argv.includes('--keep')

const { token } = JSON.parse(execFileSync(PHP, [join(ROOT, 'mint-token.php'), '1']).toString())
const call = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}

const created = await call('POST', '/forms', { title: 'E2E last page submit' })
const form = created.data.form || created.data
const fields = [
  { type: 'radio', label: 'P1 câu hỏi', options: ['A', 'B'] },
  { type: 'section', label: 'Phần 2' },
  { type: 'radio', label: 'P2 câu hỏi', options: ['A', 'B'] },
  { type: 'section', label: 'Phần 3' },
  { type: 'radio', label: 'P3 câu hỏi', options: ['A', 'B'] },
  { type: 'number', label: 'P3 tuổi' },
]
for (const [order, f] of fields.entries()) await call('POST', `/forms/${form.id}/fields`, { ...f, order, is_required: false })
await call('PUT', `/forms/${form.id}`, { status: 'published', is_public: true, accept_responses: true })
const slug = (await call('GET', `/forms/${form.id}`)).data.slug

const stored = () => JSON.parse(execFileSync(PHP, [join(ROOT, 'db-peek.php'), `SELECT COUNT(*) n FROM form_responses WHERE form_id=${form.id}`]).toString()).n * 1
const rows = []
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
try {
  const page = await browser.newPage()
  await page.goto(`${APP}/f/${slug}`)
  const at = async () => (await page.getByText('Phản hồi của bạn đã được ghi nhận').isVisible())
    ? 'thank-you screen'
    : page.getByText(/Trang \d+ \/ \d+/).textContent().catch(() => '?')
  const step = async (name, action) => {
    await action().catch((e) => rows.push({ step: `${name} (not possible)`, at: e.message.split('\n')[0].slice(0, 60), stored: stored() }))
    await page.waitForTimeout(1500)
    rows.push({ step: name, at: await at(), stored: stored() })
  }

  await page.getByText('Tiếp theo').waitFor()
  rows.push({ step: 'tab title', at: await page.title(), stored: stored() })
  await step('page 1 -> Tiếp theo', () => page.getByText('Tiếp theo').click())
  await step('page 2 -> Tiếp theo (to last page)', () => page.getByText('Tiếp theo').click())
  await step('last page -> Gửi', () => page.getByRole('button', { name: 'Gửi' }).click())
} finally {
  await browser.close()
  if (!KEEP) await call('DELETE', `/forms/${form.id}`)
}

console.table(rows)
const titled = rows[0]?.at === 'E2E last page submit'
const early = rows.slice(1, 3).some((r) => r.stored > 0)
const sent = rows[3]?.stored === 1 && rows[3]?.at === 'thank-you screen'
console.log(titled ? 'PASS: tab title is the form title' : 'FAIL: tab title is not the form title')
console.log(early ? 'FAIL: form was submitted before pressing "Gửi"' : sent ? 'PASS: last page opened, "Gửi" submitted once' : 'FAIL: "Gửi" did not submit')
process.exit(!titled || early || !sent ? 1 : 0)
