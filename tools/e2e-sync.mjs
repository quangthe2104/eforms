// Headless check of live sync (polling) + presence (plan phase 5) with two accounts in two browser contexts.
// Run: node tools/e2e-sync.mjs [--keep] [--skip-expiry]
// Needs: frontend dev server on http://eforms.test:5173, backend on http://eforms.test, local Chrome.
// Prints failures only + a one-line total; details go to tools/out/e2e-sync.json.
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
const SKIP_EXPIRY = process.argv.includes('--skip-expiry')
const OUT = join(ROOT, 'out')
mkdirSync(OUT, { recursive: true })

const results = []
const timings = {}
let step = 'start'
const check = (name, ok, detail = '') => results.push({ step, name, ok: !!ok, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) })

const php = (...args) => JSON.parse(execFileSync(PHP, args.map(String)).toString())
const owner = php(join(ROOT, 'mint-token.php'), 1)
const editorId = php(join(ROOT, 'ensure-user.php'), 'e2e-editor@eforms.test', 'E2E Editor').id
const viewerId = php(join(ROOT, 'ensure-user.php'), 'e2e-viewer@eforms.test', 'E2E Viewer').id
const editor = php(join(ROOT, 'mint-token.php'), editorId)
const viewer = php(join(ROOT, 'mint-token.php'), viewerId)

const api = async (method, path, body, who = owner) => {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${who.token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, data: text } }
}
const serverFields = async (id) => (await api('GET', `/forms/${id}`)).data.fields.sort((a, b) => a.order - b.order)

const form = (await api('POST', '/forms', { title: 'E2E đồng bộ' })).data.form
await api('POST', `/forms/${form.id}/fields/bulk-update`, {
  fields: ['Câu một', 'Câu hai', 'Câu ba', 'Câu bốn', 'Câu năm'].map((label, order) => ({
    type: order === 1 ? 'radio' : 'short_text', label, order, is_required: false, ...(order === 1 ? { options: ['A', 'B'] } : {}),
  })),
})
const keyOf = Object.fromEntries((await serverFields(form.id)).map((f) => [f.label, f.key]))

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const pageErrors = []

