// Headless check of the phase 7 UI polish: type selector only on the active question, deselect resets edit mode,
// viewer read-only (also after a live role change), tooltips/aria/Escape, mobile layout (390px, 768px).
// Run: node tools/e2e-polish.mjs [--keep] [--shots]
// Needs: frontend dev server on http://eforms.test:5173, backend on http://eforms.test, local Chrome.
// Prints failures only + a one-line total; details go to tools/out/e2e-polish.json.
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

const makeForm = async (title, fields) => {
  const form = (await api('POST', '/forms', { title })).data.form
  await api('POST', `/forms/${form.id}/fields/bulk-update`, { fields: fields.map((f, order) => ({ ...f, order })) })
  return form
}
const form = await makeForm('E2E polish', [
  { type: 'radio', label: 'Câu A', options: ['Một', 'Hai'] },
  { type: 'short_text', label: 'Câu B' },
])
const bannerForm = await makeForm('E2E polish banner', [
  { type: 'short_text', label: 'Câu sẽ xóa' },
  { type: 'short_text', label: 'Câu giữ lại' },
])
php(join(ROOT, 'add-response.php'), form.id, 2)
php(join(ROOT, 'add-response.php'), bannerForm.id, 1)
await api('PUT', `/forms/${form.id}`, { status: 'published', accept_responses: true })
const share = await api('POST', `/forms/${form.id}/collaborators`, { user_id: viewerId, role: 'editor', notify: false })

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const pageErrors = []
const contexts = []
const overflowDetails = {}

async function openPage(auth, viewport = { width: 1280, height: 900 }, label = 'owner') {
  const context = await browser.newContext({ viewport })
  contexts.push(context)
  const page = await context.newPage()
  page.on('pageerror', (e) => pageErrors.push(`${label}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && pageErrors.push(`${label}: ${m.text()}`))
  // The invite page with a made-up token answers 404 on purpose.
  page.on('response', (r) => r.status() >= 400 && !r.url().includes('/invitations/') && pageErrors.push(`${label}: ${r.status()} ${r.request().method()} ${r.url()}`))
  page.on('dialog', (d) => d.accept())
  await page.goto(APP + '/login')
  if (auth) {
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    }, auth)
  }
  return page
}

const card = (page, text) => page.locator('.eforms-question', { hasText: text })
const activate = (page, text) => card(page, text).click({ position: { x: 8, y: 8 } })
const selectorCount = (page) => page.locator('.eforms-type-selector').count()
const dropdownCount = (page) => page.locator('.eforms-type-dropdown').count()
const shot = async (locator, name) => SHOTS && locator.screenshot({ path: join(OUT, `polish-${name}.png`) })

/** Whole-page horizontal overflow plus the widest offenders (kept in the JSON for diagnosis). */
const overflow = (page) => page.evaluate(() => {
  const width = window.innerWidth
  const offenders = [...document.querySelectorAll('body *')]
    .filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.right > width + 1 && getComputedStyle(el).position !== 'fixed' && el.checkVisibility()
    })
    .slice(0, 5)
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} r=${Math.round(el.getBoundingClientRect().right)}`)
  return { ok: document.documentElement.scrollWidth <= width, scrollWidth: document.documentElement.scrollWidth, width, offenders }
})
const inViewport = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel)
  if (!el) return { ok: false, missing: true }
  const r = el.getBoundingClientRect()
  return { ok: r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight + 1, l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: window.innerWidth }
}, selector)
const headerState = (page) => page.evaluate(() => [...document.querySelectorAll('[data-editor-header] [data-hdr]')]
  .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.checkVisibility({ visibilityProperty: true }) })
  .map((el) => el.dataset.hdr))

/** Hovers each matching element and checks that its tooltip stays inside the viewport. */
async function tooltipsFit(page, selector) {
  const bad = []
  const handles = await page.locator(selector).all()
  for (const h of handles) {
    if (!(await h.isVisible())) continue
    await h.hover()
    const tip = page.locator('[role=tooltip]').first()
    const r = await tip.waitFor({ timeout: 1500 }).then(() => tip.evaluate((el) => {
      const b = el.getBoundingClientRect()
      return { text: el.textContent, ok: b.left >= 0 && b.right <= window.innerWidth && b.top >= 0 && b.bottom <= window.innerHeight }
    })).catch(() => ({ text: null, ok: false }))
    const name = await h.getAttribute('aria-label')
    if (!r.ok) bad.push(`${name}: ${r.text === null ? 'no tooltip' : 'outside viewport'}`)
    await page.mouse.move(1, 1)
  }
  return bad
}

