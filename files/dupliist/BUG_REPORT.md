# DUPLiiST — Redesign & QA Report

**Date:** 2026-06-12
**Scope:** Full visual/UX redesign ("Spectra" identity) + end-to-end functional verification of the Flask app (`server.py`, `core.py`, `static/`).

---

## 1. Visual Redesign — "Spectra"

The previous "Aurora Control Deck" violet/cyan theme was replaced with a fresh, higher-energy identity:

- **Animated iridescent mesh background** — 4 large blurred gradient "morb" blobs drifting independently (`drift-a/b/c/d`), blended with `mix-blend-mode: screen` for a holographic effect. Replaces the old static blob layer.
- **Spectra gradient** — a violet → magenta → orange → cyan linear-gradient (`--spectra`) animated with `gradient-flow`, applied to the logo, headings, and key accents.
- **Redesigned splash screen** — conic-gradient mesh, rotating ring, sweeping highlight, and a letter-by-letter staggered entrance for the "DUPLiiST" wordmark (`letter-in` keyframes). The original `splash-seq` animation name was preserved since `app.js` listens for its `animationend` event to dismiss the splash.
- **Glass cards with animated gradient borders** — `.card` elements now have a subtle animated glow border via layered `::before`/`::after` pseudo-elements.
- **Magnetic buttons** — the main search/action button (`.sbtn`) tracks the cursor and renders a radial glow that follows it (`--mx`/`--my` CSS custom properties updated on `mousemove`).
- **Click ripples** — every interactive control (`.sbtn`, `.abtn`, format/quality pills, modal options, candidate rows, settings icons, retry button) now emits a Material-style ripple on click.
- **3D cover tilt** — the playlist cover art (`#pcov`) tilts toward the cursor within the results card (`perspective` + `rotateX/rotateY`).
- **Confetti celebration** — on `download_done` with at least one successful track, a full-screen canvas confetti burst plays (140 pieces, palette-matched colors, gravity physics, auto-cleans after ~150 frames).
- **Accessibility** — a complete `@media (prefers-reduced-motion: reduce)` block disables the mesh animation, gradient-flow, ripples, confetti, cover tilt, magnetic glow, and sparks, falling back to static states. All new JS effects also check `prefersReducedMotion()` before running.

All existing element IDs, CSS class names used by `app.js`, and `onclick` handlers were preserved — the redesign is additive/replacing styles only, no markup contract was broken.

**Verification:** `style.css` checked for brace balance (326 open / 326 close). `app.js` passed `node --check` with no syntax errors. App loaded in-browser; splash, mesh background, gradient text, ripples, magnetic button glow, cover tilt, and confetti (on completed download) all confirmed working.

---

## 2. Bugs Found & Fixed

### Bug #1 — Text-search results showed a placeholder instead of real artist/title
**Severity:** Medium (cosmetic + data-quality — affected filenames, ID3 tags, and exports)

**Where:** `core.get_text_search_track()`

