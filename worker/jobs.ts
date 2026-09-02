export type JobStatus = 'queued' | 'running' | 'done' | 'error'
export type JobPhase =
  | 'queued'
  | 'fetching'
  | 'filtering'
  | 'resolving'
  | 'saving'
  | 'done'
  | 'error'

export interface CatalogJobSnapshot {
  status: JobStatus
  processed: number
  total: number
  added: number
  skipped: number
  phase: JobPhase
  error?: string
  playlistName?: string
  skippedExisting?: number
  skippedNonOpm?: number
  skippedNoPreview?: number
  skippedNonOpmNames?: string[]
  updated?: number
  country?: string
  catalog?: string
  errors?: string[]
  source?: string
  fetched?: number
}

interface StoredJob extends CatalogJobSnapshot {
  id: string
  createdAt: number
}

const JOB_TTL_MS = 30 * 60 * 1000
const jobs = new Map<string, StoredJob>()

function sweepExpiredJobs(): void {
  const now = Date.now()
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) {
      jobs.delete(id)
    }
  }
}

function toSnapshot(job: StoredJob): CatalogJobSnapshot {
  return {
    status: job.status,
    processed: job.processed,
    total: job.total,
    added: job.added,
    skipped: job.skipped,
    phase: job.phase,
    error: job.error,
    playlistName: job.playlistName,
    skippedExisting: job.skippedExisting,
    skippedNonOpm: job.skippedNonOpm,
    skippedNoPreview: job.skippedNoPreview,
    skippedNonOpmNames: job.skippedNonOpmNames,
    updated: job.updated,
    country: job.country,
    catalog: job.catalog,
    errors: job.errors,
    source: job.source,
    fetched: job.fetched,
  }
}

export function createCatalogJob(): string {
  sweepExpiredJobs()
  const id = crypto.randomUUID()
  jobs.set(id, {
    id,
    createdAt: Date.now(),
    status: 'queued',
    processed: 0,
    total: 0,
    added: 0,
    skipped: 0,
    phase: 'queued',
  })
  return id
}

export function getCatalogJob(id: string): CatalogJobSnapshot | null {
  const job = jobs.get(id)
  return job ? toSnapshot(job) : null
}

export function updateCatalogJob(id: string, patch: Partial<CatalogJobSnapshot>): void {
  const job = jobs.get(id)
  if (!job) return
  Object.assign(job, patch)
}
