/** Filipino / OPM artists allowed in the catalogue. */
export const OPM_ARTISTS = [
  'SB19',
  'BINI',
  'BGYO',
  'ALAMAT',
  'VXON',
  'G22',
  'Press Hit Play',
  'Ben&Ben',
  'Cup of Joe',
  'Lola Amour',
  'The Ridleys',
  'SunKissed Lola',
  'Maki',
  'Dionela',
  'Rob Deniel',
  'Adie',
  'Nobita',
  'Dilaw',
  'Arthur Nery',
  'Zack Tabudlo',
  'juan karlos',
  'TJ Monterde',
  'Hev Abi',
  'Kristina Dawn',
  'Kyle Raphael',
  'El Manu',
  'Jason Dhakal',
  'Jan Roberts',
  'Allona',
  'Ashtine Olviga',
  'Eliza Maturan',
  'MATÉO',
  'JOLIN',
  'Morissette',
  'KZ Tandingan',
  'Yeng Constantino',
  'Jona',
  'Christian Bautista',
  'Erik Santos',
  'Angeline Quinto',
  'Richard Poon',
  'Jed Madela',
  'Jay R',
  'Piolo Pascual',
  'Sarah Geronimo',
  'Regine Velasquez',
  'Gary Valenciano',
  'Martin Nievera',
  'Moira Dela Torre',
  'Sharon Cuneta',
  'Lea Salonga',
  'Kuh Ledesma',
  'Ogie Alcasid',
  'Janno Gibbs',
  'Toni Gonzaga',
  'Kyla',
  'Gino Padilla',
  'Unique Salonga',
  'IV of Spades',
  'Felip',
  'Eraserheads',
  'Rivermaya',
  'Parokya ni Edgar',
  'December Avenue',
  'Silent Sanctuary',
  'The Itchyworms',
  'Up Dharma Down',
  'Hale',
  'Chicosci',
  'Kamikazee',
  'Urbandub',
  'Sponge Cola',
  'Franco',
  'Typecast',
  'Sandwich',
  'Barbie Almalbis',
  'Kitchie Nadal',
  'Yano',
  'Wolfgang',
  'Razorback',
  'Color It Red',
  'Neocolours',
  'Introvoys',
  'True Faith',
  'Teeth',
  'Ebe Dancel',
  'Bamboo',
  'Moonstar88',
  'Cueshé',
  'Gloc-9',
  'Flow G',
  'Skusta Clee',
  'Ex Battalion',
  'Yuridope',
  'PDL',
  'John Roa',
  'Jnske',
  'Bullet D',
  'Shanti Dope',
  'Ron Henley',
  'Loonie',
  'Abra',
  'ALLMO$T',
  'Hellmerry',
  'Brando',
  'Denise Julia',
  'Al James',
  'Happee Sy',
  'APO Hiking Society',
  'Freddie Aguilar',
  'Jose Mari Chan',
  'Rey Valera',
  'Basil Valdez',
  'Ryan Cayabyab',
  'Asin',
  'Hotdog',
  'VST & Company',
  'Side A',
  'Ariel Rivera',
  'Noel Cabangon',
  'Freestyle',
  'Jireh Lim',
  'Jason Marvin',
  'MYMP',
  'Mayonnaise',
  'Gracenote',
  'Aiza Seguerra',
  'Sitti',
  'Orange & Lemons',
  'Imago',
  '6cyclemind',
  'Callalily',
  'Join The Club',
  'Autotelic',
  'Oh, Flamingo!',
  'Sud',
  'Rico Blanco',
  'Sampaguita',
  'Rachel Alejandro',
  'Zsa Zsa Padilla',
  'Jaya',
  'Vina Morales',
  'Nina',
  'Kris Lawrence',
  'Mark Bautista',
  'Nyoy Volante',
  'Khalil Ramos',
  'James Reid',
  'Zild',
  'Sugarcane',
  'Bandang Lapis',
  'Munimuni',
  'Over October',
  'The Juans',
  'This Band',
  'Calein',
  'Sunkissed Lola',
] as const

/** Deduplicated artist list preserving order. */
export const UNIQUE_OPM_ARTISTS = [...new Set(OPM_ARTISTS.map((name) => name.trim()))]

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9&\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isOpmArtistName(name: string): boolean {
  const normalized = normalizeName(name)
  return UNIQUE_OPM_ARTISTS.some((allowed) => {
    const allowedNorm = normalizeName(allowed)
    return (
      normalized === allowedNorm ||
      normalized.includes(allowedNorm) ||
      allowedNorm.includes(normalized)
    )
  })
}

export function artistNameScore(candidateName: string, targetName: string): number {
  const candidate = normalizeName(candidateName)
  const target = normalizeName(targetName)
  if (candidate === target) return 100
  if (candidate.includes(target) || target.includes(candidate)) return 85
  const candidateFirst = candidate.split(' ')[0] ?? ''
  const targetFirst = target.split(' ')[0] ?? ''
  if (candidateFirst.length > 2 && candidateFirst === targetFirst) return 60
  return 0
}

export interface SpotifyArtistRef {
  name: string
}

export interface SpotifyTrackRef {
  id?: string
  name?: string
  preview_url?: string | null
  popularity?: number
  artists?: SpotifyArtistRef[]
  album?: {
    images?: { url?: string }[]
    release_date?: string
  }
}

/** Spotify API track with `artists: { name }[]`. */
export function isOpmSpotifyTrack(track: SpotifyTrackRef): boolean {
  return (track.artists ?? []).some((artist) => isOpmArtistName(artist.name))
}
