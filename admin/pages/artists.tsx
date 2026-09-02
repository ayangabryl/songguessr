import { useCallback, useEffect, useState } from 'react'
import {
  fetchArtists,
  removeArtist,
  updateArtist,
  type AdminArtist,
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
import { formatNumber } from '@/lib/format'
import { UsersIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

export function ArtistsPage() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [artists, setArtists] = useState<AdminArtist[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [pendingRemove, setPendingRemove] = useState<AdminArtist | null>(null)
  const [removeSongs, setRemoveSongs] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchArtists(page, query)
      setArtists(data.artists)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load artists')
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => {
    void load()
  }, [load])

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setQuery(input.trim())
    setPage(1)
  }

  const handleCountry = async (artist: AdminArtist, country: string) => {
    setSavingId(artist.id)
    try {
      const next = await updateArtist(artist.id, { country })
      setArtists((current) => current.map((row) => (row.id === artist.id ? next : row)))
      toast.success(`Updated country for ${artist.name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update country')
    } finally {
      setSavingId(null)
    }
  }

  const handleWhitelist = async (artist: AdminArtist, whitelisted: boolean) => {
    setSavingId(artist.id)
    try {
      const next = await updateArtist(artist.id, { whitelisted })
      setArtists((current) => current.map((row) => (row.id === artist.id ? next : row)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update whitelist')
    } finally {
      setSavingId(null)
    }
  }

  const handleRemove = async () => {
    if (!pendingRemove) return
    setRemoving(true)
    try {
      const result = await removeArtist(pendingRemove.id, { removeSongs })
      toast.success(
        removeSongs
          ? `Removed ${pendingRemove.name} and ${formatNumber(result.songsRemoved)} songs`
          : `Unlisted ${pendingRemove.name}`,
      )
      setPendingRemove(null)
      setRemoveSongs(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove artist')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{formatNumber(total)} artists</CardTitle>
          <CardDescription>
            Country origin and whitelist live in D1. Unlist an artist, or remove them and optionally
            their songs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch}>
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                placeholder="Search artists"
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
          ) : artists.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>No artists match</EmptyTitle>
                <EmptyDescription>Try a different search.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-64">Country</TableHead>
                  <TableHead>Songs</TableHead>
                  <TableHead>Whitelist</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {artists.map((artist) => (
                  <TableRow key={artist.id}>
                    <TableCell className="font-medium">{artist.name}</TableCell>
                    <TableCell>
                      <CountryCombobox
                        value={artist.country}
                        disabled={savingId === artist.id}
                        onChange={(value) => void handleCountry(artist, value)}
                      />
                    </TableCell>
                    <TableCell>{formatNumber(artist.songCount)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={artist.whitelisted}
                        disabled={savingId === artist.id}
                        onCheckedChange={(checked) => void handleWhitelist(artist, checked)}
                        aria-label={`Whitelist ${artist.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setRemoveSongs(false)
                          setPendingRemove(artist)
                        }}
                      >
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

      <AlertDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRemove(null)
            setRemoveSongs(false)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this artist?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove
                ? `“${pendingRemove.name}” will be deleted from the artists table.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field orientation="horizontal" className="items-center px-1">
            <Switch
              id="remove-artist-songs"
              checked={removeSongs}
              onCheckedChange={setRemoveSongs}
            />
            <FieldLabel htmlFor="remove-artist-songs">
              Also remove their songs from the catalog
            </FieldLabel>
          </Field>
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
