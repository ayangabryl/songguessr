import type { EmojiMartData } from '@emoji-mart/data'
import emojiMartData from '@emoji-mart/data'
import { ISO_COUNTRIES } from '../../shared/iso-countries'
import { isoCountryToFlagEmoji } from '../../shared/noto-emoji'

export type EmojiCategoryId =
  | 'flags'
  | 'music'
  | 'smileys'
  | 'people'
  | 'nature'
  | 'food'
  | 'travel'
  | 'objects'
  | 'symbols'

export interface CatalogEmoji {
  emoji: string
  name: string
  keywords: string[]
}

export interface EmojiCategory {
  id: EmojiCategoryId
  label: string
  emojis: CatalogEmoji[]
}

const MUSIC_MATCH =
  /music|musical|note|guitar|microphone|headphone|saxophone|trumpet|violin|drum|piano|radio|karaoke|singer|accordion|banjo|maracas|control knobs/

const SMILEY_MATCH = /face|smile|grin|laugh|sad|cry|wink|kiss|angry|think|sleep|nauseat|vomit|skull|ghost|poop|clown|ogre|goblin|alien|robot|cat|monkey|see-no|hear-no|speak-no|heart|kiss mark|love|hundred|anger|boom|dizzy|sweat|dash|hole|speech|thought/

const data = emojiMartData as EmojiMartData

function nativeOf(id: string): CatalogEmoji | null {
  const emoji = data.emojis[id]
  const native = emoji?.skins?.[0]?.native
  if (!emoji || !native) return null
  return {
    emoji: native,
    name: emoji.name,
    keywords: [emoji.id, emoji.name, ...(emoji.keywords ?? [])],
  }
}

function uniqueEmojis(items: CatalogEmoji[]): CatalogEmoji[] {
  const seen = new Set<string>()
  const unique: CatalogEmoji[] = []
  for (const item of items) {
    if (seen.has(item.emoji)) continue
    seen.add(item.emoji)
    unique.push(item)
  }
  return unique
}

function categoryEmojis(id: string): CatalogEmoji[] {
  const category = data.categories.find((item) => item.id === id)
  return uniqueEmojis((category?.emojis ?? []).map(nativeOf).filter((item): item is CatalogEmoji => item != null))
}

function haystack(item: CatalogEmoji): string {
  return `${item.name} ${item.keywords.join(' ')}`.toLowerCase()
}

const peopleAll = categoryEmojis('people')
const smileys = peopleAll.filter((item) => SMILEY_MATCH.test(haystack(item)))
const people = peopleAll.filter((item) => !SMILEY_MATCH.test(haystack(item)))

const allMart = uniqueEmojis(data.categories.flatMap((category) => categoryEmojis(category.id)))
const music = allMart.filter((item) => MUSIC_MATCH.test(haystack(item)))

const isoFlags: CatalogEmoji[] = ISO_COUNTRIES.map((country) => ({
  emoji: isoCountryToFlagEmoji(country.code),
  name: country.name,
  keywords: [country.code, country.name, 'flag'],
})).filter((item) => item.emoji)

const martFlags = categoryEmojis('flags')

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  { id: 'flags', label: 'Flags', emojis: uniqueEmojis([...isoFlags, ...martFlags]) },
  { id: 'music', label: 'Music', emojis: music },
  { id: 'smileys', label: 'Smileys', emojis: smileys },
  { id: 'people', label: 'People', emojis: people },
  { id: 'nature', label: 'Animals', emojis: categoryEmojis('nature') },
  { id: 'food', label: 'Food', emojis: categoryEmojis('foods') },
  { id: 'travel', label: 'Travel', emojis: categoryEmojis('places') },
  { id: 'objects', label: 'Objects', emojis: categoryEmojis('objects') },
  { id: 'symbols', label: 'Symbols', emojis: categoryEmojis('symbols') },
]

export function searchCatalogEmojis(query: string): CatalogEmoji[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  return uniqueEmojis(
    EMOJI_CATEGORIES.flatMap((category) =>
      category.emojis.filter((item) => haystack(item).includes(normalized) || item.emoji.includes(query.trim())),
    ),
  )
}
