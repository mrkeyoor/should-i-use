#!/usr/bin/env node
// Smoke test for the public build. Spawns the server over stdio, calls every
// tool once against the bundled data file, prints each response with its
// estimated token count, and exits non-zero if any response breaks the 500
// token cap or comes back as an error.

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { estimateTokens } from './clamp.js'
import { allPublished } from './data.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MAX_TOKENS = 500

async function main() {
  const libs = await allPublished()
  if (libs.length === 0) throw new Error('data/libraries.json has no published libraries')

  // Pick real fixtures from the bundled data so the test never goes stale.
  const withPatterns = libs.find((l) => (l.patterns || []).length > 0) || libs[0]
  const withAlts = libs.find((l) => ((l.guide || {}).alternatives || []).length > 0) || libs[0]
  const pattern = (withPatterns.patterns || [])[0]

  const calls = [
    ['pick_library', { task: `use ${withPatterns.name} for ${withPatterns.category || 'a task'}` }],
    ['should_i_use', { library: withPatterns.name }],
    ['alternatives', { library: withAlts.name }],
    ['how_do_i', { library: withPatterns.name, task: pattern ? pattern.title : 'get started' }],
    ['docs_link', { library: withPatterns.name }],
  ]

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(HERE, 'server.js')],
  })
  const client = new Client({ name: 'should-i-use-smoke', version: '0.1.0' })
  await client.connect(transport)

  const { tools } = await client.listTools()
  console.log(`tools listed: ${tools.map((t) => t.name).join(', ')}`)
  if (tools.length !== 6) throw new Error(`expected 6 tools, got ${tools.length}`)

  let failed = false
  for (const [name, args] of calls) {
    const res = await client.callTool({ name, arguments: args })
    const text = (res.content || []).map((c) => c.text).join('\n')
    const tokens = estimateTokens(text)
    const status = res.isError ? 'ERROR' : tokens > MAX_TOKENS ? 'OVER CAP' : 'ok'
    if (res.isError || tokens > MAX_TOKENS) failed = true
    console.log(`\n=== ${name} (${tokens} tokens, ${status}) ===`)
    console.log(text)
  }

  await client.close()
  if (failed) throw new Error('smoke test failed: see output above')
  console.log(`\nsmoke ok: ${libs.length} libraries in index, all responses within ${MAX_TOKENS} tokens`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
