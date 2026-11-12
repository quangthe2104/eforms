// Typing latency in the form editor on a large form (~130 fields).
// Run: node tools/perf-typing.mjs [--app=http://eforms.test:5173] [--keep] [--form=<id>] [--tag=before] [--profile] [--insecure]
// Production check: `npx vite build` + `npx vite preview --port 4173 --host eforms.test`, then --app=http://eforms.test:4173 --insecure.
// Card renders per key come from a dev-only counter (`window.__cardRenders`), so they are empty on builds.
// Needs: frontend on --app, backend on http://eforms.test, local Chrome.
// Prints one compact table; details go to tools/out/perf-typing-<tag>.json.
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PHP = 'D:\\wamp64\\bin\\php\\php8.3.14\\php.exe'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const arg = (name, def) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? def
const APP = arg('app', 'http://eforms.test:5173')
const API = 'http://eforms.test/api'
const TAG = arg('tag', 'run')
const KEEP = process.argv.includes('--keep')
const SOURCE_FORM = Number(arg('source', 74))
const COPIES = Number(arg('copies', 4))
const TEXT = 'Nội dung gõ thử để đo độ mượt khi nhập liệu trong trình sửa form'.slice(0, 60)
const OUT = join(ROOT, 'out')
mkdirSync(OUT, { recursive: true })

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

/** Large form: the source form's fields repeated COPIES times (keys remapped so references stay inside each copy). */
async function makeLargeForm() {
  const src = (await api('GET', `/forms/${SOURCE_FORM}`)).data
  const fields = (src.fields || []).sort((a, b) => a.order - b.order)
  const out = []
  for (let c = 0; c < COPIES; c++) {
    let json = JSON.stringify(fields.map(({ id, form_id, created_at, updated_at, ...f }) => f))
    for (const f of fields) json = json.split(f.key).join(crypto.randomUUID())
    out.push(...JSON.parse(json))
  }
  const form = (await api('POST', '/forms', { title: `PERF typing ${out.length}` })).data.form
  const res = await api('POST', `/forms/${form.id}/fields/bulk-update`, { fields: out.map((f, order) => ({ ...f, order })) })
  if (res.status >= 300) throw new Error(`bulk-update ${res.status}: ${JSON.stringify(res.data).slice(0, 400)}`)
  return { id: form.id, count: out.length }
}

const stats = (arr) => {
  if (!arr.length) return { n: 0, p50: 0, p95: 0, max: 0 }
  const s = [...arr].sort((a, b) => a - b)
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]
  return { n: s.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +s[s.length - 1].toFixed(1) }
}

const formArg = arg('form', null)
const form = formArg ? { id: Number(formArg), count: '?' } : await makeLargeForm()

// --insecure: for `vite preview` on another port (backend CORS only allows :5173).
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: process.argv.includes('--insecure') ? ['--disable-web-security'] : [] })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
const errors = []
const ops = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('request', (r) => r.method() === 'POST' && r.url().endsWith(`/forms/${form.id}/ops`) && ops.push(Date.now()))

// Per keystroke: keydown → next frame painted (rAF + message after it); plus Event Timing and long tasks.
await context.addInitScript(() => {
  const p = (window.__perf = { keys: [], events: [], longtasks: [] })
  document.addEventListener('keydown', () => {
    const t0 = performance.now()
    requestAnimationFrame(() => {
      const ch = new MessageChannel()
      ch.port1.onmessage = () => p.keys.push(performance.now() - t0)
      ch.port2.postMessage(0)
    })
  }, true)
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) p.events.push({ name: e.name, d: e.duration, proc: e.processingEnd - e.processingStart, delay: e.processingStart - e.startTime })
  }).observe({ type: 'event', durationThreshold: 16, buffered: false })
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) p.longtasks.push(e.duration)
  }).observe({ type: 'longtask' })
})

const cdp = await context.newCDPSession(page)
await cdp.send('Performance.enable')
const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))

const PROFILE = process.argv.includes('--profile')
const profiles = {}
/** Self time and total (inclusive) time per function, top 25 each, in ms. */
function summarizeProfile(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]))
  const parent = new Map()
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id)
  const self = new Map()
  const total = new Map()
  const name = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber + 1}`
  const dts = profile.timeDeltas
  profile.samples.forEach((id, i) => {
    const dt = (dts[i + 1] ?? 0) / 1000
    const n = byId.get(id)
    self.set(name(n), (self.get(name(n)) || 0) + dt)
    const seen = new Set()
    for (let cur = id; cur != null; cur = parent.get(cur)) {
      const k = name(byId.get(cur))
      if (seen.has(k)) continue
      seen.add(k)
      total.set(k, (total.get(k) || 0) + dt)
    }
  })
  const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${v.toFixed(0).padStart(6)}  ${k}`)
  const app = [...total].filter(([k]) => /\.(jsx?|mjs) ?:/.test(k.replace(/:\d+$/, ' :')) && !/chunk-|react_|deps/.test(k))
    .sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => `${v.toFixed(0).padStart(6)}  ${k}`)
  return { self: top(self), total: top(total), app }
}

