// Headless check of the share dialog, invite page, invite registration/login and the shared forms list (plan phase 6).
// Run: node tools/e2e-share.mjs [--keep]
// Needs: frontend dev server on http://eforms.test:5173, backend on http://eforms.test, local Chrome.
// Prints failures only + a one-line total; details go to tools/out/e2e-share.json (+ screenshots on failure).
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

const NO_MAIL = 'Chưa cấu hình email – hãy sao chép link mời để gửi'
const FORCED = 'Đang bật vì "Giới hạn mỗi người trả lời" dùng căn cứ Tài khoản đăng nhập'
const PASSWORD = 'e2e-share-pass-123'
const STAMP = Date.now().toString(36)

const results = []
let step = 'start'
const check = (name, ok, detail = '') => results.push({ step, name, ok: !!ok, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) })

const php = (...args) => JSON.parse(execFileSync(PHP, args.map(String)).toString())
const fixture = (...args) => php(join(ROOT, 'share-fixture.php'), ...args)
const owner = php(join(ROOT, 'mint-token.php'), 1)
const userB = fixture('user', 'e2e-share-b@eforms.test', 'Qwzy Người Nhận', PASSWORD)
const userD = fixture('user', 'e2e-share-d@eforms.test', 'E2E Share D', PASSWORD)
const tokB = php(join(ROOT, 'mint-token.php'), userB.id)
const tokD = php(join(ROOT, 'mint-token.php'), userD.id)
const NEW_EMAIL = `e2e-share-new-${STAMP}@eforms.test`
const LATE_EMAIL = `e2e-share-late-${STAMP}@eforms.test`
const WRONG_EMAIL = `e2e-share-wrong-${STAMP}@eforms.test`
const EXP_EMAIL = `e2e-share-exp-${STAMP}@eforms.test`

const api = async (method, path, body, who = owner) => {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${who.token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, data: text } }
}
const collaborators = async () => (await api('GET', `/forms/${form.id}/collaborators`)).data

const form = (await api('POST', '/forms', { title: 'E2E chia sẻ' })).data.form
await api('POST', `/forms/${form.id}/fields/bulk-update`, { fields: [{ type: 'short_text', label: 'Họ tên', order: 0, is_required: false }] })
const published = (await api('PUT', `/forms/${form.id}`, { status: 'published', is_public: true })).data.form

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const pageErrors = []
const httpErrors = [] // expected ones too (410 used link, 422 last owner…): context for failures
const contexts = []

