// Headless check of "Sign in with Google" (docs/GOOGLE-LOGIN-PLAN.md §4, §6) using the fake verifier.
// Run: node tools/e2e-google-login.mjs [--keep]
// Needs: frontend dev server on http://localhost:5173 (VITE_GOOGLE_CLIENT_ID set), backend on http://eforms.test, local Chrome.
// Flips GOOGLE_FAKE_VERIFIER=true in backend/.env (+ config:cache) for the run and always restores false + config:clear.
// Prints one line per check + a total; details go to tools/out/e2e-google-login.json (+ screenshots on failure).
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const BACKEND = join(ROOT, '..', 'backend')
const ENV_FILE = join(BACKEND, '.env')
const PHP = 'D:\\wamp64\\bin\\php\\php8.3.14\\php.exe'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const APP = 'http://localhost:5173'
const API = 'http://eforms.test/api'
const KEEP = process.argv.includes('--keep')
const OUT = join(ROOT, 'out')
mkdirSync(OUT, { recursive: true })

const PASSWORD = 'e2e-google-pass-123'
const TS = Date.now()
const mail = (tag) => `e2e-google-${tag ? `${tag}-` : ''}${TS}@example.com`
const G1 = mail('')          // API: new Google-only user, later sets a password in the UI
const UNVERIFIED = mail('unv')
const P1 = mail('pw')        // password user that links Google
const G2 = mail('ui')        // UI login
const G3 = mail('inv')       // UI login through an invitation
const WRONG = mail('wrong')  // invitation addressed to someone else

const results = []
let step = 'start'
const check = (name, ok, detail = '') => results.push({ step, name, ok: !!ok, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) })

const php = (...args) => JSON.parse(execFileSync(PHP, args.map(String)).toString())
const fixture = (...args) => php(join(ROOT, 'share-fixture.php'), ...args)
const artisan = (...args) => execFileSync(PHP, [join(BACKEND, 'artisan'), ...args], { cwd: BACKEND }).toString().trim()
const setFakeVerifier = (on) => {
  const env = readFileSync(ENV_FILE, 'utf8')
  const next = env.replace(/^GOOGLE_FAKE_VERIFIER=.*$/m, `GOOGLE_FAKE_VERIFIER=${on}`)
  if (next !== env) writeFileSync(ENV_FILE, next)
  // Cached while on: mod_php (ZTS) re-reading .env under concurrent requests sometimes loses DB_CONNECTION → 500.
  artisan(on ? 'config:cache' : 'config:clear')
}
const fakeVerifierConfig = () => artisan('tinker', '--execute=echo json_encode(config("services.google.fake_verifier"));')