const results = {}
async function measure(name, startEditing) {
  const input = await startEditing()
  await input.press('End')
  await page.waitForTimeout(1600)
  await page.evaluate(() => { const p = window.__perf; p.keys = []; p.events = []; p.longtasks = []; if ('__cardRenders' in window) window.__cardRenders = 0 })
  const m0 = await metric()
  const opsBefore = ops.length
  if (PROFILE) {
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
    await cdp.send('Profiler.start')
  }
  const t0 = Date.now()
  await page.keyboard.type(TEXT, { delay: 30 })
  const typedMs = Date.now() - t0
  await page.waitForTimeout(300)
  if (PROFILE) {
    const { profile } = await cdp.send('Profiler.stop')
    profiles[name] = summarizeProfile(profile)
  }
  const opsDuring = ops.length - opsBefore
  const m1 = await metric()
  const p = await page.evaluate(() => ({ ...window.__perf, cards: window.__cardRenders ?? null }))
  await page.waitForTimeout(2200)
  const evStats = stats(p.events.filter((e) => e.name === 'keydown' || e.name === 'keypress' || e.name === 'input' || e.name === 'keyup').map((e) => e.d))
  results[name] = {
    keys: stats(p.keys),
    longtasks: { n: p.longtasks.length, total: Math.round(p.longtasks.reduce((a, b) => a + b, 0)) },
    eventsOver16: evStats,
    maxProcessing: Math.round(Math.max(0, ...p.events.map((e) => e.proc))),
    scriptMs: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000),
    taskMs: Math.round((m1.TaskDuration - m0.TaskDuration) * 1000),
    cardsPerKey: p.cards == null ? null : +(p.cards / TEXT.length).toFixed(1),
    opsDuring,
    opsAfter: ops.length - opsBefore - opsDuring,
    typedMs,
  }
  await page.evaluate(() => document.activeElement?.blur())
  await page.waitForTimeout(300)
}

try {
  await page.goto(APP + '/login')
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, owner)
  await page.goto(`${APP}/forms/${form.id}/edit`)
  await page.locator('.eforms-question').first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(1500)
  const cardCount = await page.locator('.eforms-question').count()

  // A visible choice question in the middle of the form.
  const choiceCards = page.locator('[data-field-key]:not(.hidden) .eforms-question:has(.eforms-option-radio)')
  const n = await choiceCards.count()
  if (!n) throw new Error('no visible choice question found')
  const card = choiceCards.nth(Math.floor(n / 2))
  await card.scrollIntoViewIfNeeded()
  await card.locator('div.eforms-question-input').click()
  await page.waitForTimeout(300)

  await measure('label', async () => {
    await card.locator('div.eforms-question-input').click()
    const input = card.locator('input.eforms-question-input')
    await input.waitFor()
    return input
  })
  await measure('option', async () => {
    await card.locator('div.eforms-option-input.cursor-text').first().click()
    const input = card.locator('input.eforms-option-input').first()
    await input.waitFor()
    return input
  })
  await measure('title', async () => {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.locator('h1.eforms-title').click()
    const input = page.locator('input.eforms-title-input')
    await input.waitFor()
    return input
  })

  const rows = Object.entries(results).map(([k, r]) => ({
    input: k,
    p50: r.keys.p50,
    p95: r.keys.p95,
    max: r.keys.max,
    'ev>16 n/max': `${r.eventsOver16.n}/${r.eventsOver16.max}`,
    longtasks: `${r.longtasks.n} (${r.longtasks.total}ms)`,
    scriptMs: r.scriptMs,
    'cards/key': r.cardsPerKey ?? '-',
    'ops typing/after': `${r.opsDuring}/${r.opsAfter}`,
  }))
  console.log(`form ${form.id}: ${form.count} fields, ${cardCount} cards rendered, ${TEXT.length} keys @30ms, app ${APP}`)
  console.table(rows)
  if (errors.length) console.log('page errors:', errors.slice(0, 5))
  writeFileSync(join(OUT, `perf-typing-${TAG}.json`), JSON.stringify({ app: APP, form, cardCount, results, errors, profiles }, null, 2))
} finally {
  await browser.close()
  if (!KEEP && !formArg) await api('DELETE', `/forms/${form.id}`)
  else console.log(`kept form ${form.id}`)
  php(join(ROOT, 'mint-token.php'), 1, '--revoke')
}
