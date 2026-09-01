# Songgussr

Guess the Filipino (OPM) song from short Spotify preview clips — built for Cloudflare Workers.

## Setup

1. Add your Spotify credentials to `.env.local`:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

Get keys from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

In your Spotify app settings, add this **Redirect URI** (must match exactly):

- Local: `http://127.0.0.1:3000/`
- Production: your deployed site origin with trailing slash, e.g. `https://your-app.workers.dev/`

Users connect their own **Spotify Premium** account in the game settings. **From the start** and **Main hook** use full-song playback via the Spotify Web Playback SDK. Without Premium, only 30-second preview clips play.

2. Build the OPM catalogue (paginates up to 250 songs per artist across 123+ OPM acts; resumes if interrupted):

```bash
npm run build:catalog
npm run enrich:catalog
```

Re-run `build:catalog` any time to resume — progress is saved after each artist.

3. Run locally:

```bash
npm run dev
```

4. Deploy to Cloudflare (you're already signed in):

```bash
npm run deploy
```

The Worker is named `songgussr` in `wrangler.jsonc`. The R2 audio bucket remains `opm-songless-audio` (existing Cloudflare resource). If you previously deployed as `opm-songless`, update your custom domain to the new worker or remove the old deployment after migrating.

## Hosted audio on R2 (optional)

For **From the start** / **Main hook** behaviour like the reference app, you can host your own **licensed** audio on Cloudflare R2. The game prefers R2 URLs when present in the catalog and falls back to Deezer/iTunes preview clips otherwise.

**You must provide the audio files yourself.** Do not rip songs from Spotify, YouTube, Deezer, or other services. Only upload files you own or are licensed to use.

### 1. Add files under `data/audio/`

Use the Spotify track `id` from `data/catalog.json` as the filename stem:

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

- Spotify API is used to build the catalogue (locally via `build:catalog`, or automatically in production — see below)
- Players stream preview MP3s directly from Spotify's CDN (`p.scdn.co`)
- Your single API key is **not** hit on every play — only during catalogue builds

## Automatic catalog growth (production)

In production the catalogue lives in **R2** (`catalog/catalog.json`) and grows over time via a **Worker Cron** trigger.

| Setting | Value |
|---------|-------|
| Cron schedule | Every 6 hours (`0 */6 * * *` UTC) |
| R2 keys | `catalog/catalog.json`, `catalog/build-checkpoint.json` |
| Batch size | 1 artist per cron run |
| Cap | Stops adding tracks at **20,000** |

Each cron invocation:

1. Loads the catalog and checkpoint from R2
2. Skips if the catalog is at the 20k cap or all artists are done
3. Fetches the next OPM artist from Spotify (top tracks, albums, search)
4. Resolves preview URLs (Spotify / iTunes)
5. Writes the updated catalog and checkpoint back to R2

HTTP requests read the catalog from R2 with a **10-minute in-memory cache** (falls back to bundled `data/catalog.json` if R2 is empty).

### First-time seed

After your first deploy, upload the local catalogue to R2:

```bash
npm run upload:catalog
```

Use `--force` to overwrite an existing R2 catalog. Re-run `upload:catalog` after a local `build:catalog` if you want to reset the R2 starting point.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev with Vite + Worker |
| `npm run build:catalog` | Fetch OPM tracks from Spotify (full artist discographies) |
| `npm run upload:catalog` | Seed R2 catalog from local `data/catalog.json` |
| `npm run upload:audio` | One-shot upload from `data/audio/` to R2 |
| `npm run sync:audio` | Incremental sync (recommended) |
| `npm run audio:manifest` | Generate upload checklist from catalog |
| `npm run audio:status` | Show R2 coverage stats |
| `npm run build` | Production build |
| `npm run deploy` | Deploy to Cloudflare Workers |
