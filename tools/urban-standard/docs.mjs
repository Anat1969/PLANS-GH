// Fills the generated tables in docs/urban-twin/*.md from standard/urban-standard.mjs, so the docs never drift.
// Usage: node tools/urban-standard/docs.mjs [--check]   (--check: exit 1 if the docs are not up to date)
import { readFileSync, writeFileSync } from 'node:fs'
import * as S from '../../standard/urban-standard.mjs'
const check = process.argv.includes('--check')
const V = { 'mavat-output':'אומת (חוזר ב-2 תוכניות ומעלה)', 'mavat-single':'נמצא בתוכנית אחת', pending:'לבדיקה' }
const codes = ['| קטגוריה במודל | ייעוד במבא"ת | צבע | מצב | תוכניות | הערה |', '|---|---|---|---|---|---|',
  ...Object.entries(S.LAND_USE).map(([k, v]) => `| \`${k}\` | ${v.mavat || '-'} | ${v.color ? `\`${v.color}\`` : `\`${S.NEUTRAL}\` (ניטרלי)`} | ${V[v.verified]} | ${v.plans.join(', ') || '-'} | ${v.note || ''} |`),
  '', 'כל השמות שנקראו מהמקרא:', '', '| ייעוד | צבע | תוכניות |', '|---|---|---|',
  ...Object.entries(S.MAVAT_BY_NAME).map(([n, v]) => `| ${n} | \`${v.color}\` | ${v.plans.join(', ')} |`)].join('\n')
const actions = ['| פעולה | עכבר | מגע | מקלדת | כפתור |', '|---|---|---|---|---|',
  ...S.ACTIONS.map((a) => `| ${a.label} | ${a.mouse || '-'} | ${a.touch || '-'} | ${a.keys ? '`' + a.keys + '`' : '-'} | ${a.button || '-'} |`)].join('\n')
const I = S.INTERACTION
const values = ['| פרמטר | ערך |', '|---|---|', `| סף לחיצה | ${I.clickTolerancePx} פיקסלים |`, `| גלגלת | ${I.wheelLevelsPerNotch} רמת זום להזזה (100 פיקסלים) |`,
  `| + ו- | ${I.keyZoomLevels} רמה |`, `| חץ | ${I.keyPanFraction * 100}% מרוחב המפה |`, `| Shift + חץ | סיבוב ${I.keyRotateDeg}°, הטיה ${I.keyTiltDeg}° |`,
  `| הטיה מרבית | ${I.maxTiltDeg}° |`, `| משך אנימציה | ${I.animMs} מ"ש |`, `| גרסת התקן | ${S.VERSION} |`].join('\n')
const fill = (file, parts) => {
  let s = readFileSync(file, 'utf8'); const before = s
  for (const [k, body] of Object.entries(parts)) s = s.replace(new RegExp(`<!-- ${k}:start -->[\\s\\S]*?<!-- ${k}:end -->`), `<!-- ${k}:start -->\n${body}\n<!-- ${k}:end -->`)
  if (check) { if (s !== before) { console.error(`out of date: ${file}`); process.exitCode = 1 } } else writeFileSync(file, s)
}
fill('docs/urban-twin/design-system.md', { codes })
fill('docs/urban-twin/map-interaction-standard.md', { actions, values })
