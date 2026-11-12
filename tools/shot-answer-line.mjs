// Screenshot of respondent answer lines (idle + focused). Run: node tools/shot-answer-line.mjs
// Creates a temporary published form, shoots its first two cards, then deletes it.
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
const OUT = join(ROOT, 'out')
mkdirSync(OUT, { recursive: true })

const { token } = JSON.parse(execFileSync(PHP, [join(ROOT, 'mint-token.php'), '1']).toString())
const api = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json().catch(() => ({}))
}

const created = await api('POST', '/forms', { title: 'Kiểm tra ô trả lời', is_public: true, status: 'published' })
const form = created.form || created.data || created
await api('POST', `/forms/${form.id}/fields/bulk-update`, {
  fields: [
    { key: randomUUID(), type: 'short_text', label: 'Họ tên', order: 0 },
    { key: randomUUID(), type: 'long_text', label: 'Ý kiến', order: 1 },
  ],
})
await api('PUT', `/forms/${form.id}`, { status: 'published', is_public: true })
const fresh = await api('GET', `/forms/${form.id}`)
const slug = (fresh.form || fresh.data || fresh).slug

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
  await page.goto(`${APP}/f/${slug}`, { waitUntil: 'networkidle' })
  const first = page.locator('input.eforms-answer-input').first()
  await first.waitFor({ timeout: 10000 }).catch(async (e) => {
    const f = (fresh.form || fresh.data || fresh)
    console.log(JSON.stringify({ slug, status: f.status, is_public: f.is_public, fields: f.fields?.length, body: (await page.innerText('body')).slice(0, 300) }))
    throw e
  })
  const box = await page.locator('.eforms-answer').first().locator('xpath=ancestor::*[contains(@class,"card") or contains(@class,"rounded")][1]').boundingBox()
  const clip = box ? { x: box.x, y: box.y, width: Math.min(box.width, 800), height: box.height * 2 + 40 } : undefined
  await page.screenshot({ path: join(OUT, 'answer-line-idle.png'), clip })
  await first.focus()
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(OUT, 'answer-line-focus.png'), clip })
  console.log(JSON.stringify({ slug, idle: 'tools/out/answer-line-idle.png', focus: 'tools/out/answer-line-focus.png' }))
} finally {
  await browser.close()
  await api('DELETE', `/forms/${form.id}`)
}
