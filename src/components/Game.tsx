import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import {
  type Difficulty,
  type GameRound,
  type SearchResult,
  fetchAvailability,
  fetchRandomRound,
  searchTracks,
  submitGuess,
} from '../lib/api'
import {
  activeFilterCount,
  loadEraFilters,
  loadGenreFilters,
  saveEraFilters,
  saveGenreFilters,
  toggleFilterValue,
  ERA_OPTIONS,
  GENRE_OPTIONS,
  type CatalogFilters,
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
  clampPlaybackStart,
  seekAudio,
  waitForAudioMetadata,
} from '../lib/audio-playback'
import { hasPlayableAudio, resolvePlaybackSource } from '../lib/playback-source'
import { spotifyStartPositionMs } from '../lib/spotify-playback'
import {
  activateSpotifyElement,
  getSpotifyExtrapolatedPositionMs,
  isSameSpotifyTrackLoaded,
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
import {
  AutoRerollIcon,
  FeedbackIcon,
  FilterIcon,
  NextSongIcon,
  PlayControlIcon,
  ReplayIcon,
  ResetIcon,
  RetryIcon,
  SkipIcon,
  StopwatchIcon,
  SupportIcon,
  VolumeIcon,
  WaveformIcon,
} from './Icons'
import { FilterModal } from './FilterModal'
import { SpotifyConnect } from './SpotifyConnect'

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
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [draftEras, setDraftEras] = useState<EraFilter[]>([])
  const [draftGenres, setDraftGenres] = useState<GenreFilter[]>([])
  const [availabilityCounts, setAvailabilityCounts] = useState<Record<Difficulty, number> | null>(
    null,
  )
  const [draftPreviewCount, setDraftPreviewCount] = useState(0)

  const catalogFilters = useMemo<CatalogFilters>(
    () => ({ eras: eraFilters, genres: genreFilters }),
    [eraFilters, genreFilters],
  )
  const draftFilters = useMemo<CatalogFilters>(
    () => ({ eras: draftEras, genres: draftGenres }),
    [draftEras, draftGenres],
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

  const loadAllRounds = useCallback(async (filters: CatalogFilters = catalogFilters) => {
    setCatalogLoading(true)
    setCatalogError(null)

    try {
      const recent = loadRecentExcludes()
      const excludeTrackIds = [...recent.trackIds]
      const excludeSongKeys = [...recent.songKeys]
      const results: Array<{ level: Difficulty; state: RoundState }> = []

      for (const level of DIFFICULTIES) {
        const currentRound = roundsRef.current[level].round
        const batchExcludeTrackIds = [
          ...excludeTrackIds,
          ...(currentRound?.trackId ? [currentRound.trackId] : []),
        ]
        const batchExcludeSongKeys = [
          ...excludeSongKeys,
          ...(currentRound?.songKey ? [currentRound.songKey] : []),
        ]

        const round = await fetchRandomRound(level, filters, {
          excludeTrackIds: batchExcludeTrackIds,
          excludeSongKeys: batchExcludeSongKeys,
        })
        excludeTrackIds.push(round.trackId)
        if (round.songKey) excludeSongKeys.push(round.songKey)
        rememberTrack(round.trackId, round.songKey)
        results.push({
          level,
          state: {
            ...createRoundState(),
            round,
            status: 'playing' as const,
            startedAt: Date.now(),
          },
        })
      }

      setRounds(
        Object.fromEntries(results.map((result) => [result.level, result.state])) as Record<
          Difficulty,
          RoundState
        >,
      )
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : 'Could not load the catalogue.')
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
      rememberTrack(round.trackId, round.songKey)
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
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : 'Could not load the catalogue.')
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
  }, [difficulty])

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
    void fetchAvailability(catalogFilters).then((data) => {
      setAvailabilityCounts(data.counts)
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
      return
    }

    const stageEndpoint = currentStageEndpoint
    const startTimeline =
      activeState.unlockedSeconds >= stageEndpoint ? 0 : activeState.unlockedSeconds
    const session = playSessionRef.current + 1
    playSessionRef.current = session

    setAudioError(null)

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
      const canFastReplay = isSameSpotifyTrackLoaded(round.trackId)

      if (canFastReplay) {
        setIsPlaying(true)
      } else {
        clipLoadingPendingRef.current = true
        if (clipLoadingDelayRef.current) {
          window.clearTimeout(clipLoadingDelayRef.current)
          clipLoadingDelayRef.current = null
        }
        setIsLoadingClip(true)
      }

      try {
        await playSpotifyTrack(round.trackId, seekMs, volume)
        if (session !== playSessionRef.current) return

        endClipLoading()
        setIsPlaying(true)
        const playbackStart = startTimeline
        updateRound(difficulty, {
          unlockedSeconds: Math.max(activeState.unlockedSeconds, startTimeline),
          playbackSeconds: playbackStart,
        })
        spotifyTimelineRef.current = playbackStart

        let stageEnded = false
        const endSpotifyStage = () => {
          if (stageEnded || session !== playSessionRef.current) return
          stageEnded = true
          spotifyForcePauseRef.current = true
          spotifyClipArmedRef.current = false
          spotifyEndStageRef.current = null
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
          })()
        }

        spotifyEndStageRef.current = endSpotifyStage
        spotifyClipArmedAtRef.current = Date.now()
        spotifyClipArmedRef.current = true

        const remainingMs = Math.max(0, (stageEndpoint - playbackStart) * 1000)
        const timelineNow = getSpotifyTimelineSeconds()
        const clearlyPastConfirmedStart = timelineNow > stageEndpoint + 1

        if (remainingMs <= 0 && clearlyPastConfirmedStart) {
          endSpotifyStage()
          return
        }

        spotifyPauseTimeoutRef.current = window.setTimeout(
          endSpotifyStage,
          remainingMs > 0 ? remainingMs : stageEndpoint * 1000,
        )

        const tick = () => {
          if (session !== playSessionRef.current) return

          const elapsedSeconds = (Date.now() - spotifyClipArmedAtRef.current) / 1000
          const timelineSeconds = getSpotifyTimelineSeconds()
          const displaySeconds = Math.min(
            stageEndpoint,
            Math.max(startTimeline, startTimeline + elapsedSeconds),
          )
          spotifyTimelineRef.current = displaySeconds
          updateRound(difficulty, { playbackSeconds: displaySeconds })

          if (elapsedSeconds >= stageEndpoint - startTimeline) {
            endSpotifyStage()
            return
          }

          if (
            elapsedSeconds >= 0.03 &&
            timelineSeconds >= stageEndpoint &&
            timelineSeconds <= stageEndpoint + 1
          ) {
            endSpotifyStage()
            return
          }

          rafRef.current = window.requestAnimationFrame(tick)
        }

        rafRef.current = window.requestAnimationFrame(tick)
      } catch {
        if (session !== playSessionRef.current) return
        spotifyForcePauseRef.current = true
        spotifyClipArmedRef.current = false
        usingSpotifyRef.current = false
        spotifyEndStageRef.current = null
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

    audio.src = previewSource.url
    audio.volume = volume

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
      updateRound(difficulty, {
        unlockedSeconds: Math.max(activeState.unlockedSeconds, startTimeline),
        playbackSeconds: startTimeline,
      })

      const tick = () => {
        if (session !== playSessionRef.current) return

        const timelineSeconds = getTimelineSeconds()
        updateRound(difficulty, { playbackSeconds: timelineSeconds })

        if (timelineSeconds >= stageEndpoint) {
          audio.pause()
          setIsPlaying(false)
          updateRound(difficulty, {
            unlockedSeconds: stageEndpoint,
            playbackSeconds: stageEndpoint,
          })
          return
        }

        rafRef.current = window.requestAnimationFrame(tick)
      }

      rafRef.current = window.requestAnimationFrame(tick)
    } catch {
      if (session !== playSessionRef.current) return
      endClipLoading()
      setIsPlaying(false)
      setAudioError('The clip could not be played.')
    }
  }

  async function revealAnswer(level: Difficulty) {
    const round = rounds[level].round
    if (!round) return
    const result = await submitGuess(round, { reveal: true })
    stopClip()
    updateRound(level, {
      status: 'lost',
      answer: result.answer,
    })
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

    const guessResult = await submitGuess(round, { guessedTrackId: result.id })
    clearSearchSelection()

    if (guessResult.correct) {
      stopClip()
      const solvedAt = Date.now()
      updateRound(difficulty, {
        status: 'won',
        answer: guessResult.answer,
        solvedAt,
      })
      scheduleAutoReroll(difficulty)
      return
    }

    const label = `${result.title} - ${result.artist}`
    const nextIndex = activeState.stageIndex + 1
    const wrongGuesses = [...activeState.wrongGuesses, label]
    const stageEndpoint = activeStages[activeState.stageIndex] ?? activeStages[0] ?? 0.1

    if (nextIndex >= activeStages.length) {
      stopClip()
      const reveal = await submitGuess(round, { reveal: true })
      updateRound(difficulty, {
        status: 'lost',
        answer: reveal.answer,
        wrongGuesses,
      })
      scheduleAutoReroll(difficulty)
      return
    }

    stopClip()
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

  function handleSkip() {
    stopClip({ preserveProgress: true })
    advanceStageAfterSkip()
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
    setFilterModalOpen(true)
  }

  function applyFilters() {
    setEraFilters([...draftEras])
    setGenreFilters([...draftGenres])
    setFilterModalOpen(false)
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

  return (
    <div className="app-shell" data-difficulty={difficulty} data-status={shellStatus}>
      <div className="game-layout">
        <aside className="mode-panel">
          <div className="difficulty-list">
            {DIFFICULTIES.map((level) => (
              <button
                key={level}
                type="button"
                className={level === difficulty ? 'difficulty active' : 'difficulty'}
                onClick={() => setDifficulty(level)}
                disabled={catalogLoading || (availabilityCounts !== null && availabilityCounts[level] === 0)}
              >
                {DIFFICULTY_LABELS[level]}
              </button>
            ))}
          </div>
          <div className="mode-actions">
            <button
              type="button"
              className="mode-action"
              onClick={() => {
                clearRecentTrackIds()
                void loadAllRounds(catalogFilters)
              }}
            >
              <ReplayIcon /> Reroll all
            </button>
            {activeState.status === 'lost' && (
              <button type="button" className="mode-action" onClick={() => retryRound()}>
                <RetryIcon /> Play again
              </button>
            )}
            <button
              type="button"
              className={`mode-action filter-button${activeFilterTotal > 0 ? ' active-filter' : ''}`}
              onClick={openFilterModal}
            >
              <FilterIcon /> Filters{activeFilterTotal > 0 ? ` (${activeFilterTotal})` : ''}
            </button>
            <button type="button" className="mode-action" disabled>
              <FeedbackIcon /> Feedback
            </button>
            <a
              className="mode-action support-button"
              href="https://buymeacoffee.com/songlessrecreation"
              target="_blank"
              rel="noopener noreferrer"
              title="Support this project on Buy Me A Coffee"
            >
              <SupportIcon /> Support
            </a>
          </div>
        </aside>

        <div className="game-card">
          <div className={`game-content ${showResult ? 'result-state' : ''}`}>
            {catalogLoading && !activeState.round && (
              <div className="empty-state">
                <div className="empty-icon">♫</div>
                <h1>Loading catalogue...</h1>
                <p>The song library is loading.</p>
              </div>
            )}

            {catalogError && !activeState.round && (
              <div className="empty-state">
                <div className="empty-icon">{catalogLoading ? '♫' : '!'}</div>
                <h1>{catalogLoading ? 'Loading catalogue...' : 'No songs match'}</h1>
                <p>
                  {catalogLoading
                    ? 'The song library is loading.'
                    : catalogError}
                </p>
              </div>
            )}

            {activeState.round && !showResult && (
              <div className="round-panel">
                <div className="difficulty-tabs">
                  {DIFFICULTIES.map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={`${level} ${level === difficulty ? 'active' : ''}`}
                      onClick={() => setDifficulty(level)}
                      disabled={availabilityCounts !== null && availabilityCounts[level] === 0}
                    >
                      {DIFFICULTY_LABELS[level]}
                    </button>
                  ))}
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
                    className="stage-playback-progress"
                    style={{ width: `${playbackProgress}%` }}
                  />
                </div>

                <div className="player-area">
                  <button
                    type="button"
                    className={[
                      'play-button',
                      isPlaying ? 'playing' : '',
                      isLoadingClip ? 'loading' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => void playClip()}
                    aria-label={
                      isLoadingClip
                        ? 'Cancel loading clip'
                        : `Play ${currentStageEndpoint} second clip`
                    }
                  >
                    <span className="pulse-ring" />
                    <PlayControlIcon
                      state={isLoadingClip ? 'loading' : isPlaying ? 'pause' : 'play'}
                    />
                  </button>
                  <div className="stage-time">
                    <strong className="stage-value" key={currentStageEndpoint}>
                      {formatStageValue(currentStageEndpoint)}
                    </strong>
                    <span>s</span>
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
                      placeholder="Search songs..."
                      aria-label="Search songs"
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
                              <img className="artwork small" src={result.albumArt} alt="" />
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
                    <button type="submit" className="guess-button">
                      Guess
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="skip-button"
                      onClick={handleSkip}
                    >
                      <SkipIcon />
                      Skip
                    </button>
                  )}
                </form>

                {audioError && (
                  <p className="audio-error" role="alert">
                    {audioError}
                  </p>
                )}

                {activeState.wrongGuesses.length > 0 && (
                  <div className="wrong-guesses">
                    {activeState.wrongGuesses.map((guess) => (
                      <span key={guess}>{guess}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showResult && activeState.answer && (
              <div className={`result-panel ${activeState.status}`}>
                <div className="result-artwork-wrap">
                  {activeState.answer.albumArt ? (
                    <img className="artwork" src={activeState.answer.albumArt} alt="" />
                  ) : (
                    <div className="artwork fallback">♫</div>
                  )}
                  {activeState.status === 'won' && (
                    <>
                      <div className="success-ring success-ring-one" />
                      <div className="success-ring success-ring-two" />
                      <Confetti />
                    </>
                  )}
                </div>
                <div className="result-kicker">
                  {activeState.status === 'won' ? 'Correct' : 'Nice try'}
                </div>
                <h1>{activeState.answer.title}</h1>
                <p className="result-artist">{activeState.answer.artist}</p>
                <a
                  className="result-source-link"
                  href={`https://open.spotify.com/track/${activeState.answer.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Spotify
                </a>
                {audioError && (
                  <p className="audio-error" role="alert">
                    {audioError}
                  </p>
                )}
                <div className="result-stamp">
                  {activeState.status === 'won'
                    ? `Guessed in ${guessSeconds}s!`
                    : 'Lost!'}
                </div>
                <div className="result-actions">
                  {activeState.status === 'lost' && (
                    <button
                      type="button"
                      className="result-action result-retry-button"
                      onClick={() => retryRound()}
                    >
                      <RetryIcon /> Retry
                    </button>
                  )}
                  {autoRerollCountdown === null && (
                    <button
                      type="button"
                      className="result-action result-next-button primary"
                      onClick={() => startNextSong()}
                    >
                      Next song <NextSongIcon />
                    </button>
                  )}
                </div>
                {autoRerollCountdown !== null && (
                  <div className="auto-reroll-countdown" role="status">
                    <span>Next song in {autoRerollCountdown}s</span>
                    <button type="button" onClick={clearAutoReroll}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="settings-panel">
          <SpotifyConnect
            isConnected={spotify.isConnected}
            isPremium={spotify.isPremium}
            displayName={spotify.session?.displayName}
            connecting={spotify.connecting}
            authError={spotify.authError}
            onConnect={() => void spotify.connect()}
            onDisconnect={spotify.disconnect}
          />

          <div>
            <p className="eyebrow">
              <WaveformIcon /> Song start
            </p>
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
            <p className="setting-note">
              {spotify.canUseStartModes
                ? 'Play from the intro or chorus.'
                : 'Connect Spotify above to unlock.'}
            </p>
          </div>

          <div>
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

          <div>
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

          <div className="volume-control">
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
        </aside>
      </div>

      <FilterModal
        open={filterModalOpen}
        difficulty={difficulty}
        draftEras={draftEras}
        draftGenres={draftGenres}
        previewCount={draftPreviewCount}
        onClose={() => setFilterModalOpen(false)}
        onToggleEra={(era) => setDraftEras((current) => toggleFilterValue(current, era, ERA_OPTIONS))}
        onToggleGenre={(genre) =>
          setDraftGenres((current) => toggleFilterValue(current, genre, GENRE_OPTIONS))
        }
        onClearEras={() => setDraftEras([])}
        onClearGenres={() => setDraftGenres([])}
        onClearAll={() => {
          setDraftEras([])
          setDraftGenres([])
        }}
        onApply={applyFilters}
      />

      <audio ref={audioRef} preload="none" />
    </div>
  )
}
