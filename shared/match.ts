import { parseMatchFilters, type MatchFilters } from './match-filters.ts'
/** Authoritative match rules. Public views deliberately omit the song until reveal. */
export const MATCH_STAGES = [0.1, 0.5, 2, 8, 15]
export const MATCH_POINTS = [5000, 4000, 3000, 2000, 1000]
const CLASSIC_POINTS = [1000, 800, 600, 400, 200]
export const MATCH_LENGTH = 10
export const ROUND_MS = 90000
export type MatchDifficulty =
  | 'easy'
  | 'medium'
  | 'hard'
  | 'expert'
  | 'impossible'
export interface MatchEntry {
  id: string
  name: string
  points: number
  stage: number
  status: 'playing' | 'solved' | 'out'
  lastAction: 'ready' | 'skip' | 'miss' | 'solved' | 'timeout'
  delta: number
  solvedAt?: number
  ready?: boolean
  history: number[]
  attempts?: { stage: number; kind: 'skip' | 'miss' }[]
}
export interface MatchRoundSummary {
  roundId: string
  number: number
  answer: { id: string; title: string; artist: string }
  results: Pick<MatchEntry, 'id' | 'stage' | 'status' | 'lastAction' | 'delta' | 'attempts'>[]
}
export interface MatchSong {
  id: string
  title: string
  artist: string
  albumArt: string
  audio: string
  offset: number
}
export interface MatchState {
  completedRounds?: MatchRoundSummary[]
  scoringVersion?: 2
  id: string
  roundId: string
  number: number
  phase: 'playing' | 'reveal' | 'finished'
  difficulty: MatchDifficulty
  filters?: MatchFilters
  difficultyMode?: MatchDifficulty | 'mixed'
  length?: number
  carryScores?: boolean
  startsAt: number
  deadline: number
  entries: MatchEntry[]
  song: MatchSong
  used: string[]
}
/** Preserve the rules of a match already in progress across a deployment. */
export function matchPoints(match?: Pick<MatchState, 'scoringVersion'>): readonly number[] {
  return match && match.scoringVersion !== 2 ? CLASSIC_POINTS : MATCH_POINTS
}
export function matchRank(entries: Pick<MatchEntry, 'id' | 'points'>[], id: string) {
  const player = entries.find(entry => entry.id === id)
  if (!player) return { rank: 0, tied: false }
  return { rank: 1 + entries.filter(entry => entry.points > player.points).length,
    tied: entries.filter(entry => entry.points === player.points).length > 1 }
}
export type MatchView = Omit<MatchState, 'song' | 'used'> & {
  audio: string
  offset: number
  answer: Omit<MatchSong, 'audio' | 'offset'> | null
}
export type MatchCommand =
  | {
      filters?: MatchFilters
      type: 'match-start'
      difficulty: MatchDifficulty | 'mixed'
      length?: number
      carryScores?: boolean
    }
  | { type: 'match-next'; roundId: string }
  | { type: 'match-skip'; roundId: string; stage: number }
  | { type: 'match-guess'; roundId: string; stage: number; guess: string; trackId?: string }
