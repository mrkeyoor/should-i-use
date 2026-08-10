#!/usr/bin/env node
// should-i-use-mcp install: writes the MCP server entry into whichever agent
// config files exist on this machine. Everyone ships a different config path,
// and hand-editing JSON is where people give up.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const HOME = os.homedir()
const ENTRY = { command: 'npx', args: ['-y', 'should-i-use-mcp'] }

// key = where the servers map lives inside the file
const TARGETS = [
  { name: 'Claude Code (user)', file: path.join(HOME, '.claude.json'), key: 'mcpServers' },
  { name: 'Claude Desktop (macOS)', file: path.join(HOME, 'Library/Application Support/Claude/claude_desktop_config.json'), key: 'mcpServers' },
  { name: 'Claude Desktop (Windows)', file: path.join(process.env.APPDATA || path.join(HOME, 'AppData/Roaming'), 'Claude/claude_desktop_config.json'), key: 'mcpServers' },
  { name: 'Cursor', file: path.join(HOME, '.cursor/mcp.json'), key: 'mcpServers' },
  { name: 'Windsurf', file: path.join(HOME, '.codeium/windsurf/mcp_config.json'), key: 'mcpServers' },
  { name: 'Cline (VS Code)', file: path.join(HOME, '.vscode/cline_mcp_settings.json'), key: 'mcpServers' },
  { name: 'VS Code (user)', file: path.join(HOME, '.vscode/mcp.json'), key: 'servers' },
  { name: 'Zed', file: path.join(HOME, '.config/zed/settings.json'), key: 'context_servers' },
  { name: 'Codex', file: path.join(HOME, '.codex/config.json'), key: 'mcpServers' },
  { name: 'Gemini CLI', file: path.join(HOME, '.gemini/settings.json'), key: 'mcpServers' },
]

const projectLocal = process.argv.includes('--project')
if (projectLocal) {
  TARGETS.length = 0
  TARGETS.push(
    { name: 'Claude Code (this project)', file: path.join(process.cwd(), '.mcp.json'), key: 'mcpServers', create: true },
    { name: 'Cursor (this project)', file: path.join(process.cwd(), '.cursor/mcp.json'), key: 'mcpServers', create: true }
  )
}

let written = 0
const skipped = []

for (const t of TARGETS) {
  const exists = fs.existsSync(t.file)
  if (!exists && !t.create) {
    skipped.push(t.name)
    continue
  }
  try {
    let json = {}
    if (exists) {
      const raw = fs.readFileSync(t.file, 'utf8').trim()
      json = raw ? JSON.parse(raw) : {}
    } else {
      fs.mkdirSync(path.dirname(t.file), { recursive: true })
    }
    json[t.key] = json[t.key] || {}
    if (json[t.key]['should-i-use']) {
      console.log(`already configured  ${t.name}`)
      continue
    }
    // Zed uses a different shape for context servers
    json[t.key]['should-i-use'] = t.key === 'context_servers' ? { command: ENTRY, settings: {} } : { ...ENTRY }
    if (exists) fs.copyFileSync(t.file, `${t.file}.bak`) // never lose a working config
    fs.writeFileSync(t.file, JSON.stringify(json, null, 2))
    console.log(`configured          ${t.name}  (${t.file})`)
    written++
  } catch (err) {
    console.error(`could not update    ${t.name}: ${err.message}`)
  }
}

// --with-policy: drop a one-line rule into the project's agent instruction
// files so the agent checks BEFORE adding a dependency, every time. MCP tools
// are advisory on their own; a project rule makes the check near-guaranteed.
const POLICY_LINE =
  'Before adding or recommending any npm/PyPI dependency, check it with the should-i-use MCP tools first (should_i_use for a specific library, pick_library for a task, audit_dependencies after editing a manifest). Take the skip-warnings seriously.'

if (process.argv.includes('--with-policy')) {
  const targets = ['CLAUDE.md', 'AGENTS.md']
  const found = targets.filter((f) => fs.existsSync(path.join(process.cwd(), f)))
  // If neither file exists, create AGENTS.md — the cross-agent convention.
  for (const f of found.length ? found : ['AGENTS.md']) {
    const file = path.join(process.cwd(), f)
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    if (existing.includes('should-i-use MCP')) {
      console.log(`policy already present  ${f}`)
      continue
    }
    const block = `${existing.trim() ? existing.replace(/\s*$/, '\n\n') : ''}## Dependency policy\n\n${POLICY_LINE}\n`
    if (existing) fs.copyFileSync(file, `${file}.bak`)
    fs.writeFileSync(file, block)
    console.log(`policy written          ${f}`)
  }
} else if (written > 0) {
  console.log('\nTip: run with --with-policy inside a project to add a one-line rule to')
  console.log('CLAUDE.md/AGENTS.md so your agent checks every dependency automatically.')
}

if (written === 0) {
  console.log('\nNo agent config files were found on this machine.')
  console.log('Add this to your MCP config by hand:\n')
  console.log(JSON.stringify({ mcpServers: { 'should-i-use': ENTRY } }, null, 2))
  console.log('\nOr run inside a project:  npx should-i-use-mcp install --project')
} else {
  console.log(`\nDone. ${written} config${written > 1 ? 's' : ''} updated (backups saved as .bak).`)
  console.log('Restart your agent, then ask it: "audit my dependencies".')
  if (skipped.length) console.log(`Not installed (not found): ${skipped.join(', ')}`)
}
