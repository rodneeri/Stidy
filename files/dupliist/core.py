"""
core.py — DUPLiiST core logic (GUI-free)
=========================================
Lógica de negocio extraída de main.py: configuración, detección de
fuentes, Spotify, yt-dlp, matching, descarga, tagging y exportación.
Sin dependencias de Tkinter/customtkinter — usable desde Flask.
"""
from __future__ import annotations

import os
import re
import json
import shutil
from pathlib import Path

import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import yt_dlp

try:
    from mutagen.id3 import (ID3, APIC, TIT2, TPE1, TALB, TRCK, TDRC, ID3NoHeaderError)
    from mutagen.mp3 import MP3
    MUTAGEN_OK = True
except ImportError:
    MUTAGEN_OK = False

from aero_assets import fetch_image_bytes


SEARCH_WORKERS = 8
DOWNLOAD_WORKERS = 4
YT_PLAYLIST_LIMIT = 50

APP_NAME = "DUPLiiST"
CONFIG_FILE = Path.home() / ".spotify_yt_converter.json"
DEFAULT_DOWNLOAD_DIR = str(Path.home() / "Downloads" / "DUPLiiST")


def load_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"client_id": "", "client_secret": "",
            "download_dir": DEFAULT_DOWNLOAD_DIR}


def save_config(cfg: dict) -> None:
    try:
        CONFIG_FILE.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"[config] no se pudo guardar: {e}")


def check_ffmpeg() -> bool:
    """yt-dlp necesita ffmpeg Y ffprobe para conversión a MP3."""
    return (shutil.which("ffmpeg") is not None
            and shutil.which("ffprobe") is not None)


def ensure_writable_dir(preferred: str) -> tuple[str, str | None]:
    """Garantiza una carpeta de descarga existente y escribible.
    Intenta `preferred` primero, luego fallbacks razonables.
    Devuelve (ruta_absoluta, aviso_o_None)."""
    home = os.path.expanduser("~")
    fallbacks = [
        (preferred, None),
        (os.path.join(home, "Downloads", "MusicDownloader"),
         "La carpeta configurada no era accesible · usando Downloads"),
        (os.path.join(home, "Desktop", "MusicDownloader"),
         "Downloads tampoco funcionó · usando Desktop"),
        (os.path.join(home, "MusicDownloader"),
         "Usando carpeta de usuario como último recurso"),
    ]
    last_err = ""
    for path, warning in fallbacks:
        if not path or not path.strip():
            continue
        try:
            abs_path = os.path.abspath(path)
            os.makedirs(abs_path, exist_ok=True)
            test_file = os.path.join(abs_path, ".sptyt_writetest")
            with open(test_file, "w", encoding="utf-8") as f:
                f.write("ok")
            os.remove(test_file)
            return (abs_path, warning)
        except Exception as e:
            last_err = f"{path}: {type(e).__name__}: {e}"
            continue
    raise RuntimeError(
        f"No se pudo usar ninguna carpeta de descarga.\n"
        f"Último error: {last_err}"
    )


_INVALID_FN_RE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def sanitize_filename(name: str) -> str:
    cleaned = _INVALID_FN_RE.sub("_", name).strip(" .")
    return (cleaned or "track")[:180]


def fmt_duration(ms: int | None) -> str:
    if not ms:
        return "—"
    total_s = int(ms) // 1000
    m, s = divmod(total_s, 60)
    return f"{m}:{s:02d}"


_SPOTIFY_PLAYLIST_RE = re.compile(
    r"(?:open\.spotify\.com/(?:intl-[a-z]+/)?playlist/|spotify:playlist:)"
    r"([A-Za-z0-9]+)"
)
_SPOTIFY_TRACK_RE = re.compile(
    r"(?:open\.spotify\.com/(?:intl-[a-z]+/)?track/|spotify:track:)"
    r"([A-Za-z0-9]+)"
)
_YOUTUBE_PLAYLIST_RE = re.compile(
    r"[?&]list=([A-Za-z0-9_-]+)"
)
_YOUTUBE_VIDEO_RE = re.compile(
    r"(?:youtube\.com/(?:watch\?v=|shorts/|embed/|v/)|youtu\.be/)"
    r"([A-Za-z0-9_-]{6,})"
)
_SOUNDCLOUD_PLAYLIST_RE = re.compile(
    r"soundcloud\.com/[^/]+/sets/[^/?#]+", re.IGNORECASE
)
_SOUNDCLOUD_TRACK_RE = re.compile(
    r"soundcloud\.com/[^/]+/[^/?#]+", re.IGNORECASE
)


