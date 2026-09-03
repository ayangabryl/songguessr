import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import {
  type Difficulty,
  type GameRound,
  type SearchResult,
  fetchAvailability,
  fetchCollections,
  fetchRandomRound,
  fetchRegions,
  searchTracks,
  submitGuess,
  type CatalogCollection,
  type CatalogRegion,
} from '../lib/api'
import {
  COUNTRY_CODES,
  ERA_OPTIONS,
  GENRE_OPTIONS,
  activeFilterCount,
  loadCollectionFilters,
  loadEraFilters,
  loadGenreFilters,
  loadRegionFilters,
  saveCollectionFilters,
  saveEraFilters,
  saveGenreFilters,
  saveRegionFilters,
  toggleFilterValue,
  type CatalogFilters,
  type CatalogKind,
  type CountryCode,
  type EraFilter,
  type GenreFilter,
} from '../lib/filters'
import {
  ALL_STAGES,
  DIFFICULTY_LABELS,
  type ShellStatus,
  type StartMode,
  formatStageLabel,
  formatStageValue,
  loadEnabledStages,
  loadStartMode,
  loadVolume,
  saveEnabledStages,
  saveStartMode,
  saveVolume,
} from '../lib/game-state'
import {
  audioSrcMatches,
  clampPlaybackStart,
  seekAudio,
  startTimedHtmlClip,
  waitForAudioMetadata,
  warmHtmlPreview,
} from '../lib/audio-playback'
import {
  assumedElapsedMs,
  getSpotifyPauseLeadMs,
  startClipTimer,
  type ClipTimerHandle,
} from '../lib/clip-timer'
import { hasPlayableAudio, resolvePlaybackSource } from '../lib/playback-source'
import { spotifyStartPositionMs } from '../lib/spotify-playback'
import {
  activateSpotifyElement,
  getSpotifyExtrapolatedPositionMs,
  onSpotifyStateChange,
  pauseSpotifyPlayback,
  playSpotifyTrack,
  preloadSpotifyTrack,
  setSpotifyVolume,
  warmupSpotifyPlayer,
} from '../lib/spotify-player'
import { useSpotify } from '../hooks/useSpotify'
import {
  progressAtElapsedSeconds,
  progressAtStageBoundary,
  stageSegmentWeight,
} from '../lib/stage-progress'
import { loadRecentExcludes, rememberTrack, clearRecentTrackIds } from '../lib/recent-tracks'
import { incrementStreak, loadStreak, resetStreak } from '../lib/streak'
import {
  applyResolvedTheme,
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '../lib/theme'
import type { MascotIntent } from '../lib/mascot'
import { MASCOT_DURATION_MS } from '../lib/mascot'
import {
  AutoRerollIcon,
  FeedbackIcon,
  FilterIcon,
  GearIcon,
  MoonIcon,
  NextSongIcon,
  PlayControlIcon,
  ReplayIcon,
  ResetIcon,
  RetryIcon,
  SkipIcon,
  StopwatchIcon,
  SunIcon,
  VolumeIcon,
  WaveformIcon,
} from './Icons'
import { SpotifyConnect } from './SpotifyConnect'
import { Mascot } from './Mascot'
import { SettingsSheet } from './SettingsSheet'
import { StreakBadge } from './StreakBadge'

const FilterModal = lazy(() =>
  import('./FilterModal').then((mod) => ({ default: mod.FilterModal })),
)

type PlaybackMode = 'idle' | 'clip' | 'reveal'

const REVEAL_PLAYBACK_MS = 45_000


function resolveMascotIntent(input: {
  switching: boolean
  skipPulse: boolean
  status: ShellStatus
  isPlaying: boolean
  playPulse: boolean
}): MascotIntent {
  if (input.switching) return 'switch'
  if (input.status === 'won') return 'win'
  if (input.status === 'lost') return 'lose'
  if (input.skipPulse) return 'skip'
  if (input.isPlaying || input.playPulse) return 'play'
  return 'idle'
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'impossible']

interface RoundState {
  round: GameRound | null
  stageIndex: number
  wrongGuesses: string[]
  status: ShellStatus
  answer: SearchResult | null
  startedAt: number
  solvedAt: number | null
  unlockedSeconds: number
  playbackSeconds: number
}

function createRoundState(): RoundState {
  return {
    round: null,
    stageIndex: 0,
    wrongGuesses: [],
    status: 'idle',
    answer: null,
    startedAt: Date.now(),
    solvedAt: null,
    unlockedSeconds: 0,
    playbackSeconds: 0,
  }
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        color: ['#22d875', '#ffd119', '#e17c21', '#d74842', '#9a4de0'][index % 5],
        x: `${(index % 6) * 22 - 55}px`,
        y: `${Math.floor(index / 6) * -18 - 20}px`,
        fall: `${80 + (index % 4) * 24}px`,
        rotation: `${(index % 5) * 72}deg`,
        delay: `${index * 0.03}s`,
        round: index % 3 === 0,
      })),
    [],
  )

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className={piece.round ? 'confetti-piece round' : 'confetti-piece'}
          style={
            {
              '--confetti-color': piece.color,
              '--confetti-x': piece.x,
              '--confetti-y': piece.y,
              '--confetti-fall': piece.fall,
              '--confetti-rotation': piece.rotation,
              '--confetti-delay': piece.delay,
              animationDelay: piece.delay,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

export function Game() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const playSessionRef = useRef(0)
  const usingSpotifyRef = useRef(false)
  const spotifyTimelineRef = useRef(0)
  const spotifyBaseMsRef = useRef(0)
  const spotifyStageEndpointRef = useRef(0)
  const spotifyLevelRef = useRef<Difficulty>('easy')
  const spotifyEndStageRef = useRef<(() => void) | null>(null)
  const spotifyPauseTimeoutRef = useRef<number | null>(null)
  const spotifyForcePauseRef = useRef(false)
  const spotifyClipArmedRef = useRef(false)
  const spotifyClipArmedAtRef = useRef(0)
  const clipLoadingDelayRef = useRef<number | null>(null)
  const clipLoadingPendingRef = useRef(false)
  const preloadedTrackRef = useRef<string | null>(null)
  const autoRerollIntervalRef = useRef<number | null>(null)
  const suggestionsRef = useRef<HTMLDivElement | null>(null)
  const startModeRef = useRef<StartMode>(loadStartMode())
  const clipTimerRef = useRef<ClipTimerHandle | null>(null)
  const playbackBarRef = useRef<HTMLDivElement | null>(null)
  const levelSwitchRef = useRef<HTMLDivElement | null>(null)
  const playbackSecondsRef = useRef(0)
  const enabledStagesRef = useRef<number[]>(loadEnabledStages())
  const difficultyRef = useRef<Difficulty>('easy')
  const catalogFiltersRef = useRef<CatalogFilters>({
    eras: loadEraFilters(),
    genres: loadGenreFilters(),
    countries: loadRegionFilters(),
    collections: loadCollectionFilters(),
  })
  const prefetchedRef = useRef<Partial<Record<Difficulty, GameRound>>>({})
  const prefetchInFlightRef = useRef<Partial<Record<Difficulty, Promise<void>>>>({})
  const playbackModeRef = useRef<PlaybackMode>('idle')
  const revealEndedHandlerRef = useRef<(() => void) | null>(null)
  const streakBumpTimeoutRef = useRef<number | null>(null)
  const mascotSwitchTimeoutRef = useRef<number | null>(null)
  const mascotSkipTimeoutRef = useRef<number | null>(null)
  const mascotPlayTimeoutRef = useRef<number | null>(null)

  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [rounds, setRounds] = useState<Record<Difficulty, RoundState>>(() =>
    Object.fromEntries(DIFFICULTIES.map((level) => [level, createRoundState()])) as Record<
      Difficulty,
      RoundState
    >,
  )
  const roundsRef = useRef(rounds)

  const [enabledStages, setEnabledStages] = useState<number[]>(loadEnabledStages)
  const [startMode, setStartMode] = useState<StartMode>(loadStartMode)
  const [autoReroll, setAutoReroll] = useState(false)
  const [volume, setVolume] = useState(loadVolume)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoadingClip, setIsLoadingClip] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTrack, setSelectedTrack] = useState<SearchResult | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [autoRerollCountdown, setAutoRerollCountdown] = useState<number | null>(null)
  const spotify = useSpotify()
  const [eraFilters, setEraFilters] = useState<EraFilter[]>(loadEraFilters)
  const [genreFilters, setGenreFilters] = useState<GenreFilter[]>(loadGenreFilters)
  const [regionFilters, setRegionFilters] = useState<CountryCode[]>(loadRegionFilters)
  const [collectionFilters, setCollectionFilters] = useState<CatalogKind[]>(loadCollectionFilters)
  const [regions, setRegions] = useState<CatalogRegion[]>([])
  const [collections, setCollections] = useState<CatalogCollection[]>([])
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [draftEras, setDraftEras] = useState<EraFilter[]>([])
  const [draftGenres, setDraftGenres] = useState<GenreFilter[]>([])
  const [draftCountries, setDraftCountries] = useState<CountryCode[]>([])
  const [draftCollections, setDraftCollections] = useState<CatalogKind[]>([])
  const [availabilityCounts, setAvailabilityCounts] = useState<Record<Difficulty, number> | null>(
    null,
  )
  const [draftPreviewCount, setDraftPreviewCount] = useState(0)
  const [streak, setStreak] = useState(loadStreak)
  const [streakBump, setStreakBump] = useState(false)
  const [themePreference, setThemePreference] = useState<ThemePreference>(loadThemePreference)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(loadThemePreference()))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mascotSwitch, setMascotSwitch] = useState(false)
  const [mascotSkip, setMascotSkip] = useState(false)
  const [mascotPlay, setMascotPlay] = useState(false)
  const [mascotLoseReason, setMascotLoseReason] = useState<'wrong' | 'timeout' | 'skip'>('wrong')
  const [mascotWinStreak, setMascotWinStreak] = useState(false)

  const catalogFilters = useMemo<CatalogFilters>(
    () => ({
      eras: eraFilters,
      genres: genreFilters,
      countries: regionFilters,
      collections: collectionFilters,
    }),
    [eraFilters, genreFilters, regionFilters, collectionFilters],
  )
  const draftFilters = useMemo<CatalogFilters>(
    () => ({
      eras: draftEras,
      genres: draftGenres,
      countries: draftCountries,
      collections: draftCollections,
    }),
    [draftEras, draftGenres, draftCountries, draftCollections],
  )
  const activeFilterTotal = activeFilterCount(catalogFilters)

  const activeState = rounds[difficulty]
  const activeStages = useMemo(
    () => ALL_STAGES.filter((stage) => enabledStages.includes(stage)),
    [enabledStages],
  )
  const currentStageEndpoint = activeStages[activeState.stageIndex] ?? activeStages[0] ?? 0.1
  const shellStatus: ShellStatus =
    activeState.status === 'idle' ? (catalogLoading ? 'idle' : 'playing') : activeState.status
  const controlsDisabled = isPlaying || isLoadingClip

  const unlockedProgress = progressAtStageBoundary(
    activeStages,
    activeState.stageIndex + 1,
  )
  const playbackProgress = progressAtElapsedSeconds(
    activeStages,
    activeState.stageIndex,
    activeState.playbackSeconds,
  )
  const roundHasAudio = Boolean(activeState.round && hasPlayableAudio(activeState.round))

  function writePlaybackBar(seconds: number) {
    playbackSecondsRef.current = seconds
    const stages = ALL_STAGES.filter((stage) => enabledStagesRef.current.includes(stage))
    const stageIndex = roundsRef.current[difficultyRef.current]?.stageIndex ?? 0
    const percent = progressAtElapsedSeconds(stages, stageIndex, seconds)
    if (playbackBarRef.current) {
      playbackBarRef.current.style.width = `${percent}%`
    }
  }

  function collectPrefetchExcludes(level: Difficulty) {
    const recent = loadRecentExcludes()
    const excludeTrackIds = [...recent.trackIds]
    const excludeSongKeys = [...recent.songKeys]
    for (const item of DIFFICULTIES) {
      const round = roundsRef.current[item].round
      if (round?.trackId) excludeTrackIds.push(round.trackId)
      if (round?.songKey) excludeSongKeys.push(round.songKey)
      const prefetched = prefetchedRef.current[item]
      if (prefetched?.trackId) excludeTrackIds.push(prefetched.trackId)
      if (prefetched?.songKey) excludeSongKeys.push(prefetched.songKey)
    }
    const current = roundsRef.current[level].round
    if (current?.trackId) excludeTrackIds.push(current.trackId)
    if (current?.songKey) excludeSongKeys.push(current.songKey)
    return { excludeTrackIds, excludeSongKeys }
  }

  function warmRoundAudio(round: GameRound) {
    const preview = resolvePlaybackSource(round, 'intro', { previewOnly: true }).url
    warmHtmlPreview(preview)
  }

  function prefetchNextRound(level: Difficulty) {
    if (prefetchedRef.current[level] || prefetchInFlightRef.current[level]) return
    const currentId = roundsRef.current[level].round?.trackId
    prefetchInFlightRef.current[level] = (async () => {
      try {
        const round = await fetchRandomRound(level, catalogFiltersRef.current, collectPrefetchExcludes(level))
        if (round.trackId === currentId) return
        rememberTrack(round.trackId, round.songKey)
        prefetchedRef.current[level] = round
        warmRoundAudio(round)
      } catch {
        // Next-song click will fetch live if prefetch misses.
      } finally {
        delete prefetchInFlightRef.current[level]
      }
    })()
  }

  function applyRound(level: Difficulty, round: GameRound) {
    rememberTrack(round.trackId, round.songKey)
    warmRoundAudio(round)
    setRounds((current) => ({
      ...current,
      [level]: {
        ...createRoundState(),
        round,
        status: 'playing',
        startedAt: Date.now(),
      },
    }))
    setCatalogError(null)
    prefetchNextRound(level)
  }

  const loadAllRounds = useCallback(async (filters: CatalogFilters = catalogFilters) => {
    setCatalogLoading(true)
    setCatalogError(null)
    prefetchedRef.current = {}
    prefetchInFlightRef.current = {}

    try {
      const recent = loadRecentExcludes()
      const settled = await Promise.all(
        DIFFICULTIES.map(async (level) => {
          const currentRound = roundsRef.current[level].round
          try {
            const round = await fetchRandomRound(level, filters, {
              excludeTrackIds: [
                ...recent.trackIds,
                ...(currentRound?.trackId ? [currentRound.trackId] : []),
              ],
              excludeSongKeys: [
                ...recent.songKeys,
                ...(currentRound?.songKey ? [currentRound.songKey] : []),
              ],
            })
            rememberTrack(round.trackId, round.songKey)
            warmRoundAudio(round)
            return {
              level,
              state: {
                ...createRoundState(),
                round,
                status: 'playing' as const,
                startedAt: Date.now(),
              },
            }
          } catch {
            return { level, state: createRoundState() }
          }
        }),
      )

      setRounds(
        Object.fromEntries(settled.map((result) => [result.level, result.state])) as Record<
          Difficulty,
          RoundState
        >,
      )
      if (!settled.some((result) => result.state.round)) {
        setCatalogError('No songs match these filters.')
      }
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : 'Could not load songs.')
    } finally {
      setCatalogLoading(false)
    }
  }, [catalogFilters])

  const loadDifficultyRound = useCallback(async (level: Difficulty, filters: CatalogFilters = catalogFilters) => {
    try {
      const recent = loadRecentExcludes()
      const currentRound = roundsRef.current[level].round
      const excludeTrackIds = [
        ...recent.trackIds,
        ...(currentRound?.trackId ? [currentRound.trackId] : []),
      ]
      const excludeSongKeys = [
        ...recent.songKeys,
        ...(currentRound?.songKey ? [currentRound.songKey] : []),
      ]
      const round = await fetchRandomRound(level, filters, {
        excludeTrackIds,
        excludeSongKeys,
      })
      applyRound(level, round)
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : 'Could not load songs.')
    }
  }, [catalogFilters])

  useEffect(() => {
    void loadAllRounds(catalogFilters)
  }, [catalogFilters, loadAllRounds])

  useEffect(() => {
    roundsRef.current = rounds
  }, [rounds])

  useEffect(() => {
    startModeRef.current = startMode
  }, [startMode])

  useEffect(() => {
    spotifyLevelRef.current = difficulty
    difficultyRef.current = difficulty
  }, [difficulty])

  useEffect(() => {
    enabledStagesRef.current = enabledStages
  }, [enabledStages])

  useEffect(() => {
    catalogFiltersRef.current = catalogFilters
  }, [catalogFilters])

  useLayoutEffect(() => {
    writePlaybackBar(activeState.playbackSeconds)
  }, [activeState.playbackSeconds, activeState.stageIndex, difficulty, enabledStages])

  /*
   * The level indicator is measured, not computed: segments size to their
   * labels on narrow screens, so the pill takes the active button's real
   * left/width and glides between them.
   */
  useLayoutEffect(() => {
    const host = levelSwitchRef.current
    if (!host) return
    const place = () => {
      const active = host.querySelector<HTMLButtonElement>('button.is-active')
      if (!active) return
      host.style.setProperty('--ind-x', `${active.offsetLeft}px`)
      host.style.setProperty('--ind-w', `${active.offsetWidth}px`)
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(host)
    return () => observer.disconnect()
  }, [difficulty])

  useEffect(() => {
    if (!activeState.round || catalogLoading) return
    prefetchNextRound(difficulty)
  }, [difficulty, activeState.round?.trackId, catalogLoading])

  useEffect(() => {
    if (!spotify.canUseStartModes) {
      preloadedTrackRef.current = null
      return
    }

    const round = activeState.round
    if (!round?.trackId || isPlaying) return
    if (preloadedTrackRef.current === round.trackId) return

    const trackId = round.trackId
    const baseMs = spotifyStartPositionMs(round, startModeRef.current)

    void warmupSpotifyPlayer(volume)
      .then(() => preloadSpotifyTrack(trackId, baseMs, volume))
      .then(() => {
        preloadedTrackRef.current = trackId
      })
      .catch(() => {
        // Preload is best-effort; play will load the track on demand.
      })
  }, [spotify.canUseStartModes, activeState.round?.trackId, startMode, volume])

  function beginClipLoading() {
    clipLoadingPendingRef.current = true
    if (clipLoadingDelayRef.current) {
      window.clearTimeout(clipLoadingDelayRef.current)
    }
    clipLoadingDelayRef.current = window.setTimeout(() => {
      if (clipLoadingPendingRef.current) {
        setIsLoadingClip(true)
      }
    }, 300)
  }

  function endClipLoading() {
    clipLoadingPendingRef.current = false
    if (clipLoadingDelayRef.current) {
      window.clearTimeout(clipLoadingDelayRef.current)
      clipLoadingDelayRef.current = null
    }
    setIsLoadingClip(false)
  }

  useEffect(() => {
    if (!spotify.canUseStartModes) return

    return onSpotifyStateChange((state) => {
      if (spotifyForcePauseRef.current) {
        if (state && !state.paused) {
          void pauseSpotifyPlayback()
        }
        setIsPlaying(false)
        return
      }

      if (playbackModeRef.current === 'reveal') {
        if (!usingSpotifyRef.current) return
        setIsPlaying(Boolean(state && !state.paused))
        return
      }

      if (!usingSpotifyRef.current) return

      if (!state) {
        setIsPlaying(false)
        return
      }

      setIsPlaying(!state.paused)

      const timelineSeconds = Math.max(
        0,
        (getSpotifyExtrapolatedPositionMs() - spotifyBaseMsRef.current) / 1000,
      )
      spotifyTimelineRef.current = timelineSeconds

      if (!state.paused) {
        updateRound(spotifyLevelRef.current, { playbackSeconds: timelineSeconds })

        const armedForMs = Date.now() - spotifyClipArmedAtRef.current
        const stageEnd = spotifyStageEndpointRef.current
        if (
          spotifyClipArmedRef.current &&
          armedForMs >= 30 &&
          timelineSeconds >= stageEnd &&
          timelineSeconds <= stageEnd + 1
        ) {
          spotifyEndStageRef.current?.()
        }
      }
    })
  }, [spotify.canUseStartModes])

  useEffect(() => {
    saveEraFilters(eraFilters)
  }, [eraFilters])

  useEffect(() => {
    saveGenreFilters(genreFilters)
  }, [genreFilters])

  useEffect(() => {
    saveRegionFilters(regionFilters)
  }, [regionFilters])

  useEffect(() => {
    saveCollectionFilters(collectionFilters)
  }, [collectionFilters])

  useEffect(() => {
    void Promise.all([fetchRegions(), fetchCollections()]).then(([nextRegions, nextCollections]) => {
      if (nextRegions.length > 0) setRegions(nextRegions)
      if (nextCollections.length > 0) setCollections(nextCollections)
    })
  }, [])

  useEffect(() => {
    void fetchAvailability(catalogFilters).then((data) => {
      setAvailabilityCounts(data.counts)
      setDifficulty((current) =>
        data.counts[current] === 0
          ? (DIFFICULTIES.find((level) => data.counts[level] > 0) ?? current)
          : current,
      )
    })
  }, [catalogFilters])

  useEffect(() => {
    if (!filterModalOpen) return
    void fetchAvailability(draftFilters).then((data) => {
      setDraftPreviewCount(data.counts[difficulty] ?? 0)
    })
  }, [draftFilters, difficulty, filterModalOpen])

  useEffect(() => {
    clearSearchSelection()
    setAudioError(null)
  }, [difficulty])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = volume
    saveVolume(volume)
    void setSpotifyVolume(volume)
  }, [volume])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
      if (spotifyPauseTimeoutRef.current) window.clearTimeout(spotifyPauseTimeoutRef.current)
      if (clipLoadingDelayRef.current) window.clearTimeout(clipLoadingDelayRef.current)
      if (autoRerollIntervalRef.current) window.clearInterval(autoRerollIntervalRef.current)
      if (streakBumpTimeoutRef.current) window.clearTimeout(streakBumpTimeoutRef.current)
      if (mascotSwitchTimeoutRef.current) window.clearTimeout(mascotSwitchTimeoutRef.current)
      if (mascotSkipTimeoutRef.current) window.clearTimeout(mascotSkipTimeoutRef.current)
      if (mascotPlayTimeoutRef.current) window.clearTimeout(mascotPlayTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (selectedTrack || !searchQuery.trim()) {
      setSearchResults([])
      setSearchOpen(false)
      setHighlightedIndex(-1)
      return
    }

    const timeout = window.setTimeout(() => {
      void searchTracks(searchQuery).then((results) => {
        setSearchResults(results)
        setSearchOpen(results.length > 0)
        setHighlightedIndex(-1)
      })
    }, 180)

    return () => window.clearTimeout(timeout)
  }, [searchQuery, selectedTrack])

  function clearSearchSelection() {
    setSelectedTrack(null)
    setSearchQuery('')
    setSearchResults([])
    setSearchOpen(false)
    setHighlightedIndex(-1)
  }

  function selectTrackForGuess(result: SearchResult) {
    setSelectedTrack(result)
    setSearchQuery(`${result.title} - ${result.artist}`)
    setSearchOpen(false)
    setHighlightedIndex(-1)
  }

  function scrollSuggestionIntoView(index: number) {
    const container = suggestionsRef.current
    if (!container || index < 0) return
    const option = container.children[index] as HTMLElement | undefined
    option?.scrollIntoView({ block: 'nearest' })
  }

  function retryRound(level: Difficulty = difficulty) {
    stopClip()
    clearAutoReroll()
    clearSearchSelection()
    setAudioError(null)
    setMascotWinStreak(false)
    setMascotLoseReason('wrong')
    updateRound(level, {
      stageIndex: 0,
      wrongGuesses: [],
      status: 'playing',
      answer: null,
      solvedAt: null,
      startedAt: Date.now(),
      unlockedSeconds: 0,
      playbackSeconds: 0,
    })
  }

  function startNextSong(level: Difficulty = difficulty) {
    stopClip()
    clearAutoReroll()
    clearSearchSelection()
    setAudioError(null)
    setMascotWinStreak(false)
    setMascotLoseReason('wrong')
    const prefetched = prefetchedRef.current[level]
    if (prefetched) {
      delete prefetchedRef.current[level]
      applyRound(level, prefetched)
      return
    }
    void loadDifficultyRound(level)
  }

  function updateRound(level: Difficulty, patch: Partial<RoundState>) {
    setRounds((current) => ({
      ...current,
      [level]: { ...current[level], ...patch },
    }))
  }

  async function stopClip(options?: { preserveProgress?: boolean }) {
    const audio = audioRef.current
    playSessionRef.current += 1
    playbackModeRef.current = 'idle'
    clipTimerRef.current?.abort()
    clipTimerRef.current = null
    if (audio && revealEndedHandlerRef.current) {
      audio.removeEventListener('ended', revealEndedHandlerRef.current)
      revealEndedHandlerRef.current = null
    }
    if (audio) {
      audio.pause()
    }
    if (spotifyPauseTimeoutRef.current) {
      window.clearTimeout(spotifyPauseTimeoutRef.current)
      spotifyPauseTimeoutRef.current = null
    }
    spotifyEndStageRef.current = null
    spotifyClipArmedRef.current = false
    if (usingSpotifyRef.current) {
      spotifyForcePauseRef.current = true
      await pauseSpotifyPlayback()
      usingSpotifyRef.current = false
    }
    setIsPlaying(false)
    endClipLoading()
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current)

    if (!options?.preserveProgress) {
      updateRound(difficulty, { playbackSeconds: 0 })
      spotifyTimelineRef.current = 0
      writePlaybackBar(0)
    }
  }

  function getStartOffset(round: GameRound | null = activeState.round): number {
    if (!round) return 0
    if (spotify.canUseStartModes) {
      return spotifyStartPositionMs(round, startModeRef.current) / 1000
    }
    return resolvePlaybackSource(round, startModeRef.current, { previewOnly: true }).offsetSeconds
  }

  function getSpotifyTimelineSeconds(): number {
    return Math.max(0, (getSpotifyExtrapolatedPositionMs() - spotifyBaseMsRef.current) / 1000)
  }

  function getTimelineSeconds(): number {
    if (usingSpotifyRef.current) {
      return getSpotifyTimelineSeconds()
    }
    const audio = audioRef.current
    if (!audio) return 0
    return Math.max(0, audio.currentTime - getStartOffset())
  }

  async function syncPlaybackPosition(level: Difficulty = difficulty): Promise<number> {
    if (usingSpotifyRef.current) {
      const timelineSeconds = getSpotifyTimelineSeconds()
      spotifyTimelineRef.current = timelineSeconds
      updateRound(level, { playbackSeconds: timelineSeconds })
      return timelineSeconds
    }

    const timelineSeconds = getTimelineSeconds()
    updateRound(level, { playbackSeconds: timelineSeconds })
    return timelineSeconds
  }

  async function playClip() {
    const round = activeState.round
    if (!round || !hasPlayableAudio(round) || shellStatus !== 'playing') return

    if (isPlaying || isLoadingClip) {
      const timelineSeconds = await syncPlaybackPosition()
      const preservedSeconds = Math.min(timelineSeconds, currentStageEndpoint)
      await stopClip({ preserveProgress: true })
      updateRound(difficulty, {
        unlockedSeconds: preservedSeconds,
        playbackSeconds: preservedSeconds,
      })
      writePlaybackBar(preservedSeconds)
      return
    }

    pulseMascotPlay()
    const stageEndpoint = currentStageEndpoint
    const startTimeline =
      activeState.unlockedSeconds >= stageEndpoint ? 0 : activeState.unlockedSeconds
    const session = playSessionRef.current + 1
    playSessionRef.current = session
    playbackModeRef.current = 'clip'
    clipTimerRef.current?.abort()
    clipTimerRef.current = null

    setAudioError(null)
    prefetchNextRound(difficulty)

    if (spotify.canUseStartModes) {
      usingSpotifyRef.current = true
      spotifyForcePauseRef.current = false
      spotifyClipArmedRef.current = false
      spotifyClipArmedAtRef.current = 0
      void activateSpotifyElement()
      const baseMs = spotifyStartPositionMs(round, startModeRef.current)
      const seekMs = baseMs + startTimeline * 1000
      spotifyBaseMsRef.current = baseMs
      spotifyStageEndpointRef.current = stageEndpoint
      beginClipLoading()

      try {
        const playResult = await playSpotifyTrack(round.trackId, seekMs, volume)
        if (session !== playSessionRef.current) return

        const sdkElapsedMs = Math.max(
          0,
          getSpotifyExtrapolatedPositionMs() - baseMs - startTimeline * 1000,
        )
        const alreadyElapsedMs = assumedElapsedMs({
          mediaElapsedMs: sdkElapsedMs,
          detectionLagMs: playResult.confirmedAt - playResult.playIssuedAt,
        })

        endClipLoading()
        setIsPlaying(true)
        pulseMascotPlay()
        const playbackStart = startTimeline + alreadyElapsedMs / 1000
        updateRound(difficulty, {
          unlockedSeconds: Math.max(activeState.unlockedSeconds, startTimeline),
          playbackSeconds: Math.min(stageEndpoint, playbackStart),
        })
        spotifyTimelineRef.current = Math.min(stageEndpoint, playbackStart)
        writePlaybackBar(Math.min(stageEndpoint, playbackStart))

        let stageEnded = false
        const endSpotifyStage = () => {
          if (stageEnded || session !== playSessionRef.current) return
          stageEnded = true
          spotifyForcePauseRef.current = true
          spotifyClipArmedRef.current = false
          spotifyEndStageRef.current = null
          clipTimerRef.current?.abort()
          clipTimerRef.current = null
          if (spotifyPauseTimeoutRef.current) {
            window.clearTimeout(spotifyPauseTimeoutRef.current)
            spotifyPauseTimeoutRef.current = null
          }
          if (rafRef.current) {
            window.cancelAnimationFrame(rafRef.current)
            rafRef.current = null
          }
          void (async () => {
            await pauseSpotifyPlayback()
            if (session !== playSessionRef.current) return
            usingSpotifyRef.current = false
            setIsPlaying(false)
            updateRound(difficulty, {
              unlockedSeconds: stageEndpoint,
              playbackSeconds: stageEndpoint,
            })
            writePlaybackBar(stageEndpoint)
          })()
        }

        spotifyEndStageRef.current = endSpotifyStage
        spotifyClipArmedAtRef.current = performance.now()
        spotifyClipArmedRef.current = true

        clipTimerRef.current = startClipTimer({
          durationMs: (stageEndpoint - startTimeline) * 1000,
          alreadyElapsedMs,
          pauseLeadMs: getSpotifyPauseLeadMs(),
          getMediaElapsedMs: () =>
            Math.max(0, getSpotifyExtrapolatedPositionMs() - baseMs - startTimeline * 1000),
          onTick: (elapsedMs) => {
            if (session !== playSessionRef.current) return
            const displaySeconds = Math.min(stageEndpoint, startTimeline + elapsedMs / 1000)
            spotifyTimelineRef.current = displaySeconds
            writePlaybackBar(displaySeconds)
          },
          onEnd: endSpotifyStage,
        })
      } catch {
        if (session !== playSessionRef.current) return
        spotifyForcePauseRef.current = true
        spotifyClipArmedRef.current = false
        usingSpotifyRef.current = false
        spotifyEndStageRef.current = null
        clipTimerRef.current?.abort()
        clipTimerRef.current = null
        endClipLoading()
        setIsPlaying(false)
        void pauseSpotifyPlayback()
        setAudioError('The clip could not be played. Check your Spotify Premium connection.')
      }
      return
    }

    usingSpotifyRef.current = false
    const audio = audioRef.current
    if (!audio) return

    beginClipLoading()
    const previewSource = resolvePlaybackSource(round, 'intro', { previewOnly: true })
    if (!previewSource.url) {
      endClipLoading()
      setAudioError('The clip could not be played.')
      return
    }

    audio.volume = volume
    if (!audioSrcMatches(audio, previewSource.url)) {
      audio.preload = 'auto'
      audio.src = previewSource.url
    }

    try {
      await waitForAudioMetadata(audio)
      if (session !== playSessionRef.current) return

      const audioStart = clampPlaybackStart(
        previewSource.offsetSeconds + startTimeline,
        audio.duration,
      )
      await seekAudio(audio, audioStart, true)
      if (session !== playSessionRef.current) return

      await audio.play()
      if (session !== playSessionRef.current) return

      endClipLoading()
      setIsPlaying(true)
      pulseMascotPlay()
      updateRound(difficulty, {
        unlockedSeconds: Math.max(activeState.unlockedSeconds, startTimeline),
        playbackSeconds: startTimeline,
      })
      writePlaybackBar(startTimeline)

      clipTimerRef.current = startTimedHtmlClip(audio, {
        startSeconds: audioStart,
        durationSeconds: stageEndpoint - startTimeline,
        onTick: (elapsedSeconds) => {
          if (session !== playSessionRef.current) return
          writePlaybackBar(Math.min(stageEndpoint, startTimeline + elapsedSeconds))
        },
        onEnd: () => {
          if (session !== playSessionRef.current) return
          audio.pause()
          setIsPlaying(false)
          updateRound(difficulty, {
            unlockedSeconds: stageEndpoint,
            playbackSeconds: stageEndpoint,
          })
          writePlaybackBar(stageEndpoint)
        },
      })
    } catch {
      if (session !== playSessionRef.current) return
      endClipLoading()
      setIsPlaying(false)
      audio.pause()
      setAudioError('The clip could not be played.')
    }
  }

  function noteStreakWin() {
    const next = incrementStreak()
    setStreak(next)
    setMascotWinStreak(true)
    setStreakBump(true)
    if (streakBumpTimeoutRef.current) window.clearTimeout(streakBumpTimeoutRef.current)
    streakBumpTimeoutRef.current = window.setTimeout(() => {
      setStreakBump(false)
      streakBumpTimeoutRef.current = null
    }, MASCOT_DURATION_MS.win + MASCOT_DURATION_MS.streak)
  }

  function noteStreakFail() {
    if (loadStreak() === 0 && streak === 0) return
    setStreak(resetStreak())
    setStreakBump(false)
    setMascotWinStreak(false)
  }

  async function playReveal(round: GameRound) {
    if (!hasPlayableAudio(round)) return

    await stopClip({ preserveProgress: true })

    const session = playSessionRef.current + 1
    playSessionRef.current = session
    playbackModeRef.current = 'reveal'
    clipTimerRef.current?.abort()
    clipTimerRef.current = null
    setAudioError(null)

    const finishReveal = () => {
      if (session !== playSessionRef.current) return
      if (playbackModeRef.current !== 'reveal') return
      void stopClip({ preserveProgress: true })
    }

    if (spotify.canUseStartModes) {
      usingSpotifyRef.current = true
      spotifyForcePauseRef.current = false
      spotifyClipArmedRef.current = false
      spotifyClipArmedAtRef.current = 0
      void activateSpotifyElement()
      const baseMs = spotifyStartPositionMs(round, startModeRef.current)
      spotifyBaseMsRef.current = baseMs

      try {
        await playSpotifyTrack(round.trackId, baseMs, volume)
        if (session !== playSessionRef.current) return
        endClipLoading()
        setIsPlaying(true)
        spotifyPauseTimeoutRef.current = window.setTimeout(finishReveal, REVEAL_PLAYBACK_MS)
      } catch {
        if (session !== playSessionRef.current) return
        spotifyForcePauseRef.current = true
        usingSpotifyRef.current = false
        playbackModeRef.current = 'idle'
        endClipLoading()
        setIsPlaying(false)
        void pauseSpotifyPlayback()
        setAudioError('The song could not be played. Check your Spotify Premium connection.')
      }
      return
    }

    usingSpotifyRef.current = false
    const audio = audioRef.current
    if (!audio) return

    const previewSource = resolvePlaybackSource(round, startModeRef.current, { previewOnly: true })
    if (!previewSource.url) {
      setAudioError('The song could not be played.')
      return
    }

    audio.volume = volume
    if (!audioSrcMatches(audio, previewSource.url)) {
      audio.preload = 'auto'
      audio.src = previewSource.url
    }

    try {
      await waitForAudioMetadata(audio)
      if (session !== playSessionRef.current) return

      const audioStart = clampPlaybackStart(previewSource.offsetSeconds, audio.duration)
      await seekAudio(audio, audioStart, true)
      if (session !== playSessionRef.current) return

      await audio.play()
      if (session !== playSessionRef.current) return

      setIsPlaying(true)

      const onEnded = () => {
        if (session !== playSessionRef.current) return
        playbackModeRef.current = 'idle'
        setIsPlaying(false)
      }
      audio.addEventListener('ended', onEnded)
      revealEndedHandlerRef.current = onEnded
      spotifyPauseTimeoutRef.current = window.setTimeout(finishReveal, REVEAL_PLAYBACK_MS)
    } catch {
      if (session !== playSessionRef.current) return
      playbackModeRef.current = 'idle'
      setIsPlaying(false)
      audio.pause()
      setAudioError('Tap the artwork to hear the song.')
    }
  }

  function toggleRevealPlayback() {
    if (activeState.status !== 'won' && activeState.status !== 'lost') return
    const round = activeState.round
    if (!round) return
    if (isPlaying || isLoadingClip) {
      void stopClip({ preserveProgress: true })
      return
    }
    void playReveal(round)
  }

  async function revealAnswer(level: Difficulty) {
    const round = roundsRef.current[level].round
    if (!round) return
    void activateSpotifyElement()
    const result = await submitGuess(round, { reveal: true })
    updateRound(level, {
      status: 'lost',
      answer: result.answer,
    })
    void playReveal(round)
  }

  function clearAutoReroll() {
    if (autoRerollIntervalRef.current !== null) {
      window.clearInterval(autoRerollIntervalRef.current)
      autoRerollIntervalRef.current = null
    }
    setAutoRerollCountdown(null)
  }

  function scheduleAutoReroll(level: Difficulty) {
    if (!autoReroll) return

    clearAutoReroll()
    let remaining = 3
    setAutoRerollCountdown(remaining)
    autoRerollIntervalRef.current = window.setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        clearAutoReroll()
        startNextSong(level)
        return
      }
      setAutoRerollCountdown(remaining)
    }, 1000)
  }

  async function handleGuessSelection(result: SearchResult) {
    const round = activeState.round
    if (!round || shellStatus !== 'playing') return

    void activateSpotifyElement()
    const guessResult = await submitGuess(round, { guessedTrackId: result.id })
    clearSearchSelection()

    if (guessResult.correct) {
      noteStreakWin()
      const solvedAt = Date.now()
      updateRound(difficulty, {
        status: 'won',
        answer: guessResult.answer,
        solvedAt,
      })
      void playReveal(round)
      scheduleAutoReroll(difficulty)
      return
    }

    const label = `${result.title} - ${result.artist}`
    const nextIndex = activeState.stageIndex + 1
    const wrongGuesses = [...activeState.wrongGuesses, label]
    const stageEndpoint = activeStages[activeState.stageIndex] ?? activeStages[0] ?? 0.1

    if (nextIndex >= activeStages.length) {
      noteStreakFail()
      const reveal = await submitGuess(round, { reveal: true })
      setMascotLoseReason('wrong')
      updateRound(difficulty, {
        status: 'lost',
        answer: reveal.answer,
        wrongGuesses,
      })
      void playReveal(round)
      scheduleAutoReroll(difficulty)
      return
    }

    void stopClip()
    updateRound(difficulty, {
      stageIndex: nextIndex,
      wrongGuesses,
      unlockedSeconds: stageEndpoint,
      playbackSeconds: stageEndpoint,
    })
  }

  function advanceStageAfterSkip(level: Difficulty = difficulty) {
    const stageEndpoint = activeStages[rounds[level].stageIndex] ?? activeStages[0] ?? 0.1
    const nextIndex = rounds[level].stageIndex + 1

    if (nextIndex >= activeStages.length) {
      void revealAnswer(level)
      scheduleAutoReroll(level)
      return
    }

    updateRound(level, {
      stageIndex: nextIndex,
      unlockedSeconds: stageEndpoint,
      playbackSeconds: stageEndpoint,
    })
  }

  function pulseMascotPlay() {
    setMascotPlay(true)
    if (mascotPlayTimeoutRef.current) window.clearTimeout(mascotPlayTimeoutRef.current)
    mascotPlayTimeoutRef.current = window.setTimeout(() => {
      setMascotPlay(false)
      mascotPlayTimeoutRef.current = null
    }, MASCOT_DURATION_MS.play * 2)
  }

  function handleSkip() {
    void activateSpotifyElement()

    const nextIndex = roundsRef.current[difficulty].stageIndex + 1
    const isLastStage = nextIndex >= activeStages.length

    // Skipping is neutral: it never counts as a win and never breaks the
    // streak. Only a confirmed wrong guess on the last stage does that.
    if (isLastStage) {
      setMascotLoseReason('timeout')
    } else {
      setMascotSkip(true)
      if (mascotSkipTimeoutRef.current) window.clearTimeout(mascotSkipTimeoutRef.current)
      mascotSkipTimeoutRef.current = window.setTimeout(() => {
        setMascotSkip(false)
        mascotSkipTimeoutRef.current = null
      }, MASCOT_DURATION_MS.skip)
    }

    void stopClip({ preserveProgress: true }).then(() => {
      advanceStageAfterSkip()
    })
  }

  function handleGuessSubmit(event: FormEvent) {
    event.preventDefault()
    if (selectedTrack) {
      void handleGuessSelection(selectedTrack)
      return
    }
    const firstResult = searchResults[0]
    if (firstResult) {
      void handleGuessSelection(firstResult)
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (searchResults.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((current) => {
        const next = current < searchResults.length - 1 ? current + 1 : current
        scrollSuggestionIntoView(next)
        return next
      })
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((current) => {
        const next = current > 0 ? current - 1 : 0
        scrollSuggestionIntoView(next)
        return next
      })
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setSearchOpen(false)
      setHighlightedIndex(-1)
      return
    }

    if (event.key === 'Enter' && highlightedIndex >= 0) {
      event.preventDefault()
      const result = searchResults[highlightedIndex]
      if (result) selectTrackForGuess(result)
    }
  }

  function toggleStage(stage: number) {
    setEnabledStages((current) => {
      const next = current.includes(stage)
        ? current.filter((value) => value !== stage)
        : [...current, stage].sort((a, b) => a - b)
      const resolved = next.length > 0 ? next : current
      saveEnabledStages(resolved)
      return resolved
    })
    stopClip({ preserveProgress: true })
    updateRound(difficulty, { stageIndex: 0, unlockedSeconds: 0, playbackSeconds: 0 })
  }

  function openFilterModal() {
    setDraftEras([...eraFilters])
    setDraftGenres([...genreFilters])
    setDraftCountries([...regionFilters])
    setDraftCollections([...collectionFilters])
    setFilterModalOpen(true)
  }

  function applyFilters() {
    setEraFilters([...draftEras])
    setGenreFilters([...draftGenres])
    setRegionFilters([...draftCountries])
    setCollectionFilters([...draftCollections])
    setFilterModalOpen(false)
  }

  function clearAllFilters() {
    setEraFilters([])
    setGenreFilters([])
    setRegionFilters([])
    setCollectionFilters([])
    setDraftEras([])
    setDraftGenres([])
    setDraftCountries([])
    setDraftCollections([])
  }

  function handleStartMode(mode: StartMode) {
    if (!spotify.canUseStartModes) return
    if (mode === startMode) return
    startModeRef.current = mode
    setStartMode(mode)
    saveStartMode(mode)
    stopClip({ preserveProgress: true })
    updateRound(difficulty, { unlockedSeconds: 0, playbackSeconds: 0 })
  }

  const guessSeconds =
    activeState.solvedAt && activeState.startedAt
      ? Math.max(1, Math.round((activeState.solvedAt - activeState.startedAt) / 1000))
      : 1

  const showResult = activeState.status === 'won' || activeState.status === 'lost'
  const isCatalogEmpty = catalogLoading && !activeState.round
  const headline =
    activeState.status === 'won'
      ? 'Nailed it.'
      : activeState.status === 'lost'
        ? 'Not this time.'
        : isCatalogEmpty
          ? 'Tuning in.'
          : 'Hear the clip. Name the track.'
  const subline =
    activeState.status === 'won'
      ? 'Keep it going.'
      : activeState.status === 'lost'
        ? 'Here is what it was.'
        : isCatalogEmpty
          ? 'Finding songs for you.'
          : 'Each guess unlocks a longer clip.'
  const attemptNumber = Math.min(activeState.stageIndex + 1, activeStages.length)
  const mascotIntent = resolveMascotIntent({
    switching: mascotSwitch,
    skipPulse: mascotSkip,
    playPulse: mascotPlay,
    status: shellStatus,
    isPlaying,
  })

  function handleDifficulty(level: Difficulty) {
    if (level === difficulty) return
    setDifficulty(level)
    setMascotSwitch(true)
    if (mascotSwitchTimeoutRef.current) window.clearTimeout(mascotSwitchTimeoutRef.current)
    const switchMs = MASCOT_DURATION_MS.switch
    mascotSwitchTimeoutRef.current = window.setTimeout(() => {
      setMascotSwitch(false)
      mascotSwitchTimeoutRef.current = null
    }, switchMs)
  }

  function handleThemePreference(next: ThemePreference) {
    setThemePreference(next)
    saveThemePreference(next)
  }

  function toggleTheme() {
    handleThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    const apply = () => {
      const next = resolveTheme(themePreference)
      setResolvedTheme(next)
      applyResolvedTheme(next)
    }
    apply()
    if (themePreference !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [themePreference])

  return (
    <div className="app-shell" data-difficulty={difficulty} data-status={shellStatus} data-theme={resolvedTheme}>
      <div className="room">
        <header className="room-bar">
          <div className="wordmark">
            <img
              className="wordmark-mark"
              src="/app-icons/noot-app-icon.png"
              alt=""
              aria-hidden="true"
            />
            <h1 className="wordmark-name">SongGuessr</h1>
          </div>
          <div className="bar-actions">
            <StreakBadge count={streak} bump={streakBump} />
            <button
              type="button"
              className={`bar-btn filter-btn${activeFilterTotal > 0 ? ' is-active' : ''}`}
              onClick={() => openFilterModal()}
            >
              <FilterIcon />
              <span className="bar-label">Filters</span>
              {activeFilterTotal > 0 ? <span className="filter-count">{activeFilterTotal}</span> : null}
            </button>
            <button
              type="button"
              className="bar-btn icon-only"
              onClick={() => {
                clearRecentTrackIds()
                void loadAllRounds(catalogFilters)
              }}
              aria-label="Reroll all songs"
              title="Reroll"
            >
              <ReplayIcon />
            </button>
            <button
              type="button"
              className="bar-btn icon-only theme-btn"
              onClick={toggleTheme}
              aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              type="button"
              className="bar-btn icon-only"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
              title="Settings"
            >
              <GearIcon />
            </button>
          </div>
        </header>

        <main className="room-stage">
          <div
            ref={levelSwitchRef}
            className="level-switch"
            role="group"
            aria-label="Difficulty"
          >
            <span className="level-indicator" aria-hidden="true" />
            {DIFFICULTIES.map((level) => (
              <button
                key={level}
                type="button"
                className={level === difficulty ? 'is-active' : ''}
                aria-pressed={level === difficulty}
                onClick={() => handleDifficulty(level)}
                disabled={availabilityCounts !== null && availabilityCounts[level] === 0}
              >
                {DIFFICULTY_LABELS[level]}
              </button>
            ))}
          </div>

          <div className="hero">
            <div className="mascot-ground" data-intent={mascotIntent}>
              <span className="stage-disc" aria-hidden="true" />
              <span className="mascot-shadow" aria-hidden="true" />
              <Mascot
                difficulty={difficulty}
                intent={mascotIntent}
                withStreak={mascotWinStreak}
                loseReason={mascotLoseReason}
              />
            </div>
            <h2 className="headline" key={headline}>
              {headline}
            </h2>
            <p className="subline">{subline}</p>
          </div>

          <section className="deck">
            {catalogLoading && !activeState.round && (
              <div className="notice" role="status">
                <span className="spinner" aria-hidden="true" />
                <p>Loading songs</p>
              </div>
            )}

            {catalogError && !activeState.round && !catalogLoading && (
              <div className="notice">
                <p className="notice-title">No songs match</p>
                <p>Clear your filters or try another mix.</p>
                {activeFilterTotal > 0 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      clearAllFilters()
                      setCatalogError(null)
                    }}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            )}

            {activeState.round && !showResult && (
              <div className="round">
                <div
                  className={[
                    'transport',
                    isPlaying ? 'is-playing' : '',
                    isLoadingClip ? 'is-loading' : '',
                    !roundHasAudio ? 'no-audio' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <button
                    type="button"
                    className="play-control"
                    onClick={() => void playClip()}
                    disabled={!roundHasAudio && !isPlaying && !isLoadingClip}
                    aria-label={
                      isLoadingClip
                        ? 'Cancel loading clip'
                        : `Play ${currentStageEndpoint} second clip`
                    }
                  >
                    <PlayControlIcon
                      state={isLoadingClip ? 'loading' : isPlaying ? 'pause' : 'play'}
                    />
                  </button>

                  <div className="meter">
                    <div className="meter-row">
                      <p className="meter-label">
                        Try {attemptNumber} of {activeStages.length}
                      </p>
                      <span className="clip-length" key={currentStageEndpoint}>
                        <b>{formatStageValue(currentStageEndpoint)}</b>
                        <span>s</span>
                      </span>
                    </div>
                    <div className="stage-track" aria-label="Stage progress">
                      {ALL_STAGES.map((stage) => {
                        const enabled = enabledStages.includes(stage)
                        const stagePosition = activeStages.indexOf(stage)
                        const isCurrent = enabled && stagePosition === activeState.stageIndex
                        const isPassed = enabled && stagePosition >= 0 && stagePosition < activeState.stageIndex
                        const isLastEnabled =
                          enabled && stage === activeStages[activeStages.length - 1]
                        return (
                          <span
                            key={stage}
                            className={[
                              enabled ? 'enabled' : 'disabled',
                              isPassed ? 'passed' : '',
                              isCurrent ? 'current' : '',
                              isLastEnabled ? 'last-enabled' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            style={{ flexGrow: enabled ? stageSegmentWeight(stage) : 0 }}
                            aria-hidden={!enabled}
                          />
                        )
                      })}
                      <div
                        className="stage-unlocked-progress"
                        style={{ width: `${unlockedProgress}%` }}
                      />
                      <div
                        ref={playbackBarRef}
                        className="stage-playback-progress"
                        style={{ width: `${playbackProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <form className="guess-form" onSubmit={handleGuessSubmit}>
                  <div className={`search-wrap ${selectedTrack ? 'selected' : ''}`}>
                    <span className="search-icon" aria-hidden="true" />
                    <input
                      value={searchQuery}
                      onChange={(event) => {
                        setSelectedTrack(null)
                        setSearchQuery(event.target.value)
                        setHighlightedIndex(-1)
                      }}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Name the track"
                      aria-label="Name the track"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {searchQuery && !selectedTrack && searchOpen && (
                      <div
                        className="suggestions"
                        role="listbox"
                        aria-label="Song suggestions"
                        ref={suggestionsRef}
                      >
                        {searchResults.map((result, index) => (
                          <button
                            key={result.id}
                            type="button"
                            className={index === highlightedIndex ? 'highlighted' : ''}
                            role="option"
                            aria-selected={index === highlightedIndex}
                            onMouseMove={() => setHighlightedIndex(index)}
                            onClick={() => selectTrackForGuess(result)}
                          >
                            {result.albumArt ? (
                              <img
                                className="artwork small"
                                src={result.albumArt}
                                alt=""
                                width={30}
                                height={30}
                                decoding="async"
                              />
                            ) : (
                              <span className="artwork small fallback">♫</span>
                            )}
                            <span>
                              <strong>{result.title}</strong>
                              <small>{result.artist}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedTrack ? (
                    <button type="submit" className="btn btn-primary guess-button">
                      Guess
                    </button>
                  ) : (
                    <button type="button" className="btn btn-quiet skip-button" onClick={handleSkip}>
                      <SkipIcon />
                      Skip
                    </button>
                  )}
                </form>

                {audioError && (
                  <p className="inline-alert" role="alert">
                    {audioError}
                  </p>
                )}

                {activeState.wrongGuesses.length > 0 && (
                  <ul className="misses" aria-label="Wrong guesses">
                    {activeState.wrongGuesses.map((guess) => (
                      <li key={guess}>{guess}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {showResult && activeState.answer && (
              <div className={`result ${activeState.status}`}>
                <div className="track-row">
                  <div className="result-artwork-wrap">
                    <button
                      type="button"
                      className={`result-play-toggle${isPlaying ? ' playing' : ' paused'}`}
                      onClick={() => toggleRevealPlayback()}
                      aria-label={isPlaying ? 'Pause song' : 'Play song'}
                    >
                      {activeState.answer.albumArt ? (
                        <img
                          className="artwork"
                          src={activeState.answer.albumArt}
                          alt=""
                          width={72}
                          height={72}
                          decoding="async"
                        />
                      ) : (
                        <div className="artwork fallback">♫</div>
                      )}
                      <span className="result-play-glyph" aria-hidden="true">
                        <PlayControlIcon state={isPlaying ? 'pause' : 'play'} />
                      </span>
                    </button>
                    {activeState.status === 'won' && (
                      <>
                        <div className="success-ring success-ring-one" />
                        <div className="success-ring success-ring-two" />
                        <Confetti />
                      </>
                    )}
                  </div>
                  <div className="track-meta">
                    <p className="track-kicker">
                      {activeState.status === 'won' ? `Guessed in ${guessSeconds}s` : 'The answer'}
                    </p>
                    <h3 className="track-title">{activeState.answer.title}</h3>
                    <p className="track-artist">{activeState.answer.artist}</p>
                  </div>
                </div>

                {audioError && (
                  <p className="inline-alert" role="alert">
                    {audioError}
                  </p>
                )}

                <div className="result-actions">
                  {autoRerollCountdown === null ? (
                    <button
                      type="button"
                      className="btn btn-primary result-next-button"
                      onClick={() => startNextSong()}
                    >
                      Next song <NextSongIcon />
                    </button>
                  ) : (
                    <div className="countdown" role="status">
                      <span>Next song in {autoRerollCountdown}s</span>
                      <button type="button" className="btn btn-text" onClick={clearAutoReroll}>
                        Cancel
                      </button>
                    </div>
                  )}
                  {activeState.status === 'lost' && (
                    <button
                      type="button"
                      className="btn btn-quiet result-retry-button"
                      onClick={() => retryRound()}
                    >
                      <RetryIcon /> Retry
                    </button>
                  )}
                  <a
                    className="btn btn-text"
                    href={`https://open.spotify.com/track/${activeState.answer.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Spotify
                  </a>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <div className="settings-sheet-body">
          <SpotifyConnect
            isConnected={spotify.isConnected}
            isPremium={spotify.isPremium}
            displayName={spotify.session?.displayName}
            connecting={spotify.connecting}
            authError={spotify.authError}
            onConnect={() => void spotify.connect()}
            onDisconnect={spotify.disconnect}
          />

          <div className="settings-section">
            <p className="eyebrow">
              <WaveformIcon /> Song start
            </p>
            <div className="two-up">
              <button
                type="button"
                className={`setting-value ${startMode === 'intro' ? 'active-setting' : ''}`}
                disabled={controlsDisabled || !spotify.canUseStartModes}
                onClick={() => handleStartMode('intro')}
              >
                From the start
              </button>
              <button
                type="button"
                className={`setting-value ${startMode === 'hook' ? 'active-setting' : ''}`}
                disabled={controlsDisabled || !spotify.canUseStartModes}
                onClick={() => handleStartMode('hook')}
              >
                Main hook
              </button>
            </div>
            <p className="setting-note">
              {spotify.canUseStartModes
                ? 'Play from the intro or chorus.'
                : 'Connect Spotify above to unlock.'}
            </p>
          </div>

          <div className="settings-section">
            <p className="eyebrow">
              <StopwatchIcon /> Stages
            </p>
            <div className="stage-pills">
              {ALL_STAGES.map((stage) => {
                const enabled = enabledStages.includes(stage)
                const isCurrent = enabled && activeStages[activeState.stageIndex] === stage
                return (
                  <button
                    key={stage}
                    type="button"
                    className={[
                      'stage-pill',
                      enabled ? 'enabled' : '',
                      isCurrent ? 'current' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={controlsDisabled}
                    aria-pressed={enabled}
                    aria-label={
                      enabled ? `Remove ${stage} second stage` : `Add ${stage} second stage`
                    }
                    onClick={() => toggleStage(stage)}
                  >
                    {formatStageLabel(stage)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="settings-section">
            <p className="eyebrow">
              <AutoRerollIcon /> Auto reroll
            </p>
            <button
              type="button"
              className={`setting-value auto-reroll-toggle ${autoReroll ? 'active-setting' : ''}`}
              disabled={controlsDisabled}
              onClick={() => setAutoReroll((value) => !value)}
            >
              Auto reroll
              <span className="auto-reroll-state">{autoReroll ? 'On' : 'Off'}</span>
              <span className="toggle-track">
                <span />
              </span>
            </button>
          </div>

          <div className="settings-section volume-control">
            <div className="volume-header">
              <p className="eyebrow">
                <VolumeIcon /> Volume
              </p>
              <span className="volume-value">{Math.round(volume * 100)}%</span>
            </div>
            <div className="volume-slider-row">
              <button
                type="button"
                className="volume-reset"
                aria-label="Reset volume to 100%"
                onClick={() => setVolume(1)}
              >
                <ResetIcon />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                aria-label="Volume"
                style={{ '--volume-percent': `${volume * 100}%` } as CSSProperties}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="settings-section">
            <p className="eyebrow">Theme</p>
            <div className="theme-pills">
              <button
                type="button"
                className={`setting-value ${themePreference === 'system' ? 'active-setting' : ''}`}
                onClick={() => handleThemePreference('system')}
              >
                System
              </button>
              <button
                type="button"
                className={`setting-value ${themePreference === 'light' ? 'active-setting' : ''}`}
                onClick={() => handleThemePreference('light')}
              >
                Light
              </button>
              <button
                type="button"
                className={`setting-value ${themePreference === 'dark' ? 'active-setting' : ''}`}
                onClick={() => handleThemePreference('dark')}
              >
                Dark
              </button>
            </div>
          </div>

          <div className="settings-section">
            <p className="eyebrow">
              <FeedbackIcon /> Feedback
            </p>
            <button type="button" className="setting-value" disabled>
              Coming soon
            </button>
          </div>
        </div>
      </SettingsSheet>

      {filterModalOpen ? (
      <Suspense fallback={null}>
        <FilterModal
          open={filterModalOpen}
          difficulty={difficulty}
          draftEras={draftEras}
          draftGenres={draftGenres}
          draftCountries={draftCountries}
          draftCollections={draftCollections}
          regions={regions}
          collections={collections}
        previewCount={draftPreviewCount}
        onClose={() => setFilterModalOpen(false)}
        onToggleEra={(era) => setDraftEras((current) => toggleFilterValue(current, era, ERA_OPTIONS))}
        onToggleGenre={(genre) =>
          setDraftGenres((current) => toggleFilterValue(current, genre, GENRE_OPTIONS))
        }
        onToggleRegion={(country) =>
          setDraftCountries((current) => toggleFilterValue(current, country, COUNTRY_CODES))
        }
        onToggleCollection={(id) =>
          setDraftCollections((current) =>
            toggleFilterValue(
              current,
              id,
              collections.map((collection) => collection.id),
            ),
          )
        }
        onClearEras={() => setDraftEras([])}
        onClearGenres={() => setDraftGenres([])}
        onClearRegions={() => setDraftCountries([])}
        onClearCollections={() => setDraftCollections([])}
        onClearAll={() => {
          setDraftEras([])
          setDraftGenres([])
          setDraftCountries([])
          setDraftCollections([])
        }}
        onApply={applyFilters}
      />
      </Suspense>
      ) : null}

      <audio ref={audioRef} preload="none" />
    </div>
  )
}
