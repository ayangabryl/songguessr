import { test } from 'node:test'
import assert from 'node:assert/strict'
import { audioCandidates, isUnreliableAudioUrl, r2KeyFromAudioUrl } from './playable-audio.ts'

test('empty and Deezer URLs are treated as unplayable', () => {
  assert.equal(isUnreliableAudioUrl(''), true)
  assert.equal(isUnreliableAudioUrl(undefined), true)
  assert.equal(isUnreliableAudioUrl('https://cdns-preview-1.dzcdn.net/stream/x'), true)
  assert.equal(isUnreliableAudioUrl('https://p.scdn.co/mp3-preview/ok'), false)
})

test('audio candidates prefer hosted clips and skip duplicates', () => {
  const list = audioCandidates({
    introClipUrl: '/api/audio/a-intro.mp3',
    audioUrl: '/api/audio/a.mp3',
    previewUrl: 'https://p.scdn.co/mp3-preview/ok',
    hookPreviewUrl: 'https://p.scdn.co/mp3-preview/ok',
    startAtMs: 12000,
  })
  assert.deepEqual(list.map((item) => item.url), [
    '/api/audio/a-intro.mp3',
    '/api/audio/a.mp3',
    'https://p.scdn.co/mp3-preview/ok',
  ])
  assert.equal(list[1]?.offset, 12)
})

test('R2 keys come from the public audio route', () => {
  assert.equal(r2KeyFromAudioUrl('/api/audio/opm%2Fsong.mp3'), 'opm/song.mp3')
  assert.equal(r2KeyFromAudioUrl('https://songguessr.pages.dev/api/audio/x.m4a'), 'x.m4a')
  assert.equal(r2KeyFromAudioUrl('https://p.scdn.co/mp3-preview/ok'), null)
})
