#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import path from 'node:path'

const APP_ROOT = process.cwd()

/**
 * Read and parse JSON file
 * @param {string} file File path
 * @returns {Promise<any>} Parsed JSON
 */
async function readJson(file) {
  const raw = await fs.readFile(file, 'utf8')
  return JSON.parse(raw)
}

/**
 * Format JSON with compact 2-space indentation
 * @param {any} obj Object to format
 * @returns {string} Formatted JSON string
 */
function formatJsonCompact(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

/**
 * Format locale JSON with visual grouping by first letter
 * @param {Record<string, string>} obj Locale object
 * @returns {string} Formatted JSON with grouping
 */
function formatLocaleWithGrouping(obj) {
  const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const lines = ['{']

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const v = obj[k]
    const next = keys[i + 1]
    const kv = i === keys.length - 1 ? `  "${k}": "${v}"` : `  "${k}": "${v}",`
    
    lines.push(kv)
    
    if (next) {
      const currInitial = (k[0] || '').toUpperCase()
      const nextInitial = (next[0] || '').toUpperCase()
      if (currInitial !== nextInitial) {
        lines.push('')
      }
    }
  }
  
  lines.push('}')
  return lines.join('\n') + '\n'
}

/**
 * List files in directory matching predicate
 * @param {string} dir Directory path
 * @param {(file: string) => boolean} predicate File filter
 * @returns {Promise<string[]>} Array of matching file paths
 */
async function listFiles(dir, predicate = () => true) {
  const abs = path.resolve(APP_ROOT, dir)
  
  try {
    const entries = await fs.readdir(abs, { withFileTypes: true })
    const files = []
    
    for (const e of entries) {
      if (e.isFile()) {
        const fp = path.join(abs, e.name)
        if (predicate(fp)) files.push(fp)
      }
    }
    
    return files
  } catch (err) {
    if (err.code === 'ENOENT') {
      return []
    }
    throw err
  }
}

/**
 * Clean up and format locale files
 */
async function cleanupLocales() {
  const localeDir = 'packages/config/src/i18n/locales'
  
  const locales = await listFiles(localeDir, (f) => f.endsWith('.json'))
  
  for (const file of locales) {
    try {
      const obj = await readJson(file)
      const out = formatLocaleWithGrouping(obj)
      await fs.writeFile(file, out, 'utf8')
      process.stdout.write(`[cleanup] formatted locale: ${path.relative(APP_ROOT, file)}\n`)
    } catch (err) {
      process.stderr.write(`[cleanup] failed locale ${file}: ${String(err)}\n`)
    }
  }
}

/**
 * Clean up and format settings files
 */
async function cleanupSettings() {
  const marketDir = 'packages/config/src/settings/market'
  const defaultSettings = path.resolve(APP_ROOT, 'packages/config/src/settings/default.settings.json')
  const envSettings = path.resolve(APP_ROOT, 'packages/config/src/settings/env.json')
  
  const marketSettings = await listFiles(marketDir, (f) => f.endsWith('.settings.json'))
  const targets = [defaultSettings, envSettings, ...marketSettings]
  
  for (const file of targets) {
    try {
      const obj = await readJson(file)
      const out = formatJsonCompact(obj)
      await fs.writeFile(file, out, 'utf8')
      process.stdout.write(`[cleanup] formatted settings: ${path.relative(APP_ROOT, file)}\n`)
    } catch (err) {
      process.stderr.write(`[cleanup] failed settings ${file}: ${String(err)}\n`)
    }
  }
}

/**
 * Main cleanup function
 */
async function main() {
  process.stdout.write('[cleanup] Starting cleanup of locale and settings files...\n')
  await cleanupLocales()
  await cleanupSettings()
  process.stdout.write('[cleanup] Cleanup completed!\n')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})