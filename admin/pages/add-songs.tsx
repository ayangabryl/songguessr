import { useEffect, useMemo, useState } from 'react'
import {
  addTrack,
  fetchCatalogs,
  fetchJob,
  previewPlaylist,
  searchSpotify,
  startPlaylistImport,
  type AdminCatalog,
  type CatalogJob,
  type JobPhase,
  type PlaylistPreview,
  type SpotifySearchResult,
} from '@/api'
import { NotoEmoji } from '../../shared/noto-emoji'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { CountryCombobox } from '@/components/country-combobox'
import { Switch } from '@/components/ui/switch'
import { countryDisplayName, formatNumber } from '@/lib/format'
import { ListMusicIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

const PHASE_LABELS: Record<JobPhase, string> = {
  queued: 'Queued',
  fetching: 'Fetching playlist',
  filtering: 'Filtering tracks',
  resolving: 'Resolving previews',
  saving: 'Saving to catalog',
  done: 'Done',
  error: 'Failed',
}

function phaseLabel(phase: string): string {
  if (phase in PHASE_LABELS) {
    return PHASE_LABELS[phase as JobPhase]
  }
  return phase
}

export function AddSongsPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotifySearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [country, setCountry] = useState('PH')
  const [catalog, setCatalog] = useState('opm')
  const [catalogs, setCatalogs] = useState<AdminCatalog[]>([])
  const [assumeAllLocal, setAssumeAllLocal] = useState(false)
  const [preview, setPreview] = useState<PlaylistPreview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [previewing, setPreviewing] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<CatalogJob | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    void fetchCatalogs()
      .then((rows) => {
        setCatalogs(rows)
        setCatalog((current) =>
          rows.some((row) => row.id === current) ? current : (rows[0]?.id ?? 'opm'),
        )
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!jobId) return

    let cancelled = false
    let timer = 0

    const tick = async () => {
      try {
        const next = await fetchJob(jobId)
        if (cancelled) return
        setJob(next)
        if (next.status === 'done' || next.status === 'error') return
      } catch (err) {
        if (cancelled) return
        setJob((current) =>
          current
            ? {
                ...current,
                status: 'error',
                phase: 'error',
                error: err instanceof Error ? err.message : 'Lost job progress',
              }
            : current,
        )
        return
      }
      timer = window.setTimeout(() => void tick(), 500)
    }

    void tick()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [jobId])

  const eligibleIds = useMemo(() => {
    if (!preview) return []
    return preview.tracks
      .filter((track) => !track.alreadyInCatalog && !track.isDuplicate)
      .map((track) => track.id)
  }, [preview])

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      setResults(await searchSpotify(query))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handleAdd = async (track: SpotifySearchResult) => {
    if (!track.id) return
    setAddingId(track.id)
    try {
      await addTrack(track.id)
      toast.success(`Added “${track.title}”`)
      setResults((current) =>
        current.map((item) => (item.id === track.id ? { ...item, inCatalog: true } : item)),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add track')
    } finally {
      setAddingId(null)
    }
  }

  const handlePreview = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!playlistUrl.trim() || previewing) return
    setPreviewing(true)
    setPreview(null)
    setSelected(new Set())
    setJob(null)
    setJobId(null)
    try {
      const next = await previewPlaylist(playlistUrl.trim())
      setPreview(next)
      setSelected(
        new Set(
          next.tracks
            .filter((track) => !track.alreadyInCatalog && !track.isDuplicate)
            .map((track) => track.id),
        ),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Playlist preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  const toggleTrack = (id: string, enabled: boolean) => {
    if (!enabled) return
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(eligibleIds))
  const selectNone = () => setSelected(new Set())

  const handleAddSelected = async () => {
    if (!playlistUrl.trim() || starting || selected.size === 0) return
    setStarting(true)
    setJob(null)
    try {
      const id = await startPlaylistImport(playlistUrl.trim(), {
        country,
        catalog,
        assumeAllLocal,
        trackIds: [...selected],
      })
      setJobId(id)
      setJob({
        status: 'queued',
        processed: 0,
        total: selected.size,
        added: 0,
        skipped: 0,
        phase: 'queued',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Playlist import failed')
    } finally {
      setStarting(false)
    }
  }

  const jobRunning = job?.status === 'queued' || job?.status === 'running'
  const progressValue =
    job && job.total > 0 ? Math.round((job.processed / job.total) * 100) : jobRunning ? 8 : 0
  const selectedCatalog = catalogs.find((item) => item.id === catalog)
  const catalogOptions = catalogs.length > 0 ? catalogs : [{ id: 'opm', name: 'OPM', emoji: '🇵🇭' }]

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Spotify playlist</CardTitle>
          <CardDescription>
            Paste a public playlist URL, fetch the track list, then pick which songs to add.
            Country and whitelist still apply to the selected IDs only.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={(event) => void handlePreview(event)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="playlist-url">Playlist URL</FieldLabel>
                <Input
                  id="playlist-url"
                  value={playlistUrl}
                  onChange={(event) => {
                    setPlaylistUrl(event.target.value)
                    setPreview(null)
                    setSelected(new Set())
                  }}
                  placeholder="https://open.spotify.com/playlist/…"
                  disabled={jobRunning || starting || previewing}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Country</FieldLabel>
                  <CountryCombobox
                    value={country}
                    onChange={setCountry}
                    disabled={jobRunning || starting}
                  />
                </Field>
                <Field>
                  <FieldLabel>Catalog</FieldLabel>
                  <Select
                    value={catalog}
                    onValueChange={setCatalog}
                    disabled={jobRunning || starting}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={selectedCatalog?.name ?? 'Catalog'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {catalogOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            <span className="inline-flex items-center gap-2">
                              <NotoEmoji emoji={option.emoji} className="size-4" />
                              {option.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field orientation="horizontal" className="items-start">
                <Switch
                  id="assume-all-local"
                  checked={assumeAllLocal}
                  onCheckedChange={setAssumeAllLocal}
                  disabled={jobRunning || starting}
                />
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="assume-all-local">
                    Whitelist all selected artists as this country
                  </FieldLabel>
                  <FieldDescription>
                    Every artist on the selected songs is stored as {countryDisplayName(country)}.
                    Leave off for mixed charts like Top 50 — Philippines.
                  </FieldDescription>
                </div>
              </Field>
              <Button type="submit" disabled={jobRunning || starting || previewing || !playlistUrl.trim()}>
                {previewing ? <Spinner data-icon="inline-start" /> : null}
                {previewing ? 'Fetching…' : 'Fetch songs'}
              </Button>
            </FieldGroup>
          </form>

          {preview ? (
            <div className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{preview.playlistName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(selected.size)} selected · {formatNumber(preview.tracks.length)} in
                    playlist
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                    Select all
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={selectNone}>
                    Select none
                  </Button>
                </div>
              </div>
              <div className="flex max-h-96 flex-col gap-2 overflow-auto">
                {preview.tracks.map((track) => {
                  const disabled = track.alreadyInCatalog || track.isDuplicate
                  return (
                    <label
                      key={`${track.id}-${track.title}`}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${
                        disabled ? 'opacity-60' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={selected.has(track.id) && !disabled}
                        disabled={disabled || jobRunning || starting}
                        onChange={() => toggleTrack(track.id, !disabled)}
                      />
                      {track.albumArt ? (
                        <img src={track.albumArt} alt="" className="size-10 rounded-md object-cover" />
                      ) : (
                        <div className="size-10 rounded-md bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{track.title}</p>
                        <p className="truncate text-sm text-muted-foreground">{track.artist}</p>
                      </div>
                      {track.alreadyInCatalog ? (
                        <Badge variant="outline">In catalog</Badge>
                      ) : null}
                      {track.isDuplicate ? <Badge variant="outline">Duplicate</Badge> : null}
                    </label>
                  )
                })}
              </div>
              <Button
                type="button"
                disabled={jobRunning || starting || selected.size === 0}
                onClick={() => void handleAddSelected()}
              >
                {jobRunning || starting ? <Spinner data-icon="inline-start" /> : null}
                {jobRunning || starting ? 'Importing…' : `Add selected (${formatNumber(selected.size)})`}
              </Button>
            </div>
          ) : null}

          {job ? (
            <div className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{phaseLabel(job.phase)}</p>
                  <p className="text-sm text-muted-foreground">
                    {job.playlistName ? `${job.playlistName} · ` : ''}
                    {job.total > 0
                      ? `${formatNumber(job.processed)} / ${formatNumber(job.total)} tracks`
                      : 'Waiting for playlist tracks…'}
                  </p>
                </div>
                <Badge
                  variant={
                    job.status === 'error'
                      ? 'destructive'
                      : job.status === 'done'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {job.status}
                </Badge>
              </div>
              <Progress value={progressValue} />
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Added {formatNumber(job.added)}</Badge>
                {job.updated != null && job.updated > 0 ? (
                  <Badge variant="secondary">Updated {formatNumber(job.updated)}</Badge>
                ) : null}
                <Badge variant="outline">Skipped {formatNumber(job.skipped)}</Badge>
                {job.skippedExisting != null ? (
                  <Badge variant="outline">Existing {formatNumber(job.skippedExisting)}</Badge>
                ) : null}
                {job.skippedNonOpm != null ? (
                  <Badge variant="outline">Not local {formatNumber(job.skippedNonOpm)}</Badge>
                ) : null}
                {job.skippedNoPreview != null ? (
                  <Badge variant="outline">No preview {formatNumber(job.skippedNoPreview)}</Badge>
                ) : null}
                {job.country ? <Badge variant="outline">{job.country}</Badge> : null}
              </div>
              {job.skippedNonOpmNames?.length ? (
                <p className="text-sm text-muted-foreground">
                  Skipped artists: {job.skippedNonOpmNames.slice(0, 12).join(', ')}
                  {job.skippedNonOpmNames.length > 12
                    ? ` +${job.skippedNonOpmNames.length - 12} more`
                    : ''}
                </p>
              ) : null}
              {job.error ? <p className="text-sm text-destructive">{job.error}</p> : null}
              {job.errors?.[0] ? (
                <p className="text-sm text-muted-foreground">{job.errors[0]}</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spotify search</CardTitle>
          <CardDescription>Find an OPM track and add it to the catalog.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={(event) => void handleSearch(event)}>
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                placeholder="Search Spotify"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </InputGroup>
          </form>

          {searching ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Searching Spotify…
            </div>
          ) : results.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ListMusicIcon />
                </EmptyMedia>
                <EmptyTitle>Search for a song</EmptyTitle>
                <EmptyDescription>Results appear here so you can add them one by one.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {results.map((track) => (
                <div
                  key={track.id ?? `${track.title}-${track.artist}`}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  {track.albumArt ? (
                    <img src={track.albumArt} alt="" className="size-10 rounded-md object-cover" />
                  ) : (
                    <div className="size-10 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{track.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{track.artist}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={track.isOpm ? 'secondary' : 'outline'}>
                      {track.isOpm ? 'OPM' : 'Not OPM'}
                    </Badge>
                    {track.inCatalog ? (
                      <Badge variant="outline">In catalog</Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!track.isOpm || !track.id || addingId === track.id}
                        onClick={() => void handleAdd(track)}
                      >
                        {addingId === track.id ? <Spinner data-icon="inline-start" /> : null}
                        {addingId === track.id ? 'Adding…' : 'Add'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