let page
try {
  step = 'setup'
  check('collaborator added as editor', share.status === 201, share.data)

  // 1. Type selector only on the active question; outside click hides it and closes the dropdown.
  step = '1 type selector'
  page = await openPage(owner)
  await page.goto(`${APP}/forms/${form.id}/edit`)
  await card(page, 'Câu A').waitFor()
  check('no selector without an active question', (await selectorCount(page)) === 0)
  await activate(page, 'Câu A')
  check('selector only on the active question', (await selectorCount(page)) === 1 && (await card(page, 'Câu A').locator('.eforms-type-selector').count()) === 1)
  await card(page, 'Câu A').locator('.eforms-type-selector').click()
  check('dropdown opens', (await dropdownCount(page)) === 1)
  await page.keyboard.press('Escape')
  check('Escape closes dropdown, selector stays', (await dropdownCount(page)) === 0 && (await selectorCount(page)) === 1)
  await card(page, 'Câu A').locator('.eforms-type-selector').click()
  await page.mouse.click(40, 600)
  check('outside click hides selector and dropdown', (await selectorCount(page)) === 0 && (await dropdownCount(page)) === 0)
  await activate(page, 'Câu B')
  check('selector moves with the selection', (await selectorCount(page)) === 1 && (await card(page, 'Câu B').locator('.eforms-type-selector').count()) === 1)

  // 2. Deselecting resets the label edit mode.
  step = '2 edit mode'
  // While the label is an <input>, the card no longer contains the text "Câu A", so address it by position.
  const first = page.locator('.eforms-question').first()
  await activate(page, 'Câu A')
  await first.locator('div.eforms-question-input').click()
  check('label input opens on the active question', (await first.locator('input.eforms-question-input').count()) === 1)
  await page.mouse.click(40, 600)
  check('outside click leaves edit mode', (await page.locator('input.eforms-question-input').count()) === 0 && (await page.locator('.eforms-question.active').count()) === 0)
  await first.locator('div.eforms-question-input').click()
  check('re-selecting shows the label, not the input', (await first.locator('input.eforms-question-input').count()) === 0 && (await first.getAttribute('class')).includes('active'))
  await page.mouse.click(40, 600)

  // 3. No native titles; icon buttons have aria-label; tooltips fit; focus ring visible.
  step = '3 a11y'
  const titles = await page.evaluate(() => ({
    header: document.querySelectorAll('[data-editor-header] [title]').length,
    sidebar: document.querySelectorAll('.eforms-sidebar [title]').length,
    unnamed: [...document.querySelectorAll('[data-editor-header] button, [data-editor-header] a, .eforms-sidebar button')]
      .filter((b) => !b.getAttribute('aria-label') && !b.textContent.trim()).length,
  }))
  check('no native title in header/sidebar, all icon buttons named', titles.header === 0 && titles.sidebar === 0 && titles.unnamed === 0, titles)
  await activate(page, 'Câu A')
  const footerTitles = await card(page, 'Câu A').locator('.eforms-question-footer [title]').count()
  check('question footer buttons use Tooltip (no title)', footerTitles === 0 && (await card(page, 'Câu A').locator('button[aria-label="Xóa"]').count()) === 1, `${footerTitles} titles`)
  await page.mouse.click(40, 600)
  let bad = await tooltipsFit(page, '[data-editor-header] button[aria-label]:not([disabled])')
  check('desktop header tooltips inside viewport', bad.length === 0, bad)
  await page.mouse.click(40, 600)
  const rings = []
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab')
    const f = await page.evaluate(() => {
      const el = document.activeElement
      if (!el?.closest('[data-editor-header]')) return null
      const cs = getComputedStyle(el)
      return { name: el.getAttribute('aria-label') || el.dataset.hdr || el.textContent.trim().slice(0, 20), ring: cs.boxShadow !== 'none' || (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || (el.tagName === 'INPUT' && cs.borderBottomColor !== 'rgba(0, 0, 0, 0)') }
    })
    if (f) rings.push(f)
  }
  check('keyboard focus visible on header controls', rings.length >= 5 && rings.every((r) => r.ring), rings.filter((r) => !r.ring).map((r) => r.name).concat(`${rings.length} stops`))
  const focusTip = await page.locator('[role=tooltip]').count()
  check('keyboard focus shows a tooltip', focusTip >= 1 || rings.length === 0)

  // 4. Escape closes popovers and dialogs.
  step = '4 escape'
  const escCloses = async (name, open, openSel, focusSel) => {
    await open()
    const opened = await page.locator(openSel).first().waitFor({ timeout: 3000 }).then(() => true).catch(() => false)
    await page.keyboard.press('Escape')
    const closed = await page.locator(openSel).first().waitFor({ state: 'detached', timeout: 3000 }).then(() => true).catch(() => false)
    const focusBack = focusSel ? await page.evaluate((s) => document.activeElement?.matches(s), focusSel) : true
    check(`Escape closes ${name}`, opened && closed && focusBack, { opened, closed, focusBack })
  }
  await escCloses('⋮ menu', () => page.locator('[data-hdr=more]').click(), '[data-more-menu]', '[data-hdr=more]')
  await escCloses('publish popover', () => page.locator('[data-hdr=publish]').click(), '[data-publish-popover]', '[data-hdr=publish]')
  await escCloses('user menu', () => page.locator('[data-hdr=user]').click(), '[data-editor-header] [role=menu]')
  await escCloses('share dialog', () => page.locator('[data-hdr=share]').click(), '[role=dialog][aria-modal=true]', '[data-hdr=share]')
  await escCloses('theme panel', () => page.locator('[data-hdr=theme]').click(), '[data-theme-panel]')
  const dialogTitles = await (async () => {
    await page.locator('[data-hdr=share]').click()
    await page.locator('[role=dialog][aria-modal=true]').waitFor()
    await page.waitForTimeout(500)
    const n = await page.locator('[role=dialog][aria-modal=true] [title]').count()
    const unnamed = await page.locator('[role=dialog][aria-modal=true] button').evaluateAll((bs) => bs.filter((b) => !b.getAttribute('aria-label') && !b.textContent.trim()).length)
    await page.keyboard.press('Escape')
    return { n, unnamed }
  })()
  check('share dialog: no native title, icon buttons named', dialogTitles.n === 0 && dialogTitles.unnamed === 0, dialogTitles)

  // 5. Live role change editor -> viewer drops the selection, the type selector and the theme panel.
  step = '5 live viewer'
  const vp = await openPage(viewer, undefined, 'viewer')
  await vp.goto(`${APP}/forms/${form.id}/edit`)
  await card(vp, 'Câu A').waitFor()
  await activate(vp, 'Câu A')
  check('editor sees selector', (await selectorCount(vp)) === 1)
  await api('PATCH', `/forms/${form.id}/collaborators/${viewerId}`, { role: 'viewer' })
  await vp.locator('[data-hdr=readonly]').waitFor({ timeout: 10000 })
  check('after downgrade: no active card, no selector, no sidebar', (await vp.locator('.eforms-question.active').count()) === 0 && (await selectorCount(vp)) === 0 && (await vp.locator('.eforms-sidebar').count()) === 0)
  check('after downgrade: read-only note', (await vp.locator('[data-readonly-note]').count()) === 1)
  await api('PATCH', `/forms/${form.id}/collaborators/${viewerId}`, { role: 'editor' })
  await vp.locator('[data-hdr=theme]').waitFor({ timeout: 10000 })
  await vp.locator('[data-hdr=theme]').click()
  await vp.locator('[data-theme-panel]').waitFor()
  await api('PATCH', `/forms/${form.id}/collaborators/${viewerId}`, { role: 'viewer' })
  await vp.locator('[data-hdr=readonly]').waitFor({ timeout: 10000 })
  check('after downgrade: theme panel closed', (await vp.locator('[data-theme-panel]').count()) === 0)

  // 6. Viewer (fresh load): nothing editable.
  step = '6 viewer'
  await vp.reload()
  await card(vp, 'Câu A').waitFor()
  const box = await card(vp, 'Câu A').boundingBox()
  await vp.mouse.click(box.x + 20, box.y + 20)
  await vp.mouse.move(box.x + 40, box.y + 30)
  const ro = await vp.evaluate(() => {
    const main = document.querySelector('.eforms-main')
    const editable = [...main.querySelectorAll('input, textarea, select, [contenteditable=true]')]
      .filter((el) => !el.closest('[inert]') && !el.disabled && !el.readOnly)
    return {
      inert: main.hasAttribute('inert'),
      active: main.querySelectorAll('.eforms-question.active').length,
      selector: main.querySelectorAll('.eforms-type-selector').length,
      handles: main.querySelectorAll('[aria-label^="Di chuyển"], [aria-roledescription="sortable"]').length,
      editable: editable.length,
      titleInputs: main.querySelectorAll('.eforms-header input, .eforms-header [contenteditable=true]').length,
      hoverShadow: getComputedStyle(main.querySelector('.eforms-question')).boxShadow,
      cursor: getComputedStyle(main.querySelector('.eforms-question')).cursor,
      theme: !!document.querySelector('[data-hdr=theme], [data-theme-panel], .eforms-sidebar'),
    }
  })
  check('viewer: click does not select, no selector/handles', ro.inert && ro.active === 0 && ro.selector === 0 && ro.handles === 0, ro)
  check('viewer: no editable inputs (inert/readonly)', ro.editable === 0 && ro.titleInputs === 0, ro)
  check('viewer: no hover affordance', ro.hoverShadow === 'none' && ro.cursor === 'default', ro)
  check('viewer: no theme button/panel/sidebar', !ro.theme, ro)
  check('viewer: "Chỉ xem" + note', (await vp.locator('[data-hdr=readonly]').innerText()) === 'Chỉ xem' && (await vp.locator('[data-readonly-note]').count()) === 1)
  await vp.locator('[data-tab=settings]').click()
  await vp.locator('[data-settings-tab]').waitFor()
  check('viewer settings: disabled + explanation', (await vp.locator('[data-settings-tab] fieldset[disabled]').count()) === 1 && (await vp.locator('[data-settings-tab] [data-readonly-note]').count()) === 1)

  // 7. Mobile 390px and 768px: header items, popovers fit, no horizontal scroll on the main pages.
  for (const width of [390, 768]) {
    step = `7 mobile ${width}`
    const m = await openPage(owner, { width, height: 844 }, `m${width}`)
    await m.goto(`${APP}/forms/${form.id}/edit`)
    await card(m, 'Câu A').waitFor()
    await m.waitForTimeout(600)
    const hdr = (await headerState(m)).filter((h) => h !== 'presence')
    // < 768: mobile rules (§4.1); 768–1023: desktop set without the status badge (the publish button still shows it).
    const expected = width < 768
      ? ['logo', 'title', 'save-indicator', 'undo', 'redo', 'publish', 'more']
      : ['logo', 'title', 'save-indicator', 'theme', 'preview', 'undo', 'redo', 'copy-link', 'share', 'publish', 'more', 'user']
    check('header items per mobile rules', eq(hdr, expected), hdr)
    const row = await m.evaluate(() => {
      const r = document.querySelector('[data-editor-header] > div')
      const title = document.querySelector('[data-hdr=title]').getBoundingClientRect().width
      return { overflow: r.scrollWidth - r.clientWidth, title: Math.round(title) }
    })
    check('header row fits, title has room', row.overflow <= 0 && row.title >= 48, row)
    await activate(m, 'Câu A')
    let o = await overflow(m)
    overflowDetails[`edit-${width}`] = o
    check('editor (active question): no horizontal scroll', o.ok, o)
    await m.mouse.click(4, 400)
    bad = await tooltipsFit(m, '[data-editor-header] button[aria-label]:not([disabled]), .eforms-sidebar button')
    check('tooltips inside viewport (header + sidebar)', bad.length === 0, bad)

    await m.locator('[data-hdr=publish]').click()
    await m.locator('[data-publish-popover]').waitFor()
    let fit = await inViewport(m, '[data-publish-popover]')
    check('publish popover fits', fit.ok, fit)
    await m.keyboard.press('Escape')
    if (width < 768) {
      await m.locator('[data-hdr=more]').click()
      await m.locator('[data-menu=share]').click()
    } else {
      await m.locator('[data-hdr=share]').click()
    }
    await m.locator('[role=dialog][aria-modal=true]').waitFor()
    await m.waitForTimeout(600)
    fit = await inViewport(m, '[role=dialog][aria-modal=true]')
    check('share dialog fits', fit.ok, fit)
    o = await overflow(m)
    check('share dialog open: no horizontal scroll', o.ok, o)
    if (width === 390) await shot(m.locator('[role=dialog][aria-modal=true]'), 'share-390')
    await m.keyboard.press('Escape')

    for (const [name, path, ready] of [
      ['responses', `/forms/${form.id}/responses`, '[data-tab=responses][aria-current=page]'],
      ['settings', `/forms/${form.id}/settings`, '[data-settings-tab]'],
      ['form list', '/forms', 'main'],
    ]) {
      await m.goto(APP + path)
      await m.locator(ready).first().waitFor()
      await m.waitForTimeout(1200)
      o = await overflow(m)
      overflowDetails[`${name}-${width}`] = o
      check(`${name}: no horizontal scroll`, o.ok, o)
    }

    // Destructive banner on a form with responses.
    await m.goto(`${APP}/forms/${bannerForm.id}/edit`)
    await card(m, 'Câu sẽ xóa').waitFor()
    await activate(m, 'Câu sẽ xóa')
    await card(m, 'Câu sẽ xóa').locator('button[aria-label="Xóa"]').click()
    await m.locator('[data-destructive-banner]').waitFor({ timeout: 5000 })
    fit = await m.evaluate(() => {
      const b = document.querySelector('[data-destructive-banner]').getBoundingClientRect()
      const btns = [...document.querySelectorAll('[data-destructive-banner] button')].map((x) => x.getBoundingClientRect())
      return { ok: b.right <= window.innerWidth && btns.every((x) => x.left >= 0 && x.right <= window.innerWidth), h: Math.round(b.height) }
    })
    check('destructive banner wraps inside the screen', fit.ok, fit)
    o = await overflow(m)
    check('banner shown: no horizontal scroll', o.ok, o)
    if (width === 390) await shot(m.locator('[data-destructive-banner]'), 'banner-390')
    await m.locator('[data-banner=revert]').click()
    await card(m, 'Câu sẽ xóa').waitFor()

    // Logged-out pages.
    const anon = await openPage(null, { width, height: 844 }, `anon${width}`)
    for (const [name, path, ready] of [
      ['login', '/login', 'form'],
      ['register', '/register', 'form'],
      ['invite (bad token)', '/invite/not-a-real-token-for-e2e', '[data-invite-error]'],
    ]) {
      await anon.goto(APP + path)
      await anon.locator(ready).first().waitFor()
      await anon.waitForTimeout(600)
      o = await overflow(anon)
      overflowDetails[`${name}-${width}`] = o
      check(`${name}: no horizontal scroll`, o.ok, o)
    }
  }
} catch (e) {
  check('script ran to completion', false, `step ${step}: ${e.message.split('\n')[0]}`)
  await page?.screenshot({ path: join(OUT, 'e2e-polish-failure.png') }).catch(() => {})
} finally {
  step = 'end'
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '))
  for (const c of contexts) await c.close().catch(() => {})
  await browser.close()
  if (!KEEP) {
    await api('DELETE', `/forms/${form.id}`)
    await api('DELETE', `/forms/${bannerForm.id}`)
  }
  execFileSync(PHP, [join(ROOT, 'mint-token.php'), '1', '--revoke'])
  execFileSync(PHP, [join(ROOT, 'mint-token.php'), String(viewerId), '--revoke'])
}

writeFileSync(join(OUT, 'e2e-polish.json'), JSON.stringify({ form: form.id, results, overflowDetails, pageErrors }, null, 2))
const failed = results.filter((r) => !r.ok)
for (const r of failed) console.log(`FAIL [${r.step}] ${r.name}${r.detail ? `  — ${r.detail.slice(0, 300)}` : ''}`)
console.log(`${results.length - failed.length}/${results.length} checks passed${KEEP ? ` (forms ${form.id}, ${bannerForm.id} kept)` : ''}`)
process.exit(failed.length ? 1 : 0)
