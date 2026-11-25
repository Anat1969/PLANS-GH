// Checks the shared urban-twin standard (standard/urban-standard.mjs). Usage: node tools/check-standard.mjs
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import * as S from '../standard/urban-standard.mjs'
let fail = 0
const ok = (name, pass, d = '') => { console.log(`${pass ? 'עובר' : 'נכשל'}  ${name}${d ? `  (${d})` : ''}`); if (!pass) fail++ }
const H = JSON.parse(readFileSync('data/urban-standard/legend-harvest.json', 'utf8')).names
for (const [k, v] of Object.entries(S.LAND_USE)) {
  if (v.verified === 'pending') { ok(`${k}: בלי מקור, בלי צבע`, v.color === null && S.landUseColor(k) === S.NEUTRAL); continue }
  const h = H[v.mavat] && H[v.mavat][0]
  ok(`${k}: הצבע ${v.color} הוא משבצת המקרא של "${v.mavat}"`, !!h && h.hex === v.color, h ? h.plans.join(', ') : 'לא נמצא')
  ok(`${k}: "אומת" רק כשחוזר ב-2 תוכניות`, (v.verified === 'mavat-output') === (h && h.plans.length >= 2))
}
const reserved = [S.BLUE_LINE, S.SELECT.arrow, S.SELECT.halo, S.NEUTRAL_BG.fill].map((c) => c.toLowerCase())
ok('אין צבע ייעוד שהוא צבע שמור (קו כחול, בחירה, רקע)', Object.values(S.LAND_USE).every((v) => !v.color || !reserved.includes(v.color.toLowerCase())))
const need = ['zoom', 'pan', 'rotate', 'tilt', 'select', 'clear', 'north', 'reset', 'dim', 'full']
ok('טבלת הפעולות מכסה את כל הפעולות שבהנחיה', need.every((id) => S.ACTIONS.some((a) => a.id === id)))
ok('סף לחיצה 5 פיקסלים, ו-MapLibre מקבל 6 (גרירה מ-6)', S.INTERACTION.clickTolerancePx === 5 && S.MAPLIBRE_OPTIONS.clickTolerance === 6)
try { execFileSync('node', ['tools/urban-standard/docs.mjs', '--check'], { stdio: 'pipe' }); ok('התיעוד תואם לתקן', true) } catch (e) { ok('התיעוד תואם לתקן', false, 'הריצו node tools/urban-standard/docs.mjs') }
const rt = existsSync('data/renewal-twin.json') && JSON.parse(readFileSync('data/renewal-twin.json', 'utf8'))
ok('רקע ההתחדשות קיים, עם מקור ותאריך', !!rt && rt.features.length > 0 && !!rt.city_twin_updated_at, rt ? `${rt.features.length} נפחים, ${rt.city_twin_updated_at}` : '')
const idx = readFileSync('index.html', 'utf8')
ok('index.html טוען את התקן', idx.includes("standard/urban-standard.mjs"))
for (const f of ['plans-model.js', 'plans-city.js', 'plans-process.js']) ok(`${f} משתמש בחוזה האינטראקציה`, /apply(Orbit|Leaflet)\(/.test(readFileSync(f, 'utf8')))
console.log(fail ? `\n${fail} נכשלות` : '\nהכול עובר'); process.exit(fail ? 1 : 0)
