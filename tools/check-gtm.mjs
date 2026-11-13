// Usage: node tools/check-gtm.mjs <url> [url...] — opens each page in headless Chrome and reports the GTM tag count
// in the HTML, whether gtm.js loaded, Google Analytics hits (/g/collect) and the dataLayer events.
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
const rows = []
try {
  for (const url of process.argv.slice(2)) {
    const page = await browser.newPage()
    const hits = { gtm: 0, gtag: 0, collect: 0 }
    page.on('request', (r) => {
      const u = r.url()
      if (u.includes('googletagmanager.com/gtm.js')) hits.gtm++
      if (u.includes('googletagmanager.com/gtag/js')) hits.gtag++
      if (/google-analytics\.com\/.*\/collect|\/g\/collect/.test(u)) hits.collect++
    })
    const html = await (await fetch(url)).text()
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    const events = await page.evaluate(() => (window.dataLayer || []).map((e) => e.event || (e[0] ?? '?')).filter(Boolean).join(','))
    rows.push({ url: url.replace(/^https?:\/\/[^/]+/, '').slice(0, 40) || '/', tagsInHtml: (html.match(/GTM-[A-Z0-9]+/g) || []).length, ...hits, title: (await page.title()).slice(0, 30), dataLayer: events.slice(0, 60) })
    await page.close()
  }
} finally {
  await browser.close()
}
console.table(rows)
