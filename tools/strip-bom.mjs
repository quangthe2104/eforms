// Removes a UTF-8 BOM from the given files (Windows PowerShell 5 adds one with `Set-Content -Encoding utf8`).
// Usage: node tools/strip-bom.mjs <file...>
import { readFileSync, writeFileSync } from 'node:fs'

for (const file of process.argv.slice(2)) {
  const buf = readFileSync(file)
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    writeFileSync(file, buf.subarray(3))
    console.log(`stripped ${file}`)
  }
}