def detect_source(text: str) -> tuple[str, str]:
    """Clasifica la entrada del usuario.
    Devuelve (tipo, valor_normalizado).
    Tipos:
      · spotify_playlist   ·  spotify_track
      · youtube_playlist   ·  youtube_video
      · soundcloud_playlist · soundcloud_track
      · text_search (búsqueda libre, valor = el texto crudo)
      · unknown_url (URL pero no reconocida)
    """
    s = text.strip()
    if not s:
        return ("text_search", "")

    m = _SPOTIFY_PLAYLIST_RE.search(s)
    if m:
        return ("spotify_playlist", m.group(1))
    m = _SPOTIFY_TRACK_RE.search(s)
    if m:
        return ("spotify_track", m.group(1))

    if "soundcloud.com" in s.lower():
        if _SOUNDCLOUD_PLAYLIST_RE.search(s):
            return ("soundcloud_playlist", s)
        if _SOUNDCLOUD_TRACK_RE.search(s):
            return ("soundcloud_track", s)

    has_list = _YOUTUBE_PLAYLIST_RE.search(s)
    has_video = _YOUTUBE_VIDEO_RE.search(s)
    if has_list and ("youtube.com" in s.lower() or "youtu.be" in s.lower()):
        return ("youtube_playlist", has_list.group(1))
    if has_video:
        return ("youtube_video", has_video.group(1))

    if s.lower().startswith(("http://", "https://")):
        return ("unknown_url", s)

    return ("text_search", s)


def _spotify_client(client_id: str, client_secret: str) -> spotipy.Spotify:
    auth = SpotifyClientCredentials(client_id=client_id,
                                     client_secret=client_secret)
    return spotipy.Spotify(auth_manager=auth)


def _enrich_spotify_track(tr: dict) -> dict:
    """Extrae los campos relevantes de un objeto Track de Spotify."""
    artists = ", ".join(a["name"] for a in tr.get("artists", []) if a.get("name"))
    album_obj = tr.get("album") or {}
    images = album_obj.get("images") or []

    cover_url = ""
    if images:
        sorted_imgs = sorted(images, key=lambda i: i.get("width", 0))
        cover_url = sorted_imgs[-1].get("url", "")
        for img in sorted_imgs:
            if img.get("width", 0) >= 600:
                cover_url = img.get("url", "")
                break
    return {
        "name": tr.get("name", "(sin título)"),
        "artists": artists or "Desconocido",
        "album": album_obj.get("name", ""),
        "release_date": album_obj.get("release_date", ""),
        "track_number": tr.get("track_number", 0),
        "album_cover_url": cover_url,
        "duration_ms": tr.get("duration_ms", 0),
        "query": f"{artists} - {tr.get('name', '')}".strip(" -"),
        "source": "youtube",
        "youtube": None,
        "downloaded_path": None,
    }


def get_spotify_playlist(playlist_id: str, client_id: str,
                         client_secret: str) -> tuple[str, list[dict]]:
    sp = _spotify_client(client_id, client_secret)
    meta = sp.playlist(playlist_id, fields="name")
    name = meta.get("name", "Playlist") if isinstance(meta, dict) else "Playlist"

    tracks: list[dict] = []
    results = sp.playlist_items(
        playlist_id, additional_types=("track",),
        fields="next,items(track(name,artists(name),duration_ms,"
               "album(name,release_date,images),track_number))",
    )
    while results:
        for item in results["items"]:
            tr = item.get("track")
            if not tr or not tr.get("name"):
                continue
            tracks.append(_enrich_spotify_track(tr))
        results = sp.next(results) if results.get("next") else None
    return name, tracks


def get_spotify_track(track_id: str, client_id: str,
                      client_secret: str) -> tuple[str, list[dict]]:
    sp = _spotify_client(client_id, client_secret)
    tr = sp.track(track_id)
    if not tr:
        raise ValueError("No se encontró el track de Spotify.")
    enriched = _enrich_spotify_track(tr)
    title = f"{enriched['artists']} – {enriched['name']}"
    return title, [enriched]