const request = async (method, path, body, token) => {
  const res = await fetch(API + path, {
    method,
    headers: { ...(token && { Authorization: `Bearer ${token}` }), Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, data: text.slice(0, 300) } }
}
// /auth/google is throttled at 10/min: wait out a 429 once instead of failing.
const google = async (credential) => {
  const res = await request('POST', '/auth/google', { credential })
  if (res.status !== 429) return res
  await new Promise((r) => setTimeout(r, 61000))
  return request('POST', '/auth/google', { credential })
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
const pathOf = (page) => new URL(page.url()).pathname

const pageErrors = []
const httpErrors = []
const pages = {}
const fiberMisses = []
let browser, owner, form

async function newPage(name, who) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  if (who) {
    await context.addInitScript(({ token, user }) => {
      try {
        if (!sessionStorage.getItem('e2e-init')) {
          sessionStorage.setItem('e2e-init', '1')
          localStorage.setItem('token', token)
          localStorage.setItem('user', JSON.stringify(user))
        }
      } catch { /* opaque frame */ }
    }, who)
  }
  const page = await context.newPage()
  page.on('pageerror', (e) => pageErrors.push(`[${name}] ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && pageErrors.push(`[${name}] ${m.text()}`))
  page.on('response', (r) => {
    if (r.status() >= 500) pageErrors.push(`[${name}] ${r.status()} ${r.request().method()} ${r.url()}`)
    else if (r.status() >= 400) httpErrors.push(`[${name}] ${r.status()} ${r.request().method()} ${r.url()}`)
  })
  pages[name] = page
  return page
}

/** Calls <GoogleLogin>'s onSuccess (found via the React fiber under [data-google-signin]): real googleLogin + navigate. */
async function signInWithButton(page, email) {
  await page.locator('[data-google-signin]').waitFor({ state: 'attached', timeout: 15000 })
  const found = await until(() => page.evaluate(() => {
    const el = document.querySelector('[data-google-signin]')
    const key = el && Object.keys(el).find((k) => k.startsWith('__reactFiber$'))
    if (!key) return false
    const stack = [el[key].child]
    while (stack.length) {
      const f = stack.pop()
      if (!f) continue
      if (typeof f.memoizedProps?.onSuccess === 'function') { window.__googleOnSuccess = f.memoizedProps.onSuccess; return true }
      stack.push(f.sibling, f.child)
    }
    return false
  }), 15000)
  if (found === null) {
    fiberMisses.push(await page.evaluate(() => {
      const el = document.querySelector('[data-google-signin]')
      const key = el && Object.keys(el).find((k) => k.startsWith('__reactFiber$'))
      return { url: location.href, el: !!el, key: !!key, html: el?.outerHTML.slice(0, 200) }
    }).catch((e) => e.message))
    // Fallback: store login, then reload so PublicRoute redirects.
    await page.evaluate(async (c) => {
      const { useAuthStore } = await import('/src/store/authStore.js')
      await useAuthStore.getState().googleLogin(c)
    }, `fake:${email}`)
    await page.reload()
    return 'store'
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = page.waitForResponse((r) => r.url().endsWith('/auth/google'), { timeout: 10000 }).catch(() => null)
    await page.evaluate((c) => { window.__googleOnSuccess({ credential: c }) }, `fake:${email}`)
    if ((await res)?.status() !== 429) break
    await page.waitForTimeout(61000)
  }
  return 'fiber'
}

const loggedInAs = (page, name) => visible(page.locator(`[aria-label="Tài khoản: ${name}"]`), 8000)
const localName = (email) => email.split('@')[0]

let exitCode = 1
try {
  step = 'setup'
  setFakeVerifier(true)
  check('fake verifier enabled', fakeVerifierConfig() === 'true', fakeVerifierConfig())
  owner = php(join(ROOT, 'mint-token.php'), 1)
  browser = await chromium.launch({ executablePath: CHROME, headless: true })

  // ---------------------------------------------------------------- 1. button + divider
  step = '1-render'
  const R = await newPage('render')
  for (const path of ['/login', '/register']) {
    await R.goto(APP + path)
    const btn = await R.locator('[data-google-signin]').waitFor({ state: 'attached', timeout: 15000 }).then(() => true, () => false)
    const divider = await visible(R.locator('span', { hasText: /^hoặc$/ }), 3000)
    check(`${path}: [data-google-signin] + "hoặc"`, btn && divider, { btn, divider })
  }
  await R.context().close()

  // ---------------------------------------------------------------- 2. API new user
  step = '2-api-new'
  const g1 = await google(`fake:${G1}`)
  const u1 = g1.data?.user || {}
  check('fake: new email → 200 + token', g1.status === 200 && !!g1.data?.token, g1.status)
  check('flags has_password:false, has_google:true; no google_id/password', u1.has_password === false && u1.has_google === true && !('google_id' in u1) && !('password' in u1), u1)

  // ---------------------------------------------------------------- 3. API repeat / unverified / garbage
  step = '3-api-edge'
  const g1b = await google(`fake:${G1}`)
  check('same token again → same user', g1b.status === 200 && g1b.data?.user?.id === u1.id, { status: g1b.status, id: g1b.data?.user?.id })
  const unv = await google(`fake-unverified:${UNVERIFIED}`)
  check('fake-unverified → 422 on credential', unv.status === 422 && !!unv.data?.errors?.credential, unv)
  const junk = await google('definitely-not-a-google-token')
  check('garbage token → 422', junk.status === 422, junk.status)

  // ---------------------------------------------------------------- 4. link a password account
  step = '4-api-link'
  const reg = await request('POST', '/register', { name: 'E2E Google PW', email: P1, password: PASSWORD, password_confirmation: PASSWORD })
  const gp = await google(`fake:${P1}`)
  check('register → Google same email → same id, both flags', reg.status < 300 && gp.status === 200 && gp.data.user.id === reg.data.user.id && gp.data.user.has_password === true && gp.data.user.has_google === true,
    { reg: reg.status, google: gp.status, user: gp.data?.user })

  // ---------------------------------------------------------------- 5. password login for Google-only user
  step = '5-api-pw-login'
  const pl = await request('POST', '/login', { email: G1, password: PASSWORD })
  check('password login Google-only → 422 + message', pl.status === 422 && !!pl.data?.errors?.email?.[0], pl)

  // ---------------------------------------------------------------- 6. UI login
  step = '6-ui-login'
  const L = await newPage('login')
  await L.goto(`${APP}/login`)
  const how = await signInWithButton(L, G2)
  check(`button handler (${how}) → /forms`, !!(await until(async () => pathOf(L) === '/forms', 10000)), L.url())
  check('header shows the user', await loggedInAs(L, localName(G2)) && !!(await L.evaluate(() => localStorage.getItem('token'))))

  // ---------------------------------------------------------------- 7. invitation
  step = '7-invite'
  form = (await request('POST', '/forms', { title: 'E2E Google login' }, owner.token)).data.form
  const inv = await request('POST', `/forms/${form.id}/collaborators`, { email: G3, role: 'editor', notify: false }, owner.token)
  const invToken = inv.data?.invite_url?.split('/invite/')[1]
  check('invitation created', inv.status < 300 && !!invToken, inv)
  const I = await newPage('invite')
  await I.goto(`${APP}/login?invite=${invToken}`)
  const howI = await signInWithButton(I, G3)
  check(`Google sign-in (${howI}) via invite → /forms/{id}/edit`, !!(await until(async () => pathOf(I) === `/forms/${form.id}/edit`, 12000)), I.url())
  const wrong = await request('POST', `/forms/${form.id}/collaborators`, { email: WRONG, role: 'viewer', notify: false }, owner.token)
  const wrongToken = wrong.data?.invite_url?.split('/invite/')[1]
  const W = await newPage('wrong')
  await W.goto(`${APP}/login?invite=${wrongToken}`)
  const howW = await signInWithButton(W, G2)
  const wrongBox = W.locator('[data-invite-wrong]')
  check(`other email (${howW}) → wrong-account message`, await visible(wrongBox, 10000) && (await wrongBox.innerText()).includes(WRONG), W.url())

  // ---------------------------------------------------------------- 8. set a first password
  step = '8-set-password'
  const C = await newPage('password', { token: g1.data.token, user: u1 })
  await C.goto(`${APP}/change-password`)
  const heading = C.locator('h1')
  await heading.waitFor({ timeout: 15000 })
  const submit = C.locator('form button[type=submit]')
  check('no current-password field', (await C.locator('input[name=currentPassword]').count()) === 0)
  check('heading + button say "Đặt mật khẩu"', (await heading.innerText()).includes('Đặt mật khẩu') && (await submit.innerText()).includes('Đặt mật khẩu'),
    { h1: await heading.innerText(), button: await submit.innerText() })
  await C.locator('input[name=newPassword]').fill(PASSWORD)
  await C.locator('input[name=confirmPassword]').fill(PASSWORD)
  await submit.click()
  check('submit → success toast', await visible(C.locator('[role=status]', { hasText: 'Đặt mật khẩu thành công' }), 6000))
  const after = await request('POST', '/login', { email: G1, password: PASSWORD })
  check('POST /api/login with new password → 200', after.status === 200, after.status)
} catch (error) {
  check('uncaught', false, `${error.message}\n${error.stack?.split('\n').slice(1, 4).join('\n')}`)
} finally {
  if (results.some((r) => !r.ok)) for (const [name, p] of Object.entries(pages)) await p.screenshot({ path: join(OUT, `e2e-google-${name}.png`) }).catch(() => {})
  await browser?.close().catch(() => {})
  try {
    if (form && !KEEP) await request('DELETE', `/forms/${form.id}`, null, owner.token)
    if (!KEEP) for (const email of [G1, UNVERIFIED, P1, G2, G3, WRONG]) fixture('delete-user', email)
    if (owner) execFileSync(PHP, [join(ROOT, 'mint-token.php'), String(owner.user.id), '--revoke'])
  } catch (e) { check('cleanup', false, e.message) }
  step = 'teardown'
  try { setFakeVerifier(false) } catch (e) { check('restore .env', false, e.message) }
  const restored = fakeVerifierConfig()
  check('fake verifier back to false, config not cached', restored === 'false' && /^GOOGLE_FAKE_VERIFIER=false$/m.test(readFileSync(ENV_FILE, 'utf8')) && !existsSync(join(BACKEND, 'bootstrap', 'cache', 'config.php')), restored)
}

writeFileSync(join(OUT, 'e2e-google-login.json'), JSON.stringify({ results, fiberMisses, pageErrors, httpErrors }, null, 2))
if (fiberMisses.length) console.log(`fiber lookup fell back to the store ${fiberMisses.length}x: ${JSON.stringify(fiberMisses).slice(0, 300)}`)
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.step}] ${r.name}${!r.ok && r.detail ? ` :: ${r.detail.slice(0, 300)}` : ''}`)
if (pageErrors.length) console.log(`page errors: ${pageErrors.length} (see out/e2e-google-login.json)`)
const failed = results.filter((r) => !r.ok)
console.log(`e2e-google-login: ${results.length - failed.length}/${results.length} passed`)
exitCode = failed.length ? 1 : 0
process.exit(exitCode)
