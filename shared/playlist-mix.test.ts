import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spotifyPlaylistId, parsePlaylistMix } from './playlist-mix.ts'
import { parseMatchFilters } from './match-filters.ts'

const spotifyId = '37i9dQZEVXbNBz9cRCSFkY'
const mix = {id:'a'.repeat(64),spotifyId,name:'My songs',matched:12,total:50,partial:true}

test('accept only Spotify playlist URLs and URIs, including shared locale links', () => {
  for (const link of [`spotify:playlist:${spotifyId}`, `https://open.spotify.com/playlist/${spotifyId}?si=abc`, ` https://open.spotify.com/intl-es/playlist/${spotifyId}/ `]) {
    assert.equal(spotifyPlaylistId(link),spotifyId)
  }
  for (const link of [`https://open.spotify.com/track/${spotifyId}`, `https://open.spotify.com.evil.test/playlist/${spotifyId}`, `https://evil.test/?url=https://open.spotify.com/playlist/${spotifyId}`, `http://open.spotify.com/playlist/${spotifyId}`, `https://user@open.spotify.com/playlist/${spotifyId}`, `https://open.spotify.com:8443/playlist/${spotifyId}`, `https://open.spotify.com/playlist/${spotifyId}/more`, 'not a link']) {
    assert.equal(spotifyPlaylistId(link),null,link)
  }
})

test('multiplayer retains a validated playlist snapshot alongside other filters', () => {
  assert.deepEqual(parsePlaylistMix(mix),mix)
  assert.deepEqual(parseMatchFilters({playlist:mix,artists:['SB19'],excludedGenres:['rock']}),{playlist:mix,artists:['SB19'],excludedGenres:['rock']})
  for (const playlist of [{...mix,id:'bad'}, {...mix,matched:0}, {...mix,total:1}, {...mix,partial:'yes'}, {...mix,name:''}]) {
    assert.equal(parseMatchFilters({playlist}),null)
  }
})