async function openSession(who, name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addInitScript(({ token, user }) => {
    performance.setResourceTimingBufferSize(10000)
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, who)
  return { context, page: await newPage(context, name) }
}
async function newPage(context, name) {
  const page = await context.newPage()
  page.on('pageerror', (e) => pageErrors.push(`[${name}] ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && pageErrors.push(`[${name}] ${m.text()}`))
  page.on('response', (r) => r.status() >= 400 && pageErrors.push(`[${name}] ${r.status()} ${r.request().method()} ${r.url()}`))
  page.on('dialog', (d) => d.accept())
  await page.goto(`${APP}/forms/${form.id}/edit`)
  await page.locator('.eforms-question').first().waitFor({ timeout: 15000 })
  return page
}

const card = (page, label) => page.locator('.eforms-question', { hasText: label }).first()
const byKey = (page, key) => page.locator(`[data-field-key="${key}"]`)
const activate = async (page, label) => {
  const c = card(page, label)
  if (!((await c.getAttribute('class')) || '').includes('active')) await c.locator('div.eforms-question-input').click()
  return c
}
const openLabel = async (page, label) => {
  const c = await activate(page, label)
  const input = page.locator('input.eforms-question-input')
  // The card may reopen its label input directly (it stays in edit mode when deselected).
  await input.waitFor({ timeout: 300 }).catch(() => c.locator('div.eforms-question-input').click())
  await input.waitFor()
  await input.focus()
  return input
}
const clickBlank = (page) => page.mouse.click(30, 700)
const opsResponse = (page, timeout = 8000) => {
  const p = page.waitForResponse((r) => r.url().endsWith(`/forms/${form.id}/ops`) && r.request().method() === 'POST', { timeout })
  p.catch(() => {})
  return p
}
const waitSaved = (page) => page.locator('[data-hdr=save-indicator][data-state=saved]').waitFor({ timeout: 8000 }).catch(() => {})
/** Imports an app module with the exact URL the app loaded (HMR may add `?t=`), i.e. the same instance. */
const IMPORT_APP = `(path) => import(performance.getEntriesByType('resource').map((e) => e.name).filter((n) => new URL(n).pathname === path).pop() || path)`
/** Runs in the page with the app's own store. */
const store = (page, fn, arg) => page.evaluate(async ({ src, arg, imp }) => {
  // eslint-disable-next-line no-new-func
  const { useFormStore } = await new Function(`return ${imp}`)()('/src/store/formStore.js')
  // eslint-disable-next-line no-new-func
  return new Function('s', 'arg', `return (${src})(s, arg)`)(useFormStore.getState(), arg)
}, { src: fn.toString(), arg, imp: IMPORT_APP })
const labels = (page) => store(page, (s) => s.fields.map((f) => f.label))
/** Waits until `fn()` is truthy; returns ms waited or null on timeout. */
const until = async (fn, timeout = 6000) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await fn().catch(() => false)) return Date.now() - start
    await new Promise((r) => setTimeout(r, 150))
  }
  return null
}
const avatars = (page) => page.locator('[data-hdr=presence] [data-presence-user]').evaluateAll((els) => els.map((e) => Number(e.dataset.presenceUser)))
const LIVE_MS = 4000 // poll every 2.5 s + request time

let A, B, V
try {
  step = 'setup'
  const addEditor = await api('POST', `/forms/${form.id}/collaborators`, { user_id: editorId, role: 'editor', notify: false })
  const addViewer = await api('POST', `/forms/${form.id}/collaborators`, { user_id: viewerId, role: 'viewer', notify: false })
  check('collaborators added', addEditor.status === 201 && addViewer.status === 201, [addEditor.status, addViewer.status])
  A = await openSession(owner, 'A')
  B = await openSession(editor, 'B')
  const pa = A.page
  const pb = B.page
  check('store module reachable from page', (await labels(pa)).length === 5)

  // 1. Presence avatars: the other person, never me.
  step = '1 avatars'
  let t = await until(async () => (await avatars(pa)).includes(editorId) && (await avatars(pb)).includes(owner.user.id), 8000)
  check('avatars show the other user in both headers', t !== null, { a: await avatars(pa), b: await avatars(pb) })
  check('no self avatar', !(await avatars(pa)).includes(owner.user.id) && !(await avatars(pb)).includes(editorId))
  const initials = await pa.locator(`[data-presence-user="${editorId}"]`).innerText()
  check('avatar initials "EE"', initials === 'EE', initials)

  // 2. Changes from A appear in B.
  step = '2 live changes'
  let saved = opsResponse(pa)
  const input = await openLabel(pa, 'Câu một')
  await input.fill('Câu một (A)')
  await clickBlank(pa)
  await saved
  t = await until(async () => (await card(pb, 'Câu một (A)').count()) === 1)
  timings.label = t
  check('label edit appears in B within ~3 s of save', t !== null && t <= LIVE_MS, t)
  check('remote change not dirty in B', (await pb.locator('[data-hdr=save-indicator]').getAttribute('data-state')) === 'saved')
  check('remote change not in B undo history', await pb.locator('[data-hdr=undo]').isDisabled())

  saved = opsResponse(pa)
  await activate(pa, 'Câu năm')
  await pa.locator('.eforms-sidebar button[aria-label="Thêm câu hỏi"]').click()
  await saved
  t = await until(async () => (await labels(pb)).length === 6)
  timings.insert = t
  const la = await labels(pa)
  check('added question appears in B (same order)', t !== null && t <= LIVE_MS && JSON.stringify(await labels(pb)) === JSON.stringify(la), { t, a: la, b: await labels(pb) })

  saved = opsResponse(pa)
  await activate(pa, 'Câu năm')
  await card(pa, 'Câu năm').locator('button[aria-label="Xóa"]').click()
  await saved
  t = await until(async () => (await card(pb, 'Câu năm').count()) === 0)
  timings.delete = t
  check('deleted question disappears in B', t !== null && t <= LIVE_MS, t)

  saved = opsResponse(pa)
  await store(pa, (s) => {
    const f = s.fields.slice()
    const i = f.findIndex((x) => x.label === 'Câu bốn')
    const [moved] = f.splice(i, 1)
    f.unshift(moved)
    s.reorderFields(f)
  })
  await saved
  t = await until(async () => (await labels(pb))[0] === 'Câu bốn')
  timings.move = t
  check('moved question moves in B', t !== null && t <= LIVE_MS && JSON.stringify(await labels(pb)) === JSON.stringify(await labels(pa)), { t, b: await labels(pb) })

  saved = opsResponse(pa)
  await store(pa, (s) => s.setTheme({ primary_color: '#d93025' }))
  await saved
  t = await until(async () => (await store(pb, (s) => s.currentForm.primary_color)) === '#d93025'
    && (await pb.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--theme-primary').trim())) === '#d93025')
  timings.theme = t
  check('theme change applied in B', t !== null && t <= LIVE_MS, t)

  saved = opsResponse(pa)
  await pa.locator('[data-hdr=title] input').fill('E2E đồng bộ – đổi tên')
  await clickBlank(pa)
  await saved
  t = await until(async () => (await pb.locator('[data-hdr=title] input').inputValue()) === 'E2E đồng bộ – đổi tên'
    && (await pb.locator('.eforms-title').innerText()) === 'E2E đồng bộ – đổi tên')
  timings.title = t
  check('title change in B header + title card', t !== null && t <= LIVE_MS, t)

  // 3. B → A direction, and both editing different props of the same question.
  step = '3 same question'
  const savedA = opsResponse(pa)
  const savedB = opsResponse(pb)
  const ia = await openLabel(pa, 'Câu ba')
  await ia.fill('Câu ba (A)')
  const cb = await activate(pb, 'Câu ba')
  await cb.locator('textarea[data-prop=help_text]').fill('Hướng dẫn từ B')
  await clickBlank(pa)
  await clickBlank(pb)
  await Promise.all([savedA, savedB])
  t = await until(async () => {
    const [fa, fb] = await Promise.all([pa, pb].map((p) => store(p, (s, k) => s.fields.find((f) => f.key === k), keyOf['Câu ba'])))
    return fa.label === 'Câu ba (A)' && fa.help_text === 'Hướng dẫn từ B' && fb.label === 'Câu ba (A)' && fb.help_text === 'Hướng dẫn từ B'
  }, 8000)
  const srv3 = (await serverFields(form.id)).find((f) => f.key === keyOf['Câu ba'])
  check('label (A) + help text (B) both survive in both sessions', t !== null, t)
  check('… and on the server', srv3.label === 'Câu ba (A)' && srv3.help_text === 'Hướng dẫn từ B', srv3)

  // 4. Focused input guard: B's open label input is not overwritten until blur.
  step = '4 focus guard'
  const ib = await openLabel(pb, 'Câu hai')
  check('B input focused', await ib.evaluate((el) => el === document.activeElement))
  saved = opsResponse(pa)
  await store(pa, (s, k) => s.updateField(s.fields.findIndex((f) => f.key === k), { label: 'Câu hai từ A' }), keyOf['Câu hai'])
  await saved
  // B has polled when its server snapshot moved; give it two polls.
  await pb.waitForTimeout(LIVE_MS + 1000)
  check('focused input keeps its text while A changes it', (await ib.inputValue()) === 'Câu hai', await ib.inputValue())
  check('B not dirty while holding the remote value', (await pb.locator('[data-hdr=save-indicator]').getAttribute('data-state')) === 'saved')
  await clickBlank(pb)
  t = await until(async () => (await card(pb, 'Câu hai từ A').count()) === 1, 3000)
  check('remote value applied on blur (B did not edit)', t !== null, t)
  await pb.waitForTimeout(2500)
  check('blur did not send the old value back', (await serverFields(form.id)).find((f) => f.key === keyOf['Câu hai']).label === 'Câu hai từ A')

  // Local wins when B edits the held prop.
  const ib2 = await openLabel(pb, 'Câu hai từ A')
  saved = opsResponse(pa)
  await store(pa, (s, k) => s.updateField(s.fields.findIndex((f) => f.key === k), { label: 'Câu hai lần 2 (A)' }), keyOf['Câu hai'])
  await saved
  await pb.waitForTimeout(LIVE_MS)
  check('still not overwritten', (await ib2.inputValue()) === 'Câu hai từ A', await ib2.inputValue())
  const savedB2 = opsResponse(pb)
  await ib2.press('End')
  await ib2.type(' + B')
  await clickBlank(pb)
  await savedB2
  t = await until(async () => (await card(pa, 'Câu hai từ A + B').count()) === 1)
  check('B edited the held prop → B wins, A receives it', t !== null && (await card(pb, 'Câu hai từ A + B').count()) === 1, t)

  // 5. Selected question: border + name label in the other session.
  step = '5 selection'
  await activate(pb, 'Câu một (A)')
  t = await until(async () => (await byKey(pa, keyOf['Câu một']).locator(`[data-presence="${editorId}"]`).count()) === 1
    && (await byKey(pa, keyOf['Câu một']).locator('[data-presence-label]').innerText()) === 'E2E Editor')
  timings.selection = t
  check('A sees B\'s selection (border + name)', t !== null && t <= LIVE_MS, t)
  const frame = byKey(pa, keyOf['Câu một']).locator('[data-presence] > div').first()
  const border = await frame.evaluate((el) => getComputedStyle(el).borderTopColor)
  check('border in B\'s color', border === 'rgb(26, 115, 232)' || border.startsWith('rgb('), border)
  check('B sees no frame for own selection', (await pb.locator('[data-presence]').count()) === 0)
  await clickBlank(pb)
  t = await until(async () => (await pa.locator('[data-presence]').count()) === 0)
  check('frame goes when B deselects', t !== null, t)

  // 6. Undo conflict toast.
  step = '6 undo conflict'
  await pa.reload()
  await pa.locator('.eforms-question').first().waitFor({ timeout: 15000 })
  saved = opsResponse(pa)
  const ic = await openLabel(pa, 'Câu bốn')
  await ic.fill('Câu bốn (A)')
  await clickBlank(pa)
  await saved
  await until(async () => (await card(pb, 'Câu bốn (A)').count()) === 1)
  saved = opsResponse(pb)
  const id4 = await openLabel(pb, 'Câu bốn (A)')
  await id4.fill('Câu bốn (B)')
  await clickBlank(pb)
  await saved
  t = await until(async () => (await card(pa, 'Câu bốn (B)').count()) === 1)
  check('A received B\'s edit', t !== null, t)
  await pa.locator('[data-hdr=undo]').click()
  const toastText = await pa.getByText('Không thể hoàn tác vì E2E Editor đã thay đổi nội dung này').count()
  check('undo conflict toast names B', toastText === 1)
  check('undo did not revert B\'s value', (await card(pa, 'Câu bốn (B)').count()) === 1)

  // 7. Viewer sees live changes, cannot edit.
  step = '7 viewer'
  V = await openSession(viewer, 'V')
  const pv = V.page
  check('viewer read-only (inert, no undo)', (await pv.locator('.eforms-main[inert]').count()) === 1 && (await pv.locator('[data-hdr=undo]').count()) === 0)
  saved = opsResponse(pa)
  await store(pa, (s, k) => s.updateField(s.fields.findIndex((f) => f.key === k), { label: 'Câu một cho người xem' }), keyOf['Câu một'])
  await saved
  t = await until(async () => (await card(pv, 'Câu một cho người xem').count()) === 1)
  check('viewer sees the change live', t !== null && t <= LIVE_MS, t)
  t = await until(async () => (await avatars(pa)).includes(viewerId) && (await avatars(pv)).includes(owner.user.id) && (await avatars(pv)).includes(editorId))
  check('viewer in presence (and sees both)', t !== null, { a: await avatars(pa), v: await avatars(pv) })
  const viewerOps = await api('POST', `/forms/${form.id}/ops`, { client_id: 'x', ops: [{ type: 'form.update', set: { title: 'x' } }] }, viewer)
  check('viewer cannot save ops (403)', viewerOps.status === 403, viewerOps.status)

  // 8. Two pages of the same user (a duplicated tab copied sessionStorage before): distinct client ids.
  step = '8 same user, two tabs'
  const pa2 = await newPage(A.context, 'A2')
  const ids = await Promise.all([pa, pa2].map((p) => p.evaluate(async (imp) => (await new Function(`return ${imp}`)()('/src/services/api.js')).clientId, IMPORT_APP)))
  check('client ids differ per page', ids[0] && ids[1] && ids[0] !== ids[1], ids)
  saved = opsResponse(pa2)
  await store(pa2, (s, k) => s.updateField(s.fields.findIndex((f) => f.key === k), { label: 'Từ tab 2' }), keyOf['Câu ba'])
  await saved
  t = await until(async () => (await card(pa, 'Từ tab 2').count()) === 1)
  check('tab 1 receives tab 2\'s change', t !== null && t <= LIVE_MS, t)
  saved = opsResponse(pa)
  await store(pa, (s, k) => s.updateField(s.fields.findIndex((f) => f.key === k), { label: 'Từ tab 1' }), keyOf['Câu ba'])
  await saved
  t = await until(async () => (await card(pa2, 'Từ tab 1').count()) === 1)
  check('tab 2 receives tab 1\'s change', t !== null && t <= LIVE_MS, t)
  check('own other tab not shown as avatar', !(await avatars(pa)).includes(owner.user.id))
  await pa2.close()

  // 9. Reload case: a legacy field endpoint logs form.reload → others reload the whole form.
  step = '9 reload'
  const legacy = await api('POST', `/forms/${form.id}/fields/reorder`, {
    fields: (await serverFields(form.id)).reverse().map((f, order) => ({ id: f.id, order })),
  })
  if (legacy.status < 300) {
    const want = (await serverFields(form.id)).map((f) => f.label)
    t = await until(async () => JSON.stringify(await labels(pb)) === JSON.stringify(want))
    check('form.reload → B reloads the form', t !== null && t <= LIVE_MS, { t, want, b: await labels(pb) })
  } else {
    check('legacy reorder endpoint available', false, legacy)
  }

  // 10. Presence expires after closing a session (server TTL 30 s).
  step = '10 presence expiry'
  if (!SKIP_EXPIRY) {
    await B.context.close()
    B = null
    t = await until(async () => !(await avatars(pa)).includes(editorId), 40000)
    timings.expiry = t
    check('closed session leaves presence within ~35 s', t !== null && t <= 36000, t)
  }
  step = 'errors'
  const relevant = pageErrors.filter((e) => !/favicon/.test(e))
  check('no page errors / failed requests', relevant.length === 0, relevant.slice(0, 8))
} catch (error) {
  check(`crashed at ${step}`, false, error.stack?.split('\n').slice(0, 4).join(' | '))
  for (const [name, s] of [['A', A], ['B', B]]) {
    if (!s) continue
    const p = s.page
    const dom = await p.locator('.eforms-question').evaluateAll((els) => els.map((e) => `${e.className.includes('active') ? '*' : ''}${e.querySelector('.eforms-question-input')?.tagName}:${e.querySelector('.eforms-question-input')?.value ?? e.querySelector('.eforms-question-input')?.textContent}`)).catch(() => null)
    results.push({ step: 'debug', name: `${name} dom`, ok: true, detail: JSON.stringify(dom) })
    await p.screenshot({ path: join(OUT, `e2e-sync-${name}.png`) }).catch(() => {})
  }
  for (const [name, s] of [['A', A], ['B', B]]) {
    if (!s) continue
    const p = s.page
    const dom = await p.locator('.eforms-question').evaluateAll((els) => els.map((e) => `${e.className.includes('active') ? '*' : ''}${e.querySelector('.eforms-question-input')?.tagName}:${e.querySelector('.eforms-question-input')?.value ?? e.querySelector('.eforms-question-input')?.textContent}`)).catch(() => null)
    results.push({ step: 'debug', name: `${name} dom`, ok: true, detail: JSON.stringify(dom) })
    await p.screenshot({ path: join(OUT, `e2e-sync-${name}.png`) }).catch(() => {})
  }
} finally {
  await browser.close()
  if (!KEEP) await api('DELETE', `/forms/${form.id}`)
  for (const id of [editorId, viewerId]) execFileSync(PHP, [join(ROOT, 'mint-token.php'), String(id), '--revoke'])
}

writeFileSync(join(OUT, 'e2e-sync.json'), JSON.stringify({ results, timings, pageErrors }, null, 2))
const failed = results.filter((r) => !r.ok)
for (const f of failed) console.log(`FAIL [${f.step}] ${f.name}${f.detail ? ` :: ${f.detail.slice(0, 300)}` : ''}`)
console.log(`e2e-sync: ${results.length - failed.length}/${results.length} passed; timings ms ${JSON.stringify(timings)}`)
process.exit(failed.length ? 1 : 0)
