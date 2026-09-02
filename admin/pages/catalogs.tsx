import { useCallback, useEffect, useState } from 'react'
import {
  createCatalog,
  deleteCatalog,
  fetchCatalogs,
  updateCatalog,
  type AdminCatalog,
} from '@/api'
import { NotoEmoji } from '../../shared/noto-emoji'
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
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CatalogEmojiPicker } from '@/components/emoji-picker'
import { CountryCombobox } from '@/components/country-combobox'
import { CountryFlag } from '../../shared/country-flag'
import { formatNumber } from '@/lib/format'
import { toast } from 'sonner'

export function CatalogsPage() {
  const [catalogs, setCatalogs] = useState<AdminCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🎵')
  const [country, setCountry] = useState('all')
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AdminCatalog | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [editCountry, setEditCountry] = useState('all')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCatalogs(await fetchCatalogs())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load collections')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || creating) return
    setCreating(true)
    try {
      await createCatalog({
        name: name.trim(),
        emoji: emoji.trim() || '🎵',
        country: country === 'all' ? null : country,
      })
      toast.success(`Created collection “${name.trim()}”`)
      setName('')
      setEmoji('🎵')
      setCountry('all')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create collection')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (catalog: AdminCatalog) => {
    setEditingId(catalog.id)
    setEditName(catalog.name)
    setEditEmoji(catalog.emoji)
    setEditCountry(catalog.country ?? 'all')
  }

  const handleSave = async (id: string) => {
    setSavingId(id)
    try {
      await updateCatalog(id, {
        name: editName.trim(),
        emoji: editEmoji.trim() || '🎵',
        country: editCountry === 'all' ? null : editCountry,
      })
      toast.success('Collection updated')
      setEditingId(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update collection')
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteCatalog(pendingDelete.id)
      toast.success(`Deleted “${pendingDelete.name}”`)
      setPendingDelete(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete collection')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Add collection</CardTitle>
          <CardDescription>
            Add a collection (name + emoji) then assign songs to one or more when importing. Country
            origin is separate — K-drama can mix Korean songs and English OSTs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void handleCreate(event)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="catalog-name">Name</FieldLabel>
                <Input
                  id="catalog-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="K-drama"
                />
              </Field>
              <Field>
                <FieldLabel>Emoji</FieldLabel>
                <CatalogEmojiPicker value={emoji} onChange={setEmoji} disabled={creating} />
              </Field>
              <Field>
                <FieldLabel>Default country (optional)</FieldLabel>
                <CountryCombobox
                  value={country}
                  includeAllOption
                  allLabel="No default country"
                  onChange={setCountry}
                  disabled={creating}
                />
              </Field>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? 'Creating…' : 'Add collection'}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collections</CardTitle>
          <CardDescription>Delete only works when no songs use the collection.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <div className="flex flex-col gap-3 px-6 py-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Icon</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Id</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Songs</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalogs.map((catalog) => {
                  const editing = editingId === catalog.id
                  const unused = (catalog.trackCount ?? 0) === 0
                  return (
                    <TableRow key={catalog.id}>
                      <TableCell>
                        {editing ? (
                          <CatalogEmojiPicker
                            value={editEmoji}
                            onChange={setEditEmoji}
                            disabled={savingId === catalog.id}
                          />
                        ) : (
                          <NotoEmoji emoji={catalog.emoji} className="size-6" title={catalog.name} />
                        )}
                      </TableCell>
                      <TableCell>
                        {editing ? (
                          <Input
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                          />
                        ) : (
                          <span className="font-medium">{catalog.name}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{catalog.id}</TableCell>
                      <TableCell>
                        {editing ? (
                          <CountryCombobox
                            value={editCountry}
                            includeAllOption
                            allLabel="No default country"
                            onChange={setEditCountry}
                          />
                        ) : catalog.country ? (
                          <span className="inline-flex items-center gap-2">
                            <CountryFlag code={catalog.country} className="size-4" />
                            {catalog.country}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>{formatNumber(catalog.trackCount ?? 0)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {editing ? (
                            <>
                              <Button
                                size="sm"
                                disabled={savingId === catalog.id}
                                onClick={() => void handleSave(catalog.id)}
                              >
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => startEdit(catalog)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={!unused}
                                onClick={() => setPendingDelete(catalog)}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `“${pendingDelete.name}” (${pendingDelete.id}) will be removed.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={() => void handleDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
