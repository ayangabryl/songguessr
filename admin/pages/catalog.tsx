import { useCallback, useEffect, useState } from 'react'
import { fetchCatalog, removeTrack, type CatalogCounts, type CatalogTrack } from '@/api'
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
import { CountryFlag } from '../../shared/country-flag'
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
  ERA_LABELS,
  ERA_OPTIONS,
  GENRE_LABELS,
  GENRE_OPTIONS,
  countryDisplayName,
  formatNumber,
  formatPlayCount,
} from '@/lib/format'
import { MusicIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

const EMPTY_COUNTS: CatalogCounts = {
  difficulty: {},
  genre: {},
  era: {},
  country: {},
  missingPreview: 0,
}

export function CatalogPage() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [difficulty, setDifficulty] = useState('all')
  const [genre, setGenre] = useState('all')
  const [era, setEra] = useState('all')
  const [country, setCountry] = useState('all')
  const [missingPreview, setMissingPreview] = useState(false)
  const [page, setPage] = useState(1)
  const [tracks, setTracks] = useState<CatalogTrack[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [counts, setCounts] = useState<CatalogCounts>(EMPTY_COUNTS)
  const [loading, setLoading] = useState(true)
  const [pendingRemove, setPendingRemove] = useState<CatalogTrack | null>(null)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCatalog(page, query, {
        difficulty,
        genre,
        era,
        country,
        missingPreview,
      })
      setTracks(data.tracks)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setCounts(data.counts)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load catalog')
    } finally {
      setLoading(false)
    }
  }, [page, query, difficulty, genre, era, country, missingPreview])

  useEffect(() => {
    void load()
  }, [load])

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

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{formatNumber(total)} tracks</CardTitle>
          <CardDescription>Search and filter the live D1 catalog.</CardDescription>
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
                  <TableHead>Track</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Popularity</TableHead>
                  <TableHead>Plays</TableHead>
                  <TableHead>Released</TableHead>
                  <TableHead>Genre</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.map((track) => (
                  <TableRow key={track.id}>
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
                    <TableCell>{formatPlayCount(track.playCount)}</TableCell>
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
                      <Badge variant={track.hasPreview ? 'secondary' : 'destructive'}>
                        {track.hasPreview ? 'Yes' : 'Missing'}
                      </Badge>
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
                ? `“${pendingRemove.title}” by ${pendingRemove.artist} will be removed from the catalog.`
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
    </div>
  )
}
