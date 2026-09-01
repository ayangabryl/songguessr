import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

export const ROOT = process.cwd()
export const AUDIO_DIR = join(ROOT, 'data', 'audio')
export const CATALOG_PATH = join(ROOT, 'data', 'catalog.json')
export const MANIFEST_PATH = join(AUDIO_DIR, 'manifest.json')
export const UPLOAD_STATE_PATH = join(AUDIO_DIR, '.upload-state.json')
export const BUCKET = 'songguessr'
export const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg'])
export const API_PREFIX = '/api/audio'

export function contentTypeFor(fileName) {
  const ext = extname(fileName).toLowerCase()
  switch (ext) {
    case '.m4a':
    case '.aac':
      return 'audio/mp4'
    case '.wav':
      return 'audio/wav'
    case '.ogg':
      return 'audio/ogg'
    default:
      return 'audio/mpeg'
  }
}

export function runWrangler(args, dryRun) {
  const command = ['wrangler', 'r2', ...args]
  console.log(`$ ${command.join(' ')}`)
  if (dryRun) return
  execFileSync('npx', command, { stdio: 'inherit', cwd: ROOT })
}

export function ensureBucket(dryRun) {
  try {
    runWrangler(['bucket', 'create', BUCKET], dryRun)
  } catch {
    // Bucket likely already exists.
  }
}

export function parseTrackFileName(fileName) {
  const ext = extname(fileName)
  const stem = basename(fileName, ext)
  const introMatch = stem.match(/^(.+)-intro$/i)
  if (introMatch) {
    return { trackId: introMatch[1], kind: 'introClipUrl', objectKey: fileName }
  }
  const hookMatch = stem.match(/^(.+)-hook$/i)
  if (hookMatch) {
    return { trackId: hookMatch[1], kind: 'hookClipUrl', objectKey: fileName }
  }
  return { trackId: stem, kind: 'audioUrl', objectKey: fileName }
}

export function publicUrl(objectKey) {
  return `${API_PREFIX}/${encodeURIComponent(objectKey)}`
}

export function fileFingerprint(filePath) {
  const stats = statSync(filePath)
  const hash = createHash('sha256')
  hash.update(readFileSync(filePath))
  return {
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    sha256: hash.digest('hex'),
  }
}

export function loadUploadState() {
  if (!existsSync(UPLOAD_STATE_PATH)) return { objects: {} }
  try {
    const parsed = JSON.parse(readFileSync(UPLOAD_STATE_PATH, 'utf8'))
    return { objects: parsed.objects ?? {} }
  } catch {
    return { objects: {} }
  }
}

export function saveUploadState(state) {
  writeFileSync(UPLOAD_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export function loadSidecarMetadata(trackId) {
  const metaPath = join(AUDIO_DIR, `${trackId}.json`)
  if (!existsSync(metaPath)) return {}
  try {
    const parsed = JSON.parse(readFileSync(metaPath, 'utf8'))
    const patch = {}
    if (Number.isInteger(parsed.startAtMs) && parsed.startAtMs >= 0) {
      patch.startAtMs = parsed.startAtMs
    }
    if (Number.isInteger(parsed.hookStartMs) && parsed.hookStartMs >= 0) {
      patch.hookStartMs = parsed.hookStartMs
    }
    return patch
  } catch (error) {
    console.warn(`Could not parse ${metaPath}:`, error instanceof Error ? error.message : error)
    return {}
  }
}

export function listAudioFiles() {
  if (!existsSync(AUDIO_DIR)) return []
  return readdirSync(AUDIO_DIR)
    .filter((name) => AUDIO_EXTENSIONS.has(extname(name).toLowerCase()))
    .sort()
}

export function loadCatalog() {
  return JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))
}

export function saveCatalog(catalog) {
  catalog.updatedAt = new Date().toISOString()
  writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
}

export function trackHasHostedAudio(track) {
  return Boolean(track.audioUrl || track.introClipUrl || track.hookClipUrl)
}
