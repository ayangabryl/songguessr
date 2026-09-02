import { NotoEmoji } from '../../shared/noto-emoji'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  EMOJI_CATEGORIES,
  searchCatalogEmojis,
  type EmojiCategoryId,
} from '@/lib/emoji-categories'
import { cn } from '@/lib/utils'
import { useMemo, useState } from 'react'

const CATEGORY_ORDER = EMOJI_CATEGORIES.map((category) => category.id)

export function CatalogEmojiPicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (emoji: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<EmojiCategoryId>('flags')

  const visible = useMemo(() => {
    if (query.trim()) return searchCatalogEmojis(query)
    return EMOJI_CATEGORIES.find((item) => item.id === category)?.emojis ?? []
  }, [category, query])

  return (
    <div className="flex flex-col gap-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery('')
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-10 w-full justify-start gap-2 px-2.5 font-normal"
          >
            {value ? <NotoEmoji emoji={value} className="size-6" /> : null}
            <span className="truncate text-muted-foreground">
              {value ? 'Change emoji' : 'Choose emoji'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[200] flex max-h-[22rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden p-0">
          <div className="sticky top-0 z-10 flex flex-col gap-2 bg-popover p-2">
            <Input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search all emojis"
              aria-label="Search emojis"
            />
            <div className="flex flex-wrap gap-1">
              {CATEGORY_ORDER.map((id) => {
                const label = EMOJI_CATEGORIES.find((item) => item.id === id)?.label ?? id
                return (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      'rounded-md px-2 py-1 text-xs',
                      category === id && !query.trim()
                        ? 'bg-muted font-medium'
                        : 'text-muted-foreground hover:bg-muted/70',
                    )}
                    onClick={() => {
                      setCategory(id)
                      setQuery('')
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto p-2">
            {visible.map((item) => (
              <button
                key={`${item.emoji}-${item.name}`}
                type="button"
                title={item.name}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md hover:bg-muted/70',
                  value === item.emoji ? 'bg-muted ring-1 ring-foreground/20' : '',
                )}
                onClick={() => {
                  onChange(item.emoji)
                  setOpen(false)
                }}
              >
                <NotoEmoji emoji={item.emoji} className="size-5" title={item.name} />
              </button>
            ))}
            {visible.length === 0 ? (
              <p className="col-span-8 px-1 py-2 text-sm text-muted-foreground">No emojis match</p>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      <Input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Or paste an emoji"
        aria-label="Catalog emoji"
      />
    </div>
  )
}
