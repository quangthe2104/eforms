// Usage: node tools/find-untyped-buttons.mjs [dir=frontend/src] — lists <button> JSX elements without an explicit type (they default to type="submit" inside a <form>).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] || 'frontend/src'
const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n)
  return statSync(p).isDirectory() ? walk(p) : /\.(jsx|tsx|js)$/.test(n) ? [p] : []
})

let total = 0
for (const file of walk(root)) {
  const src = readFileSync(file, 'utf8')
  const re = /<button\b([^>]*?)>/gs
  let m
  while ((m = re.exec(src))) {
    if (/\btype\s*=/.test(m[1])) continue
    const line = src.slice(0, m.index).split('\n').length
    console.log(`${file}:${line}  ${m[0].replace(/\s+/g, ' ').slice(0, 110)}`)
    total++
  }
}
console.log(`untyped buttons: ${total}`)
