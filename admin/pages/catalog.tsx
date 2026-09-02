import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchCatalog,
  fetchCatalogs,
  refreshPlayCounts,
  removeTrack,
  removeTracksBulk,
  setTrackCollections,
  assignTrackCollections,
  type AdminCatalog,
  type CatalogCounts,
  type CatalogTrack,
  type CollectionAssignMode,
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
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CountryCombobox } from '@/components/country-combobox'
import { CollectionPickerDialog, collectionsAfterAssign } from '@/components/collection-picker'
import { FixMissingPreviewsButton } from '@/components/fix-missing-previews'
import { CountryFlag } from '../../shared/country-flag'
import { NotoEmoji } from '../../shared/noto-emoji'
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
  ERA_LABELS,
  ERA_OPTIONS,
  GENRE_LABELS,
  GENRE_OPTIONS,
  countryDisplayName,
  formatDate,
  formatNumber,
  formatPlayCount,
  isCatalogKind,
} from '@/lib/format'
import { MusicIcon, PencilIcon, RefreshCwIcon, SearchIcon, TagsIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

const EMPTY_COUNTS: CatalogCounts = {
  difficulty: {},
  genre: {},
  era: {},
  country: {},
  missingPreview: 0,
}

const REFETCH_BATCH_SIZE = 40

function collectionFromLocation(): string {
  const value = new URLSearchParams(window.location.search).get('collection')?.trim().toLowerCase()
  return value && isCatalogKind(value) ? value : 'all'
}

function writeCollectionParam(collection: string): void {
  const url = new URL(window.location.href)
  if (!collection || collection === 'all') url.searchParams.delete('collection')
  else url.searchParams.set('collection', collection)
  const next = `${url.pathname}${url.search}${url.hash}`
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next !== current) window.history.replaceState({}, '', next)
}