**Problem:** Free-text searches (anything that isn't a Spotify/YouTube/SoundCloud URL) hardcoded `"artists": "(búsqueda libre)"`. This placeholder then propagated into:
- the downloaded **filename**,
- the embedded **ID3 "artist" tag**,
- the **`.m3u` EXTINF line**,
- the **CSV export**.

**Fix:** `get_text_search_track()` now regex-parses the query for an `"Artist - Title"` pattern (`^\s*(.+?)\s+-\s+(.+?)\s*$`). If it matches, the artist and title are split correctly; otherwise the whole query is used as the title with an empty artist.

**Follow-on issue caught while fixing this:** when the query has no dash (empty artist), the old filename/M3U code produced an ugly leading `"- Title"`. Fixed by:
- `expected_audio_filename()` — now only prefixes `"{artists} - "` when `artists` is non-empty.
- `export_m3u()` — same fix for the `#EXTINF` line title.
- `server.py` download worker — now derives `filename_hint` from `core.expected_audio_filename(t, fmt)` instead of a separate inline `f"{t['artists']} - {t['name']}"` string, so all three (filename, tags, m3u) stay consistent.

**Re-verified live:** searching `"Daft Punk - One More Time"` now downloads `Daft Punk - One More Time.mp3` with correct ID3 `artist`/`title` tags and a correct `.m3u` EXTINF line.

---

### Bug #2 — Free-text search could match a 24/7 live stream and download indefinitely
**Severity:** High (resource exhaustion / runaway process)

**Where:** `core._score_candidate()` (YouTube candidate scoring for free-text queries)

**Problem:** Searching something generic (e.g. `"lofi hip hop beats"`) can return a 24/7 **live radio stream** as the top-scored YouTube result. Starting a download of a live stream causes yt-dlp/ffmpeg to download **continuously with no natural end** — the process never finishes on its own.

**How it was found:** Triggered live during testing. The download began and ran indefinitely.

**Recovery performed (this session):**
1. Killed the ffmpeg postprocessor (`taskkill /PID 16500 /F`).
2. yt-dlp's raw HLS download thread kept running inside the Flask process — killed the whole server (`taskkill /PID 16736 /F`); the background job correctly reported `failed (exit code 1)`.
3. A second, separate ffmpeg process (the actual HLS downloader, PID 17204) was still running — killed it too.
4. Removed the leftover partial file `"- lofi hip hop beats.mp4.part"`.
5. Restarted the server and confirmed it was healthy via `/api/config`.

**Fix applied:** `_score_candidate()` now applies a `-15.0` penalty to any candidate where yt-dlp reports `is_live: true` or `live_status` in `("is_live", "is_upcoming", "post_live")`, making live streams very unlikely to be picked as the "best match".

**Caveat / recommendation:** this is a **best-effort mitigation**, not a guarantee. yt-dlp's flat playlist/search extraction (`extract_flat: "in_playlist"`) doesn't always populate `is_live`/`live_status` for every result. For stronger protection, consider:
- An explicit **download time/size cap** (e.g. abort if a single track download exceeds N minutes or N MB) as a hard backstop independent of search-result metadata.
- Re-checking `is_live` with a non-flat `extract_info` call on the chosen candidate immediately before starting the download.

---

## 3. Functionality Verified End-to-End

| Feature | Result |
|---|---|
| MP3 download | ✅ Verified via ffprobe (correct codec/bitrate) |
| FLAC download | ✅ Verified via ffprobe (flac, 44.1kHz/24-bit) |
| M4A download | ✅ Verified via ffprobe (AAC, 128kbps) |
| `.m3u` export | ✅ Correct `#EXTINF` lines with artist/title |
| CSV export (Spotify-format) | ✅ |
| CSV export (SoundCloud-format) | ✅ |
| "Convert to YouTube" (watch_videos chunking) | ✅ |
| Spotify playlist/track load (metadata + match) | ✅ |
| Free-text search ("Artist - Title" form) | ✅ correct metadata after fix |
| Free-text search (no dash) | ✅ no more leading "- " in filenames/m3u after fix |
| Match-candidates picker endpoint | ✅ |
| "Open folder" endpoint | ✅ |
| Download progress / SSE events (`progress`, `track_downloaded`, `download_done`, etc.) | ✅ confetti fires correctly on completion |

**Reviewed but not freshly live-tested this session** (code inspected, logic looks correct):
- Multi-track **stop / resume** flow (`/api/search/stop`, `/api/search/resume`, `STOP_EVENT` + `ThreadPoolExecutor` in `server.py`).
- Large playlist-scale loads (single-track loads were the focus of this session's live testing; playlist-scale Spotify loads were exercised in a prior session).

---

## 4. Cleanup

All test artifacts generated during this session were removed from `C:\Users\Erick\Downloads\SpotifyYT\`:
- `(búsqueda libre) - Rick Astley...mp3`
- `Cecilio G. - Legendario.m4a/.mp3`
- `Daft Punk - One More Time.mp3`
- `jawed - Me at the zoo.flac/.m4a`
- `playlist.m3u`

Pre-existing user files (`Cecilio G., NeroBeatz, Myto - Tara Love.mp3/.m4a`, dated 2026-06-11) were **not touched**.

---

## 5. Files Changed

- `static/style.css` — full rewrite (new "Spectra" theme)
- `static/index.html` — background layer markup updated (`.mesh`/`.morb`, `#confetti` canvas added)
- `static/app.js` — added magnetic buttons, ripples, cover tilt, confetti burst, reduced-motion guards
- `core.py` — fixed `get_text_search_track()`, `expected_audio_filename()`, `export_m3u()`, added live-stream penalty in `_score_candidate()`
- `server.py` — download worker now uses `core.expected_audio_filename()` for `filename_hint`
