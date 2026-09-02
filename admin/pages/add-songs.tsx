import { useEffect, useMemo, useState } from 'react'
import {
  addTrack,
  assignTrackCollections,
  fetchCatalogs,
  fetchJob,
  previewPlaylist,
  removeTracksBulk,
  searchSpotify,
  startPlaylistImport,
  type AdminCatalog,
  type CatalogJob,
  type CollectionAssignMode,
  type JobPhase,
  type PlaylistPreview,
  type PlaylistPreviewTrack,
  type SpotifySearchResult,
} from '@/api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { Spinner } from '@/components/ui/spinner'
import { CountryCombobox } from '@/components/country-combobox'
import {
  CollectionAssignModeField,
  CollectionChecklist,
  CollectionPickerDialog,
  collectionsAfterAssign,
} from '@/components/collection-picker'
import { Switch } from '@/components/ui/switch'
import { countryDisplayName, formatNumber } from '@/lib/format'
import { ListMusicIcon, SearchIcon, TagsIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

const PHASE_LABELS: Record<JobPhase, string> = {
  queued: 'Queued',
  fetching: 'Fetching playlist',
  filtering: 'Filtering tracks',
  resolving: 'Resolving previews',
  saving: 'Saving songs',
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
  const [selectedCollections, setSelectedCollections] = useState<string[]>(['opm'])
  const [catalogs, setCatalogs] = useState<AdminCatalog[]>([])
  const [pendingAdd, setPendingAdd] = useState<SpotifySearchResult | null>(null)
  const [pickerCollections, setPickerCollections] = useState<string[]>(['opm'])
  const [trustArtists, setTrustArtists] = useState(false)
  const [requireKnownArtists, setRequireKnownArtists] = useState(true)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [preview, setPreview] = useState<PlaylistPreview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [trackCountries, setTrackCountries] = useState<Record<string, string>>({})
  const [previewing, setPreviewing] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<CatalogJob | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    void fetchCatalogs()
      .then((rows) => {
        setCatalogs(rows)
        setSelectedCollections((current) => {
          const valid = current.filter((id) => rows.some((row) => row.id === id))
          return valid.length > 0 ? valid : rows[0] ? [rows[0].id] : []
        })
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
  const globalOrigin = country === 'GLOBAL'

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

  const handleAdd = (track: SpotifySearchResult) => {
    if (!track.id) return
    setPendingAdd(track)
    setPickerCollections(selectedCollections)
  }

  const confirmAdd = async () => {
    const track = pendingAdd
    if (!track?.id) return
    setAddingId(track.id)
    try {
      const added = await addTrack(track.id, {
        country,
        collections: pickerCollections,
        title: track.title,
        artist: track.artist,
        albumArt: track.albumArt,
      })
      if (added.previewMissing) {
        toast.warning(
          `Added “${track.title}” without a preview URL. Use Fix missing previews on Dashboard or Catalog.`,
        )
      } else {
        toast.success(`Added “${track.title}”`)
      }
      setResults((current) =>
        current.map((item) => (item.id === track.id ? { ...item, inCatalog: true } : item)),
      )
      setSelectedCollections(pickerCollections)
      setPendingAdd(null)
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
      setTrackCountries(Object.fromEntries(next.tracks.map((track) => [track.id, country])))
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

  const setDefaultCountry = (next: string) => {
    setCountry(next)
    setTrackCountries((current) => {
      if (!preview) return current
      const updated = { ...current }
      for (const track of preview.tracks) {
        if (!updated[track.id] || updated[track.id] === country) {
          updated[track.id] = next
        }
      }
      return updated
    })
  }

  const applyCountryToAllRows = () => {
    if (!preview) return
    setTrackCountries(Object.fromEntries(preview.tracks.map((track) => [track.id, country])))
  }

  const handleAddSelected = async () => {
    if (!playlistUrl.trim() || starting || selected.size === 0) return
    setStarting(true)
    setJob(null)
    try {
      const id = await startPlaylistImport(playlistUrl.trim(), {
        country,
        collections: selectedCollections,
        trustArtists: globalOrigin ? false : trustArtists,
        requireKnownArtists: globalOrigin || trustArtists ? false : requireKnownArtists,
        trackIds: [...selected],
        trackCountries: Object.fromEntries(
          [...selected].map((trackId) => [trackId, trackCountries[trackId] ?? country]),
        ),
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

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Spotify playlist</CardTitle>
          <CardDescription>
            Paste a Spotify playlist. Set origin for the songs, then which collections to tag.
            Already imported with the wrong tags? Use Fix collections below — don’t re-import.
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
                  <FieldLabel>Default origin</FieldLabel>
                  <CountryCombobox
                    value={country}
                    onChange={setDefaultCountry}
                    disabled={jobRunning || starting}
                  />
                  <FieldDescription>
                    Use Global for mixed-region playlists.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Collections</FieldLabel>
                  <CollectionChecklist
                    collections={catalogs}
                    selected={selectedCollections}
                    onChange={setSelectedCollections}
                    disabled={jobRunning || starting}
                  />
                </Field>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => setShowMoreOptions((open) => !open)}
                >
                  {showMoreOptions ? 'Fewer options' : 'More options'}
                </button>
                {showMoreOptions ? (
                  <div className="flex flex-col gap-3">
                    <Field orientation="horizontal" className="items-start">
                      <Switch
                        id="trust-artists"
                        checked={trustArtists && !globalOrigin}
                        onCheckedChange={(checked) => {
                          setTrustArtists(checked)
                          if (checked) setRequireKnownArtists(false)
                        }}
                        disabled={jobRunning || starting || globalOrigin}
                      />
                      <FieldLabel htmlFor="trust-artists">
                        Add these artists to the origin’s list
                      </FieldLabel>
                    </Field>
                    <Field orientation="horizontal" className="items-start">
                      <Switch
                        id="require-known"
                        checked={requireKnownArtists && !trustArtists && !globalOrigin}
                        onCheckedChange={(checked) => {
                          setRequireKnownArtists(checked)
                          if (checked) setTrustArtists(false)
                        }}
                        disabled={jobRunning || starting || globalOrigin}
                      />
                      <FieldLabel htmlFor="require-known">
                        Only songs by artists already on this origin’s list
                      </FieldLabel>
                    </Field>
                    {globalOrigin ? (
                      <FieldDescription>Artist lists are per country, so they don’t apply to Global.</FieldDescription>
                    ) : null}
                  </div>
                ) : null}
              </div>
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
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                    Select all
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={selectNone}>
                    Select none
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={applyCountryToAllRows}>
                    Set all origins to {countryDisplayName(country)}
                  </Button>
                </div>
              </div>
              <div className="flex max-h-96 flex-col gap-2 overflow-auto">
                {preview.tracks.map((track) => {
                  const disabled = track.alreadyInCatalog || track.isDuplicate
                  return (
                    <div
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
                      <div className="w-44 shrink-0">
                        <CountryCombobox
                          value={trackCountries[track.id] ?? country}
                          disabled={disabled || jobRunning || starting}
                          onChange={(value) =>
                            setTrackCountries((current) => ({ ...current, [track.id]: value }))
                          }
                        />
                      </div>
                      {track.alreadyInCatalog ? (
                        <Badge variant="outline">Already added</Badge>
                      ) : null}
                      {track.isDuplicate ? <Badge variant="outline">Duplicate</Badge> : null}
                    </div>
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

      <FixCollectionsByPlaylistCard catalogs={catalogs} />

      <RemoveByPlaylistCard />

      <Card>
        <CardHeader>
          <CardTitle>Spotify search</CardTitle>
          <CardDescription>Search Spotify. You’ll pick collections when you add.</CardDescription>
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
                    {track.inCatalog ? (
                      <Badge variant="outline">Already added</Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!track.id || addingId === track.id}
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

      <CollectionPickerDialog
        open={pendingAdd !== null}
        title={pendingAdd ? `Add “${pendingAdd.title}”` : 'Add song'}
        description="Pick collections for this song."
        collections={catalogs}
        selected={pickerCollections}
        onSelectedChange={setPickerCollections}
        onCancel={() => setPendingAdd(null)}
        onConfirm={() => void confirmAdd()}
        confirming={addingId === pendingAdd?.id}
        confirmLabel={addingId === pendingAdd?.id ? 'Adding…' : 'Add to library'}
      />
    </div>
  )
}

interface RemoveResultSummary {
  removed: number
  notFound: number
  totalTracks: number
}

function libraryTrackId(track: PlaylistPreviewTrack): string | null {
  if (!track.alreadyInCatalog) return null
  return track.catalogTrackId ?? track.id
}

function FixCollectionsByPlaylistCard({ catalogs }: { catalogs: AdminCatalog[] }) {
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [preview, setPreview] = useState<PlaylistPreview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedCollections, setSelectedCollections] = useState<string[]>([])
  const [mode, setMode] = useState<CollectionAssignMode>('replace')
  const [fetching, setFetching] = useState(false)
  const [applying, setApplying] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ updated: number; notFound: number } | null>(null)

  const collectionLabel = (id: string) => catalogs.find((item) => item.id === id)?.name ?? id

  const inLibraryTracks = useMemo(
    () => (preview?.tracks ?? []).filter((track) => Boolean(libraryTrackId(track))),
    [preview],
  )

  const selectedCatalogIds = useMemo(() => {
    if (!preview) return []
    const ids: string[] = []
    for (const track of preview.tracks) {
      if (!selected.has(track.id)) continue
      const catalogId = libraryTrackId(track)
      if (catalogId) ids.push(catalogId)
    }
    return [...new Set(ids)]
  }, [preview, selected])

  const handleFetch = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!playlistUrl.trim() || fetching) return
    setFetching(true)
    setPreview(null)
    setSelected(new Set())
    setResult(null)
    try {
      const next = await previewPlaylist(playlistUrl.trim())
      setPreview(next)
      setSelected(
        new Set(next.tracks.filter((track) => Boolean(libraryTrackId(track))).map((track) => track.id)),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Playlist fetch failed')
    } finally {
      setFetching(false)
    }
  }

  const toggle = (id: string, enabled: boolean) => {
    if (!enabled) return
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleApply = async () => {
    if (selectedCatalogIds.length === 0) return
    if (mode === 'add' && selectedCollections.length === 0) return
    setApplying(true)
    try {
      const response = await assignTrackCollections(selectedCatalogIds, selectedCollections, mode)
      setResult({ updated: response.updated, notFound: response.notFound })
      const updatedIds = new Set(selected)
      setPreview((current) =>
        current
          ? {
              ...current,
              tracks: current.tracks.map((track) => {
                if (!updatedIds.has(track.id) || !libraryTrackId(track)) return track
                const nextCollections = collectionsAfterAssign(
                  track.collections ?? [],
                  selectedCollections,
                  mode,
                )
                return { ...track, collections: nextCollections }
              }),
            }
          : current,
      )
      setConfirming(false)
      toast.success(
        mode === 'replace'
          ? `Replaced collections on ${formatNumber(response.updated)} songs`
          : `Added collections to ${formatNumber(response.updated)} songs`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update collections')
    } finally {
      setApplying(false)
    }
  }

  const applyDisabled =
    applying ||
    selectedCatalogIds.length === 0 ||
    (mode === 'add' && selectedCollections.length === 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fix collections</CardTitle>
        <CardDescription>
          Tagged the wrong collections on import? Paste the same playlist, pick the right ones, and
          replace the tags. Songs stay in the library.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={(event) => void handleFetch(event)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="fix-playlist-url">Playlist URL</FieldLabel>
              <Input
                id="fix-playlist-url"
                value={playlistUrl}
                onChange={(event) => {
                  setPlaylistUrl(event.target.value)
                  setPreview(null)
                  setSelected(new Set())
                  setResult(null)
                }}
                placeholder="https://open.spotify.com/playlist/…"
                disabled={fetching || applying}
              />
            </Field>
            <Button type="submit" variant="outline" disabled={fetching || applying || !playlistUrl.trim()}>
              {fetching ? <Spinner data-icon="inline-start" /> : null}
              {fetching ? 'Fetching…' : 'Fetch songs'}
            </Button>
          </FieldGroup>
        </form>

        {preview ? (
          <div className="flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{preview.playlistName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(selectedCatalogIds.length)} selected ·{' '}
                  {formatNumber(inLibraryTracks.length)} in library ·{' '}
                  {formatNumber(preview.tracks.length)} in playlist
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelected(new Set(inLibraryTracks.map((track) => track.id)))
                  }
                >
                  Only in library ({formatNumber(inLibraryTracks.length)})
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                  Select none
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Correct collections</FieldLabel>
                <CollectionChecklist
                  collections={catalogs}
                  selected={selectedCollections}
                  onChange={setSelectedCollections}
                  disabled={applying}
                />
              </Field>
              <CollectionAssignModeField value={mode} onChange={setMode} disabled={applying} />
            </div>

            <div className="flex max-h-96 flex-col gap-2 overflow-auto">
              {preview.tracks.map((track) => {
                const inLibrary = Boolean(libraryTrackId(track))
                const current = track.collections ?? []
                return (
                  <div
                    key={`${track.id}-${track.title}`}
                    className={`flex items-center gap-3 rounded-lg border p-3 ${
                      inLibrary ? '' : 'opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selected.has(track.id) && inLibrary}
                      disabled={!inLibrary || applying}
                      onChange={() => toggle(track.id, inLibrary)}
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
                    {inLibrary ? (
                      <div className="flex max-w-48 flex-wrap justify-end gap-1">
                        {current.length === 0 ? (
                          <Badge variant="outline">Untagged</Badge>
                        ) : (
                          current.map((id) => (
                            <Badge key={id} variant="secondary">
                              {collectionLabel(id)}
                            </Badge>
                          ))
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline">Not in library</Badge>
                    )}
                  </div>
                )
              })}
            </div>

            <Button
              type="button"
              disabled={applyDisabled}
              onClick={() => setConfirming(true)}
            >
              {applying ? <Spinner data-icon="inline-start" /> : <TagsIcon data-icon="inline-start" />}
              {applying
                ? 'Updating…'
                : mode === 'replace'
                  ? `Replace on selected (${formatNumber(selectedCatalogIds.length)})`
                  : `Add to selected (${formatNumber(selectedCatalogIds.length)})`}
            </Button>
          </div>
        ) : null}

        {result ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Updated {formatNumber(result.updated)}</Badge>
            {result.notFound > 0 ? (
              <Badge variant="outline">Not in library {formatNumber(result.notFound)}</Badge>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <AlertDialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {mode === 'replace'
                ? `Replace collections on ${formatNumber(selectedCatalogIds.length)} songs?`
                : `Add collections to ${formatNumber(selectedCatalogIds.length)} songs?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {mode === 'replace'
                ? 'Songs stay in the library. Current collection tags on the selected songs will be replaced with the ones you picked.'
                : 'Songs stay in the library. Current tags stay, and the collections you picked will be added.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={applying} onClick={() => void handleApply()}>
              {mode === 'replace' ? 'Replace' : 'Add'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function RemoveByPlaylistCard() {
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [preview, setPreview] = useState<PlaylistPreview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [fetching, setFetching] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<RemoveResultSummary | null>(null)

  const inCatalogIds = useMemo(
    () => (preview?.tracks ?? []).filter((track) => track.alreadyInCatalog).map((track) => track.id),
    [preview],
  )

  const handleFetch = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!playlistUrl.trim() || fetching) return
    setFetching(true)
    setPreview(null)
    setSelected(new Set())
    setResult(null)
    try {
      const next = await previewPlaylist(playlistUrl.trim())
      setPreview(next)
      setSelected(
        new Set(next.tracks.filter((track) => track.alreadyInCatalog).map((track) => track.id)),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Playlist fetch failed')
    } finally {
      setFetching(false)
    }
  }

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleRemove = async () => {
    if (selected.size === 0) return
    setRemoving(true)
    try {
      const response = await removeTracksBulk([...selected])
      setResult({
        removed: response.removed,
        notFound: response.notFound,
        totalTracks: response.totalTracks,
      })
      const removedIds = new Set(selected)
      setPreview((current) =>
        current
          ? {
              ...current,
              tracks: current.tracks.map((track) =>
                removedIds.has(track.id) ? { ...track, alreadyInCatalog: false } : track,
              ),
            }
          : current,
      )
      setSelected(new Set())
      setConfirming(false)
      toast.success(`Removed ${formatNumber(response.removed)} tracks`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk remove failed')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Remove by playlist</CardTitle>
        <CardDescription>
          Fetch a playlist to remove matching songs from the library.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={(event) => void handleFetch(event)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="remove-playlist-url">Playlist URL</FieldLabel>
              <Input
                id="remove-playlist-url"
                value={playlistUrl}
                onChange={(event) => {
                  setPlaylistUrl(event.target.value)
                  setPreview(null)
                  setSelected(new Set())
                  setResult(null)
                }}
                placeholder="https://open.spotify.com/playlist/…"
                disabled={fetching || removing}
              />
            </Field>
            <Button type="submit" variant="outline" disabled={fetching || removing || !playlistUrl.trim()}>
              {fetching ? <Spinner data-icon="inline-start" /> : null}
              {fetching ? 'Fetching…' : 'Fetch songs'}
            </Button>
          </FieldGroup>
        </form>

        {preview ? (
          <div className="flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{preview.playlistName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(selected.size)} selected · {formatNumber(inCatalogIds.length)} in
                  library · {formatNumber(preview.tracks.length)} in playlist
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set(preview.tracks.map((track) => track.id)))}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  Select none
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set(inCatalogIds))}
                >
                  Only in library ({formatNumber(inCatalogIds.length)})
                </Button>
              </div>
            </div>

            <div className="flex max-h-96 flex-col gap-2 overflow-auto">
              {preview.tracks.map((track) => (
                <div
                  key={`${track.id}-${track.title}`}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    track.alreadyInCatalog ? '' : 'opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-destructive"
                    checked={selected.has(track.id)}
                    disabled={removing}
                    onChange={() => toggle(track.id)}
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
                  <Badge variant={track.alreadyInCatalog ? 'secondary' : 'outline'}>
                    {track.alreadyInCatalog ? 'In library' : 'Not in library'}
                  </Badge>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="destructive"
              disabled={removing || selected.size === 0}
              onClick={() => setConfirming(true)}
            >
              {removing ? <Spinner data-icon="inline-start" /> : <Trash2Icon data-icon="inline-start" />}
              {removing ? 'Removing…' : `Remove selected (${formatNumber(selected.size)})`}
            </Button>
          </div>
        ) : null}

        {result ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Removed {formatNumber(result.removed)}</Badge>
            <Badge variant="outline">Not in library {formatNumber(result.notFound)}</Badge>
            <Badge variant="outline">Library now {formatNumber(result.totalTracks)}</Badge>
          </div>
        ) : null}
      </CardContent>

      <AlertDialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {formatNumber(selected.size)} tracks?</AlertDialogTitle>
            <AlertDialogDescription>
              These tracks are deleted from the live library and stop appearing in the game. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={removing} onClick={() => void handleRemove()}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
