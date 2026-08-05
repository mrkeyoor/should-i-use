// Token-budget clamp. Every tool response passes through this before it
// leaves the server. Tokens are approximated as chars / 4. When a response
// is over budget it is truncated at the last sentence boundary that fits,
// with a short tail pointing at docs_link.

const MAX_TOKENS = 500
const TAIL = '\n...use docs_link for more'

export function estimateTokens(text) {
  return Math.ceil(String(text).length / 4)
}

export function clamp(text, maxTokens = MAX_TOKENS) {
  const s = String(text).trim()
  const maxChars = maxTokens * 4
  if (s.length <= maxChars) return s

  const budget = maxChars - TAIL.length
  const head = s.slice(0, budget)

  // Prefer cutting at a sentence end (. ! ?) or a line break, whichever
  // sits latest inside the budget. Fall back to a word boundary.
  let cut = -1
  for (const re of [/[.!?](?=\s|$)/g, /\n/g]) {
    let m
    while ((m = re.exec(head)) !== null) {
      const end = m.index + (m[0] === '\n' ? 0 : 1)
      if (end > cut) cut = end
    }
  }
  if (cut < budget * 0.5) {
    const sp = head.lastIndexOf(' ')
    cut = sp > budget * 0.5 ? sp : budget
  }
  return head.slice(0, cut).trimEnd() + TAIL
}
