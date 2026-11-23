#!/usr/bin/env node
/* global console */
/**
 * Writes docs/USER_GUIDE.md from the in-app guide (src/components/UsersGuide/guideData.js),
 * so the Markdown guide and /guide never drift apart. Run from frontend/:
 *   node scripts/build-user-guide-md.mjs
 * Edit guideData.js, not the Markdown file.
 */
import { writeFileSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const guide = await import(resolve(here, '../src/components/UsersGuide/guideData.js'))
const pkg = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8'))
const out = resolve(here, '../../docs/USER_GUIDE.md')

const { CATEGORIES, GUIDE_CHANGES, SHORTCUTS, guideSections, guideUpdated } = guide
const byId = new Map(guideSections.map((s) => [s.id, s]))
const ordered = CATEGORIES.flatMap((c) => c.ids.map((id) => ({ group: c.label, section: byId.get(id) }))).filter((e) => e.section)

const anchor = (n, title) => `${n}-${title}`.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-')
const list = (items) => items.map((t) => `- ${t}`).join('\n')
const steps = (items) => items.map((t, i) => `${i + 1}. ${t}`).join('\n')
const prettyDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

const lines = []
lines.push('# Entomate User\'s Guide', '')
lines.push(`**Version**: ${pkg.version}  `, `**Last Updated**: ${prettyDate(guideUpdated)}`, '')
lines.push('> This file is generated from the in-app guide (`/guide`). Edit `frontend/src/components/UsersGuide/guideData.js`, then run `node scripts/build-user-guide-md.mjs` in `frontend/`.', '')
lines.push('---', '', '## Table of Contents', '')
let group = ''
ordered.forEach(({ group: g, section }, i) => {
  if (g !== group) { lines.push('', `**${g}**`, ''); group = g }
  lines.push(`${i + 1}. [${section.title}](#${anchor(i + 1, section.title)})`)
})
lines.push(`${ordered.length + 1}. [What's new](#${anchor(ordered.length + 1, "What's new")})`)
lines.push('', '---', '')

ordered.forEach(({ section: s }, i) => {
  lines.push(`## ${i + 1}. ${s.title}`, '')
  if (s.summary) lines.push(s.summary, '')
  if (s.steps?.length) lines.push(steps(s.steps), '')
  for (const sub of s.subsections ?? []) {
    lines.push(`### ${sub.title}`, '')
    if (sub.description) lines.push(sub.description, '')
    if (sub.steps?.length) lines.push(steps(sub.steps), '')
    if (sub.note) lines.push(`> **Note:** ${sub.note}`, '')
  }
  if (s.id === 'keyboard-shortcuts') {
    lines.push('| Keys | What it does |', '|---|---|')
    for (const k of SHORTCUTS) lines.push(`| ${k.keys.join(' ')} | ${k.label} |`)
    lines.push('')
  }
  for (const uc of s.useCases ?? []) {
    lines.push(`### ${uc.title}`, '')
    if (uc.scenario) lines.push(`*${uc.scenario}*`, '')
    if (uc.steps?.length) lines.push(list(uc.steps), '')
  }
  for (const t of s.tips ?? []) lines.push(`**Tip:** ${t}`, '')
  lines.push('---', '')
})

lines.push(`## ${ordered.length + 1}. What's new`, '')
for (const c of GUIDE_CHANGES) lines.push(`- **${prettyDate(c.date)}** (${byId.get(c.section)?.title ?? c.section}): ${c.text}`)
lines.push('')

writeFileSync(out, lines.join('\n'))
console.log(`Wrote ${out}: ${ordered.length} sections`)