export function parseMatchCommand(raw: string): MatchCommand | null {
  let m: Record<string, unknown>
  try {
    m = JSON.parse(raw)
  } catch {
    return null
  }
  if (!m || typeof m !== 'object') return null
  if (m.type === 'match-start') {
    if (
      !['mixed', 'easy', 'medium', 'hard', 'expert', 'impossible'].includes(
        String(m.difficulty),
      )
    )
      return null
    if (
      m.length !== undefined &&
      (typeof m.length !== 'number' || ![5, 10, 15, 20].includes(m.length))
    )
      return null
    if (m.carryScores !== undefined && typeof m.carryScores !== 'boolean')
      return null
    const filters = parseMatchFilters(m.filters)
    if (!filters) return null
    return {
      ...(m.filters !== undefined ? {filters} : {}),
      type: 'match-start',
      difficulty: m.difficulty as MatchDifficulty | 'mixed',
      length: Number(m.length ?? 10),
      carryScores: m.carryScores === true,
    }
  }
  if (typeof m.roundId !== 'string' || m.roundId.length > 64) return null
  if (m.type === 'match-next') return { type: m.type, roundId: m.roundId }
  if (
    !Number.isInteger(m.stage) ||
    Number(m.stage) < 0 ||
    Number(m.stage) >= MATCH_STAGES.length
  )
    return null
  if (m.type === 'match-skip')
    return { type: m.type, roundId: m.roundId, stage: Number(m.stage) }
  if (
    m.type === 'match-guess' &&
    typeof m.guess === 'string' &&
    m.guess.trim().length > 0 &&
    m.guess.length <= 200
  )
    return {
      type: m.type,
      roundId: m.roundId,
      stage: Number(m.stage),
      guess: m.guess.trim(),
      ...(typeof m.trackId === "string" && m.trackId.length > 0 && m.trackId.length <= 200 ? {trackId: m.trackId} : {}),
    }
  return null
}
export function publicMatch(match: MatchState): MatchView {
  const { song, used: _used, ...rest } = match
  return {
    ...rest,
    completedRounds: completedMatchRounds(match),
    audio: song.audio,
    offset: song.offset,
    answer:
      match.phase === 'playing'
        ? null
        : {
            id: song.id,
            title: song.title,
            artist: song.artist,
            albumArt: song.albumArt,
          },
  }
}
/** Only revealed songs can enter the sitting history; older live matches remain compatible. */
export function completedMatchRounds(match: MatchState): MatchRoundSummary[] {
  const rounds = match.completedRounds ?? []
  if (match.phase === 'playing' || rounds.some(r => r.roundId === match.roundId)) return rounds
  return [...rounds, {
    roundId: match.roundId, number: match.number,
    answer: {id: match.song.id, title: match.song.title, artist: match.song.artist},
    results: match.entries.map(({id, stage, status, lastAction, delta, attempts}) => ({
      id, stage, status, lastAction, delta,
      ...(attempts ? {attempts: attempts.map(mark => ({...mark}))} : {}),
    })),
  }].slice(-20)
}
export function finishRound(match: MatchState): MatchState {
  if (
    match.phase !== 'playing' ||
    match.entries.some((p) => p.status === 'playing')
  )
    return match
  const finished: MatchState = {
    ...match,
    phase:
      match.number === (match.length ?? MATCH_LENGTH) ? 'finished' : 'reveal',
    entries: match.entries.map((p) => ({
      ...p,
      history: [...p.history, p.delta],
    })),
  }
  return {...finished, completedRounds: completedMatchRounds(finished)}
}
export function expireRound(match: MatchState, now: number): MatchState {
  if (match.phase !== 'playing' || now < match.deadline) return match
  return finishRound({
    ...match,
    entries: match.entries.map((p) =>
      p.status === 'playing'
        ? { ...p, status: 'out', lastAction: 'timeout' }
        : p,
    ),
  })
}
export function advancePlayer(
  match: MatchState,
  id: string,
  roundId: string,
  stage: number,
  correct: boolean,
  skip: boolean,
  now: number,
): MatchState {
  if (
    match.phase !== 'playing' ||
    match.roundId !== roundId ||
    now < match.startsAt
  )
    return match
  if (now >= match.deadline) return expireRound(match, now)
  const player = match.entries.find((p) => p.id === id)
  if (!player || player.status !== 'playing' || player.stage !== stage)
    return match
  return finishRound({
    ...match,
    entries: match.entries.map((p) =>
      p.id !== id
        ? p
        : correct
          ? {
              ...p,
              status: 'solved',
              solvedAt: now,
              lastAction: 'solved',
              delta: matchPoints(match)[stage],
              points: p.points + matchPoints(match)[stage],
            }
          : {
              ...p,
              stage: Math.min(stage + 1, MATCH_STAGES.length - 1),
              status: stage === MATCH_STAGES.length - 1 ? 'out' : 'playing',
              lastAction: skip ? 'skip' : 'miss',
              attempts: [...(p.attempts ?? []), {stage: MATCH_STAGES[stage], kind: skip ? 'skip' : 'miss'}],
            },
    ),
  })
}

/** A balanced rotation includes every difficulty once per five songs. */
export function roundDifficulty(
  mode: MatchDifficulty | 'mixed',
  number: number,
): MatchDifficulty {
  return mode === 'mixed'
    ? (['easy', 'medium', 'hard', 'expert', 'impossible'] as const)[
        (number - 1) % 5
      ]
    : mode
}
export function readyForNext(
  match: MatchState,
  id: string,
  roundId: string,
): MatchState {
  if (match.phase === 'playing' || match.roundId !== roundId) return match
  return {
    ...match,
    entries: match.entries.map((p) =>
      p.id === id ? { ...p, ready: true } : p,
    ),
  }
}
export function everyoneReady(match: MatchState, connected: string[]): boolean {
  const present = match.entries.filter((p) => connected.includes(p.id))
  return present.length > 0 && present.every((p) => p.ready)
}

export function nextEntries(
  previous: MatchEntry[],
  active: { id: string; name: string }[],
  continuing: boolean,
  carryScores: boolean,
): MatchEntry[] {
  return (continuing ? previous : active).map((p) => ({
    id: p.id,
    name: p.name,
    points:
      continuing || carryScores
        ? (previous.find((e) => e.id === p.id)?.points ?? 0)
        : 0,
    stage: 0,
    status: active.some((e) => e.id === p.id) ? 'playing' : 'out',
    lastAction: 'ready',
    delta: 0,
    ready: false,
    attempts: [],
    history: continuing
      ? [...(previous.find((e) => e.id === p.id)?.history ?? [])]
      : [],
  }))
}

/** Consecutive correct songs, independent of score carry-over. */
export function matchStreak(entry: MatchEntry, revealed: boolean): number {
  const history = revealed ? entry.history : [...entry.history, ...(entry.status === 'solved' ? [entry.delta] : entry.status === 'out' ? [0] : [])]
  let count = 0
  for (let i = history.length - 1; i >= 0 && history[i] > 0; i--) count++
  return count
}

/** One status line for the seat, the board, and the recap. */
export function matchSeatLabel(
  entry: Pick<MatchEntry, 'status' | 'ready' | 'lastAction' | 'stage'>,
  revealed: boolean,
): string {
  if (entry.status === 'solved') return 'Named it'
  if (entry.ready) return 'Ready'
  if (revealed) return ''
  if (entry.status === 'out' && entry.lastAction !== 'timeout') return 'Song passed'
  switch (entry.lastAction) {
    case 'skip':
      return `Skipped to ${MATCH_STAGES[entry.stage]}s`
    case 'miss':
      return `Trying ${MATCH_STAGES[entry.stage]}s`
    case 'timeout':
      return 'Time ran out'
    case 'solved':
      return 'Named it'
    case 'ready':
      return 'Listening'
    default: {
      const exhaustive: never = entry.lastAction
      return exhaustive
    }
  }
}
