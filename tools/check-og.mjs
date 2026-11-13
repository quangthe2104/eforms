// Usage: node tools/check-og.mjs <baseUrl> <slug> [slug...] — fetches /f/<slug> the way a link-preview bot does
// and prints the <title>, Open Graph tags and whether og:image is reachable.
const [base, ...slugs] = process.argv.slice(2)
const UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'

for (const slug of slugs) {
  const url = `${base.replace(/\/$/, '')}/f/${slug}`
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'manual' })
  const html = await res.text()
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1]
  const og = Object.fromEntries([...html.matchAll(/<meta (?:property|name)="((?:og|twitter):[a-z_]+|description)" content="([^"]*)"/g)].map((m) => [m[1], m[2]]))
  let image = ''
  if (og['og:image']) image = (await fetch(og['og:image'], { method: 'HEAD', headers: { 'User-Agent': UA } }).then((r) => `${r.status} ${r.headers.get('content-type')}`).catch((e) => e.message))
  console.log(`\n${res.status} ${url}\n  title: ${title}\n  app script: ${/assets\/index-[\w-]+\.js/.test(html)}`)
  for (const [k, v] of Object.entries(og)) console.log(`  ${k}: ${v.slice(0, 110)}`)
  if (image) console.log(`  og:image fetch: ${image}`)
}
