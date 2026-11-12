// Headless check of the editor header + 3 tabs (plan phase 3). Run: node tools/e2e-editor-header.mjs [--keep] [--shots]
// Needs: frontend dev server on http://eforms.test:5173, backend on http://eforms.test, local Chrome.
// Prints failures only + a one-line total; details go to tools/out/e2e-editor-header.json.
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
const SHOTS = process.argv.includes('--shots')
const OUT = join(ROOT, 'out')
mkdirSync(OUT, { recursive: true })

const results = []
let step = 'start'
const check = (name, ok, detail = '') => results.push({ step, name, ok: !!ok, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) })
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const php = (...args) => JSON.parse(execFileSync(PHP, args.map(String)).toString())
const owner = php(join(ROOT, 'mint-token.php'), 1)
const viewerId = php(join(ROOT, 'ensure-user.php'), 'e2e-viewer@eforms.test', 'E2E Viewer').id
const viewer = php(join(ROOT, 'mint-token.php'), viewerId)

const api = async (method, path, body, token = owner.token) => {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, data: text } }
}

const form = (await api('POST', '/forms', { title: 'E2E editor header' })).data.form
await api('POST', `/forms/${form.id}/fields/bulk-update`, {
  fields: [
    { type: 'email', label: 'Email liên hệ', order: 0 },
    { type: 'radio', label: 'Chọn một', options: ['A', 'B'], order: 1 },
  ],
})
const share = await api('POST', `/forms/${form.id}/collaborators`, { user_id: viewerId, role: 'viewer', notify: false })
const createdIds = []

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const pageErrors = []
const contexts = []

