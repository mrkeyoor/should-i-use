// Tool implementations for should-i-use. Each function returns a plain
// string; server.js wraps it in MCP content and runs it through clamp().

import { findLibrary, allPublished, slugify } from './data.js'

const STOPWORDS = new Set([
  'a', 'an', 'the', 'i', 'to', 'for', 'of', 'in', 'on', 'with', 'and', 'or',
  'do', 'how', 'can', 'need', 'want', 'my', 'me', 'is', 'it', 'that', 'this',
  'use', 'using', 'library', 'lib', 'package', 'best', 'good', 'some', 'get',
  'make', 'from', 'into', 'what', 'which', 'should',
])

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9+#-]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
}

// Adjacent word pairs from the task ("http client"), minus stopword pairs.
// A phrase match is far stronger evidence than scattered single-word hits.
function phraseBigrams(task) {
  const raw = String(task)
    .toLowerCase()
    .split(/[^a-z0-9+#-]+/)
    .filter((w) => w.length >= 2)
  const out = []
  for (let i = 0; i < raw.length - 1; i++) {
    if (STOPWORDS.has(raw[i]) || STOPWORDS.has(raw[i + 1])) continue
    out.push(raw[i] + ' ' + raw[i + 1])
  }
  return out
}

// When the caller does not pass an ecosystem, a task that clearly names one
// runtime should not surface libraries from the other registry.
function inferEcosystem(task) {
  const t = String(task).toLowerCase()
  const npm = /\b(node|nodejs|npm|javascript|typescript|deno|bun|react|vue|browser|frontend)\b/.test(t)
  const pypi = /\b(python|pypi|pip|django|flask|pandas|asyncio|jupyter)\b/.test(t)
  if (npm && !pypi) return 'npm'
  if (pypi && !npm) return 'pypi'
  return undefined
}

function hits(tokens, text) {
  if (!text) return 0
  const t = String(text).toLowerCase()
  let n = 0
  for (const tok of tokens) if (t.includes(tok)) n++
  return n
}

function fmtDownloads(n) {
  if (n == null) return 'unknown'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B/wk'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M/wk'
  if (n >= 1e3) return Math.round(n / 1e3) + 'k/wk'
  return n + '/wk'
}

function fmtLastPush(iso) {
  if (!iso) return 'unknown'
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000)
  if (days < 1) return 'today'
  if (days < 31) return days + 'd ago'
  if (days < 365) return Math.round(days / 30) + 'mo ago'
  return (days / 365).toFixed(1) + 'y ago'
}

function firstSentence(text) {
  if (!text) return ''
  const m = String(text).match(/^.*?[.!?](?=\s|$)/)
  return (m ? m[0] : String(text)).trim()
}

export function notInIndex(name) {
  return (
    `"${name}" is not in the should-i-use index yet. The index covers a curated ` +
    'set of npm and PyPI libraries with hand-written guides, so coverage grows ' +
    'over time. Try the exact registry name, or check https://mrkeyoor.com/libs/ ' +
    'for what is currently indexed.'
  )
}

// pick_library: keyword and category match over guide/pattern text.
export async function pickLibrary({ task, ecosystem }) {
  const eco = ecosystem || inferEcosystem(task)
  const libs = await allPublished(eco)
  if (libs.length === 0) {
    return 'The index has no published libraries for that filter yet. Check https://mrkeyoor.com/libs/ for coverage.'
  }
  const tokens = tokenize(task)
  const phrases = phraseBigrams(task)
  const scored = libs
    .map((lib) => {
      const g = lib.guide || {}
      const patternText = (lib.patterns || [])
        .map((p) => `${p.intent} ${p.title}`)
        .join(' ')
      let score = 0
      score += hits(tokens, lib.name) * 5
      score += hits(tokens, lib.category) * 3
      score += hits(tokens, (g.useIf || []).join(' ')) * 3
      score += hits(tokens, patternText) * 2
      score += hits(tokens, g.whatIs) * 1
      const allText = `${lib.name} ${(g.useIf || []).join(' ')} ${patternText} ${g.whatIs || ''}`
      score += hits(phrases, allText) * 4
      return { lib, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || (b.lib.weeklyDownloads || 0) - (a.lib.weeklyDownloads || 0))
    .slice(0, 3)

  if (scored.length === 0) {
    return `No indexed library matched "${task}". The index is curated and still growing. Try different wording, or check https://mrkeyoor.com/libs/.`
  }

  const lines = [`Task: ${task}`]
  scored.forEach(({ lib }, i) => {
    const g = lib.guide || {}
    const reason = firstSentence(g.verdict) || firstSentence(g.whatIs)
    lines.push(`${i + 1}. ${lib.name} (${lib.registry}, ${lib.category}): ${reason}`)
  })
  const winner = scored[0].lib
  const skip = (winner.guide && winner.guide.skipIf && winner.guide.skipIf[0]) || null
  if (skip) lines.push(`Warning for ${winner.name}: skip it if ${lcFirst(skip)}`)
  return lines.join('\n')
}

function lcFirst(s) {
  s = String(s).trim()
  // Avoid mangling names that are intentionally capitalized (React, Django).
  if (/^[A-Z][a-z]/.test(s) && !/^[A-Z][a-z]+[A-Z]/.test(s)) {
    return s[0].toLowerCase() + s.slice(1)
  }
  return s
}

// should_i_use: verdict + scores + skipIf + maintenance signals.
export async function shouldIUse({ library }) {
  const lib = await findLibrary(library)
  if (!lib) return notInIndex(library)
  const g = lib.guide || {}
  const s = lib.scores || {}
  const lines = [`${lib.name} (${lib.registry} ${lib.version || '?'})`]
  if (g.verdict) lines.push(`Verdict: ${g.verdict}`)
  for (const key of ['apiStability', 'docsQuality', 'maintenance', 'ecosystem']) {
    if (s[key]) lines.push(`${key}: ${s[key].score}/5. ${s[key].why}`)
  }
  const skips = (g.skipIf || []).slice(0, 3)
  if (skips.length) {
    lines.push('Skip if:')
    for (const item of skips) lines.push(`- ${item}`)
  }
  lines.push(
    `Signals: last push ${fmtLastPush(lib.lastPush)}, downloads ${fmtDownloads(lib.weeklyDownloads)}` +
      (lib.stars != null ? `, ${lib.stars.toLocaleString('en-US')} stars` : '')
  )
  return lines.join('\n')
}

// alternatives: the curated list, plus each one's verdict if indexed.
export async function alternatives({ library }) {
  const lib = await findLibrary(library)
  if (!lib) return notInIndex(library)
  const alts = (lib.guide && lib.guide.alternatives) || []
  if (alts.length === 0) return `No alternatives recorded for ${lib.name} yet.`
  const lines = [`Alternatives to ${lib.name}:`]
  for (const alt of alts) {
    const indexed = await findLibrary(alt.name, alt.registry)
    const when = /[.!?]$/.test(String(alt.when).trim()) ? String(alt.when).trim() : `${String(alt.when).trim()}.`
    let line = `- ${alt.name} (${alt.registry}): ${when}`
    if (indexed && indexed.guide && indexed.guide.verdict) {
      line += ` Verdict: ${firstSentence(indexed.guide.verdict)}`
    }
    lines.push(line)
  }
  return lines.join('\n')
}

// how_do_i: rank patterns against the task, return best 1-2 snippets only.
export async function howDoI({ library, task }) {
  const lib = await findLibrary(library)
  if (!lib) return notInIndex(library)
  const patterns = lib.patterns || []
  if (patterns.length === 0) return `No usage patterns recorded for ${lib.name} yet. Try docs_link.`
  const tokens = tokenize(task)
  const scored = patterns
    .map((p) => ({
      p,
      score:
        hits(tokens, String(p.intent).replace(/-/g, ' ')) * 3 +
        hits(tokens, p.title) * 2 +
        hits(tokens, p.note),
    }))
    .sort((a, b) => b.score - a.score)

  if (scored[0].score === 0) {
    const intents = patterns.map((p) => p.intent).join(', ')
    return `No ${lib.name} pattern matched "${task}". Indexed intents: ${intents}. Try one of those words, or docs_link.`
  }

  const picks = scored.filter((s) => s.score > 0).slice(0, 2)
  const parts = []
  for (const { p } of picks) {
    parts.push(`${p.title} (${p.intent}, ${lib.name} ${lib.version || '?'})\n\`\`\`\n${p.snippet}\n\`\`\`\nGotcha: ${p.note}`)
  }
  return parts.join('\n\n')
}

// docs_link: docsUrl + repo, one line each.
export async function docsLink({ library, topic }) {
  const lib = await findLibrary(library)
  if (!lib) return notInIndex(library)
  const lines = []
  if (lib.docsUrl) {
    lines.push(`Docs: ${lib.docsUrl}` + (topic ? ` (search the docs for "${topic}")` : ''))
  }
  if (lib.repo) lines.push(`Repo: https://github.com/${lib.repo}`)
  lines.push(`Guide: https://mrkeyoor.com/libs/${lib.slug}/`)
  if (!lib.docsUrl && !lib.repo) {
    lines.unshift(`No docs or repo URL on file for ${lib.name}.`)
  }
  return lines.join('\n')
}

export { slugify }
