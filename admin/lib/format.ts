export function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatNumber(value: number): string {
  return value.toLocaleString()
}

export const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard', 'expert', 'impossible'] as const
export const ERA_OPTIONS = ['modern', '2010s', '2000s', 'classics'] as const
export const GENRE_OPTIONS = ['pop', 'hip-hop', 'r&b', 'rock', 'dance', 'other'] as const

export const ERA_LABELS: Record<(typeof ERA_OPTIONS)[number] | 'all', string> = {
  all: 'All eras',
  modern: 'Modern (2020+)',
  '2010s': '2010s',
  '2000s': '2000s',
  classics: 'Classics (pre-2000)',
}

export const GENRE_LABELS: Record<(typeof GENRE_OPTIONS)[number] | 'all', string> = {
  all: 'All genres',
  pop: 'Pop',
  'hip-hop': 'Hip-hop / Rap',
  'r&b': 'R&B / Soul',
  rock: 'Rock / Alternative',
  dance: 'Dance / Electronic',
  other: 'Other / Unclassified',
}

export const DIFFICULTY_LABELS: Record<(typeof DIFFICULTY_OPTIONS)[number] | 'all', string> = {
  all: 'All difficulties',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
  impossible: 'Impossible',
}
