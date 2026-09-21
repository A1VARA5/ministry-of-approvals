// Copies the effect handlers from workflows/src/effects into web/src/effects so the site's
// fallback drainer can run the clerks. Vercel only uploads the web folder, hence the copy.
// The single source of truth stays in workflows/. Run: npm run sync-effects
import {cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs'
import path from 'node:path'
const from = path.resolve('../workflows/src/effects')
const to = path.resolve('src/effects')
mkdirSync(to, {recursive: true})
for (const file of readdirSync(from)) {
  const src = readFileSync(path.join(from, file), 'utf8')
  writeFileSync(path.join(to, file), `// GENERATED from workflows/src/effects/${file}. Do not edit here; run npm run sync-effects.\n${src}`)
}
console.log('synced', readdirSync(from).length, 'files')
