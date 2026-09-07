import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasPlayableAudio, resolvePlaybackSource } from './playback-source.ts'
import type { GameRound } from './api.ts'

const round = (patch: Partial<GameRound>): GameRound => ({
  seed: 's',
  difficulty: 'easy',
  trackId: 't',
  songKey: 'k',
  previewUrl: '',
  albumArt: '',
  stages: [0.1, 0.5, 2, 8, 15],
  filters: { eras: [], genres: [], countries: [], collections: [], artists: [] },
  ...patch,
})

test('hosted intro wins over a dead Deezer preview', () => {
  const source = resolvePlaybackSource(
    round({
      previewUrl: 'https://cdns-preview-1.dzcdn.net/stream/x',
      introClipUrl: '/api/audio/opm.mp3',
    }),
    'intro',
  )
  assert.equal(source.url, '/api/audio/opm.mp3')
  assert.equal(hasPlayableAudio(round({ previewUrl: 'https://cdns-preview-1.dzcdn.net/stream/x' })), false)
})

test('Spotify preview is used when it is the only source', () => {
  const source = resolvePlaybackSource(
    round({ previewUrl: 'https://p.scdn.co/mp3-preview/ok' }),
    'intro',
  )
  assert.equal(source.url, 'https://p.scdn.co/mp3-preview/ok')
})
