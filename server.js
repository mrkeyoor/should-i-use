#!/usr/bin/env node
// should-i-use MCP server. Stdio transport, reads the bundled library index
// snapshot (data/libraries.json, override with SHOULD_I_USE_DATA). Five
// tools, every response clamped to ~500 tokens.

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { clamp } from './clamp.js'
import { pickLibrary, shouldIUse, alternatives, howDoI, docsLink } from './tools.js'

const TOOLS = [
  {
    name: 'pick_library',
    description:
      'Given a coding task, recommend 1-3 libraries from the should-i-use index with one-line reasoning and an honest warning about the top pick. Use before installing anything.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'What you are trying to do, e.g. "parse CSV files in node"' },
        ecosystem: { type: 'string', enum: ['npm', 'pypi'], description: 'Optional registry filter' },
      },
      required: ['task'],
    },
    handler: pickLibrary,
  },
  {
    name: 'should_i_use',
    description:
      'Honest verdict on a specific library: 4-axis scores with reasons, when to skip it, and maintenance signals (last push, weekly downloads).',
    inputSchema: {
      type: 'object',
      properties: {
        library: { type: 'string', description: 'Library name as published on npm or PyPI' },
      },
      required: ['library'],
    },
    handler: shouldIUse,
  },
  {
    name: 'alternatives',
    description:
      'Curated alternatives to a library, each with a one-line "prefer it when" and a verdict if the alternative is also indexed.',
    inputSchema: {
      type: 'object',
      properties: {
        library: { type: 'string', description: 'Library name as published on npm or PyPI' },
      },
      required: ['library'],
    },
    handler: alternatives,
  },
  {
    name: 'how_do_i',
    description:
      'Return the 1-2 best code snippets for a task with a library, plus the gotcha for each. Snippets are correct for the indexed version. Far cheaper in tokens than a docs dump.',
    inputSchema: {
      type: 'object',
      properties: {
        library: { type: 'string', description: 'Library name as published on npm or PyPI' },
        task: { type: 'string', description: 'What you want to do, e.g. "retry a failed request"' },
      },
      required: ['library', 'task'],
    },
    handler: howDoI,
  },
  {
    name: 'docs_link',
    description: 'Official docs URL and GitHub repo for a library, one line each. Use when the clamped answers are not enough.',
    inputSchema: {
      type: 'object',
      properties: {
        library: { type: 'string', description: 'Library name as published on npm or PyPI' },
        topic: { type: 'string', description: 'Optional topic to look up in the docs' },
      },
      required: ['library'],
    },
    handler: docsLink,
  },
]

const server = new Server(
  { name: 'should-i-use', version: '0.1.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name)
  if (!tool) {
    return { content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }], isError: true }
  }
  try {
    const text = await tool.handler(req.params.arguments || {})
    return { content: [{ type: 'text', text: clamp(text) }] }
  } catch (err) {
    const msg = /cannot read data file/i.test(String(err.message || err))
      ? 'should-i-use cannot read its bundled data file. Reinstall the package, or point SHOULD_I_USE_DATA at a valid libraries.json.'
      : `should-i-use error: ${err.message || err}`
    return { content: [{ type: 'text', text: clamp(msg) }], isError: true }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write('should-i-use MCP server running on stdio\n')
}

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))

main().catch((err) => {
  process.stderr.write(`should-i-use failed to start: ${err.message || err}\n`)
  process.exit(1)
})
