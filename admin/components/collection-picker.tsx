import { useId } from 'react'
import type { AdminCatalog, CollectionAssignMode } from '@/api'
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
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { pushAdminPath } from '@/lib/routes'

export function toggleId(current: string[], id: string): string[] {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
}

export function collectionsAfterAssign(
  current: string[],
  picked: string[],
  mode: CollectionAssignMode,
): string[] {
  switch (mode) {
    case 'replace':
      return [...picked]
    case 'add':
      return [...new Set([...current, ...picked])]
    default: {
      const exhaustive: never = mode
      return exhaustive
    }
  }
}

export function CollectionChecklist({
  collections,
  selected,
  onChange,
  disabled = false,
}: {
  collections: AdminCatalog[]
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const options =
    collections.length > 0 ? collections : [{ id: 'opm', name: 'OPM', emoji: '🇵🇭', country: 'PH', createdAt: '' }]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex max-h-64 flex-col gap-1 overflow-auto rounded-lg border p-2">
        {options.map((option) => {
          const checked = selected.includes(option.id)
          return (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
            >
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(toggleId(selected, option.id))}
              />
              <NotoEmoji emoji={option.emoji} className="size-4" />
              <span className="min-w-0 flex-1 truncate text-sm">{option.name}</span>
            </label>
          )
        })}
      </div>
      <FieldDescription>
        {selected.length === 0
          ? 'None selected — the song stays untagged.'
          : `${selected.length} collection${selected.length === 1 ? '' : 's'} selected.`}{' '}
        <button
          type="button"
          className="text-primary underline-offset-4 hover:underline"
          onClick={() => pushAdminPath('/catalogs')}
        >
          Manage collections
        </button>
      </FieldDescription>
    </div>
  )
}

export function CollectionAssignModeField({
  value,
  onChange,
  disabled = false,
}: {
  value: CollectionAssignMode
  onChange: (mode: CollectionAssignMode) => void
  disabled?: boolean
}) {
  const name = useId()
  return (
    <Field>
      <FieldLabel>How to apply</FieldLabel>
      <div className="flex flex-col gap-1 rounded-lg border p-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
          <input
            type="radio"
            className="mt-1 size-4 accent-primary"
            name={name}
            checked={value === 'replace'}
            disabled={disabled}
            onChange={() => onChange('replace')}
          />
          <span>
            <span className="block text-sm font-medium">Replace with these</span>
            <span className="block text-sm text-muted-foreground">
              Removes the current tags, then sets the ones you picked.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
          <input
            type="radio"
            className="mt-1 size-4 accent-primary"
            name={name}
            checked={value === 'add'}
            disabled={disabled}
            onChange={() => onChange('add')}
          />
          <span>
            <span className="block text-sm font-medium">Add these</span>
            <span className="block text-sm text-muted-foreground">
              Keeps current tags and adds the ones you picked.
            </span>
          </span>
        </label>
      </div>
    </Field>
  )
}

export function CollectionPickerDialog({
  open,
  title,
  description,
  collections,
  selected,
  onSelectedChange,
  onCancel,
  onConfirm,
  confirming = false,
  confirmLabel = 'Add',
  mode,
  onModeChange,
}: {
  open: boolean
  title: string
  description?: string
  collections: AdminCatalog[]
  selected: string[]
  onSelectedChange: (ids: string[]) => void
  onCancel: () => void
  onConfirm: () => void
  confirming?: boolean
  confirmLabel?: string
  mode?: CollectionAssignMode
  onModeChange?: (mode: CollectionAssignMode) => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !confirming && onCancel()}>
      <AlertDialogContent className="sm:max-w-lg data-[size=default]:sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ??
              'Pick every collection this song belongs to. Leave them unchecked to add it uncategorized.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <CollectionChecklist
          collections={collections}
          selected={selected}
          onChange={onSelectedChange}
          disabled={confirming}
        />
        {mode && onModeChange ? (
          <CollectionAssignModeField value={mode} onChange={onModeChange} disabled={confirming} />
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={confirming || (mode === 'add' && selected.length === 0)}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
