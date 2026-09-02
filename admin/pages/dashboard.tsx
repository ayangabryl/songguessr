import { useEffect, useState } from 'react'
import {
  syncSpotifyMetrics,
  triggerCron,
  type CronTriggerResponse,
  type SpotifySyncResponse,
  type StatusResponse,
} from '@/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { formatDate, formatNumber } from '@/lib/format'
import { PlayIcon, RefreshCwIcon } from 'lucide-react'
import { toast } from 'sonner'

const CRON_COOLDOWN_MS = 30_000

export function DashboardPage({
  status,
  onStatusRefresh,
}: {
  status: StatusResponse | null
  onStatusRefresh: () => void
}) {
  const [running, setRunning] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [lastRun, setLastRun] = useState<CronTriggerResponse | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<SpotifySyncResponse | null>(null)

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [cooldownUntil])

  if (!status) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const artistPct = status.artistsTotal
    ? Math.round((status.artistsDone / status.artistsTotal) * 100)
    : 0
  const catalogPct = Math.round((status.tracks / status.catalogCap) * 100)
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
  const disabled = running || cooldownLeft > 0

  const handleRunCron = async () => {
    setRunning(true)
    setCooldownUntil(Date.now() + CRON_COOLDOWN_MS)
    setNow(Date.now())
    try {
      const result = await triggerCron()
      setLastRun(result)
      onStatusRefresh()
      toast.success(result.message)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Library update failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Songs in library</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{formatNumber(status.tracks)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {catalogPct}% of {formatNumber(status.catalogCap)} cap
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Last updated</CardDescription>
            <CardTitle className="text-lg">{formatDate(status.updatedAt)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              D1 source of truth · Spotify {formatDate(status.spotifySyncedAt ?? null)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatNumber(status.popularityFilled ?? 0)} popularity ·{' '}
              {formatNumber(status.playCountFilled ?? 0)} plays ·{' '}
              {formatNumber(status.releaseDateFilled ?? 0)} release dates
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Cron status</CardDescription>
            <CardTitle>
              <Badge variant={status.ok ? 'secondary' : 'destructive'}>{status.health}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{status.cronDescription}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Artist backlog</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{artistPct}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {formatNumber(status.artistsDone)} / {formatNumber(status.artistsTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Library update</CardTitle>
          <CardDescription>
            Next scheduled run {formatDate(status.nextCronEstimate)} · {status.cronSchedule}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {status.catalogError ? (
            <Alert>
              <AlertTitle>Library error</AlertTitle>
              <AlertDescription>{status.catalogError}</AlertDescription>
            </Alert>
          ) : null}
          {lastRun ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Added {formatNumber(lastRun.tracksAdded)}</Badge>
              <Badge variant={(lastRun.errors?.length ?? 0) > 0 ? 'destructive' : 'outline'}>
                Errors {formatNumber(lastRun.errors?.length ?? 0)}
              </Badge>
              <Badge variant={lastRun.rateLimited ? 'destructive' : 'outline'}>
                {lastRun.rateLimited ? 'Rate limited' : 'Not rate limited'}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No manual run yet this session.</p>
          )}
        </CardContent>
        <CardFooter>
          <Button disabled={disabled} onClick={() => void handleRunCron()}>
            {running ? <Spinner data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}
            {running ? 'Running…' : cooldownLeft > 0 ? `Wait ${cooldownLeft}s` : 'Run library update'}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spotify metrics</CardTitle>
          <CardDescription>
            Play count, popularity, release date, and artist popularity all come from the public
            open.spotify.com web player — no Web API quota involved. It is unofficial, so a run
            fills what it can and resumes from where it stopped next time.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {(() => {
            const displayedSync = lastSync ?? status.lastSpotifySync ?? null
            if (!displayedSync) {
              return (
                <p className="text-sm text-muted-foreground">
                  No Spotify sync yet. {formatNumber(status.popularityMissing ?? 0)} tracks are still
                  missing popularity and {formatNumber(status.playCountMissing ?? 0)} are missing a
                  play count.
                </p>
              )
            }
            const filled = displayedSync.filled
            const coverage = displayedSync.coverage
            return (
              <div className="flex flex-col gap-2">
                <p className="text-sm">{displayedSync.message}</p>
                {filled ? (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Plays filled {formatNumber(filled.playCount)}</Badge>
                    <Badge variant="secondary">
                      Popularity filled {formatNumber(filled.popularity)}
                    </Badge>
                    <Badge variant="secondary">
                      Release dates filled {formatNumber(filled.releaseDate)}
                    </Badge>
                  </div>
                ) : null}
                {coverage ? (
                  <p className="text-sm text-muted-foreground">
                    Coverage: {formatNumber(coverage.releaseDateFilled)} release dates,{' '}
                    {formatNumber(coverage.playCountFilled)} plays,{' '}
                    {formatNumber(coverage.popularityFilled)} popularity
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Updated {formatNumber(displayedSync.updated)}</Badge>
                  {(displayedSync.errors?.length ?? 0) > 0 ? (
                    <Badge variant="destructive">
                      Errors {formatNumber(displayedSync.errors?.length ?? 0)}
                    </Badge>
                  ) : null}
                  {displayedSync.rateLimited ? (
                    <Badge variant="destructive">Throttled</Badge>
                  ) : (
                    <Badge variant="secondary">Clean run</Badge>
                  )}
                </div>
                {displayedSync.sources?.length ? (
                  <p className="text-sm text-muted-foreground">
                    Source: {displayedSync.sources.join(' + ')}
                  </p>
                ) : null}
                {displayedSync.at ? (
                  <p className="text-sm text-muted-foreground">{formatDate(displayedSync.at)}</p>
                ) : null}
                {displayedSync.distribution ? (
                  <p className="text-sm text-muted-foreground">
                    {Object.entries(displayedSync.distribution)
                      .map(([level, count]) => `${level} ${count}`)
                      .join(' · ')}
                  </p>
                ) : null}
                {(displayedSync.errors?.length ?? 0) > 0 ? (
                  <p className="text-sm text-destructive">{displayedSync.errors[0]}</p>
                ) : null}
              </div>
            )
          })()}
        </CardContent>
        <CardFooter>
          <Button
            disabled={syncing}
            onClick={() => {
              void (async () => {
                setSyncing(true)
                try {
                  const result = await syncSpotifyMetrics()
                  setLastSync(result)
                  onStatusRefresh()
                  toast.success(result.message)
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Spotify sync failed')
                } finally {
                  setSyncing(false)
                }
              })()
            }}
          >
            {syncing ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
            {syncing ? 'Syncing…' : 'Sync Spotify metrics'}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System</CardTitle>
          <CardDescription>Ingest checkpoints from R2</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <StatusRow label="Genre ingest" value={`${formatDate(status.genreSyncedAt)}${status.genreSource ? ` · ${status.genreSource}` : ''}`} />
          <Separator />
          <StatusRow label="Playlist synced" value={formatDate(status.playlistSyncedAt)} />
          <Separator />
          <StatusRow label="Genre cursor" value={String(status.genrePlaylistCursor)} />
        </CardContent>
      </Card>
    </div>
  )
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  )
}
