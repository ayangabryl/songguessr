import { useCallback, useEffect, useState } from 'react'
import {
  fetchArtist,
  fetchCatalogs,
  removeTrack,
  setTrackCollections,
  updateArtist,
  type AdminArtist,
  type AdminCatalog,
  type CatalogTrack,
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
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
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
import { CollectionPickerDialog } from '@/components/collection-picker'
import { CountryFlag } from '../../shared/country-flag'
import { countryDisplayName, formatNumber, formatPlayCount } from '@/lib/format'
import { pathForPage, pushAdminPath } from '@/lib/routes'
import { MusicIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

export function ArtistDetailPage({ artistId }: { artistId: string }) {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [artist, setArtist] = useState<AdminArtist | null>(null)
  const [tracks, setTracks] = useState<CatalogTrack[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<CatalogTrack | null>(null)
  const [removing, setRemoving] = useState(false)
  const [collections, setCollections] = useState<AdminCatalog[]>([])
  const [editingCollections, setEditingCollections] = useState<CatalogTrack | null>(null)
  const [pickerCollections, setPickerCollections] = useState<string[]>([])
  const [savingCollections, setSavingCollections] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchArtist(artistId, page, query)
      setArtist(data.artist)
      setTracks(data.tracks)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load artist')
    } finally {
      setLoading(false)
    }
  }, [artistId, page, query])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void fetchCatalogs()
      .then(setCollections)
      .catch(() => undefined)
  }, [])

  const collectionLabel = (id: string) => collections.find((item) => item.id === id)?.name ?? id

  const handleCountry = async (country: string) => {
    if (!artist) return
    setSaving(true)
    try {
      setArtist(await updateArtist(artist.id, { country }))
      toast.success('Updated artist country')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update country')
    } finally {
      setSaving(false)
    }
  }

  const handleKnown = async (whitelisted: boolean) => {
    if (!artist) return
    setSaving(true)
    try {
      setArtist(await updateArtist(artist.id, { whitelisted }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update known-artist flag')
    } finally {
      setSaving(false)
    }
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

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit px-0"
            onClick={() => pushAdminPath(pathForPage('artists'))}
          >
            ← Artists
          </Button>
          <CardTitle>{artist?.name ?? 'Artist'}</CardTitle>
          <CardDescription>
            Country is origin for import. Known means this artist is allowed when importing that
            country. Collections on each song are separate.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loading && !artist ? (
            <Skeleton className="h-10 w-full" />
          ) : artist ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted-foreground">Country</span>
                <CountryCombobox
                  value={artist.country}
                  disabled={saving}
                  onChange={(value) => void handleCountry(value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={artist.whitelisted}
                  disabled={saving}
                  onCheckedChange={(checked) => void handleKnown(checked)}
                  aria-label={`Known for import ${artist.name}`}
                />
                <span className="text-sm">Known for {countryDisplayName(artist.country)} import</span>
              </div>
              <p className="text-sm text-muted-foreground">{formatNumber(artist.songCount)} songs</p>
            </div>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setQuery(input.trim())
              setPage(1)
            }}
          >
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                placeholder="Search this artist’s songs"
                value={input}
                onChange={(event) => setInput(event.target.value)}
              />
            </InputGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
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
                <EmptyTitle>No songs for this artist</EmptyTitle>
                <EmptyDescription>Import a playlist or try a different search.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Track</TableHead>
                  <TableHead>Plays</TableHead>
                  <TableHead>Released</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Collections</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.map((track) => (
                  <TableRow key={track.id}>
                    <TableCell className="font-medium">{track.title}</TableCell>
                    <TableCell>{formatPlayCount(track.playCount)}</TableCell>
                    <TableCell>{track.releaseDate ?? track.releaseYear ?? '—'}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <CountryFlag code={track.country ?? 'PH'} className="size-4" />
                        {track.country ? countryDisplayName(track.country) : 'Philippines'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="flex max-w-48 flex-wrap items-center gap-1 text-left"
                        onClick={() => {
                          setEditingCollections(track)
                          setPickerCollections(
                            track.collections?.length
                              ? track.collections
                              : track.catalog
                                ? [track.catalog]
                                : [],
                          )
                        }}
                      >
                        {(track.collections?.length
                          ? track.collections
                          : track.catalog
                            ? [track.catalog]
                            : []
                        ).length === 0 ? (
                          <span className="text-muted-foreground">Uncategorized</span>
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
                      </button>
                    </TableCell>
                    <TableCell>
                      <Button variant="destructive" size="sm" onClick={() => setPendingRemove(track)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {formatNumber(total)} songs
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
            <AlertDialogTitle>Remove this song?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove
                ? `“${pendingRemove.title}” will be removed from the library.`
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

      <CollectionPickerDialog
        open={editingCollections !== null}
        title={editingCollections ? `Collections for “${editingCollections.title}”` : 'Collections'}
        collections={collections}
        selected={pickerCollections}
        onSelectedChange={setPickerCollections}
        onCancel={() => setEditingCollections(null)}
        onConfirm={() => void saveCollections()}
        confirming={savingCollections}
        confirmLabel={savingCollections ? 'Saving…' : 'Save'}
      />
    </div>
  )
}
