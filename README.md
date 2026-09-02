# SongGuessr

Guess the song from a short clip. SongGuessr is a free browser game for OPM, the Philippines, and other countries, built on Cloudflare Workers.

**Live:** [https://songguessr.lol](https://songguessr.lol)

## Setup

1. Add your Spotify credentials to `.env.local`:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

Get keys from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

In your Spotify app settings, add this **Redirect URI** (must match exactly):

- Local: `http://127.0.0.1:3000/`
- Production: `https://songguessr.lol/`

Users connect their own **Spotify Premium** account in the game settings. **From the start** and **Main hook** use full-song playback via the Spotify Web Playback SDK. Without Premium, only 30-second preview clips play.

2. Build the OPM catalogue (paginates up to 250 songs per artist across 123+ OPM acts; resumes if interrupted):

```bash
npm run build:catalog
npm run enrich:catalog
npm run upload:catalog
```

`build:catalog` writes `data/catalog.json` locally (gitignored), then `upload:catalog` pushes it to R2. **R2 is the source of truth** for prod and local dev — there is no bundled catalog in the repo.

Re-run `build:catalog` any time to resume — progress is saved after each artist.

3. Run locally:

```bash
npm run dev
```

4. Deploy to Cloudflare (you're already signed in):

```bash
npm run deploy
```

The Worker and R2 bucket are both named `songguessr` in `wrangler.jsonc`. After deploy, seed the new bucket with `npm run upload:catalog -- --force`. The legacy bucket `songgussr` can remain until migration is verified.

## Hosted audio on R2 (optional)

For **From the start** / **Main hook** behaviour like the reference app, you can host your own **licensed** audio on Cloudflare R2. The game prefers R2 URLs when present in the catalog and falls back to Deezer/iTunes preview clips otherwise.

**You must provide the audio files yourself.** Do not rip songs from Spotify, YouTube, Deezer, or other services. Only upload files you own or are licensed to use.

### 1. Add files under `data/audio/`

Use the Spotify track `id` from the catalog (build locally or inspect R2) as the filename stem:

| File | Catalog field |
|------|----------------|
| `{trackId}.mp3` | `audioUrl` — full song; intro/hook use `startAtMs` / `hookStartMs` seeks |
| `{trackId}-intro.mp3` | `introClipUrl` — optional pre-cut intro |
| `{trackId}-hook.mp3` | `hookClipUrl` — optional pre-cut hook |
| `{trackId}.json` | optional `{ "startAtMs": 0, "hookStartMs": 45000 }` |

See `data/catalog.audio-example.json` for the resulting catalog shape.

### 2. Sync to R2 (automated)

```bash
npm run audio:status      # how many tracks have local files / R2 URLs
npm run audio:manifest    # writes data/audio/manifest.json (planning checklist)
npm run sync:audio        # upload new/changed files only, update catalog
npm run sync:audio -- --missing-only   # only tracks not on R2 yet
npm run sync:audio -- --deploy         # sync then deploy
```

`sync:audio` skips unchanged files (tracked in `data/audio/.upload-state.json`). Drop new MP3s in `data/audio/` anytime and re-run — only new or modified files upload.

`upload:audio` still works for a full one-shot upload. Use `--dry-run` or `--track <id>` on either command.

### 3. Deploy

```bash
npm run deploy
```

Audio is served from the Worker at `/api/audio/*` (R2 binding `AUDIO_BUCKET` in `wrangler.jsonc`). Range requests are supported for seeking within full songs.

### Limitations

- Preview URLs remain 30-second store clips when no R2 audio is configured for a track.
- Hook mode without `hookClipUrl` seeks into `audioUrl` at `hookStartMs` (milliseconds); without hosted audio it uses separate preview URLs or a 12s offset.
- You are responsible for licensing and copyright compliance for all uploaded audio.

## How it scales

- Spotify API is used to build the catalogue (`build:catalog` locally, or automatically in production via Cron)
- Players stream preview MP3s directly from Spotify's CDN (`p.scdn.co`)
- Your single API key is **not** hit on every play — only during catalogue builds

## Catalog source of truth (R2)

The catalogue lives in **R2** at `catalog/catalog.json` in the `songguessr` bucket. Both production and local dev (`npm run dev`) read from this bucket via the `AUDIO_BUCKET` binding (`remote: true` in `wrangler.jsonc`).

| Setting | Value |
|---------|-------|
| R2 bucket | `songguessr` |
| Catalog key | `catalog/catalog.json` |
| Checkpoint key | `catalog/build-checkpoint.json` |
| Local cache | 10-minute in-memory cache in the Worker |

If R2 has no catalog, API routes return **503** with a message to run `npm run upload:catalog`. There is no fallback to a local file in the repo.

### First-time seed

After building locally, upload the catalogue to R2:

```bash
npm run build:catalog
npm run upload:catalog
```

Use `--force` to overwrite an existing R2 catalog.

## Automatic catalog growth (production)

In production the catalogue lives in **R2** (`catalog/catalog.json`) and grows over time via a **Worker Cron** trigger.

| Setting | Value |
|---------|-------|
| Cron schedule | Every 6 hours (`0 */6 * * *` UTC) |
| R2 keys | `catalog/catalog.json`, `catalog/build-checkpoint.json` |
| Batch size | 3–5 artists per cron run (adaptive; continues while under time budget) |
| Cap | Stops adding tracks at **20,000** |

Each cron invocation:

1. Loads the catalog and checkpoint from R2
2. Skips if the catalog is at the 20k cap or all artists are done
3. Fetches the next OPM artists from Spotify (top tracks, albums, search) — up to 5 per run when time allows
4. On Spotify 429 rate limits, waits for `Retry-After` (with exponential backoff) and retries indefinitely — never abandons mid-artist
5. Resolves preview URLs (Spotify / iTunes)
6. Writes the updated catalog and checkpoint back to R2 after each artist

HTTP requests read the catalog from R2 with a **10-minute in-memory cache**.

### Re-seed from local build

After a local `build:catalog`, push to R2:

```bash
npm run upload:catalog
```

Use `--force` to overwrite an existing R2 catalog.

## Admin panel

Production admin UI for catalog management and system health monitoring.

| | |
|---|---|
| **URL** | `https://songguessr.lol/admin` |
| **Password** | `wizard123` (override with `ADMIN_PASSWORD` in `wrangler.jsonc` or `wrangler secret put ADMIN_PASSWORD`) |

Sign in with the password on the login page. Sessions use an httpOnly cookie (7 days).

### Routes

| Route | Description |
|-------|-------------|
| `/admin` | Admin SPA (Dashboard, Catalog, Add songs) |
| `GET /admin/api/status` | Health, track count, R2 timestamps, artist checkpoint, cron schedule |
| `GET /admin/api/catalog` | Paginated catalog (`?page=1&pageSize=50&q=`) |
| `GET /admin/api/catalog/search` | Search existing catalog (`?q=`) |
| `GET /admin/api/spotify/search` | Spotify track search for manual add (`?q=`) |
| `POST /admin/api/catalog/add` | Add track by Spotify ID (`{ "trackId": "..." }`) |
| `POST /admin/api/catalog/playlist/preview` | List a playlist's tracks and flag which are already in D1 |
| `DELETE /admin/api/catalog/:trackId` | Remove track from catalog |
| `POST /admin/api/catalog/remove-bulk` | Remove many tracks (`{ "trackIds": [...] }`) → `{ removed, notFound }`, max 1000 per call |
| `POST /admin/api/spotify/sync` | Refresh popularity, play count, and release date; returns per-field fill counts |
| `POST /admin/api/login` | Authenticate (`{ "password": "..." }`) |
| `POST /admin/api/logout` | Clear session |

### Bulk removal

Two ways to clean up a bad import:

- **Add songs → Remove by playlist** — paste the playlist you imported from, **Fetch songs**, and the
  checklist marks which tracks exist in D1. *Only in catalog* selects just those. **Remove selected**
  asks for confirmation, then deletes and reports removed / not-found counts.
- **Catalog table** — a checkbox column with select-all-on-page. The action bar shows the selected
  count and **Remove selected** confirms before deleting.

Both hit `POST /admin/api/catalog/remove-bulk`, which deletes from D1 and mirrors the deletion into
the legacy `catalog/catalog.json` snapshot in R2 so stale data cannot resurrect a track.

Manual adds validate OPM artists via `isOpmSpotifyTrack` and resolve preview URLs before writing to R2.

> **Note:** Admin lives at `/admin` on the production domain. `www.songguessr.lol` serves the same Worker. The workers.dev URL (`https://songguessr.ayangabryl.workers.dev/`) remains as a fallback.

## Track metrics: popularity, plays, release date

Difficulty is scored from Spotify metadata only. Three fields feed it, from two different sources:

| Field | Source | Notes |
|-------|--------|-------|
| `popularity` (0–100) | `GET /v1/tracks?ids=` | Official. Currently **quota-blocked (429)** for this app, so the column is `0` across the catalog. |
| `play_count` | `open.spotify.com` web player | Real listen counts. Unofficial — see below. |
| `release_date` / `release_year` | Web player, or the Web API when quota allows | Backfilled for the whole catalog. |

### How play count is obtained

There is no listen count on the official Web API, and the public track page ships no
`__NEXT_DATA__`. The path that works:

1. `GET https://open.spotify.com/embed/track/{id}` returns `__NEXT_DATA__` containing an
   **anonymous** web-player access token (`props.pageProps.state.settings.session.accessToken`).
2. That token authorizes the web player's persisted GraphQL query against
   `https://api-partner.spotify.com/pathfinder/v1/query` (`operationName: getTrack`), which returns
   `trackUnion.playcount` and `albumOfTrack.date.isoString`.

`https://open.spotify.com/get_access_token` is blocked (403) and `/api/token` refuses non-web-player
clients (400), so the embed page is the only usable token source.

This is **undocumented and can break without notice**. `worker/spotify-public-stats.ts` keeps it
conservative: concurrency 4, a short delay between chunks, at most 250 tracks per run, token
refresh before expiry, and an immediate stop on 401/403/429. Nothing is credentialed or stored —
the anonymous token lives only for the duration of a run. When a lookup fails, the field stays
`NULL` and the admin UI shows an em dash; play counts are **never** estimated.

### Scoring

`playCountScore` in `worker/difficulty.ts` maps plays onto the same 0–100 range as popularity on a
log scale (10K → 0, 1M → ~44, 100M → ~89). When popularity exists it stays the primary signal and
plays are blended in; when popularity is missing, plays carry the track weight instead of leaving
the score artificially low. The same substitution is mirrored in the SQL fame gate in
`worker/catalog-d1.ts` (bucketed, since D1's SQLite has no `log10()`).

Run a sync from **Dashboard → Sync Spotify metrics**. It reports how many release dates, play
counts, and popularity values it filled, plus the source used. The 6-hourly cron runs the same job,
filling gaps first and then refreshing the stalest rows.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev with Vite + Worker |
| `npm run build:catalog` | Fetch OPM tracks from Spotify (full artist discographies) |
| `npm run upload:catalog` | Upload local `data/catalog.json` to R2 (seed / reset) |
| `npm run upload:audio` | One-shot upload from `data/audio/` to R2 |
| `npm run sync:audio` | Incremental sync (recommended) |
| `npm run audio:manifest` | Generate upload checklist from catalog |
| `npm run audio:status` | Show R2 coverage stats |
| `npm run build` | Production build |
| `npm run deploy` | Deploy to Cloudflare Workers |
