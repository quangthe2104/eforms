// Usage: node tools/check-live-form.mjs <formUrl> — opens a respondent page in headless Chrome (read-only, never submits)
// and reports tab title, whether the first page rendered, and any console/network errors.
import { chromium } from 'playwright-core'

const url = process.argv[2]
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
const errors = []
try {
  const page = await browser.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text().slice(0, 120)}`))
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url().slice(0, 100)}`))
  await page.goto(url, { waitUntil: 'networkidle' })
  const next = await page.getByText(/Tiếp theo|Gửi/).first().isVisible().catch(() => false)
  console.log(JSON.stringify({ title: await page.title(), navButton: next, questions: await page.locator('input, textarea').count(), errors }, null, 1))
} finally {
  await browser.close()
}
