// Data access for the public should-i-use build. Reads a bundled JSON
// snapshot (data/libraries.json) instead of a database. The snapshot is a
// plain JSON array of library docs, exported daily from the mrkeyoor.com
// index. Override the path with the SHOULD_I_USE_DATA env var.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'data',
  'libraries.json'
)

let cache = null

function load() {
  if (cache) return cache
  const file = process.env.SHOULD_I_USE_DATA || DEFAULT_PATH
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch (err) {
    throw new Error(`cannot read data file at ${file}: ${err.message}`)
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`cannot read data file at ${file}: invalid JSON (${err.message})`)
  }
  const docs = Array.isArray(parsed) ? parsed : parsed.libraries
  if (!Array.isArray(docs)) {
    throw new Error(`cannot read data file at ${file}: expected a JSON array of library docs`)
  }
  cache = docs
  return cache
}

// Same rule as the upstream pipeline's slugify().
export function slugify(name) {
  return String(name).toLowerCase().replace(/[@/.]/g, '-').replace(/^-+/, '')
}

export async function findLibrary(name, ecosystem) {
  const slug = slugify(name)
  return (
    load().find(
      (lib) =>
        lib.status === 'published' &&
        (lib.slug === slug || lib.name === String(name)) &&
        (!ecosystem || lib.registry === ecosystem)
    ) || null
  )
}

export async function allPublished(ecosystem) {
  return load().filter(
    (lib) => lib.status === 'published' && (!ecosystem || lib.registry === ecosystem)
  )
}

export async function countPublished() {
  return (await allPublished()).length
}