def _ytdlp_extract(url: str, flat: bool = True) -> dict:
    """Extrae metadatos de cualquier URL soportada por yt-dlp."""
    opts = {
        "quiet": True, "no_warnings": True,
        "skip_download": True, "noplaylist": False,
        "extract_flat": "in_playlist" if flat else False,
        "socket_timeout": 15,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=False)


def _parse_uploader(uploader: str | None) -> str:
    """Limpia el nombre del canal: quita ' - Topic' final, ' VEVO', etc."""
    if not uploader:
        return "Desconocido"
    cleaned = re.sub(r"\s*-\s*Topic\s*$", "", uploader, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+VEVO\s*$", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip() or uploader


def _entry_to_track(entry: dict, source: str) -> dict:
    """Convierte una entry de yt-dlp en un dict de track de la app."""
    vid_id = entry.get("id") or ""
    title = entry.get("title") or "(sin título)"
    uploader = _parse_uploader(entry.get("uploader") or entry.get("channel"))
    duration = entry.get("duration") or 0
    duration_ms = int(duration * 1000) if duration else 0

    if source == "youtube":
        media_url = entry.get("url") or f"https://www.youtube.com/watch?v={vid_id}"
        thumb_url = ""
        if entry.get("thumbnail"):
            thumb_url = entry["thumbnail"]
    else:
        media_url = entry.get("url") or entry.get("webpage_url") or ""
        thumb_url = entry.get("thumbnail") or ""

    media_match = {
        "id": vid_id,
        "title": title,
        "url": media_url,
        "duration": duration,
        "thumbnail_url": thumb_url,
    }

    artist_guess = uploader
    name_guess = title
    if " - " in title:
        parts = title.split(" - ", 1)
        if len(parts) == 2 and len(parts[0]) < 60:
            artist_guess, name_guess = parts[0].strip(), parts[1].strip()

            name_guess = re.sub(
                r"\s*[\(\[][^()\[\]]*(official|video|music|audio|lyrics?|hd|"
                r"4k|hq)[^()\[\]]*[\)\]]\s*",
                "", name_guess, flags=re.IGNORECASE,
            ).strip()

    return {
        "name": name_guess or title,
        "artists": artist_guess or uploader,
        "album": "",
        "release_date": "",
        "track_number": 0,
        "album_cover_url": thumb_url,
        "duration_ms": duration_ms,
        "query": f"{artist_guess} - {name_guess}".strip(" -") or title,
        "source": source,
        "youtube": media_match,
        "downloaded_path": None,
    }


def get_youtube_video(video_id: str) -> tuple[str, list[dict]]:
    url = f"https://www.youtube.com/watch?v={video_id}"
    info = _ytdlp_extract(url, flat=False)
    if not info:
        raise ValueError("No se pudo obtener info de ese vídeo de YouTube.")
    track = _entry_to_track(info, source="youtube")
    title = f"{track['artists']} – {track['name']}"
    return title, [track]


def get_youtube_playlist(playlist_id: str) -> tuple[str, list[dict]]:
    url = f"https://www.youtube.com/playlist?list={playlist_id}"
    info = _ytdlp_extract(url, flat=True)
    if not info:
        raise ValueError("No se pudo obtener la playlist de YouTube.")
    name = info.get("title") or "YouTube Playlist"
    entries = info.get("entries") or []
    tracks = [_entry_to_track(e, source="youtube") for e in entries if e]
    return name, tracks


def get_soundcloud(url: str, is_playlist: bool) -> tuple[str, list[dict]]:
    info = _ytdlp_extract(url, flat=is_playlist)
    if not info:
        raise ValueError("No se pudo obtener info de SoundCloud.")
    if is_playlist:
        name = info.get("title") or "SoundCloud Playlist"
        entries = info.get("entries") or []
        tracks = [_entry_to_track(e, source="soundcloud") for e in entries if e]
        return name, tracks
    else:
        track = _entry_to_track(info, source="soundcloud")
        title = f"{track['artists']} – {track['name']}"
        return title, [track]


def get_text_search_track(query: str) -> tuple[str, list[dict]]:
    """Para búsqueda libre: crea un track sin match (se buscará en YT).

    Si la consulta tiene forma "Artista - Título", se separan para que el
    nombre de archivo, las etiquetas ID3 y las exportaciones m3u/csv queden
    correctas en lugar de mostrar un marcador de posición.
    """
    name, artists = query, ""
    m = re.match(r"^\s*(.+?)\s+-\s+(.+?)\s*$", query)
    if m:
        artists, name = m.group(1), m.group(2)

    return f"Búsqueda · {query}", [{
        "name": name,
        "artists": artists,
        "album": "",
        "release_date": "",
        "track_number": 0,
        "album_cover_url": "",
        "duration_ms": 0,
        "query": query,
        "source": "youtube",
        "youtube": None,
        "downloaded_path": None,
    }]


_NOISE_TAGS_RE = re.compile(
    r"\s*[\(\[\{][^()\[\]{}]*("
    r"remaster(ed)?|remix|version|edit|mix|mono|stereo|deluxe|"
    r"bonus|edition|live|acoustic|radio|extended|expanded|"
    r"\d{4}|anniversary|reissue|hd|hq|official|"
    r"feat\.?|ft\.?|featuring|with"
    r")[^()\[\]{}]*[\)\]\}]\s*",
    re.IGNORECASE,
)
_TRAILING_NOISE_RE = re.compile(
    r"\s+-\s+("
    r"\d{4}\s+)?(remaster(ed)?|remix|version|edit|mix|live|acoustic|"
    r"radio|extended|expanded|anniversary|reissue|bonus|deluxe|mono|stereo"
    r")(\s+(version|edit|mix))?\s*$",
    re.IGNORECASE,
)


def _clean_query(q: str) -> str:
    cleaned = _NOISE_TAGS_RE.sub(" ", q)
    cleaned = re.sub(r"\s+-\s+(feat\.?|ft\.?|featuring)\s+.+$", "",
                     cleaned, flags=re.IGNORECASE)
    cleaned = _TRAILING_NOISE_RE.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -")
    return cleaned or q


def _score_candidate(entry: dict, query: str) -> float:
    dur = entry.get("duration") or 0
    title = (entry.get("title") or "").lower()
    q_low = query.lower()
    score = 0.0
    if 30 <= dur <= 720:
        score += 5.0
    elif dur and dur > 1800:
        score -= 8.0
    elif dur and dur < 20:
        score -= 5.0
    # Las transmisiones en directo (duración 0/desconocida, p.ej. radios 24/7)
    # se descargarían indefinidamente: penalízalas para que no se elijan
    # como mejor match en búsquedas libres.
    if entry.get("is_live") or entry.get("live_status") in ("is_live", "is_upcoming", "post_live"):
        score -= 15.0
    q_tokens = [t for t in re.split(r"[\s\-,]+", q_low) if len(t) > 2]
    hits = sum(1 for t in q_tokens if t in title)
    if q_tokens:
        score += 3.0 * (hits / len(q_tokens))
    if "topic" in title or "official audio" in title:
        score += 2.0
    for bad in ("karaoke", "cover by", "8d audio", "sped up", "slowed",
                "nightcore", "instrumental"):
        if bad in title:
            score -= 3.0
    return score


def _yt_search_once(search_query: str, max_results: int = 5) -> list[dict]:
    opts = {
        "quiet": True, "no_warnings": True,
        "skip_download": True, "noplaylist": True,
        "extract_flat": "in_playlist",
        "socket_timeout": 10,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(f"ytsearch{max_results}:{search_query}",
                                download=False)
    entries = info.get("entries") if isinstance(info, dict) else None
    return [e for e in (entries or []) if e and e.get("id")]


def search_youtube(query: str) -> dict | None:
    """Devuelve el mejor match en YouTube."""
    candidates: list[dict] = []
    try:
        candidates = _yt_search_once(query, max_results=5)
    except Exception as e:
        print(f"[YouTube] búsqueda 1 falló '{query}': {e}")

    best_score = max((_score_candidate(c, query) for c in candidates),
                     default=-99)
    if not candidates or best_score < 3.0:
        cleaned = _clean_query(query)
        if cleaned and cleaned.lower() != query.lower():
            try:
                more = _yt_search_once(cleaned, max_results=5)
                seen = {c.get("id") for c in candidates}
                for m in more:
                    if m.get("id") not in seen:
                        candidates.append(m)
            except Exception as e:
                print(f"[YouTube] búsqueda 2 falló '{cleaned}': {e}")

    if not candidates:
        return None
    best = max(candidates, key=lambda c: _score_candidate(c, query))
    vid = best.get("id")
    if not vid:
        return None
    return {
        "id": vid,
        "title": best.get("title", "(sin título)"),
        "url": f"https://www.youtube.com/watch?v={vid}",
        "duration": best.get("duration"),
        "thumbnail_url": "",
    }


def search_youtube_candidates(query: str, n: int = 10) -> list[dict]:
    """Devuelve hasta `n` candidatos rankeados (para el match picker)."""
    candidates: list[dict] = []
    try:
        candidates = _yt_search_once(query, max_results=n)
    except Exception as e:
        print(f"[YouTube] búsqueda candidates falló: {e}")
        return []
    candidates.sort(key=lambda c: _score_candidate(c, query), reverse=True)
    return candidates[:n]


SUPPORTED_FORMATS = ("mp3", "flac", "m4a")
DEFAULT_FORMAT = "mp3"


QUALITY_KBPS = {
    "normal":  "128",
    "alta":    "192",
    "maxima":  "320",
}
DEFAULT_QUALITY = "maxima"


def expected_audio_filename(track: dict, fmt: str = "mp3") -> str:
    """Nombre que tendrá el archivo descargado, para el formato dado."""
    artists = track.get("artists") or ""
    name = track.get("name") or ""
    hint = f"{artists} - {name}" if artists else name
    fmt = fmt.lower() if fmt in SUPPORTED_FORMATS else DEFAULT_FORMAT
    return f"{sanitize_filename(hint)}.{fmt}"


def expected_mp3_filename(track: dict) -> str:
    """Compat: alias para el formato MP3."""
    return expected_audio_filename(track, "mp3")


PLAYLIST_SOURCE_KINDS = {
    "spotify_playlist", "youtube_playlist", "soundcloud_playlist",
}


def playlist_subfolder_name(playlist_name: str, source_kind: str) -> str:
    """Devuelve el nombre de subcarpeta para esta playlist, o "" si
    se trata de una canción suelta / búsqueda libre (van a la raíz).
    Espacios → underscores · caracteres inválidos → underscores."""
    if source_kind not in PLAYLIST_SOURCE_KINDS:
        return ""
    if not playlist_name or not playlist_name.strip():
        return ""
    safe = sanitize_filename(playlist_name)
    safe = re.sub(r"\s+", "_", safe).strip("_")
    return safe or ""


def effective_download_dir(base_dir: str, playlist_name: str,
                           source_kind: str) -> str:
    """Combina la carpeta base con la subcarpeta de la playlist (si aplica)."""
    sub = playlist_subfolder_name(playlist_name, source_kind)
    if sub:
        return os.path.join(base_dir, sub)
    return base_dir


def find_existing_download(track: dict, output_dir: str,
                            fmt: str | None = None) -> str | None:
    """Devuelve la ruta al archivo de audio existente o None.
    Si fmt se da, busca solo ese formato. Si no, busca cualquiera
    de los formatos soportados (mp3, flac, m4a)."""
    if not output_dir or not os.path.isdir(output_dir):
        return None
    formats_to_check = (fmt,) if fmt else SUPPORTED_FORMATS
    for f in formats_to_check:
        candidate = os.path.join(output_dir, expected_audio_filename(track, f))
        if os.path.exists(candidate):
            return candidate
    return None


def export_m3u(tracks: list[dict], output_path: str) -> bool:
    """Genera una playlist .m3u (formato Extended M3U) con las pistas dadas.
    Usa rutas absolutas a los archivos descargados, ya que el .m3u puede
    guardarse (vía descarga del navegador) en una carpeta distinta a la
    de los audios y las rutas relativas dejarían de resolver.
    Devuelve True si tuvo éxito."""
    lines = ["#EXTM3U"]
    for t in tracks:
        yt = t.get("youtube") or {}
        if not yt:
            continue
        dur = (int(t.get("duration_ms") or 0) // 1000) or -1
        artist = t.get("artists") or ""
        name = t.get("name") or "Track"
        title = f"{artist} - {name}" if artist else name
        lines.append(f"#EXTINF:{dur},{title}")
        local = t.get("downloaded_path")
        if local and os.path.exists(local):
            lines.append(os.path.abspath(local))
        else:
            lines.append(yt.get("url", ""))
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        return True
    except Exception as e:
        print(f"[m3u] {e}")
        return False


def export_tracks_csv(tracks: list[dict], output_path: str) -> bool:
    """Genera un .csv compatible con TuneMyMusic / Soundiiz / Songshift
    para importar la playlist a Spotify, SoundCloud, Apple Music, etc.
    Columnas: Track Name, Artist Name, Album Name."""
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("Track Name,Artist Name,Album Name\n")
            for t in tracks:
                name = (t.get("name") or "").replace('"', '""')
                artist = (t.get("artists") or "").replace('"', '""')
                album = (t.get("album") or "").replace('"', '""')
                f.write(f'"{name}","{artist}","{album}"\n')
        return True
    except Exception as e:
        print(f"[csv] {e}")
        return False


def download_track(media_url: str, output_dir: str,
                   source: str = "youtube",
                   filename_hint: str | None = None,
                   audio_format: str = "mp3",
                   quality: str = "maxima") -> str:
    """Descarga audio en el formato y calidad indicados. Devuelve la ruta del
    archivo final.

    audio_format: 'mp3' | 'flac' | 'm4a'
    quality:      'normal' | 'alta' | 'maxima'   (ignorado para FLAC, lossless)

    En 2025/2026 YouTube bloquea intermitentemente el cliente 'web' por
    defecto de yt-dlp. Para YouTube probamos varias estrategias; para
    SoundCloud el flujo es más directo.
    """
    output_dir = os.path.abspath(output_dir)
    try:
        os.makedirs(output_dir, exist_ok=True)
    except OSError as e:
        raise RuntimeError(
            f"No se pudo crear la carpeta de descarga «{output_dir}»: {e}"
        )

    audio_format = audio_format.lower() if audio_format in SUPPORTED_FORMATS \
        else "mp3"
    safe_hint = sanitize_filename(filename_hint) if filename_hint else None
    outtmpl = os.path.join(
        output_dir,
        f"{safe_hint}.%(ext)s" if safe_hint else "%(title)s.%(ext)s",
    )

    if audio_format == "flac":
        pp_audio = {"key": "FFmpegExtractAudio", "preferredcodec": "flac"}
    else:
        kbps = QUALITY_KBPS.get(quality, "320")
        pp_audio = {"key": "FFmpegExtractAudio",
                    "preferredcodec": audio_format,
                    "preferredquality": kbps}

    base_opts = {
        "outtmpl": outtmpl,
        "postprocessors": [pp_audio, {"key": "FFmpegMetadata"}],
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "retries": 5,
        "fragment_retries": 5,
        "ignoreerrors": False,
    }

    if source == "soundcloud":
        strategies = [
            {"format": "bestaudio/best"},
            {"format": "ba/b"},
        ]
    else:
        strategies = [
            {"format": "ba[ext=m4a]/ba/b",
             "extractor_args": {"youtube": {"player_client": ["android", "web"]}}},
            {"format": "ba/b",
             "extractor_args": {"youtube": {"player_client": ["ios"]}}},
            {"format": "ba/b",
             "extractor_args": {"youtube": {"player_client": ["mweb"]}}},
            {"format": "ba/b",
             "extractor_args": {"youtube": {"player_client": ["tv_embedded"]}}},
            {"format": "bestaudio/best"},
        ]

    errors: list[str] = []
    target_ext = audio_format
    for i, override in enumerate(strategies, 1):
        opts = {**base_opts, **override}
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([media_url])

            if safe_hint:
                expected = os.path.join(output_dir, f"{safe_hint}.{target_ext}")
                if os.path.exists(expected):
                    return expected

            matches = list(Path(output_dir).glob(f"*.{target_ext}"))
            if matches:
                return str(max(matches, key=lambda p: p.stat().st_mtime))
            return ""
        except Exception as e:
            err_line = str(e).splitlines()[0][:200] if str(e) else type(e).__name__
            client = list(override.get('extractor_args', {})
                          .get('youtube', {})
                          .get('player_client', ['default']))[0] if source == "youtube" else "default"
            errors.append(f"#{i} ({client}): {err_line}")
            continue

    raise RuntimeError(" | ".join(errors) or "yt-dlp falló sin mensaje")


def embed_metadata(mp3_path: str, track: dict) -> bool:
    """Escribe tags ID3 ricos + portada del álbum.
    Devuelve True si tuvo éxito; False si mutagen no está disponible,
    el archivo no es MP3, o hubo un error.

    Para FLAC y M4A nos apoyamos en lo que yt-dlp ya escribe con su
    postprocessor FFmpegMetadata + EmbedThumbnail (formato-específico).
    El embebido rico via mutagen lo hacemos solo en MP3 por ahora."""
    if not MUTAGEN_OK:
        return False
    if not mp3_path or not os.path.exists(mp3_path):
        return False
    if not mp3_path.lower().endswith(".mp3"):
        return False
    try:
        try:
            audio = MP3(mp3_path, ID3=ID3)
        except ID3NoHeaderError:
            audio = MP3(mp3_path)
            audio.add_tags()

        audio.tags.delall("TIT2")
        audio.tags.delall("TPE1")
        audio.tags.delall("TALB")
        audio.tags.delall("TRCK")
        audio.tags.delall("TDRC")
        audio.tags.delall("APIC")

        name = track.get("name") or ""
        artists = track.get("artists") or ""
        album = track.get("album") or ""
        track_num = track.get("track_number") or 0
        release = track.get("release_date") or ""

        if name:
            audio.tags.add(TIT2(encoding=3, text=name))
        if artists:
            audio.tags.add(TPE1(encoding=3, text=artists))
        if album:
            audio.tags.add(TALB(encoding=3, text=album))
        if track_num:
            audio.tags.add(TRCK(encoding=3, text=str(track_num)))
        if release:
            audio.tags.add(TDRC(encoding=3, text=release))

        cover_url = track.get("album_cover_url") or ""
        if not cover_url:
            yt = track.get("youtube") or {}
            cover_url = yt.get("thumbnail_url") or ""
            if not cover_url and yt.get("id") and track.get("source") == "youtube":
                cover_url = f"https://i.ytimg.com/vi/{yt['id']}/hqdefault.jpg"
        if cover_url:
            data = fetch_image_bytes(cover_url)
            if data:
                mime = "image/jpeg"
                if cover_url.lower().endswith(".png"):
                    mime = "image/png"
                audio.tags.add(APIC(
                    encoding=3, mime=mime, type=3,
                    desc="Cover", data=data,
                ))
        audio.save()
        return True
    except Exception as e:
        print(f"[embed_metadata] {e}")
        return False


def chunk_playlists(selected_tracks: list[dict], playlist_name: str,
                    chunk_size: int = YT_PLAYLIST_LIMIT) -> list[dict]:
    """Divide canciones en grupos para YouTube watch_videos.
    Solo funciona con tracks cuyo source='youtube' (SoundCloud no tiene
    URL equivalente de playlist temporal)."""
    only_yt = [t for t in selected_tracks
               if t.get("source") == "youtube" and t.get("youtube")]
    total = len(only_yt)
    parts: list[dict] = []
    if total == 0:
        return parts
    multi = total > chunk_size
    n_chunks = (total + chunk_size - 1) // chunk_size
    for i in range(n_chunks):
        start = i * chunk_size + 1
        end = min((i + 1) * chunk_size, total)
        chunk = only_yt[start - 1:end]
        ids = [t["youtube"]["id"] for t in chunk]
        url = ("https://www.youtube.com/watch_videos?video_ids="
               + ",".join(ids))
        label = (f"{playlist_name} — Part {i + 1}  {end}/{total}"
                 if multi else (playlist_name or "Playlist"))
        parts.append({
            "part_num": i + 1, "label": label, "url": url,
            "count": len(ids), "start": start, "end": end, "total": total,
        })
    return parts