async function openPage(auth, viewport = { width: 1280, height: 900 }, label = 'owner') {
  const context = await browser.newContext({ viewport })
  contexts.push(context)
  // eforms.test is plain http, so the app copies through the execCommand fallback; record what it copied.
  await context.addInitScript(() => document.addEventListener('copy', (e) => {
    window.__copied = e.target?.value ?? document.getSelection()?.toString()
  }))
  const page = await context.newPage()
  page.on('pageerror', (e) => pageErrors.push(`${label}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && pageErrors.push(`${label}: ${m.text()}`))
  page.on('response', (r) => r.status() >= 400 && pageErrors.push(`${label}: ${r.status()} ${r.request().method()} ${r.url()}`))
  page.on('dialog', (d) => d.accept())
  await page.goto(APP + '/login')
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, auth)
  return page
}

/** Header items in DOM order with visibility and x position. */
const headerState = (page) => page.evaluate(() => [...document.querySelectorAll('[data-editor-header] [data-hdr]')].map((el) => {
  const r = el.getBoundingClientRect()
  return { hdr: el.dataset.hdr, visible: r.width > 0 && r.height > 0 && el.checkVisibility({ visibilityProperty: true }), x: Math.round(r.left), w: Math.round(r.width) }
}))
const visibleOrder = (state) => state.filter((s) => s.visible).map((s) => s.hdr)
const xIncreasing = (state) => state.filter((s) => s.visible).every((s, i, a) => i === 0 || s.x >= a[i - 1].x)
const menuItems = async (page) => {
  await page.locator('[data-hdr=more]').click()
  await page.locator('[data-more-menu]').waitFor()
  const items = await page.locator('[data-more-menu] [role=menuitem]').evaluateAll((els) => els.filter((e) => e.checkVisibility()).map((e) => ({ key: e.dataset.menu, text: e.textContent.trim() })))
  await page.keyboard.press('Escape')
  return items
}
const tooltipText = async (page) => {
  const tip = page.locator('[role=tooltip]')
  await tip.waitFor({ timeout: 2000 }).catch(() => {})
  if (!(await tip.count())) return null
  return tip.first().evaluate((el) => {
    const bg = getComputedStyle(el).backgroundColor.match(/\d+/g).slice(0, 3).map(Number)
    return { text: el.textContent, dark: bg.reduce((a, b) => a + b, 0) < 300 }
  })
}
const statusPut = (page, status) => {
  const p = page.waitForResponse((r) => r.url().endsWith(`/forms/${form.id}`) && r.request().method() === 'PUT' && r.request().postData()?.includes(`"status":"${status}"`), { timeout: 15000 })
  p.catch(() => {})
  return p
}
const serverForm = async () => (await api('GET', `/forms/${form.id}`)).data
const shot = async (locator, name) => SHOTS && locator.screenshot({ path: join(OUT, `${name}.png`) })

let page
try {
  step = 'setup'
  check('viewer added via API', share.status === 201, share.data)

  // 1. Desktop owner: order, aria-labels, tooltips.
  step = '1 order'
  page = await openPage(owner)
  let formGets = 0
  page.on('request', (r) => r.method() === 'GET' && new URL(r.url()).pathname === `/api/forms/${form.id}` && formGets++)
  await page.goto(`${APP}/forms/${form.id}/edit`)
  await page.locator('.eforms-question').first().waitFor()
  let state = await headerState(page)
  check('DOM order', eq(state.map((s) => s.hdr), ['logo', 'title', 'status', 'save-indicator', 'presence', 'theme', 'preview', 'undo', 'redo', 'copy-link', 'share', 'publish', 'more', 'user']), state.map((s) => s.hdr))
  check('visible order (owner desktop)', eq(visibleOrder(state), ['logo', 'title', 'status', 'save-indicator', 'theme', 'preview', 'undo', 'redo', 'copy-link', 'share', 'publish', 'more', 'user']), visibleOrder(state))
  check('left-to-right positions', xIncreasing(state), state)
  const a11y = await page.evaluate(() => {
    const header = document.querySelector('[data-editor-header]')
    const unnamed = [...header.querySelectorAll('button, a, input')].filter((el) => !el.getAttribute('aria-label') && !el.textContent.trim()).map((el) => el.outerHTML.slice(0, 80))
    return { unnamed, titles: header.querySelectorAll('[title]').length, noLogoText: !header.querySelector('[data-hdr=logo]').textContent.trim() }
  })
  check('icon buttons have aria-label', a11y.unnamed.length === 0, a11y.unnamed)
  check('no native title tooltips in header', a11y.titles === 0, `${a11y.titles}`)
  check('logo without "eForms" text', a11y.noLogoText)
  check('undo/redo disabled with empty history', await page.locator('[data-hdr=undo]').isDisabled() && await page.locator('[data-hdr=redo]').isDisabled())

  step = '1 tooltip'
  await page.locator('[data-hdr=preview]').hover()
  let tip = await tooltipText(page)
  check('hover tooltip', tip?.text === 'Xem trước' && tip.dark, tip)
  await page.mouse.move(640, 700)
  await page.waitForTimeout(150)
  check('tooltip hides on mouse leave', (await page.locator('[role=tooltip]').count()) === 0)
  await page.locator('[data-hdr=undo]').hover()
  tip = await tooltipText(page)
  check('tooltip on disabled undo', tip?.text === 'Hoàn tác', tip)
  await page.mouse.move(640, 700)
  await page.locator('[data-hdr=theme]').focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  tip = await tooltipText(page)
  check('keyboard focus tooltip', tip?.text === 'Tùy chỉnh giao diện', tip)
  await page.keyboard.press('Escape')
  await page.locator('.eforms-question').first().click()

  // 2. Title sync + tabs keep state without refetching the form.
  step = '2 tabs'
  const headerTitle = page.locator('[data-hdr=title] input')
  await headerTitle.fill('E2E tiêu đề mới')
  check('header title -> title card', (await page.locator('.eforms-title').innerText()) === 'E2E tiêu đề mới')
  check('save indicator pending', ['pending', 'saving'].includes(await page.locator('[data-hdr=save-indicator]').getAttribute('data-state')))
  formGets = 0
  await page.locator('[data-tab=responses]').click()
  await page.waitForURL(/\/responses$/)
  await page.getByRole('heading', { name: /câu trả lời/ }).waitFor()
  check('responses tab active', (await page.locator('[data-tab=responses]').getAttribute('aria-current')) === 'page')
  await page.locator('[data-tab=settings]').click()
  await page.waitForURL(/\/settings$/)
  await page.locator('[data-settings-tab]').waitFor()
  await shot(page.locator('[data-editor-header]'), 'header-desktop')
  await page.locator('[data-tab=edit]').click()
  await page.waitForURL(/\/edit$/)
  await page.locator('.eforms-question').first().waitFor()
  check('no GET /forms/{id} while switching tabs', formGets === 0, `${formGets} requests`)
  check('title survives tab switch', (await headerTitle.inputValue()) === 'E2E tiêu đề mới' && (await page.locator('.eforms-title').innerText()) === 'E2E tiêu đề mới')

  await page.locator('[data-hdr=save-indicator][data-state=saved]').waitFor({ timeout: 8000 }).catch(() => {})
  check('save indicator saved', (await page.locator('[data-hdr=save-indicator]').getAttribute('data-state')) === 'saved')
  check('title saved on server', (await serverForm()).title === 'E2E tiêu đề mới')

  await page.locator('.eforms-title').click()
  await page.locator('.eforms-title-input').fill('Tiêu đề từ thẻ')
  await page.keyboard.press('Enter')
  check('title card -> header title', (await headerTitle.inputValue()) === 'Tiêu đề từ thẻ')

  // 3. Publish button, popover, status badge, ⋮ menu, copy link.
  step = '3 publish'
  await page.locator('[data-hdr=copy-link]').click()
  const notPublished = page.locator('[role=status]', { hasText: 'Biểu mẫu chưa được xuất bản' })
  await notPublished.waitFor({ timeout: 3000 }).catch(() => {})
  check('copy link on draft -> toast with Xuất bản', (await notPublished.count()) > 0 && (await notPublished.getByRole('button', { name: 'Xuất bản' }).count()) === 1)
  check('draft badge', (await page.locator('[data-hdr=status]').getAttribute('data-status')) === 'draft' && (await page.locator('[data-hdr=status]').innerText()) === 'Bản nháp')
  check('publish button label', (await page.locator('[data-hdr=publish]').innerText()) === 'Xuất bản')
  let wait = statusPut(page, 'published')
  await page.locator('[data-hdr=publish]').click()
  check('publish request', (await wait).status() === 200)
  await page.locator('[data-hdr=status][data-status=published]').waitFor({ timeout: 5000 })
  const afterPublish = await serverForm()
  check('published on server (pending title saved first)', afterPublish.status === 'published' && afterPublish.title === 'Tiêu đề từ thẻ', { status: afterPublish.status, title: afterPublish.title })
  check('badge "Đang nhận câu trả lời"', (await page.locator('[data-hdr=status]').innerText()) === 'Đang nhận câu trả lời')
  check('button "Đã xuất bản"', (await page.locator('[data-hdr=publish]').innerText()) === 'Đã xuất bản')
  await page.locator('[data-hdr=publish]').click()
  const toggle = page.locator('[data-publish-popover] [role=switch]')
  check('popover toggle on', (await toggle.getAttribute('aria-checked')) === 'true')
  wait = statusPut(page, 'closed')
  await toggle.click()
  await wait
  await page.locator('[data-hdr=status][data-status=closed]').waitFor({ timeout: 5000 })
  check('toggle -> closed', (await serverForm()).status === 'closed' && (await page.locator('[data-hdr=status]').innerText()) === 'Không nhận câu trả lời')
  wait = statusPut(page, 'published')
  await toggle.click()
  await wait
  await page.locator('[data-hdr=status][data-status=published]').waitFor({ timeout: 5000 })
  check('toggle -> published again', (await serverForm()).status === 'published')
  await page.locator('[data-publish-popover]').getByRole('button', { name: 'Sao chép liên kết' }).click()
  await page.waitForTimeout(300)
  const clip = await page.evaluate(() => window.__copied)
  check('copy link from popover', clip === `${APP}/f/${afterPublish.slug}`, clip)
  await page.locator('[data-hdr=publish]').click()
  wait = statusPut(page, 'draft')
  await page.locator('[data-publish-popover]').getByRole('button', { name: 'Hủy xuất bản' }).click()
  await wait
  await page.locator('[data-hdr=status][data-status=draft]').waitFor({ timeout: 5000 })
  check('unpublish from popover', (await serverForm()).status === 'draft')
  const ownerMenu = await menuItems(page)
  check('⋮ menu = Nhân bản, Xóa (no Hủy xuất bản)', eq(ownerMenu.map((i) => i.text), ['Nhân bản', 'Xóa']), ownerMenu)

  // 4. Theme panel + share dialog.
  step = '4 theme/share'
  await page.locator('[data-hdr=theme]').click()
  await page.getByRole('heading', { name: 'Giao Diện' }).waitFor()
  await page.waitForTimeout(300)
  check('opening theme is not a change', (await page.locator('[data-hdr=save-indicator]').getAttribute('data-state')) === 'saved' && (await page.locator('[data-hdr=undo]').getAttribute('aria-label')) === 'Hoàn tác')
  await page.mouse.click(200, 600)
  await page.getByRole('heading', { name: 'Giao Diện' }).waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
  check('theme panel closes', (await page.getByRole('heading', { name: 'Giao Diện' }).count()) === 0)
  await page.locator('[data-hdr=share]').click()
  await page.locator('[data-share-dialog] li').nth(1).waitFor({ timeout: 5000 }).catch(() => {})
  check('share dialog lists owner + viewer', (await page.locator('[data-share-dialog] li').count()) === 2)
  await page.getByRole('button', { name: 'Xong' }).click()

  // 5. /forms/create makes exactly one draft and opens it.
  step = '5 create'
  let posts = 0
  page.on('request', (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/forms' && posts++)
  await page.goto(`${APP}/forms/create`)
  await page.waitForURL(/\/forms\/\d+\/edit$/, { timeout: 10000 })
  createdIds.push(Number(page.url().match(/forms\/(\d+)\/edit/)[1]))
  await page.locator('[data-hdr=title] input').waitFor()
  await page.waitForTimeout(800)
  check('create -> one draft', posts === 1, `${posts} POST /forms`)
  check('new draft title', (await page.locator('[data-hdr=title] input').inputValue()) === 'Biểu mẫu không có tiêu đề')

  // 6. Mobile 390px.
  step = '6 mobile'
  const mobile = await openPage(owner, { width: 390, height: 844 }, 'mobile')
  await mobile.goto(`${APP}/forms/${form.id}/edit`)
  await mobile.locator('.eforms-question').first().waitFor()
  state = await headerState(mobile)
  check('mobile visible order', eq(visibleOrder(state), ['logo', 'title', 'save-indicator', 'undo', 'redo', 'publish', 'more']), visibleOrder(state))
  check('mobile left-to-right', xIncreasing(state), state)
  check('mobile title has room', (state.find((s) => s.hdr === 'title')?.w || 0) >= 48, state.find((s) => s.hdr === 'title'))
  const overflow = await mobile.evaluate(() => {
    const row = document.querySelector('[data-editor-header] > div')
    const tabs = [...document.querySelectorAll('[data-tab]')].map((t) => t.getBoundingClientRect().right)
    return { doc: document.documentElement.scrollWidth, row: row.scrollWidth - row.clientWidth, tabsRight: Math.max(...tabs) }
  })
  check('mobile no horizontal overflow', overflow.doc <= 390 && overflow.row <= 0 && overflow.tabsRight <= 390, overflow)
  const mobileMenu = (await menuItems(mobile)).map((i) => i.key)
  check('mobile ⋮ holds moved items', ['theme', 'preview', 'copy-link', 'share', 'duplicate', 'delete', 'profile', 'password', 'logout'].every((k) => mobileMenu.includes(k)), mobileMenu)
  await shot(mobile.locator('[data-editor-header]'), 'header-mobile')

  // 7. Viewer, then editor.
  step = '7 viewer'
  const vp = await openPage(viewer, undefined, 'viewer')
  await vp.goto(`${APP}/forms/${form.id}/edit`)
  await vp.locator('.eforms-question').first().waitFor()
  state = await headerState(vp)
  check('viewer visible order', eq(visibleOrder(state), ['logo', 'title', 'status', 'readonly', 'preview', 'copy-link', 'share', 'more', 'user']), visibleOrder(state))
  check('viewer "Chỉ xem" label', (await vp.locator('[data-hdr=readonly]').innerText()) === 'Chỉ xem')
  check('viewer title not editable', (await vp.locator('[data-hdr=title] input').count()) === 0)
  check('viewer builder inert, no sidebar', (await vp.locator('.eforms-main[inert]').count()) === 1 && (await vp.locator('.eforms-sidebar').count()) === 0)
  const viewerMenu = await menuItems(vp)
  check('viewer ⋮ = Nhân bản only', eq(viewerMenu.map((i) => i.text), ['Nhân bản']), viewerMenu)
  await vp.locator('[data-tab=settings]').click()
  await vp.locator('[data-settings-tab]').waitFor()
  check('viewer settings read-only', (await vp.locator('[data-settings-tab] fieldset[disabled]').count()) === 1 && (await vp.getByRole('button', { name: 'Lưu Cài Đặt' }).count()) === 0)
  await vp.locator('[data-tab=responses]').click()
  await vp.getByRole('heading', { name: /câu trả lời/ }).waitFor()

  step = '7 editor'
  const patch = await api('PATCH', `/forms/${form.id}/collaborators/${viewerId}`, { role: 'editor' })
  check('role -> editor via API', patch.status === 200, patch.data)
  await vp.goto(`${APP}/forms/${form.id}/edit`)
  await vp.locator('.eforms-question').first().waitFor()
  state = await headerState(vp)
  check('editor visible order', eq(visibleOrder(state), ['logo', 'title', 'status', 'save-indicator', 'theme', 'preview', 'undo', 'redo', 'copy-link', 'share', 'publish', 'more', 'user']), visibleOrder(state))
  const editorMenu = await menuItems(vp)
  check('editor ⋮ has no Xóa', eq(editorMenu.map((i) => i.text), ['Nhân bản']), editorMenu)
} catch (e) {
  check('script ran to completion', false, `step ${step}: ${e.message.split('\n')[0]}`)
  await page?.screenshot({ path: join(OUT, 'e2e-editor-header-failure.png') }).catch(() => {})
} finally {
  step = 'end'
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '))
  for (const c of contexts) await c.close().catch(() => {})
  await browser.close()
  if (!KEEP) {
    await api('DELETE', `/forms/${form.id}`)
    for (const id of createdIds) await api('DELETE', `/forms/${id}`)
  }
  execFileSync(PHP, [join(ROOT, 'mint-token.php'), '1', '--revoke'])
  execFileSync(PHP, [join(ROOT, 'mint-token.php'), String(viewerId), '--revoke'])
}

writeFileSync(join(OUT, 'e2e-editor-header.json'), JSON.stringify({ form: form.id, results, pageErrors }, null, 2))
const failed = results.filter((r) => !r.ok)
for (const r of failed) console.log(`FAIL [${r.step}] ${r.name}${r.detail ? `  — ${r.detail.slice(0, 300)}` : ''}`)
console.log(`${results.length - failed.length}/${results.length} checks passed${KEEP ? ` (form ${form.id} kept)` : ''}`)
process.exit(failed.length ? 1 : 0)
