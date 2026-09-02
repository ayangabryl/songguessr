import { useEffect, useRef, useState } from 'react'
import { fetchJob, startPreviewBackfill, type CatalogJob } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { formatNumber } from '@/lib/format'
import { AudioLinesIcon } from 'lucide-react'
import { toast } from 'sonner'

function usePreviewBackfill(onDone?: () => void) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<CatalogJob | null>(null)
  const [starting, setStarting] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    let timer: number | undefined

    const poll = async () => {
      try {
        const next = await fetchJob(jobId)
        if (cancelled) return
        setJob(next)
        if (next.status === 'queued' || next.status === 'running') {
          timer = window.setTimeout(() => void poll(), 800)
          return
        }
        if (next.status === 'done') {
          const filled = next.filled ?? next.added
          const stillMissing = next.stillMissing ?? next.skipped
          toast.success(
            stillMissing > 0
              ? `Filled ${formatNumber(filled)} preview${filled === 1 ? '' : 's'}; ${formatNumber(stillMissing)} still missing`
              : filled > 0
                ? `Filled ${formatNumber(filled)} preview${filled === 1 ? '' : 's'}`
                : 'No missing previews to fill',
          )
          if ((next.errors?.length ?? 0) > 0) toast.warning(next.errors?.[0])
          onDoneRef.current?.()
        } else if (next.status === 'error') {
          toast.error(next.error ?? 'Preview backfill failed')
        }
      } catch (err) {
        if (cancelled) return
        toast.error(err instanceof Error ? err.message : 'Lost preview backfill progress')
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [jobId])

  const running = starting || job?.status === 'queued' || job?.status === 'running'
  const progress =
    job && job.total > 0 ? Math.round((job.processed / job.total) * 100) : running ? 8 : 0

  const start = async () => {
    setStarting(true)
    setJob(null)
    try {
      const id = await startPreviewBackfill()
      setJobId(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start preview backfill')
    } finally {
      setStarting(false)
    }
  }

  return { job, running, progress, start }
}

function ResultBadges({ job }: { job: CatalogJob }) {
  const filled = job.filled ?? job.added
  const stillMissing = job.stillMissing ?? job.skipped
  const hookFilled = job.hookFilled ?? 0
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary">Filled {formatNumber(filled)}</Badge>
      <Badge variant={stillMissing > 0 ? 'destructive' : 'outline'}>
        Still missing {formatNumber(stillMissing)}
      </Badge>
      {hookFilled > 0 ? (
        <Badge variant="outline">Hook filled {formatNumber(hookFilled)}</Badge>
      ) : null}
      {(job.errors?.length ?? 0) > 0 ? (
        <Badge variant="destructive">Errors {formatNumber(job.errors?.length ?? 0)}</Badge>
      ) : null}
    </div>
  )
}

export function FixMissingPreviewsButton({
  missingCount,
  onDone,
}: {
  missingCount: number
  onDone?: () => void
}) {
  const { job, running, progress, start } = usePreviewBackfill(onDone)
  const done = job?.status === 'done' || job?.status === 'error'

  return (
    <div className="flex min-w-0 flex-col items-end gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={running || missingCount === 0}
        onClick={() => void start()}
        title="Resolve iTunes (preferred) then public Spotify embed previews. Does not call quota'd GET /v1/tracks."
      >
        {running ? <Spinner data-icon="inline-start" /> : <AudioLinesIcon data-icon="inline-start" />}
        {running ? 'Fixing previews…' : 'Fix missing previews'}
      </Button>
      {running ? <Progress value={progress} className="h-1 w-40" /> : null}
      {done && job ? <ResultBadges job={job} /> : null}
    </div>
  )
}

export function FixMissingPreviewsCard({
  missingCount,
  onDone,
}: {
  missingCount: number
  onDone?: () => void
}) {
  const { job, running, progress, start } = usePreviewBackfill(onDone)
  const done = job?.status === 'done' || job?.status === 'error'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Missing previews</CardTitle>
        <CardDescription>
          Tracks without a preview URL cannot play in-game. This fills only empty previews via
          iTunes first, then the public Spotify embed — never quota-blocked GET /v1/tracks. Existing
          working URLs are left alone.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">
          {formatNumber(missingCount)} track{missingCount === 1 ? '' : 's'} missing a preview URL
        </p>
        {running ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {job && job.total > 0
                ? `${formatNumber(job.processed)} / ${formatNumber(job.total)} checked · filled ${formatNumber(job.filled ?? job.added)}`
                : 'Starting…'}
            </p>
            <Progress value={progress} />
          </div>
        ) : null}
        {done && job ? <ResultBadges job={job} /> : null}
        {job?.error ? <p className="text-sm text-destructive">{job.error}</p> : null}
      </CardContent>
      <CardFooter>
        <Button disabled={running || missingCount === 0} onClick={() => void start()}>
          {running ? <Spinner data-icon="inline-start" /> : <AudioLinesIcon data-icon="inline-start" />}
          {running
            ? 'Fixing…'
            : missingCount === 0
              ? 'All previews present'
              : 'Fix missing previews'}
        </Button>
      </CardFooter>
    </Card>
  )
}
