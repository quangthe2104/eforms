// Screenshot of a /forms card + its share dialog, and a button-row overflow check at several widths.
// Run: node tools/shot-form-card.mjs   (creates a temporary published form, deletes it afterwards)
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
const OUT = join(ROOT, 'out')
mkdirSync(OUT, { recursive: true })

const auth = JSON.parse(execFileSync(PHP, [join(ROOT, 'mint-token.php'), '1']).toString())
const api = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json().catch(() => ({}))
}

const form = (await api('POST', '/forms', { title: 'Thăm dò dư luận xã hội về các sự kiện lịch sử' })).form
await api('PUT', `/forms/${form.id}`, { status: 'published', is_public: true })

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const report = []
try {
  for (const width of [1280, 1100, 760]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.goto(APP + '/login')
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    }, auth)
    await page.goto(APP + '/forms', { waitUntil: 'networkidle' })
    const card = page.locator(`[data-form-card="${form.id}"]`)
    await card.waitFor({ timeout: 10000 }).catch(async (e) => {
      console.log(JSON.stringify({ width, url: page.url(), body: (await page.innerText('body')).slice(0, 300) }))
      throw e
    })
    const m = await card.evaluate((el) => {
      const row = el.querySelector('[data-card-action=share]').parentElement
      const share = el.querySelector('[data-card-action=share] span')
      return {
        rowOverflow: row.scrollWidth > row.clientWidth,
        shareTextCut: share.scrollWidth > share.clientWidth,
        cardWidth: Math.round(el.getBoundingClientRect().width),
      }
    })
    report.push({ width, ...m })
    if (width === 1280) {
      await card.screenshot({ path: join(OUT, 'form-card.png') })
      await card.locator('[data-card-action=share]').click()
      const dialog = page.locator('[data-share-dialog]')
      await dialog.waitFor({ timeout: 10000 })
      await page.waitForTimeout(500)
      await dialog.screenshot({ path: join(OUT, 'form-card-share.png') })
    }
    await page.close()
  }
} finally {
  await browser.close()
  await api('DELETE', `/forms/${form.id}`)
}
console.table(report)
console.log('shots: tools/out/form-card.png, tools/out/form-card-share.png')