export function CatalogPage() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [difficulty, setDifficulty] = useState('all')
  const [genre, setGenre] = useState('all')
  const [era, setEra] = useState('all')
  const [country, setCountry] = useState('all')
  const [collection, setCollection] = useState(collectionFromLocation)
  const [missingPreview, setMissingPreview] = useState(false)
  const [page, setPage] = useState(1)
  const [tracks, setTracks] = useState<CatalogTrack[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [counts, setCounts] = useState<CatalogCounts>(EMPTY_COUNTS)
  const [loading, setLoading] = useState(true)
  const [pendingRemove, setPendingRemove] = useState<CatalogTrack | null>(null)
  const [removing, setRemoving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmingBulk, setConfirmingBulk] = useState(false)
  const [refreshingPlays, setRefreshingPlays] = useState(false)
  const [refetchingId, setRefetchingId] = useState<string | null>(null)
  const [refetchProgress, setRefetchProgress] = useState<{ done: number; total: number } | null>(
    null,
  )
  const [collections, setCollections] = useState<AdminCatalog[]>([])
  const [editingCollections, setEditingCollections] = useState<CatalogTrack | null>(null)
  const [pickerCollections, setPickerCollections] = useState<string[]>([])
  const [savingCollections, setSavingCollections] = useState(false)
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false)
  const [bulkMode, setBulkMode] = useState<CollectionAssignMode>('replace')
  const [bulkCollections, setBulkCollections] = useState<string[]>([])
  const [confirmingBulkCollections, setConfirmingBulkCollections] = useState(false)
  const [savingBulkCollections, setSavingBulkCollections] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCatalog(page, query, {
        difficulty,
        genre,
        era,
        country,
        collection,
        missingPreview,
      })
      setTracks(data.tracks)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setCounts(data.counts)
      setSelected(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load songs')
    } finally {
      setLoading(false)
    }
  }, [page, query, difficulty, genre, era, country, collection, missingPreview])

  const allOnPageSelected = useMemo(
    () => tracks.length > 0 && tracks.every((track) => selected.has(track.id)),
    [tracks, selected],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void fetchCatalogs()
      .then(setCollections)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    writeCollectionParam(collection)
  }, [collection])

  useEffect(() => {
    const onPopState = () => {
      const next = collectionFromLocation()
      setCollection((current) => (current === next ? current : next))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const collectionLabel = (id: string) => collections.find((item) => item.id === id)?.name ?? id

  const openCollections = (track: CatalogTrack) => {
    setEditingCollections(track)
    setPickerCollections(
      track.collections?.length ? track.collections : track.catalog ? [track.catalog] : [],
    )
  }

  const saveCollections = async () => {
    if (!editingCollections) return
    setSavingCollections(true)
    try {
      const next = await setTrackCollections(editingCollections.id, pickerCollections)
      setTracks((current) =>
        current.map((track) =>
          track.id === editingCollections.id
            ? { ...track, collections: next, catalog: next[0] }
            : track,
        ),
      )
      setEditingCollections(null)
      toast.success('Collections updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update collections')
    } finally {
      setSavingCollections(false)
    }
  }

  const openBulkCollections = () => {
    setBulkCollections([])
    setBulkMode('replace')
    setBulkPickerOpen(true)
  }

  const saveBulkCollections = async () => {
    if (selected.size === 0) return
    if (bulkMode === 'add' && bulkCollections.length === 0) return
    setSavingBulkCollections(true)
    try {
      const ids = [...selected]
      const response = await assignTrackCollections(ids, bulkCollections, bulkMode)
      const selectedIds = new Set(ids)
      setTracks((current) =>
        current.map((track) => {
          if (!selectedIds.has(track.id)) return track
          const currentIds = track.collections?.length
            ? track.collections
            : track.catalog
              ? [track.catalog]
              : []
          const next = collectionsAfterAssign(currentIds, bulkCollections, bulkMode)
          return { ...track, collections: next, catalog: next[0] }
        }),
      )
      setConfirmingBulkCollections(false)
      toast.success(
        bulkMode === 'replace'
          ? `Replaced collections on ${formatNumber(response.updated)} songs`
          : `Added collections to ${formatNumber(response.updated)} songs`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update collections')
    } finally {
      setSavingBulkCollections(false)
    }
  }

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setQuery(input.trim())
    setPage(1)
  }

  const handleRemove = async () => {
    if (!pendingRemove) return
    setRemoving(true)
    try {
      await removeTrack(pendingRemove.id)
      toast.success(`Removed “${pendingRemove.title}”`)
      setPendingRemove(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove track')
    } finally {
      setRemoving(false)
    }
  }

  const toggleTrack = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllOnPage = () => {
    setSelected((current) => {
      const next = new Set(current)
      if (allOnPageSelected) {
        for (const track of tracks) next.delete(track.id)
      } else {
        for (const track of tracks) next.add(track.id)
      }
      return next
    })
  }

  const handleRefreshPlayCounts = async (trackIds?: string[]) => {
    const ids = trackIds?.length ? [...new Set(trackIds.filter(Boolean))] : undefined
    setRefreshingPlays(true)
    setRefetchingId(ids?.length === 1 ? (ids[0] ?? null) : null)
    setRefetchProgress(ids && ids.length > 1 ? { done: 0, total: ids.length } : null)
    try {
      if (!ids) {
        const response = await refreshPlayCounts({
          limit: 250,
          collection: collection !== 'all' ? collection : undefined,
        })
        toast.success(response.message)
        if (response.errors.length > 0) toast.warning(response.errors[0])
        await load()
        return
      }

      let updated = 0
      let playCountFilled = 0
      let popularityFilled = 0
      let releaseDateFilled = 0
      const errors: string[] = []
      let rateLimited = false
      let lastMessage = ''

      for (let index = 0; index < ids.length; index += REFETCH_BATCH_SIZE) {
        const batch = ids.slice(index, index + REFETCH_BATCH_SIZE)
        const response = await refreshPlayCounts({
          trackIds: batch,
          limit: batch.length,
        })
        updated += response.updated
        playCountFilled += response.playCountFilled
        popularityFilled += response.popularityFilled
        releaseDateFilled += response.releaseDateFilled
        rateLimited = rateLimited || response.rateLimited
        lastMessage = response.message
        for (const error of response.errors) {
          if (!errors.includes(error)) errors.push(error)
        }
        setRefetchProgress({ done: Math.min(index + batch.length, ids.length), total: ids.length })
      }

      toast.success(
        ids.length === 1
          ? lastMessage
          : `Refetched ${playCountFilled} play counts, ${popularityFilled} popularity values, and ${releaseDateFilled} release dates across ${ids.length} songs (${updated} rows updated).`,
      )
      if (errors.length > 0) toast.warning(errors[0])
      if (rateLimited) toast.warning('Spotify throttled part of this run; retry the rest later.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to refetch Spotify stats')
      await load()
    } finally {
      setRefreshingPlays(false)
      setRefetchingId(null)
      setRefetchProgress(null)
    }
  }

  const handleRemoveSelected = async () => {
    if (selected.size === 0) return
    setRemoving(true)
    try {
      const response = await removeTracksBulk([...selected])
      toast.success(`Removed ${formatNumber(response.removed)} tracks`)
      setConfirmingBulk(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove tracks')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{formatNumber(total)} tracks</CardTitle>
          <CardDescription>
            Search and filter the live song library. Collection matches the game buckets. Refetch
            fills play count, popularity, and release date from Spotify's public web player,
            then recomputes the stored difficulty column (catalog-wide ingest tier; the game ranks
            within the filtered pool at play time).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleSearch}>
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                placeholder="Search title, artist, or ID"
                value={input}
                onChange={(event) => setInput(event.target.value)}
              />
            </InputGroup>
          </form>
          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-48">
              <FieldLabel>Difficulty</FieldLabel>
              <Select
                value={difficulty}
                onValueChange={(value) => {
                  setDifficulty(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">
                      All difficulties
                    </SelectItem>
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {DIFFICULTY_LABELS[option]} ({formatNumber(counts.difficulty[option] ?? 0)})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="w-52">
              <FieldLabel>Genre</FieldLabel>
              <Select
                value={genre}
                onValueChange={(value) => {
                  setGenre(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All genres</SelectItem>
                    {GENRE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {GENRE_LABELS[option]} ({formatNumber(counts.genre[option] ?? 0)})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="w-56">
              <FieldLabel>Collection</FieldLabel>
              <Select
                value={collection}
                onValueChange={(value) => {
                  setCollection(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All collections</SelectItem>
                    {collections.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        <span className="inline-flex items-center gap-2">
                          <NotoEmoji emoji={item.emoji} className="size-4" />
                          {item.name}
                          {item.trackCount != null
                            ? ` (${formatNumber(item.trackCount)})`
                            : ''}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="w-56">
              <FieldLabel>Country</FieldLabel>
              <CountryCombobox
                value={country}
                includeAllOption
                counts={counts.country}
                onChange={(value) => {
                  setCountry(value)
                  setPage(1)
                }}
              />
            </Field>
            <Field className="w-52">
              <FieldLabel>Era</FieldLabel>
              <Select
                value={era}
                onValueChange={(value) => {
                  setEra(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All eras</SelectItem>
                    {ERA_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {ERA_LABELS[option]} ({formatNumber(counts.era[option] ?? 0)})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field orientation="horizontal" className="w-auto items-center">
              <Switch
                id="missing-preview"
                checked={missingPreview}
                onCheckedChange={(checked) => {
                  setMissingPreview(checked)
                  setPage(1)
                }}
              />
              <FieldLabel htmlFor="missing-preview">
                Missing preview
                <Badge variant="secondary">{formatNumber(counts.missingPreview)}</Badge>
              </FieldLabel>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b pb-4">
          <p className="text-sm font-medium">
            {selected.size > 0
              ? `${formatNumber(selected.size)} selected`
              : `${formatNumber(total)} tracks`}
          </p>
          <div className="flex flex-wrap items-start justify-end gap-2">
            <FixMissingPreviewsButton
              missingCount={counts.missingPreview}
              onDone={() => void load()}
            />
            {refetchProgress ? (
              <div className="flex min-w-40 flex-col gap-1">
                <Progress
                  value={Math.round((refetchProgress.done / refetchProgress.total) * 100)}
                  className="w-40"
                />
                <p className="text-xs text-muted-foreground">
                  {formatNumber(refetchProgress.done)} / {formatNumber(refetchProgress.total)}
                </p>
              </div>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={refreshingPlays}
              onClick={() =>
                void handleRefreshPlayCounts(selected.size > 0 ? [...selected] : undefined)
              }
              title={
                selected.size > 0
                  ? 'Refetch play count, popularity, and release date for the selected songs'
                  : collection !== 'all'
                    ? 'Refetch missing public stats in this collection'
                    : 'Refetch missing public stats from Spotify public APIs'
              }
            >
              {refreshingPlays && !refetchingId ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              {refreshingPlays
                ? 'Refetching…'
                : selected.size > 0
                  ? `Refetch stats (${formatNumber(selected.size)})`
                  : 'Refetch missing'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selected.size === 0}
              onClick={openBulkCollections}
              title={
                selected.size === 0
                  ? 'Select songs first'
                  : `Set collections on ${formatNumber(selected.size)} songs`
              }
            >
              <TagsIcon data-icon="inline-start" />
              {selected.size > 0
                ? `Set collections (${formatNumber(selected.size)})`
                : 'Set collections'}
            </Button>
            {selected.size > 0 ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={removing}
                  onClick={() => setConfirmingBulk(true)}
                >
                  <Trash2Icon data-icon="inline-start" />
                  Remove selected
                </Button>
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <div className="flex flex-col gap-3 px-6 py-4">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MusicIcon />
                </EmptyMedia>
                <EmptyTitle>No tracks match</EmptyTitle>
                <EmptyDescription>Try a different search or clear filters.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      aria-label="Select all tracks on this page"
                      checked={allOnPageSelected}
                      onChange={toggleAllOnPage}
                    />
                  </TableHead>
                  <TableHead>Track</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead
                    title="Catalog-wide ingest tier. The game ranks songs within the filtered pool at play time."
                  >
                    Difficulty
                  </TableHead>
                  <TableHead>Popularity</TableHead>
                  <TableHead>Plays</TableHead>
                  <TableHead>Released</TableHead>
                  <TableHead>Genre</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Collections</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.map((track) => (
                  <TableRow key={track.id} data-state={selected.has(track.id) ? 'selected' : undefined}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        aria-label={`Select ${track.title}`}
                        checked={selected.has(track.id)}
                        onChange={() => toggleTrack(track.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {track.albumArt ? (
                          <img
                            src={track.albumArt}
                            alt=""
                            className="size-9 rounded-md object-cover"
                          />
                        ) : (
                          <div className="size-9 rounded-md bg-muted" />
                        )}
                        <span className="font-medium">{track.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>{track.artist}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{track.difficulty}</Badge>
                    </TableCell>
                    <TableCell>
                      {track.popularity != null ? (
                        <span title="Official Spotify popularity 0–100">
                          {formatNumber(track.popularity)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        title={
                          track.playCountUpdatedAt
                            ? `${formatNumber(track.playCount ?? 0)} plays · updated ${formatDate(track.playCountUpdatedAt)}`
                            : 'Never fetched from the public web player'
                        }
                      >
                        {formatPlayCount(track.playCount)}
                      </span>
                      {track.playCountUpdatedAt ? null : (
                        <span className="ml-1 text-xs text-muted-foreground">·&nbsp;stale</span>
                      )}
                    </TableCell>
                    <TableCell>{track.releaseDate ?? track.releaseYear ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(track.genreGroups ?? []).map((group) => (
                          <Badge key={group} variant="outline">
                            {GENRE_LABELS[group as keyof typeof GENRE_LABELS] ?? group}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <CountryFlag code={track.country ?? 'PH'} className="size-4" />
                        {track.country ? countryDisplayName(track.country) : 'Philippines'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        title="Edit collections"
                        className="flex max-w-52 cursor-pointer flex-wrap items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-muted/60"
                        onClick={() => openCollections(track)}
                      >
                        {(track.collections?.length
                          ? track.collections
                          : track.catalog
                            ? [track.catalog]
                            : []
                        ).length === 0 ? (
                          <span className="text-muted-foreground">Untagged</span>
                        ) : (
                          (track.collections?.length
                            ? track.collections
                            : track.catalog
                              ? [track.catalog]
                              : []
                          ).map((id) => (
                            <Badge key={id} variant="outline">
                              {collectionLabel(id)}
                            </Badge>
                          ))
                        )}
                        <PencilIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={track.hasPreview ? 'secondary' : 'destructive'}>
                        {track.hasPreview ? 'Yes' : 'Missing'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={refreshingPlays}
                          onClick={() => void handleRefreshPlayCounts([track.id])}
                          title="Refetch play count, popularity, and release date from Spotify public APIs"
                        >
                          {refetchingId === track.id ? (
                            <Spinner data-icon="inline-start" />
                          ) : (
                            <RefreshCwIcon data-icon="inline-start" />
                          )}
                          {refetchingId === track.id ? 'Refetching…' : 'Refetch'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCollections(track)}
                        >
                          <PencilIcon data-icon="inline-start" />
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setPendingRemove(track)}>
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(event) => {
                    event.preventDefault()
                    if (page > 1) setPage(page - 1)
                  }}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(event) => {
                    event.preventDefault()
                    if (page < totalPages) setPage(page + 1)
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardFooter>
      </Card>

      <AlertDialog open={pendingRemove !== null} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this track?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove
                ? `“${pendingRemove.title}” by ${pendingRemove.artist} will be removed from the library.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={removing} onClick={() => void handleRemove()}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmingBulk} onOpenChange={(open) => !open && setConfirmingBulk(false)}>
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
            <AlertDialogAction disabled={removing} onClick={() => void handleRemoveSelected()}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CollectionPickerDialog
        open={editingCollections !== null}
        title={editingCollections ? `Edit collections — “${editingCollections.title}”` : 'Edit collections'}
        description="Pick the collections for this song. Saving replaces the current tags."
        collections={collections}
        selected={pickerCollections}
        onSelectedChange={setPickerCollections}
        onCancel={() => setEditingCollections(null)}
        onConfirm={() => void saveCollections()}
        confirming={savingCollections}
        confirmLabel={savingCollections ? 'Saving…' : 'Save'}
      />

      <CollectionPickerDialog
        open={bulkPickerOpen}
        title={`Set collections on ${formatNumber(selected.size)} songs`}
        description="Replace is the default — it removes the wrong tags, then sets the ones you pick. Add these keeps current tags."
        collections={collections}
        selected={bulkCollections}
        onSelectedChange={setBulkCollections}
        mode={bulkMode}
        onModeChange={setBulkMode}
        onCancel={() => setBulkPickerOpen(false)}
        onConfirm={() => {
          setBulkPickerOpen(false)
          setConfirmingBulkCollections(true)
        }}
        confirmLabel="Continue"
      />

      <AlertDialog
        open={confirmingBulkCollections}
        onOpenChange={(open) => !open && setConfirmingBulkCollections(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkMode === 'replace'
                ? `Replace collections on ${formatNumber(selected.size)} songs?`
                : `Add collections to ${formatNumber(selected.size)} songs?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkMode === 'replace'
                ? 'Songs stay in the library. Current collection tags on the selected songs will be replaced with the ones you picked.'
                : 'Songs stay in the library. Current tags stay, and the collections you picked will be added.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingBulkCollections}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={savingBulkCollections || (bulkMode === 'add' && bulkCollections.length === 0)}
              onClick={() => void saveBulkCollections()}
            >
              {bulkMode === 'replace' ? 'Replace' : 'Add'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