async function newContext(who, name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  contexts.push(context)
  if (who) {
    await context.addInitScript(({ token, user }) => {
      // Only on the first load: a logout in the page must stick across navigations. (Opaque frames: no storage.)
      try {
        if (!sessionStorage.getItem('e2e-init')) {
          sessionStorage.setItem('e2e-init', '1')
          localStorage.setItem('token', token)
          localStorage.setItem('user', JSON.stringify(user))
        }
      } catch { /* about:blank / sandboxed frame */ }
    }, who)
  }
  context.on('page', (page) => watch(page, name))
  return context
}
function watch(page, name) {
  page.on('pageerror', (e) => pageErrors.push(`[${name}] ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && pageErrors.push(`[${name}] ${m.text()}`))
  page.on('response', (r) => {
    if (r.status() >= 500) pageErrors.push(`[${name}] ${r.status()} ${r.request().method()} ${r.url()}`)
    else if (r.status() >= 400) httpErrors.push(`[${name}] ${r.status()} ${r.request().method()} ${r.url()}`)
  })
  page.on('dialog', (d) => d.accept())
}
const until = async (fn, timeout = 6000) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await fn().catch(() => false)) return Date.now() - start
    await new Promise((r) => setTimeout(r, 150))
  }
  return null
}
const visible = (locator, timeout = 5000) => locator.first().waitFor({ state: 'visible', timeout }).then(() => true, () => false)
const gone = (locator, timeout = 5000) => locator.first().waitFor({ state: 'detached', timeout }).then(() => true, () => false)
const pathOf = (page) => new URL(page.url()).pathname
const openEditor = async (page) => {
  await page.goto(`${APP}/forms/${form.id}/edit`)
  await page.locator('[data-hdr=share]').waitFor({ timeout: 15000 })
}
const dialog = (page) => page.locator('[data-share-dialog]')
const openShare = async (page) => {
  await page.locator('[data-hdr=share]').click()
  await dialog(page).waitFor()
  await dialog(page).locator('[data-collaborators] li').first().waitFor()
}
const row = (page, email) => dialog(page).locator(`[data-collaborator="${email}"]`)
const typeQuery = async (page, text) => {
  const input = dialog(page).locator('[data-share-input]')
  await input.fill('')
  await input.pressSequentially(text, { delay: 30 })
}
const toastText = (page, text, timeout = 4000) => visible(page.locator('[role=status]', { hasText: text }), timeout)

let O, OB, B, L
try {
  step = 'setup'
  const ctxO = await newContext(owner, 'owner')
  // Headless Chrome refuses clipboard permissions here: record what the app writes instead.
  await ctxO.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__clip = t }, readText: async () => window.__clip || '' } })
  })
  O = await ctxO.newPage()
  await openEditor(O)
  const ctxB = await newContext(tokB, 'B')
  B = await ctxB.newPage()

  // ---------------------------------------------------------------- dialog basics
  step = 'dialog'
  await openShare(O)
  const dlg = await dialog(O).evaluate((el) => ({ role: el.getAttribute('role'), modal: el.getAttribute('aria-modal'), labelled: !!document.getElementById(el.getAttribute('aria-labelledby'))?.textContent }))
  check('role=dialog, aria-modal, labelled', dlg.role === 'dialog' && dlg.modal === 'true' && dlg.labelled, dlg)
  check('focus starts in the add-people input', await O.evaluate(() => document.activeElement?.hasAttribute('data-share-input')))
  await dialog(O).locator('[data-share-done]').focus()
  await O.keyboard.press('Tab')
  check('Tab wraps inside the dialog', await O.evaluate(() => !!document.activeElement?.closest('[data-share-dialog]')))
  check('input has an accessible label', await dialog(O).locator('[data-share-input]').evaluate((el) => !!el.labels?.[0]?.textContent))
  check('owner row "(bạn)" + last-owner lock', (await row(O, owner.user.email).innerText()).includes('(bạn)') && await visible(row(O, owner.user.email).locator('[data-last-owner]'), 1000))
  const ownOptions = await row(O, owner.user.email).locator('[data-role-select] option').evaluateAll((os) => os.filter((o) => o.value && !o.disabled).map((o) => o.value))
  check('last owner: only "Chủ sở hữu" selectable', JSON.stringify(ownOptions) === '["owner"]', ownOptions)

  // ---------------------------------------------------------------- invite existing user
  step = 'invite-existing-user'
  await typeQuery(O, 'Qw')
  await O.waitForTimeout(700)
  check('no suggestions under 3 characters', (await dialog(O).locator('[data-suggestion]').count()) === 0)
  await typeQuery(O, 'Qwz')
  const suggestB = dialog(O).locator(`[data-suggestion="${userB.email}"]`)
  check('suggestion appears from 3 characters', await visible(suggestB, 4000))
  check('at most 8 suggestions', (await dialog(O).locator('[data-suggestion]').count()) <= 8)
  await suggestB.click()
  check('recipient chip', await visible(dialog(O).locator(`[data-recipient="${userB.email}"]`), 1000))
  const roleChoices = await dialog(O).locator('[data-share-role] option').evaluateAll((os) => os.map((o) => o.value))
  check('owner can pick every role', JSON.stringify(roleChoices) === '["owner","editor","viewer"]', roleChoices)
  await dialog(O).locator('[data-share-role]').selectOption('editor')
  await dialog(O).locator('[data-share-notify]').uncheck()
  await dialog(O).locator('[data-share-send]').click()
  check('B listed as editor', await visible(dialog(O).locator(`[data-collaborator="${userB.email}"][data-role=editor]`)))
  await typeQuery(O, 'Qwz')
  await O.waitForTimeout(900)
  check('people with access are not suggested', (await dialog(O).locator(`[data-suggestion="${userB.email}"]`).count()) === 0)
  await typeQuery(O, '')

  // ---------------------------------------------------------------- form list filters
  step = 'form-list'
  await B.goto(`${APP}/forms?filter=shared`)
  const cardB = B.locator(`[data-form-card="${form.id}"]`)
  check('B: form under "Được chia sẻ"', await visible(cardB, 10000))
  if (await cardB.count()) {
    check('B: card shows owner name', (await cardB.locator('[data-owner]').innerText()).includes(owner.user.name), await cardB.locator('[data-owner]').innerText())
    check('B: card shows my role', (await cardB.locator('[data-role-badge]').innerText()).includes('Người chỉnh sửa'))
    check('B: share icon', (await cardB.locator('[data-shared-icon]').count()) === 1)
    await cardB.locator('button[title="Tùy chọn"]').click()
    check('B: no delete for non-owner', (await cardB.locator('[data-card-action=delete]').count()) === 0)
  }
  await B.locator('[data-filter=mine]').click()
  check('B: not under "Của tôi"', await gone(B.locator(`[data-form-card="${form.id}"]`)))
  await B.locator('[data-filter=all]').click()
  check('B: listed under "Tất cả"', await visible(B.locator(`[data-form-card="${form.id}"]`)))
  OB = await ctxO.newPage()
  await OB.goto(`${APP}/forms?filter=mine`)
  const cardO = OB.locator(`[data-form-card="${form.id}"]`)
  check('owner: under "Của tôi" with share icon + role', await visible(cardO, 10000) && (await cardO.locator('[data-shared-icon]').count()) === 1 && (await cardO.locator('[data-role-badge]').innerText()).includes('Chủ sở hữu'))
  await OB.locator('[data-filter=shared]').click()
  check('owner: not under "Được chia sẻ"', await gone(OB.locator(`[data-form-card="${form.id}"]`)))
  await OB.close()

  // ---------------------------------------------------------------- invite a new email → register
  step = 'invite-new-email'
  await typeQuery(O, NEW_EMAIL)
  const inviteOpt = dialog(O).locator('[data-suggestion=invite]')
  check('"Mời <email>" option', await visible(inviteOpt, 4000) && (await inviteOpt.innerText()).includes(`Mời ${NEW_EMAIL}`))
  await inviteOpt.click()
  await dialog(O).locator('[data-share-role]').selectOption('viewer')
  await dialog(O).locator('[data-share-send]').click()
  const linkBox = dialog(O).locator(`[data-invite-link="${NEW_EMAIL}"] [data-invite-url]`)
  check('invite link shown after creating', await visible(linkBox))
  const newUrl = await linkBox.inputValue().catch(() => '')
  check('invite link is /invite/<token>', newUrl.startsWith(`${APP}/invite/`), newUrl)
  check('no-mail notice', (await dialog(O).locator('[data-invite-links] [data-no-mail]').innerText().catch(() => '')).includes(NO_MAIL))
  check('pending invitation listed', (await dialog(O).locator(`[data-invitation="${NEW_EMAIL}"]`).innerText().catch(() => '')).includes('Người xem'))

  const ctxN = await newContext(null, 'new')
  const N = await ctxN.newPage()
  await N.goto(newUrl)
  check('logged out → Register', !!(await until(async () => pathOf(N) === '/register', 8000)), N.url())
  const regEmail = N.locator('#register-email')
  await until(async () => (await regEmail.inputValue()) === NEW_EMAIL, 5000)
  check('email prefilled + locked', (await regEmail.inputValue()) === NEW_EMAIL && (await regEmail.getAttribute('readonly')) !== null)
  check('invite banner', await visible(N.locator('[data-invite-banner]'), 2000))
  await N.locator('#register-name').fill('E2E Người Mới')
  await N.locator('#register-password').fill(PASSWORD)
  await N.locator('#register-password-confirmation').fill(PASSWORD)
  await N.locator('button[type=submit]').click()
  check('registered → lands in the form', !!(await until(async () => pathOf(N) === `/forms/${form.id}/edit`, 10000)), N.url())
  check('viewer role → read-only header', await visible(N.locator('[data-hdr=readonly]'), 10000))
  await N.goto(newUrl)
  check('used link → "used" message', await visible(N.locator('[data-invite-error=used]'), 8000))
  await ctxN.close()

  // ---------------------------------------------------------------- invitation for an email that has an account by now → login
  step = 'invite-login'
  const late = await api('POST', `/forms/${form.id}/collaborators`, { email: LATE_EMAIL, role: 'editor', notify: false })
  fixture('user', LATE_EMAIL, 'E2E Late Editor', PASSWORD)
  const ctxL = await newContext(null, 'late')
  L = await ctxL.newPage()
  await L.goto(late.data.invite_url)
  check('has account → Login', !!(await until(async () => pathOf(L) === '/login', 8000)), L.url())
  await until(async () => (await L.locator('#login-email').inputValue()) === LATE_EMAIL, 4000)
  check('login email prefilled', (await L.locator('#login-email').inputValue()) === LATE_EMAIL)
  await L.locator('#login-password').fill(PASSWORD)
  await L.locator('button[type=submit]').click()
  check('logged in → lands in the form', !!(await until(async () => pathOf(L) === `/forms/${form.id}/edit`, 10000)), L.url())
  check('editor role → editable header', await visible(L.locator('[data-hdr=undo]'), 10000) && (await L.locator('[data-hdr=readonly]').count()) === 0)

  // ---------------------------------------------------------------- wrong account, expired, invalid
  step = 'invite-errors'
  const wrong = await api('POST', `/forms/${form.id}/collaborators`, { email: WRONG_EMAIL, role: 'viewer', notify: false })
  const ctxD = await newContext(tokD, 'D')
  const D = await ctxD.newPage()
  await D.goto(wrong.data.invite_url)
  const wrongBox = D.locator('[data-invite-wrong]')
  check('wrong account message', await visible(wrongBox, 8000) && (await wrongBox.innerText()).includes(`Lời mời gửi tới ${WRONG_EMAIL}`))
  await D.locator('[data-invite-logout]').click()
  check('logout → Register with the invited email', !!(await until(async () => pathOf(D) === '/register' && (await D.locator('#register-email').inputValue()) === WRONG_EMAIL, 8000)), D.url())
  await ctxD.close()
  const exp = await api('POST', `/forms/${form.id}/collaborators`, { email: EXP_EMAIL, role: 'viewer', notify: false })
  fixture('expire-invitation', exp.data.invitation.id)
  const ctxX = await newContext(null, 'anon')
  const X = await ctxX.newPage()
  await X.goto(exp.data.invite_url)
  check('expired link message', await visible(X.locator('[data-invite-error=expired]'), 8000))
  await X.goto(`${APP}/invite/not-a-real-token-${STAMP}`)
  check('invalid link message', await visible(X.locator('[data-invite-error=invalid]'), 8000))
  await ctxX.close()

  // ---------------------------------------------------------------- pending invitation actions
  step = 'pending-invitations'
  await dialog(O).locator('[data-share-done]').click()
  await openShare(O)
  const expRow = dialog(O).locator(`[data-invitation="${EXP_EMAIL}"]`)
  check('expired invitation marked', (await expRow.innerText().catch(() => '')).includes('Đã hết hạn'))
  await expRow.locator('[data-invite-action=link]').click()
  check('copy invite link toast warns old link', await toastText(O, 'Link mời trước đó không còn dùng được'))
  const renewed = await dialog(O).locator(`[data-invite-link="${EXP_EMAIL}"] [data-invite-url]`).inputValue().catch(() => '')
  check('renewed link differs and is copied', renewed && renewed !== exp.data.invite_url && (await O.evaluate(() => navigator.clipboard.readText())) === renewed)
  check('renewed invitation no longer expired', await until(async () => !(await expRow.innerText()).includes('Đã hết hạn'), 4000) !== null)
  const oldLink = await api('GET', `/invitations/${exp.data.invite_url.split('/invite/')[1]}`)
  check('old link stops working', oldLink.status === 404, oldLink.status)
  await expRow.locator('[data-invite-action=resend]').click()
  check('resend without mail → no-mail notice', await toastText(O, NO_MAIL))
  await dialog(O).screenshot({ path: join(OUT, 'e2e-share-dialog.png') }).catch(() => {})
  const wrongRow = dialog(O).locator(`[data-invitation="${WRONG_EMAIL}"]`)
  await wrongRow.locator('[data-invite-action=cancel]').click()
  check('cancel invitation', await gone(wrongRow))

  // ---------------------------------------------------------------- editor limits
  step = 'editor-limits'
  await openEditor(B)
  await openShare(B)
  check('B dialog role editor', (await dialog(B).getAttribute('data-my-role')) === 'editor')
  const ownerRowB = row(B, owner.user.email)
  check('editor: owner row locked', (await ownerRowB.locator('[data-locked]').count()) === 1 && (await ownerRowB.locator('[data-role-select]').count()) === 0)
  const bOwnOpts = await row(B, userB.email).locator('[data-role-select] option[value=owner]').evaluate((o) => o.disabled).catch(() => null)
  check('editor: cannot make owners', bOwnOpts === true)
  await dialog(B).locator('[data-share-input]').fill('x')
  await B.keyboard.press('Escape')
  check('Escape closes the dialog', await gone(dialog(B)))

  // ---------------------------------------------------------------- role change reaches the open editor
  step = 'role-change'
  await row(O, userB.email).locator('[data-role-select]').selectOption('viewer')
  check('B listed as viewer', await visible(dialog(O).locator(`[data-collaborator="${userB.email}"][data-role=viewer]`)))
  check('B header turns read-only live', await visible(B.locator('[data-hdr=readonly]'), 8000))

  step = 'viewer-dialog'
  await openShare(B)
  check('viewer: read-only notice', await visible(dialog(B).locator('[data-share-readonly]'), 2000))
  check('viewer: no add input / role selects / invitations', (await dialog(B).locator('[data-share-input], [data-role-select], [data-invitations]').count()) === 0)
  check('viewer: general access disabled', await dialog(B).locator('[data-respondent-access]').isDisabled())
  check('viewer: can leave own row', (await row(B, userB.email).locator('[data-leave]').count()) === 1)
  await dialog(B).locator('[data-share-done]').click()

  // ---------------------------------------------------------------- remove access
  step = 'remove'
  await row(O, NEW_EMAIL).locator('[data-role-select]').selectOption('remove')
  check('removed from the list', await gone(row(O, NEW_EMAIL)))
  check('removed on the server', !(await collaborators()).collaborators.some((c) => c.email === NEW_EMAIL))

  // ---------------------------------------------------------------- last owner (server error in a race)
  step = 'last-owner'
  await api('POST', `/forms/${form.id}/collaborators`, { user_id: userD.id, role: 'owner', notify: false })
  await dialog(O).locator('[data-share-done]').click()
  await openShare(O)
  check('two owners: own row unlocked', (await row(O, owner.user.email).locator('[data-last-owner]').count()) === 0)
  const leaveD = await api('DELETE', `/forms/${form.id}/collaborators/${userD.id}`, null, tokD)
  check('D left (API)', leaveD.status === 200, leaveD)
  await row(O, owner.user.email).locator('[data-role-select]').selectOption('editor')
  const err = dialog(O).locator('[data-share-error]')
  check('server error shown', await visible(err, 5000) && (await err.innerText()).includes('ít nhất một chủ sở hữu'))
  check('still owner after refresh', await visible(dialog(O).locator(`[data-collaborator="${owner.user.email}"][data-role=owner] [data-last-owner]`), 4000))

  // ---------------------------------------------------------------- self-leave
  step = 'self-leave'
  await openShare(L)
  await row(L, LATE_EMAIL).locator('[data-role-select]').selectOption('remove')
  check('left → form list', !!(await until(async () => pathOf(L) === '/forms', 8000)), L.url())
  check('left on the server', !(await collaborators()).collaborators.some((c) => c.email === LATE_EMAIL))

  // ---------------------------------------------------------------- general access ↔ Settings tab
  step = 'general-access'
  const access = dialog(O).locator('[data-respondent-access]')
  check('respondents: anyone with the link', (await access.inputValue()) === 'anyone')
  const saved = O.waitForResponse((r) => r.url().endsWith(`/forms/${form.id}/ops`) && (r.request().postData() || '').includes('"require_login":true'), { timeout: 8000 }).catch(() => null)
  await access.selectOption('login')
  check('require_login saved via ops', !!(await saved))
  await dialog(O).locator('[data-share-done]').click()
  await O.locator('[data-tab=settings]').click()
  const loginBox = O.locator('[data-setting=require_login]')
  await loginBox.waitFor()
  check('Settings tab shows require_login on', await loginBox.isChecked())
  check('old "Chấp Nhận Phản Hồi" removed', (await O.getByText('Chấp Nhận Phản Hồi').count()) === 0)
  const savedOff = O.waitForResponse((r) => r.url().endsWith(`/forms/${form.id}/ops`) && (r.request().postData() || '').includes('"require_login":false'), { timeout: 8000 }).catch(() => null)
  await loginBox.uncheck()
  check('Settings change saved', !!(await savedOff))
  await openShare(O)
  check('dialog follows Settings tab', (await access.inputValue()) === 'anyone')
  await dialog(O).locator('[data-share-done]').click()
  await O.getByRole('checkbox', { name: /Giới Hạn Mỗi Người Trả Lời/ }).check()
  await O.getByRole('checkbox', { name: /Tài khoản đăng nhập/ }).check()
  check('Settings: account limit forces login', await until(async () => (await loginBox.isChecked()) && (await loginBox.isDisabled()), 4000) !== null)
  await openShare(O)
  check('dialog: forced "Yêu cầu đăng nhập" + disabled', (await access.inputValue()) === 'login' && (await access.isDisabled()))
  check('dialog: explains why', (await dialog(O).locator('[data-respondent-hint]').innerText()).includes(FORCED))

  // ---------------------------------------------------------------- copy responder link
  step = 'copy-link'
  await dialog(O).locator('[data-share-copy-link]').click()
  check('copy link toast', await toastText(O, 'Đã sao chép liên kết biểu mẫu!'))
  const clip = await O.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check('clipboard has the responder link', clip === `${APP}/f/${published.slug}`, clip)
  await dialog(O).locator('[data-share-done]').click()
} catch (error) {
  check('uncaught', false, `${error.message}\n${error.stack?.split('\n').slice(1, 4).join('\n')}`)
  for (const [name, p] of [['O', O], ['B', B], ['L', L]]) await p?.screenshot({ path: join(OUT, `e2e-share-${name}.png`) }).catch(() => {})
} finally {
  if (results.some((r) => !r.ok)) for (const [name, p] of [['O', O], ['B', B], ['L', L]]) await p?.screenshot({ path: join(OUT, `e2e-share-${name}.png`) }).catch(() => {})
  await browser.close()
  if (!KEEP) await api('DELETE', `/forms/${form.id}`)
  for (const email of [NEW_EMAIL, LATE_EMAIL]) fixture('delete-user', email)
  for (const id of [userB.id, userD.id]) execFileSync(PHP, [join(ROOT, 'mint-token.php'), String(id), '--revoke'])
}

writeFileSync(join(OUT, 'e2e-share.json'), JSON.stringify({ results, pageErrors, httpErrors }, null, 2))
const failed = results.filter((r) => !r.ok)
for (const f of failed) console.log(`FAIL [${f.step}] ${f.name}${f.detail ? ` :: ${f.detail.slice(0, 300)}` : ''}`)
if (pageErrors.length) console.log(`page errors: ${pageErrors.length} (see out/e2e-share.json)`)
console.log(`e2e-share: ${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
