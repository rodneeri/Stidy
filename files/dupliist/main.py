"""
Music Downloader  ·  V5
=========================
Multi-fuente:
  · Spotify (playlist o canción suelta)
  · YouTube (video suelto o playlist)
  · SoundCloud (canción o playlist pública)
  · Búsqueda libre por texto

Funcionalidades:
  · Búsqueda paralela en YouTube (8 workers) para playlists de Spotify
  · Detener / Reanudar la búsqueda
  · Multi-playlist automático cuando >50 canciones
  · Detecta archivos ya descargados al cargar
  · Reintentar canciones que fallaron
  · Picker de match manual (clic en una canción para elegir otro video)
  · Cover art + tags ID3 ricos embebidos en los MP3
"""
from __future__ import annotations

import concurrent.futures
import io
import os
import re
import sys
import json
import queue
import shutil
import threading
import webbrowser
from pathlib import Path
from tkinter import filedialog, messagebox

import customtkinter as ctk
from PIL import Image

import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import yt_dlp


try:
    from mutagen.id3 import (ID3, APIC, TIT2, TPE1, TALB, TRCK, TDRC, ID3NoHeaderError)
    from mutagen.mp3 import MP3
    MUTAGEN_OK = True
except ImportError:
    MUTAGEN_OK = False

from aero_assets import (
    make_app_icon,
    make_placeholder_thumb,
    make_thumb_with_play,
    fetch_thumbnail,
    fetch_image,
    fetch_image_bytes,
    HEX_BG, HEX_BG_ALT, HEX_CARD, HEX_CARD_ALT, HEX_CARD_HI,
    HEX_BORDER, HEX_BORDER_HI, HEX_DIVIDER,
    HEX_TEXT, HEX_TEXT_SOFT, HEX_TEXT_MUTED, HEX_TEXT_DIM,
    HEX_LIME, HEX_LIME_HOVER, HEX_LIME_DEEP, HEX_LIME_DIM,
    HEX_ORANGE, HEX_ORANGE_HOVER, HEX_ORANGE_DIM,
    HEX_RED, HEX_RED_DIM,
    HEX_BLUE, HEX_BLUE_DIM,
    HEX_CYAN, HEX_CYAN_DIM,
    HEX_GREEN, HEX_GREEN_DIM,
    HEX_SPOTIFY, HEX_SPOTIFY_HV,
    HEX_YOUTUBE, HEX_YOUTUBE_DIM,
    HEX_SOUNDCLOUD, HEX_SOUNDCLOUD_DIM,
)
from splash import SplashScreen


SEARCH_WORKERS = 8
YT_PLAYLIST_LIMIT = 50


def resource_path(rel: str) -> str:
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, rel)


APP_NAME = "DUPLiiST"
CONFIG_FILE = Path.home() / ".spotify_yt_converter.json"
DEFAULT_DOWNLOAD_DIR = str(Path.home() / "Downloads" / "DUPLiiST")
CREDITS_PATH = resource_path("credits.png")


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
    """Para búsqueda libre: crea un track sin match (se buscará en YT)."""
    return f"Búsqueda · {query}", [{
        "name": query,
        "artists": "(búsqueda libre)",
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
    hint = f"{track.get('artists', '')} - {track.get('name', '')}"
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
    Usa rutas relativas al archivo .m3u para que sea portable.
    Devuelve True si tuvo éxito."""
    m3u_dir = os.path.dirname(os.path.abspath(output_path))
    lines = ["#EXTM3U"]
    for t in tracks:
        yt = t.get("youtube") or {}
        if not yt:
            continue
        dur = (int(t.get("duration_ms") or 0) // 1000) or -1
        artist = t.get("artists", "Unknown")
        name = t.get("name", "Track")
        lines.append(f"#EXTINF:{dur},{artist} - {name}")
        local = t.get("downloaded_path")
        if local and os.path.exists(local):
            rel = os.path.relpath(local, m3u_dir)
            lines.append(rel.replace("\\", "/"))
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


class StatusPill(ctk.CTkFrame):
    STATES = {
        "pending":      ("·  Pendiente",      HEX_BG_ALT,         HEX_TEXT_DIM),
        "wait":         ("⏳ Buscando",        HEX_ORANGE_DIM,     HEX_ORANGE),
        "ok":           ("✓ Encontrado",      HEX_LIME_DIM,       HEX_LIME),
        "fail":         ("✗ No encontrado",   HEX_RED_DIM,        HEX_RED),
        "stopped":      ("◾ Detenido",        HEX_BG_ALT,         HEX_TEXT_MUTED),
        "downloaded":   ("⬇ Ya descargado",   HEX_CYAN_DIM,       HEX_CYAN),
        "fail_dl":      ("✗ Error descarga",  HEX_RED_DIM,        HEX_RED),
        "idle":         ("—",                  HEX_BG_ALT,         HEX_TEXT_DIM),
    }

    def __init__(self, master, state: str = "pending"):
        super().__init__(master, fg_color=HEX_BG_ALT, corner_radius=10,
                         border_width=0, width=130, height=22)
        self.grid_propagate(False)
        self.pack_propagate(False)
        self.label = ctk.CTkLabel(
            self, text="", text_color=HEX_TEXT_DIM, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=10, weight="bold"),
        )
        self.label.pack(expand=True, fill="both", padx=8, pady=0)
        self.set_state(state)

    def set_state(self, state: str):
        text, bg, fg = self.STATES.get(state, self.STATES["idle"])
        self.configure(fg_color=bg)
        self.label.configure(text=text, text_color=fg)


class SourceBadge(ctk.CTkLabel):
    BADGES = {
        "youtube":    ("YT", HEX_YOUTUBE_DIM,    HEX_YOUTUBE),
        "soundcloud": ("SC", HEX_SOUNDCLOUD_DIM, HEX_SOUNDCLOUD),
    }
    def __init__(self, master, source: str):
        text, bg, fg = self.BADGES.get(source, ("?", HEX_BG_ALT, HEX_TEXT_DIM))
        super().__init__(
            master, text=text, fg_color=bg, text_color=fg,
            corner_radius=6, width=26, height=18,
            font=ctk.CTkFont(family="Segoe UI", size=9, weight="bold"),
        )


class TrackRow(ctk.CTkFrame):
    """Fila: checkbox · thumb · título/artista/match · badge fuente · pill · duración.
    Clickable: click en el área central abre el MatchPickerDialog."""

    THUMB_W, THUMB_H = 86, 64
    ROW_HEIGHT = 92

    def __init__(self, master, idx: int, track: dict,
                 on_click_match=None):
        super().__init__(master, fg_color=HEX_CARD_ALT, corner_radius=12,
                         border_width=0, height=self.ROW_HEIGHT)
        self.idx = idx
        self.track = track
        self.youtube = track.get("youtube")
        self.selected = ctk.BooleanVar(value=True)
        self._thumb_ref = None
        self._on_click_match = on_click_match

        self.grid_columnconfigure(2, weight=1)
        self.grid_propagate(False)


        self.checkbox = ctk.CTkCheckBox(
            self, text="", variable=self.selected, width=22,
            checkbox_width=18, checkbox_height=18,
            corner_radius=4, border_width=2,
            border_color=HEX_BORDER_HI,
            fg_color=HEX_LIME, hover_color=HEX_LIME_HOVER,
            checkmark_color=HEX_BG,
        )
        self.checkbox.grid(row=0, column=0, padx=(14, 8), pady=8, sticky="ns")


        placeholder = make_placeholder_thumb(self.THUMB_W, self.THUMB_H)
        self._thumb_ref = ctk.CTkImage(
            light_image=placeholder, dark_image=placeholder,
            size=(self.THUMB_W, self.THUMB_H),
        )
        self.thumb_lbl = ctk.CTkLabel(
            self, text="", image=self._thumb_ref,
            fg_color="transparent",
            width=self.THUMB_W, height=self.THUMB_H, cursor="hand2",
        )
        self.thumb_lbl.grid(row=0, column=1, padx=(0, 12), pady=10, sticky="ns")


        info = ctk.CTkFrame(self, fg_color="transparent", cursor="hand2")
        info.grid(row=0, column=2, padx=(0, 10), pady=10, sticky="nsew")
        info.grid_columnconfigure(0, weight=1)
        info.grid_rowconfigure(0, weight=1)
        info.grid_rowconfigure(1, weight=1)
        info.grid_rowconfigure(2, weight=1)

        self.title_lbl = ctk.CTkLabel(
            info, text=f"{idx:02d}.  {track['name']}",
            anchor="w", justify="left",
            text_color=HEX_TEXT, fg_color="transparent", cursor="hand2",
            font=ctk.CTkFont(family="Segoe UI", size=13, weight="bold"),
        )
        self.title_lbl.grid(row=0, column=0, sticky="ew")

        self.artist_lbl = ctk.CTkLabel(
            info, text=track["artists"], anchor="w", justify="left",
            text_color=HEX_TEXT_SOFT, fg_color="transparent", cursor="hand2",
            font=ctk.CTkFont(family="Segoe UI", size=11),
        )
        self.artist_lbl.grid(row=1, column=0, sticky="ew")

        self.yt_lbl = ctk.CTkLabel(
            info, text="", anchor="w", justify="left",
            text_color=HEX_TEXT_MUTED, fg_color="transparent", cursor="hand2",
            font=ctk.CTkFont(family="Segoe UI", size=9),
        )
        self.yt_lbl.grid(row=2, column=0, sticky="ew")


        for widget in (info, self.title_lbl, self.artist_lbl,
                       self.yt_lbl, self.thumb_lbl):
            widget.bind("<Button-1>", self._on_clicked)


        badge = SourceBadge(self, track.get("source", "youtube"))
        badge.grid(row=0, column=3, padx=(0, 6), pady=8, sticky="ns")


        initial_state = "downloaded" if track.get("downloaded_path") else "pending"
        if track.get("youtube") and not track.get("downloaded_path"):
            initial_state = "ok"
        self.pill = StatusPill(self, state=initial_state)
        self.pill.grid(row=0, column=4, padx=(0, 10), pady=8, sticky="ns")


        self.dur_lbl = ctk.CTkLabel(
            self, text=fmt_duration(track["duration_ms"]),
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            width=46,
        )
        self.dur_lbl.grid(row=0, column=5, padx=(0, 14), pady=8, sticky="ns")


        if track.get("youtube"):
            self._show_match_title(track["youtube"].get("title", ""))
        if track.get("downloaded_path"):
            self.selected.set(False)

    def _on_clicked(self, _evt=None):
        if self._on_click_match:
            self._on_click_match(self)

    def _show_match_title(self, yt_title: str):
        if len(yt_title) > 70:
            yt_title = yt_title[:67] + "…"
        self.yt_lbl.configure(text=f"▸ {yt_title}")

    def set_state(self, state: str):
        self.pill.set_state(state)

    def set_youtube_match(self, match: dict | None,
                          thumb_pil: Image.Image | None = None):
        self.youtube = match
        self.track["youtube"] = match
        if not match:
            self.pill.set_state("fail")
            self.yt_lbl.configure(text="")
            self.selected.set(False)
            return
        self.pill.set_state("ok")
        self._show_match_title(match.get("title", ""))
        if thumb_pil:
            try:
                composed = make_thumb_with_play(
                    thumb_pil, self.THUMB_W, self.THUMB_H)
                self._thumb_ref = ctk.CTkImage(
                    light_image=composed, dark_image=composed,
                    size=(self.THUMB_W, self.THUMB_H),
                )
                self.thumb_lbl.configure(image=self._thumb_ref)
            except Exception as e:
                print(f"[thumb] err idx={self.idx}: {e}")

    def mark_downloaded(self, path: str):
        self.track["downloaded_path"] = path
        self.pill.set_state("downloaded")
        self.selected.set(False)

    def mark_fail_download(self):
        self.pill.set_state("fail_dl")


class SettingsDialog(ctk.CTkToplevel):
    def __init__(self, parent, cfg: dict, on_save):
        super().__init__(parent)
        self.title("Ajustes")
        self.geometry("560x540")
        self.resizable(False, False)
        self.configure(fg_color=HEX_BG)
        self.on_save = on_save
        self.transient(parent)
        self.after(50, self.grab_set)
        try:
            x = parent.winfo_x() + (parent.winfo_width() // 2) - 280
            y = parent.winfo_y() + (parent.winfo_height() // 2) - 270
            self.geometry(f"+{max(0, x)}+{max(0, y)}")
        except Exception:
            pass

        card = ctk.CTkFrame(self, fg_color=HEX_CARD, corner_radius=18,
                            border_width=1, border_color=HEX_BORDER)
        card.pack(fill="both", expand=True, padx=18, pady=18)

        ctk.CTkLabel(
            card, text="Ajustes",
            text_color=HEX_TEXT, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=20, weight="bold"),
        ).pack(anchor="w", padx=24, pady=(20, 4))
        ctk.CTkLabel(
            card, text="Credenciales de Spotify (solo para playlists/canciones "
                       "de Spotify) y carpeta de descarga.",
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=11),
            wraplength=480, justify="left",
        ).pack(anchor="w", padx=24, pady=(0, 12))

        self._add_label(card, "CLIENT ID  (Spotify)")
        self.cid_entry = self._make_entry(card)
        self.cid_entry.insert(0, cfg.get("client_id", ""))

        self._add_label(card, "CLIENT SECRET  (Spotify)")
        self.csec_entry = self._make_entry(card, show="•")
        self.csec_entry.insert(0, cfg.get("client_secret", ""))

        self._add_label(card, "CARPETA DE DESCARGA")
        dir_frame = ctk.CTkFrame(card, fg_color="transparent")
        dir_frame.pack(fill="x", padx=24, pady=(4, 10))
        self.dir_entry = ctk.CTkEntry(
            dir_frame, fg_color=HEX_BG_ALT, text_color=HEX_TEXT,
            border_width=1, border_color=HEX_BORDER,
            corner_radius=10, height=38,
            font=ctk.CTkFont(family="Segoe UI", size=11),
        )
        self.dir_entry.pack(side="left", fill="x", expand=True)
        self.dir_entry.insert(0, cfg.get("download_dir", DEFAULT_DOWNLOAD_DIR))
        ctk.CTkButton(
            dir_frame, text="📁", width=42, height=38,
            fg_color=HEX_BG_ALT, hover_color=HEX_CARD_HI,
            text_color=HEX_TEXT, border_width=1, border_color=HEX_BORDER,
            corner_radius=10, command=self._pick_dir,
        ).pack(side="right", padx=(8, 0))

        ctk.CTkLabel(
            card, text="🔑  developer.spotify.com → Crear app → ID + Secret\n"
                       "    (no hace falta para YouTube / SoundCloud / búsqueda libre)",
            text_color=HEX_TEXT_DIM, fg_color="transparent", justify="left",
            font=ctk.CTkFont(family="Segoe UI", size=10),
        ).pack(anchor="w", padx=24, pady=(10, 0))

        bf = ctk.CTkFrame(card, fg_color="transparent")
        bf.pack(fill="x", padx=24, pady=(18, 20))
        ctk.CTkButton(
            bf, text="Cancelar", height=40, corner_radius=10,
            fg_color=HEX_BG_ALT, hover_color=HEX_CARD_HI,
            text_color=HEX_TEXT_SOFT, border_width=1, border_color=HEX_BORDER,
            font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"),
            command=self.destroy,
        ).pack(side="right", padx=(8, 0))
        ctk.CTkButton(
            bf, text="Guardar", height=40, corner_radius=10,
            fg_color=HEX_LIME, hover_color=HEX_LIME_HOVER, text_color=HEX_BG,
            font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"),
            command=self._save,
        ).pack(side="right")

    def _add_label(self, parent, text: str):
        ctk.CTkLabel(
            parent, text=text,
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=9, weight="bold"),
        ).pack(anchor="w", padx=24, pady=(8, 4))

    def _make_entry(self, parent, show=None):
        e = ctk.CTkEntry(
            parent, fg_color=HEX_BG_ALT, text_color=HEX_TEXT,
            border_width=1, border_color=HEX_BORDER, corner_radius=10,
            height=38, show=show or "",
            font=ctk.CTkFont(family="Segoe UI", size=11),
        )
        e.pack(fill="x", padx=24, pady=(0, 0))
        return e

    def _pick_dir(self):
        d = filedialog.askdirectory(initialdir=self.dir_entry.get()
                                    or str(Path.home()))
        if d:
            self.dir_entry.delete(0, "end")
            self.dir_entry.insert(0, d)

    def _save(self):
        cfg = {
            "client_id": self.cid_entry.get().strip(),
            "client_secret": self.csec_entry.get().strip(),
            "download_dir": self.dir_entry.get().strip() or DEFAULT_DOWNLOAD_DIR,
        }
        save_config(cfg)
        self.on_save(cfg)
        self.destroy()


class PlaylistsDialog(ctk.CTkToplevel):
    def __init__(self, parent, parts: list[dict]):
        super().__init__(parent)
        self.parts = parts
        self.title("Playlists de YouTube")
        n = len(parts)
        H = min(640, 200 + 84 * min(n, 6))
        self.geometry(f"720x{H}")
        self.resizable(False, False)
        self.configure(fg_color=HEX_BG)
        self.transient(parent)
        self.after(50, self.grab_set)
        try:
            x = parent.winfo_x() + (parent.winfo_width() // 2) - 360
            y = parent.winfo_y() + (parent.winfo_height() // 2) - H // 2
            self.geometry(f"+{max(0, x)}+{max(0, y)}")
        except Exception:
            pass

        card = ctk.CTkFrame(self, fg_color=HEX_CARD, corner_radius=18,
                            border_width=1, border_color=HEX_BORDER)
        card.pack(fill="both", expand=True, padx=18, pady=18)
        card.grid_columnconfigure(0, weight=1)
        card.grid_rowconfigure(2, weight=1)

        total_songs = parts[0]["total"] if parts else 0
        ctk.CTkLabel(
            card, text=f"{n} playlists generadas",
            text_color=HEX_TEXT, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=18, weight="bold"),
        ).grid(row=0, column=0, sticky="w", padx=22, pady=(18, 2))
        ctk.CTkLabel(
            card, text=f"YouTube limita las playlists temporales a 50 canciones, "
                       f"así que tus {total_songs} canciones se dividen en {n} partes.",
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=11),
        ).grid(row=1, column=0, sticky="w", padx=22, pady=(0, 14))

        scroll = ctk.CTkScrollableFrame(
            card, fg_color=HEX_BG_ALT, corner_radius=12,
            scrollbar_button_color=HEX_BORDER_HI,
            scrollbar_button_hover_color=HEX_TEXT_DIM,
        )
        scroll.grid(row=2, column=0, sticky="nsew", padx=14, pady=(0, 12))
        scroll.grid_columnconfigure(0, weight=1)

        for i, part in enumerate(parts):
            row = ctk.CTkFrame(scroll, fg_color=HEX_CARD_ALT, corner_radius=10,
                               height=72)
            row.grid(row=i, column=0, sticky="ew", padx=4, pady=4)
            row.grid_columnconfigure(0, weight=1)
            row.grid_propagate(False)
            inner = ctk.CTkFrame(row, fg_color="transparent")
            inner.grid(row=0, column=0, sticky="nsew", padx=14, pady=10)
            inner.grid_columnconfigure(0, weight=1)
            ctk.CTkLabel(
                inner, text=part["label"], anchor="w",
                text_color=HEX_TEXT, fg_color="transparent",
                font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"),
            ).grid(row=0, column=0, sticky="ew")
            ctk.CTkLabel(
                inner,
                text=f"{part['count']} canciones · ítems "
                     f"{part['start']}–{part['end']}",
                anchor="w",
                text_color=HEX_TEXT_MUTED, fg_color="transparent",
                font=ctk.CTkFont(family="Segoe UI", size=10),
            ).grid(row=1, column=0, sticky="ew", pady=(2, 0))
            btns = ctk.CTkFrame(row, fg_color="transparent")
            btns.grid(row=0, column=1, sticky="e", padx=(0, 12))
            ctk.CTkButton(
                btns, text="Copiar", width=78, height=32, corner_radius=8,
                fg_color=HEX_BG_ALT, hover_color=HEX_CARD_HI,
                text_color=HEX_TEXT_SOFT, border_width=1,
                border_color=HEX_BORDER,
                font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
                command=lambda u=part["url"]: self._copy(u),
            ).pack(side="left", padx=(0, 6))
            ctk.CTkButton(
                btns, text="Abrir ↗", width=82, height=32, corner_radius=8,
                fg_color=HEX_ORANGE, hover_color=HEX_ORANGE_HOVER,
                text_color=HEX_BG,
                font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
                command=lambda u=part["url"]: webbrowser.open(u),
            ).pack(side="left")

        footer = ctk.CTkFrame(card, fg_color="transparent")
        footer.grid(row=3, column=0, sticky="ew", padx=22, pady=(8, 20))
        ctk.CTkButton(
            footer, text="Cerrar", width=110, height=40, corner_radius=10,
            fg_color=HEX_BG_ALT, hover_color=HEX_CARD_HI,
            text_color=HEX_TEXT_SOFT, border_width=1, border_color=HEX_BORDER,
            font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"),
            command=self.destroy,
        ).pack(side="right", padx=(8, 0))
        ctk.CTkButton(
            footer, text=f"Abrir las {n}", width=140, height=40,
            corner_radius=10,
            fg_color=HEX_LIME, hover_color=HEX_LIME_HOVER, text_color=HEX_BG,
            font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"),
            command=self._open_all,
        ).pack(side="right")

    def _copy(self, url: str):
        try:
            self.clipboard_clear()
            self.clipboard_append(url)
        except Exception as e:
            print(f"[clipboard] {e}")

    def _open_all(self):
        for p in self.parts:
            try:
                webbrowser.open(p["url"])
            except Exception as e:
                print(f"[open all] {e}")


class MatchPickerDialog(ctk.CTkToplevel):
    """Muestra varios candidatos de YouTube para una canción, permite al
    usuario elegir o re-buscar con otra query."""

    def __init__(self, parent, track: dict, on_picked):
        super().__init__(parent)
        self.track = track
        self.on_picked = on_picked
        self.title("Elegir match en YouTube")
        self.geometry("780x620")
        self.resizable(False, False)
        self.configure(fg_color=HEX_BG)
        self.transient(parent)
        self.after(50, self.grab_set)
        try:
            x = parent.winfo_x() + (parent.winfo_width() // 2) - 390
            y = parent.winfo_y() + (parent.winfo_height() // 2) - 310
            self.geometry(f"+{max(0, x)}+{max(0, y)}")
        except Exception:
            pass

        self._refs: list = []
        self._candidates: list[dict] = []
        self._loading = False

        card = ctk.CTkFrame(self, fg_color=HEX_CARD, corner_radius=18,
                            border_width=1, border_color=HEX_BORDER)
        card.pack(fill="both", expand=True, padx=18, pady=18)
        card.grid_columnconfigure(0, weight=1)
        card.grid_rowconfigure(3, weight=1)


        ctk.CTkLabel(
            card, text="Elegir match en YouTube",
            text_color=HEX_TEXT, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=18, weight="bold"),
        ).grid(row=0, column=0, sticky="w", padx=22, pady=(18, 2))
        ctk.CTkLabel(
            card, text=f"{track.get('artists', '')} · {track.get('name', '')}",
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=11),
        ).grid(row=1, column=0, sticky="w", padx=22, pady=(0, 12))


        search_row = ctk.CTkFrame(card, fg_color="transparent")
        search_row.grid(row=2, column=0, sticky="ew", padx=18, pady=(0, 10))
        search_row.grid_columnconfigure(0, weight=1)
        self.query_entry = ctk.CTkEntry(
            search_row, height=38, corner_radius=10,
            fg_color=HEX_BG_ALT, text_color=HEX_TEXT,
            border_width=1, border_color=HEX_BORDER,
            font=ctk.CTkFont(family="Segoe UI", size=11),
        )
        self.query_entry.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        self.query_entry.insert(0, track.get("query", ""))
        self.query_entry.bind("<Return>", lambda _: self._search())
        self.search_btn = ctk.CTkButton(
            search_row, text="Buscar", width=100, height=38, corner_radius=10,
            fg_color=HEX_LIME, hover_color=HEX_LIME_HOVER, text_color=HEX_BG,
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            command=self._search,
        )
        self.search_btn.grid(row=0, column=1)


        self.scroll = ctk.CTkScrollableFrame(
            card, fg_color=HEX_BG_ALT, corner_radius=12,
            scrollbar_button_color=HEX_BORDER_HI,
            scrollbar_button_hover_color=HEX_TEXT_DIM,
        )
        self.scroll.grid(row=3, column=0, sticky="nsew", padx=14, pady=(0, 12))
        self.scroll.grid_columnconfigure(0, weight=1)

        self.loading_lbl = ctk.CTkLabel(
            self.scroll, text="Buscando…",
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=12),
        )
        self.loading_lbl.grid(row=0, column=0, pady=40)

        footer = ctk.CTkFrame(card, fg_color="transparent")
        footer.grid(row=4, column=0, sticky="ew", padx=22, pady=(0, 18))
        ctk.CTkButton(
            footer, text="Cerrar", width=110, height=38, corner_radius=10,
            fg_color=HEX_BG_ALT, hover_color=HEX_CARD_HI,
            text_color=HEX_TEXT_SOFT, border_width=1, border_color=HEX_BORDER,
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            command=self.destroy,
        ).pack(side="right")


        self.after(80, self._search)

    def _search(self):
        if self._loading:
            return
        query = self.query_entry.get().strip()
        if not query:
            return
        self._loading = True
        self.search_btn.configure(state="disabled", text="…")
        for w in self.scroll.winfo_children():
            w.destroy()
        self.loading_lbl = ctk.CTkLabel(
            self.scroll, text="Buscando…",
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=12),
        )
        self.loading_lbl.grid(row=0, column=0, pady=40)
        threading.Thread(
            target=self._search_worker, args=(query,), daemon=True,
        ).start()

    def _search_worker(self, query: str):
        try:
            cands = search_youtube_candidates(query, n=10)
        except Exception as e:
            print(f"[picker] search err: {e}")
            cands = []

        self.after(0, self._on_results, cands)

    def _on_results(self, candidates: list[dict]):
        self._candidates = candidates
        self._loading = False
        self.search_btn.configure(state="normal", text="Buscar")
        for w in self.scroll.winfo_children():
            w.destroy()
        if not candidates:
            ctk.CTkLabel(
                self.scroll, text="Sin resultados",
                text_color=HEX_TEXT_MUTED, fg_color="transparent",
                font=ctk.CTkFont(family="Segoe UI", size=12),
            ).grid(row=0, column=0, pady=40)
            return

        for i, c in enumerate(candidates):
            self._render_candidate(i, c)

            vid = c.get("id")
            if vid:
                threading.Thread(
                    target=self._load_thumb_async, args=(i, vid),
                    daemon=True,
                ).start()

    def _render_candidate(self, idx: int, cand: dict):
        row = ctk.CTkFrame(self.scroll, fg_color=HEX_CARD_ALT,
                           corner_radius=10, height=78)
        row.grid(row=idx, column=0, sticky="ew", padx=4, pady=4)
        row.grid_columnconfigure(2, weight=1)
        row.grid_propagate(False)


        placeholder = make_placeholder_thumb(76, 56)
        cimg = ctk.CTkImage(light_image=placeholder, dark_image=placeholder,
                            size=(76, 56))
        self._refs.append(cimg)
        thumb_lbl = ctk.CTkLabel(row, text="", image=cimg,
                                 fg_color="transparent",
                                 width=76, height=56)
        thumb_lbl.grid(row=0, column=0, padx=(12, 10), pady=10, sticky="ns")
        row.thumb_lbl = thumb_lbl


        title = cand.get("title", "(sin título)")
        if len(title) > 70:
            title = title[:67] + "…"
        dur = (cand.get("duration") or 0) * 1000
        info_text = (f"{_parse_uploader(cand.get('uploader') or cand.get('channel'))} · "
                     f"{fmt_duration(dur)}")
        info = ctk.CTkFrame(row, fg_color="transparent")
        info.grid(row=0, column=2, padx=(0, 10), pady=10, sticky="nsew")
        info.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(
            info, text=title, anchor="w", justify="left",
            text_color=HEX_TEXT, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"),
            wraplength=420,
        ).grid(row=0, column=0, sticky="ew")
        ctk.CTkLabel(
            info, text=info_text, anchor="w", justify="left",
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=10),
        ).grid(row=1, column=0, sticky="ew", pady=(2, 0))


        ctk.CTkButton(
            row, text="Usar este", width=110, height=34, corner_radius=8,
            fg_color=HEX_LIME, hover_color=HEX_LIME_HOVER, text_color=HEX_BG,
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            command=lambda c=cand: self._pick(c),
        ).grid(row=0, column=3, padx=(0, 12))

    def _load_thumb_async(self, row_idx: int, vid: str):
        img = fetch_thumbnail(vid)
        if not img:
            return
        try:
            row = self.scroll.winfo_children()[row_idx]
        except Exception:
            return
        try:
            composed = make_thumb_with_play(img, 76, 56)
            cimg = ctk.CTkImage(light_image=composed, dark_image=composed,
                                size=(76, 56))
            self._refs.append(cimg)
            self.after(0, lambda: row.thumb_lbl.configure(image=cimg))
        except Exception as e:
            print(f"[picker thumb] {e}")

    def _pick(self, cand: dict):
        vid = cand.get("id")
        if not vid:
            return
        match = {
            "id": vid,
            "title": cand.get("title", ""),
            "url": f"https://www.youtube.com/watch?v={vid}",
            "duration": cand.get("duration"),
            "thumbnail_url": "",
        }
        try:
            self.on_picked(match)
        except Exception as e:
            print(f"[picker on_picked] {e}")
        self.destroy()


class HelpDialog(ctk.CTkToplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.title("Ayuda")
        self.geometry("680x640")
        self.resizable(False, False)
        self.configure(fg_color=HEX_BG)
        self.transient(parent)
        self.after(50, self.grab_set)
        try:
            x = parent.winfo_x() + (parent.winfo_width() // 2) - 340
            y = parent.winfo_y() + (parent.winfo_height() // 2) - 320
            self.geometry(f"+{max(0, x)}+{max(0, y)}")
        except Exception:
            pass

        card = ctk.CTkFrame(self, fg_color=HEX_CARD, corner_radius=18,
                            border_width=1, border_color=HEX_BORDER)
        card.pack(fill="both", expand=True, padx=18, pady=18)
        card.grid_columnconfigure(0, weight=1)
        card.grid_rowconfigure(1, weight=1)

        ctk.CTkLabel(
            card, text="Ayuda",
            text_color=HEX_TEXT, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=20, weight="bold"),
        ).grid(row=0, column=0, sticky="w", padx=22, pady=(18, 12))

        scroll = ctk.CTkScrollableFrame(
            card, fg_color=HEX_BG_ALT, corner_radius=12,
            scrollbar_button_color=HEX_BORDER_HI,
            scrollbar_button_hover_color=HEX_TEXT_DIM,
        )
        scroll.grid(row=1, column=0, sticky="nsew", padx=14, pady=(0, 12))
        scroll.grid_columnconfigure(0, weight=1)

        def section(title: str, body: str, title_color: str = HEX_TEXT):
            ctk.CTkLabel(
                scroll, text=title, anchor="w", justify="left",
                text_color=title_color, fg_color="transparent",
                font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"),
                wraplength=540,
            ).pack(anchor="w", padx=18, pady=(16, 4), fill="x")
            ctk.CTkLabel(
                scroll, text=body, anchor="w", justify="left",
                text_color=HEX_TEXT_SOFT, fg_color="transparent",
                font=ctk.CTkFont(family="Segoe UI", size=11),
                wraplength=540,
            ).pack(anchor="w", padx=18, pady=(0, 4), fill="x")

        section(
            "Qué puedes pegar",
            "  ·  URL de playlist de Spotify  →  busca cada canción en YouTube\n"
            "  ·  URL de canción de Spotify   →  busca esa canción en YouTube\n"
            "  ·  URL de vídeo de YouTube     →  ese vídeo directo\n"
            "  ·  URL de playlist de YouTube  →  toda la playlist\n"
            "  ·  URL de canción de SoundCloud → ese track directo\n"
            "  ·  URL de playlist de SoundCloud → toda la playlist\n"
            "  ·  Texto libre («Bohemian Rhapsody Queen») → búsqueda en YouTube",
        )

        section(
            "Cómo usar",
            "1) Pega URL o texto y pulsa Buscar.\n"
            "2) Si es Spotify o texto libre, la búsqueda corre en paralelo "
            "(8 a la vez). Pulsa Detener para pausar — las canciones ya "
            "encontradas siguen disponibles. Reanudar continúa con las "
            "pendientes.\n"
            "3) YouTube Playlist: abre una o varias playlists temporales en "
            "el navegador (solo para tracks de YouTube · YouTube limita a 50 "
            "por URL).\n"
            "4) Descargar MP3: 320 kbps con cover art y tags ID3 (artista, "
            "álbum, año…). Las canciones que ya tienes descargadas se "
            "detectan y se desmarcan automáticamente.\n"
            "5) Si fallan algunas descargas, aparece un botón Reintentar.",
        )

        section(
            "💡  Click en una canción para elegir otro match",
            "Si la canción que ha encontrado el programa no es la correcta, "
            "haz click sobre ella en la lista. Se abre un selector con 10 "
            "candidatos de YouTube y puedes elegir el bueno o refinar la "
            "búsqueda.",
            title_color=HEX_LIME,
        )

        section(
            "⚠   Las canciones pueden no coincidir con la búsqueda",
            "Para Spotify y texto libre, el programa busca por título y "
            "artista en YouTube. El vídeo puede ser una versión live, remix, "
            "cover, karaoke o canción con título parecido — revisa la línea "
            "▸ debajo de cada canción y desmarca / cambia las que no quieras.",
            title_color=HEX_ORANGE,
        )

        section(
            "Requisitos",
            "  ·  FFmpeg + FFprobe en el PATH (necesarios para convertir a "
            "MP3). Descarga: https://www.gyan.dev/ffmpeg/builds/ — añade "
            "'bin' al PATH de Windows.\n"
            "  ·  Credenciales de Spotify (solo para fuentes de Spotify). "
            "En developer.spotify.com crea una app y copia Client ID + "
            "Secret en Ajustes. Para YouTube/SoundCloud/texto libre no "
            "hacen falta.",
        )

        section(
            "Si la descarga falla",
            "YouTube bloquea de vez en cuando a yt-dlp. El programa ya prueba "
            "5 estrategias automáticamente. Si todas fallan:\n"
            "  ·  Actualiza yt-dlp:  pip install -U yt-dlp\n"
            "  ·  Espera unos minutos y reintenta\n"
            "  ·  Comprueba que FFmpeg + FFprobe están instalados",
        )

        section(
            "Aviso legal y de uso responsable",
            "Esta herramienta se ofrece con fines educativos y para uso "
            "personal sobre contenido que el usuario ya posee legalmente "
            "o que está disponible bajo licencias permisivas (Creative "
            "Commons, dominio público, contenido autorizado por el "
            "creador).\n\n"
            "Usos legítimos incluyen, entre otros:\n"
            "  ·  Digitalizar tu propia colección física (CDs, vinilos, "
            "casetes) de la que ya tienes los derechos de copia privada\n"
            "  ·  Crear copias de seguridad de música que has comprado "
            "legalmente\n"
            "  ·  Acceder a contenido bajo licencia libre o de dominio "
            "público\n"
            "  ·  Uso educativo, periodístico o de investigación "
            "amparado por las excepciones de tu jurisdicción\n\n"
            "El usuario es el único responsable de cumplir con las "
            "leyes de derechos de autor de su país. Descargar contenido "
            "protegido sin autorización del titular puede constituir "
            "una infracción.\n\n"
            "Este programa solo automatiza acciones que el usuario "
            "podría realizar manualmente desde un navegador. No aloja, "
            "almacena ni redistribuye contenido: los archivos se "
            "descargan directamente desde YouTube/SoundCloud al equipo "
            "local del usuario.\n\n"
            "Ni el autor del software ni quien lo distribuya se hacen "
            "responsables del uso indebido de esta herramienta. El "
            "programa se proporciona \"TAL CUAL\", sin garantías "
            "expresas ni implícitas, incluyendo pero no limitándose a "
            "las garantías de comerciabilidad o idoneidad para un "
            "propósito determinado.\n\n"
            "Si te gusta un artista, apóyalo a través de canales "
            "oficiales: streaming legal, compra del álbum, conciertos "
            "o merchandise.",
            title_color=HEX_TEXT_MUTED,
        )

        footer = ctk.CTkFrame(card, fg_color="transparent")
        footer.grid(row=2, column=0, sticky="ew", padx=22, pady=(0, 20))
        ctk.CTkButton(
            footer, text="Cerrar", width=120, height=40, corner_radius=10,
            fg_color=HEX_LIME, hover_color=HEX_LIME_HOVER, text_color=HEX_BG,
            font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"),
            command=self.destroy,
        ).pack(side="right")


class ConvertPlaylistDialog(ctk.CTkToplevel):
    """Chooser para elegir plataforma destino (YouTube / Spotify / SoundCloud)."""

    def __init__(self, parent, on_choose):
        super().__init__(parent)
        self.title("Convertir playlist a…")
        self.configure(fg_color=HEX_BG)
        self.geometry("520x340")
        self.resizable(False, False)
        self.transient(parent); self.grab_set()
        self.on_choose = on_choose

        ctk.CTkLabel(
            self, text="¿A qué plataforma quieres convertir?",
            text_color=HEX_TEXT, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=15, weight="bold"),
        ).pack(pady=(22, 4))
        ctk.CTkLabel(
            self,
            text="YouTube genera playlists temporales instantáneas. "
                 "Spotify y SoundCloud generan un .csv que puedes importar "
                 "con TuneMyMusic o Soundiiz.",
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=10),
            wraplength=460, justify="center",
        ).pack(pady=(0, 18), padx=20)

        opts = [
            ("🎬", "YouTube", "Abre playlists temporales en el navegador",
             HEX_YOUTUBE, HEX_YOUTUBE_DIM, "youtube"),
            ("🎵", "Spotify",  "Genera CSV importable a Spotify",
             HEX_SPOTIFY, HEX_LIME_DIM, "spotify"),
            ("🔶", "SoundCloud", "Genera CSV importable a SoundCloud",
             HEX_SOUNDCLOUD, HEX_SOUNDCLOUD_DIM, "soundcloud"),
        ]
        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(pady=(0, 18))
        for icon, name, desc, fg, bg, kind in opts:
            cell = ctk.CTkFrame(
                row, fg_color=HEX_CARD, corner_radius=12,
                border_width=1, border_color=HEX_BORDER, width=150, height=160,
            )
            cell.pack(side="left", padx=8)
            cell.pack_propagate(False)
            ctk.CTkLabel(
                cell, text=icon, fg_color="transparent", text_color=fg,
                font=ctk.CTkFont(size=32),
            ).pack(pady=(18, 4))
            ctk.CTkLabel(
                cell, text=name, fg_color="transparent", text_color=HEX_TEXT,
                font=ctk.CTkFont(family="Segoe UI", size=13, weight="bold"),
            ).pack()
            ctk.CTkLabel(
                cell, text=desc, fg_color="transparent", text_color=HEX_TEXT_MUTED,
                font=ctk.CTkFont(family="Segoe UI", size=9),
                wraplength=130, justify="center",
            ).pack(pady=(2, 8), padx=6)
            ctk.CTkButton(
                cell, text="Elegir", width=110, height=28, corner_radius=10,
                fg_color=bg, hover_color=fg, text_color=fg,
                border_width=1, border_color=fg,
                font=ctk.CTkFont(family="Segoe UI", size=10, weight="bold"),
                command=lambda k=kind: self._pick(k),
            ).pack(pady=(0, 10))

        ctk.CTkButton(
            self, text="Cancelar", width=120, height=30, corner_radius=10,
            fg_color="transparent", hover_color=HEX_CARD_HI,
            text_color=HEX_TEXT_MUTED, border_width=1, border_color=HEX_BORDER_HI,
            font=ctk.CTkFont(family="Segoe UI", size=10),
            command=self.destroy,
        ).pack(pady=(0, 14))

        self.after(50, self.grab_set)

    def _pick(self, kind: str):
        self.destroy()
        self.on_choose(kind)


class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        ctk.set_appearance_mode("dark")
        self.title(APP_NAME)
        self.geometry("1220x800")
        self.minsize(980, 620)
        self.configure(fg_color=HEX_BG)

        self.config_data = load_config()
        self.tracks: list[dict] = []
        self.track_rows: list[TrackRow] = []
        self.playlist_name = ""
        self.current_source = ""
        self.msg_queue: queue.Queue = queue.Queue()
        self._img_refs: list = []


        self._search_state = "idle"
        self._stop_event = threading.Event()
        self._worker_active = False
        self._loaded_url = ""


        self._download_active = False
        self._has_failed_dl = False


        self.audio_format = self.config_data.get("audio_format", DEFAULT_FORMAT)
        self.audio_quality = self.config_data.get("audio_quality", DEFAULT_QUALITY)
        if self.audio_format not in SUPPORTED_FORMATS:
            self.audio_format = DEFAULT_FORMAT
        if self.audio_quality not in QUALITY_KBPS:
            self.audio_quality = DEFAULT_QUALITY


        self.history: list[dict] = self.config_data.get("history", [])[:20]

        self._fmt_buttons: dict[str, "ctk.CTkButton"] = {}
        self._qual_buttons: dict[str, "ctk.CTkButton"] = {}

        self.withdraw()
        self._build_ui()

        self.splash = SplashScreen(
            self, credits_path=CREDITS_PATH,
            on_complete=self._on_splash_done,
        )

        self.after(100, self._drain_queue)

    def _on_splash_done(self):
        try:
            self.deiconify()
            self.lift()
            self.focus_force()
        except Exception:
            pass


    def _build_ui(self):
        self.grid_columnconfigure(0, weight=0, minsize=92)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)


        sidebar = ctk.CTkFrame(
            self, fg_color=HEX_CARD, corner_radius=20,
            border_width=1, border_color=HEX_BORDER, width=88,
        )
        sidebar.grid(row=0, column=0, sticky="nsw", padx=(16, 8), pady=16)
        sidebar.grid_propagate(False)
        sidebar.grid_columnconfigure(0, weight=1)
        sidebar.grid_rowconfigure(99, weight=1)

        icon_pil = make_app_icon(48)
        icon_img = ctk.CTkImage(light_image=icon_pil, dark_image=icon_pil,
                                size=(48, 48))
        self._img_refs.append(icon_img)
        ctk.CTkLabel(sidebar, text="", image=icon_img,
                     fg_color="transparent").grid(row=0, column=0, pady=(22, 30))

        for i, (icon, label, cmd) in enumerate([
            ("⚙", "Ajustes",  self._open_settings),
            ("📁", "Carpeta", self._open_folder),
            ("?", "Ayuda",   self._open_help),
        ]):
            frm = ctk.CTkFrame(sidebar, fg_color="transparent")
            frm.grid(row=1 + i, column=0, pady=4, sticky="ew", padx=10)
            frm.grid_columnconfigure(0, weight=1)
            ctk.CTkButton(
                frm, text=icon, command=cmd,
                width=56, height=44, corner_radius=12,
                fg_color=HEX_BG_ALT, hover_color=HEX_CARD_HI,
                text_color=HEX_TEXT_SOFT, border_width=0,
                font=ctk.CTkFont(family="Segoe UI", size=18),
            ).grid(row=0, column=0)
            ctk.CTkLabel(
                frm, text=label,
                text_color=HEX_TEXT_DIM, fg_color="transparent",
                font=ctk.CTkFont(family="Segoe UI", size=8),
            ).grid(row=1, column=0, pady=(2, 0))

        credits = ctk.CTkFrame(sidebar, fg_color="transparent")
        credits.grid(row=100, column=0, pady=(8, 18))
        ctk.CTkLabel(
            credits, text="EREK",
            text_color=HEX_LIME, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=10, weight="bold"),
        ).grid(row=0, column=0)
        ctk.CTkLabel(
            credits, text="TC CREW",
            text_color=HEX_TEXT_DIM, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=8, weight="bold"),
        ).grid(row=1, column=0)


        main = ctk.CTkFrame(self, fg_color="transparent")
        main.grid(row=0, column=1, sticky="nsew", padx=(8, 16), pady=16)
        main.grid_columnconfigure(0, weight=1)
        main.grid_rowconfigure(5, weight=1)


        header = ctk.CTkFrame(main, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", pady=(4, 8))
        header.grid_columnconfigure(0, weight=1)


        logo_row = ctk.CTkFrame(header, fg_color="transparent")
        logo_row.grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(
            logo_row, text="DUPLi",
            text_color=HEX_TEXT, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=32, weight="bold"),
        ).grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(
            logo_row, text="ist",
            text_color=HEX_LIME, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=32, weight="bold"),
        ).grid(row=0, column=1, sticky="w")

        accent_line = ctk.CTkFrame(logo_row, fg_color=HEX_LIME,
                                    corner_radius=1, height=2, width=42)
        accent_line.grid(row=1, column=1, sticky="w", pady=(0, 0))
        accent_line.grid_propagate(False)


        ctk.CTkLabel(
            header, text="Migra y descarga tu música desde cualquier plataforma",
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=11),
            anchor="w",
        ).grid(row=1, column=0, sticky="w", pady=(6, 0))


        chips_row = ctk.CTkFrame(header, fg_color="transparent")
        chips_row.grid(row=2, column=0, sticky="w", pady=(10, 0))
        for col, (text, bg, fg) in enumerate([
            ("● Spotify",    HEX_LIME_DIM,       HEX_SPOTIFY),
            ("● YouTube",    HEX_YOUTUBE_DIM,    HEX_YOUTUBE),
            ("● SoundCloud", HEX_SOUNDCLOUD_DIM, HEX_SOUNDCLOUD),
        ]):
            ctk.CTkLabel(
                chips_row, text=text,
                fg_color=bg, text_color=fg,
                corner_radius=10, width=98, height=24,
                font=ctk.CTkFont(family="Segoe UI", size=10, weight="bold"),
            ).grid(row=0, column=col, padx=(0, 6))
        ctk.CTkLabel(
            chips_row, text=" · o búsqueda libre",
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=11),
        ).grid(row=0, column=3, sticky="w", padx=(4, 0))


        url_card = ctk.CTkFrame(
            main, fg_color=HEX_CARD, corner_radius=16,
            border_width=1, border_color=HEX_BORDER,
        )
        url_card.grid(row=1, column=0, sticky="ew", pady=(16, 8))
        url_card.grid_columnconfigure(0, weight=1)

        url_row = ctk.CTkFrame(url_card, fg_color="transparent")
        url_row.grid(row=0, column=0, sticky="ew", padx=14, pady=(14, 8))
        url_row.grid_columnconfigure(0, weight=1)
        self.url_entry = ctk.CTkEntry(
            url_row,
            placeholder_text="URL de Spotify, YouTube o SoundCloud · o texto a buscar…",
            placeholder_text_color=HEX_TEXT_DIM,
            height=44, corner_radius=11,
            fg_color=HEX_BG_ALT, text_color=HEX_TEXT,
            border_width=1, border_color=HEX_BORDER_HI,
            font=ctk.CTkFont(family="Segoe UI", size=12),
        )
        self.url_entry.grid(row=0, column=0, sticky="ew", padx=(0, 10))
        self.url_entry.bind("<Return>", lambda _: self._on_search_btn())
        self.url_entry.bind("<KeyRelease>", self._on_url_changed)

        self.search_btn = ctk.CTkButton(
            url_row, text="Buscar →", width=120, height=44, corner_radius=11,
            fg_color=HEX_LIME, hover_color=HEX_LIME_HOVER, text_color=HEX_TEXT,
            font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"),
            command=self._on_search_btn,
        )
        self.search_btn.grid(row=0, column=1)


        fq_row = ctk.CTkFrame(url_card, fg_color="transparent")
        fq_row.grid(row=1, column=0, sticky="w", padx=14, pady=(0, 12))

        ctk.CTkLabel(
            fq_row, text="Formato:",
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=10, weight="bold"),
        ).grid(row=0, column=0, padx=(0, 6))

        for col, fmt in enumerate(["mp3", "flac", "m4a"], start=1):
            btn = ctk.CTkButton(
                fq_row, text=fmt.upper(), width=58, height=24,
                corner_radius=12, border_width=1,
                command=lambda f=fmt: self._set_audio_format(f),
                font=ctk.CTkFont(family="Segoe UI", size=10, weight="bold"),
            )
            btn.grid(row=0, column=col, padx=(0, 4))
            self._fmt_buttons[fmt] = btn

        ctk.CTkLabel(
            fq_row, text="   Calidad:",
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=10, weight="bold"),
        ).grid(row=0, column=4, padx=(12, 6))

        for col, (q_id, q_label) in enumerate([
            ("normal", "Normal"), ("alta", "Alta"), ("maxima", "Máxima"),
        ], start=5):
            btn = ctk.CTkButton(
                fq_row, text=q_label, width=64, height=24,
                corner_radius=12, border_width=1,
                command=lambda q=q_id: self._set_audio_quality(q),
                font=ctk.CTkFont(family="Segoe UI", size=10, weight="bold"),
            )
            btn.grid(row=0, column=col, padx=(0, 4))
            self._qual_buttons[q_id] = btn


        self._refresh_segmented_controls()


        tracks_card = ctk.CTkFrame(
            main, fg_color=HEX_CARD, corner_radius=18,
            border_width=1, border_color=HEX_BORDER,
        )
        tracks_card.grid(row=5, column=0, sticky="nsew", pady=(8, 12))
        tracks_card.grid_columnconfigure(0, weight=1)
        tracks_card.grid_rowconfigure(1, weight=1)

        card_header = ctk.CTkFrame(tracks_card, fg_color="transparent",
                                   height=56)
        card_header.grid(row=0, column=0, sticky="ew", padx=18, pady=(14, 10))
        card_header.grid_columnconfigure(2, weight=1)
        card_header.grid_propagate(False)

        self.playlist_lbl = ctk.CTkLabel(
            card_header, text="Sin contenido cargado",
            text_color=HEX_TEXT, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=14, weight="bold"),
            anchor="w",
        )
        self.playlist_lbl.grid(row=0, column=0, sticky="w")
        self.count_lbl = ctk.CTkLabel(
            card_header, text="",
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=11),
            anchor="w",
        )
        self.count_lbl.grid(row=1, column=0, sticky="w", pady=(2, 0))

        ctk.CTkButton(
            card_header, text="Todas", width=80, height=32, corner_radius=10,
            fg_color=HEX_BG_ALT, hover_color=HEX_CARD_HI,
            text_color=HEX_TEXT_SOFT, border_width=1, border_color=HEX_BORDER,
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            command=lambda: self._toggle_all(True),
        ).grid(row=0, column=3, rowspan=2, padx=(8, 0))
        ctk.CTkButton(
            card_header, text="Ninguna", width=80, height=32, corner_radius=10,
            fg_color=HEX_BG_ALT, hover_color=HEX_CARD_HI,
            text_color=HEX_TEXT_SOFT, border_width=1, border_color=HEX_BORDER,
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            command=lambda: self._toggle_all(False),
        ).grid(row=0, column=4, rowspan=2, padx=(8, 0))

        self.tracks_scroll = ctk.CTkScrollableFrame(
            tracks_card, fg_color=HEX_BG_ALT, corner_radius=12,
            scrollbar_button_color=HEX_BORDER_HI,
            scrollbar_button_hover_color=HEX_TEXT_DIM,
        )
        self.tracks_scroll.grid(row=1, column=0, sticky="nsew",
                                padx=14, pady=(0, 14))
        self.tracks_scroll.grid_columnconfigure(0, weight=1)

        self.empty_lbl = ctk.CTkLabel(
            self.tracks_scroll,
            text="🎧\n\nPega una URL o un texto y pulsa Buscar",
            text_color=HEX_TEXT_DIM, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=12),
            justify="center",
        )
        self.empty_lbl.grid(row=0, column=0, pady=80, padx=20)


        actions = ctk.CTkFrame(main, fg_color="transparent")
        actions.grid(row=6, column=0, sticky="ew")
        actions.grid_columnconfigure(4, weight=1)

        self.yt_btn = ctk.CTkButton(
            actions, text="🔄  Convertir a…",
            width=180, height=44, corner_radius=12,
            fg_color="transparent",
            hover_color=HEX_LIME_DIM,
            text_color=HEX_LIME_HOVER,
            border_width=1, border_color=HEX_LIME_DEEP,
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            command=self._on_yt_playlist, state="disabled",
        )
        self.yt_btn.grid(row=0, column=0, padx=(0, 8))

        self.dl_btn = ctk.CTkButton(
            actions, text="⬇  Descargar",
            width=180, height=44, corner_radius=12,
            fg_color=HEX_LIME, hover_color=HEX_LIME_HOVER, text_color=HEX_TEXT,
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            command=self._on_download, state="disabled",
        )
        self.dl_btn.grid(row=0, column=1, padx=(0, 8))

        self.m3u_btn = ctk.CTkButton(
            actions, text="📄  Exportar .m3u",
            width=160, height=44, corner_radius=12,
            fg_color="transparent",
            hover_color=HEX_GREEN_DIM,
            text_color=HEX_GREEN,
            border_width=1, border_color=HEX_GREEN,
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            command=self._on_export_m3u, state="disabled",
        )
        self.m3u_btn.grid(row=0, column=2, padx=(0, 8))


        self.retry_btn = ctk.CTkButton(
            actions, text="↻  Reintentar fallidas",
            width=170, height=44, corner_radius=12,
            fg_color="transparent", hover_color=HEX_RED_DIM,
            text_color=HEX_RED, border_width=1, border_color=HEX_RED,
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            command=self._on_retry_failed,
        )


        self.status_lbl = ctk.CTkLabel(
            actions, text="",
            text_color=HEX_TEXT_MUTED, fg_color="transparent",
            font=ctk.CTkFont(family="Segoe UI", size=11),
            anchor="e",
        )
        self.status_lbl.grid(row=0, column=4, sticky="e", padx=(20, 0))

        self.progress = ctk.CTkProgressBar(
            main, height=4, corner_radius=2,
            progress_color=HEX_LIME, fg_color=HEX_BORDER,
            border_width=0,
        )
        self.progress.grid(row=7, column=0, sticky="ew", pady=(14, 0))
        self.progress.set(0)


    def _open_settings(self):
        SettingsDialog(self, self.config_data, self._on_settings_saved)

    def _on_settings_saved(self, cfg: dict):
        self.config_data = cfg
        self._set_status("Ajustes guardados ✓", HEX_LIME)

        self._refresh_downloaded_state()

    def _open_folder(self):
        d = self.config_data.get("download_dir", DEFAULT_DOWNLOAD_DIR)
        Path(d).mkdir(parents=True, exist_ok=True)
        try:
            if sys.platform == "win32":
                os.startfile(d)
            elif sys.platform == "darwin":
                os.system(f'open "{d}"')
            else:
                os.system(f'xdg-open "{d}"')
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo abrir:\n{e}")

    def _open_help(self):
        HelpDialog(self)

    def _toggle_all(self, value: bool):
        for r in self.track_rows:
            if value:

                if r.youtube and not r.track.get("downloaded_path"):
                    r.selected.set(True)
            else:
                r.selected.set(False)


    def _set_status(self, text: str, color: str = HEX_TEXT_MUTED):
        self.status_lbl.configure(text=text, text_color=color)

    def _clear_tracks(self):
        for r in self.track_rows:
            try:
                r.destroy()
            except Exception:
                pass
        self.track_rows.clear()
        if self.empty_lbl:
            try:
                self.empty_lbl.grid_forget()
            except Exception:
                pass

    def _show_empty(self):
        try:
            self.empty_lbl.grid(row=0, column=0, pady=80, padx=20)
        except Exception:
            pass

    def _show_retry_button(self, show: bool):
        if show:
            self.retry_btn.grid(row=0, column=3, padx=(0, 8))
        else:
            self.retry_btn.grid_remove()


    def _refresh_segmented_controls(self):
        """Re-aplica colores de los botones segmented según estado actual."""
        for fmt, btn in self._fmt_buttons.items():
            if fmt == self.audio_format:
                btn.configure(
                    fg_color=HEX_LIME_DIM, text_color=HEX_LIME_HOVER,
                    border_color=HEX_LIME_DEEP,
                )
            else:
                btn.configure(
                    fg_color="transparent", text_color=HEX_TEXT_MUTED,
                    border_color=HEX_BORDER_HI,
                )

        flac_active = (self.audio_format == "flac")
        for q_id, btn in self._qual_buttons.items():
            if flac_active:
                btn.configure(
                    fg_color="transparent", text_color=HEX_TEXT_DIM,
                    border_color=HEX_BORDER, state="disabled",
                )
            elif q_id == self.audio_quality:
                btn.configure(
                    fg_color=HEX_LIME_DIM, text_color=HEX_LIME_HOVER,
                    border_color=HEX_LIME_DEEP, state="normal",
                )
            else:
                btn.configure(
                    fg_color="transparent", text_color=HEX_TEXT_MUTED,
                    border_color=HEX_BORDER_HI, state="normal",
                )

    def _set_audio_format(self, fmt: str):
        if fmt not in SUPPORTED_FORMATS:
            return
        self.audio_format = fmt
        self.config_data["audio_format"] = fmt
        save_config(self.config_data)
        self._refresh_segmented_controls()
        self._set_status(f"Formato → {fmt.upper()}", HEX_LIME_HOVER)

    def _set_audio_quality(self, q: str):
        if q not in QUALITY_KBPS:
            return
        if self.audio_format == "flac":
            return
        self.audio_quality = q
        self.config_data["audio_quality"] = q
        save_config(self.config_data)
        self._refresh_segmented_controls()
        kbps = QUALITY_KBPS.get(q, "320")
        self._set_status(f"Calidad → {q.capitalize()} ({kbps} kbps)", HEX_CYAN)


    def _on_export_m3u(self):
        if not self.tracks:
            self._set_status("Nada que exportar", HEX_TEXT_MUTED)
            return
        with_match = [t for t in self.tracks if t.get("downloaded_path")]
        if not with_match:
            self._set_status("Ningún track descargado para exportar al M3U", HEX_RED)
            return

        default_name = (playlist_subfolder_name(
            self.playlist_name, self.current_source) or "playlist") + ".m3u"

        base = self.config_data.get("download_dir", DEFAULT_DOWNLOAD_DIR)
        suggested_dir = effective_download_dir(
            base, self.playlist_name, self.current_source)
        if not os.path.isdir(suggested_dir):
            suggested_dir = base if os.path.isdir(base) else str(Path.home())
        path = filedialog.asksaveasfilename(
            title="Exportar como .m3u",
            initialdir=suggested_dir,
            initialfile=default_name,
            defaultextension=".m3u",
            filetypes=[("M3U Playlist", "*.m3u"), ("Todos", "*.*")],
        )
        if not path:
            return
        ok = export_m3u(with_match, path)
        if ok:
            self._set_status(
                f"📄  M3U exportado: {len(with_match)} pistas → "
                f"{os.path.basename(path)}",
                HEX_GREEN,
            )
        else:
            self._set_status("✗  No se pudo exportar el M3U", HEX_RED)

    def _refresh_downloaded_state(self):
        """Re-escanea cuáles tracks ya están descargados (usar tras
        cambiar carpeta o descargar)."""
        base_dir = self.config_data.get("download_dir", DEFAULT_DOWNLOAD_DIR)
        out_dir = effective_download_dir(
            base_dir, self.playlist_name, self.current_source)
        for i, t in enumerate(self.tracks):
            existing = find_existing_download(t, out_dir)
            t["downloaded_path"] = existing
            if i < len(self.track_rows):
                row = self.track_rows[i]
                if existing:
                    row.mark_downloaded(existing)

        self._update_count_label()

    def _update_count_label(self):
        if not self.tracks:
            self.count_lbl.configure(text="")
            return
        total = len(self.tracks)
        matched = sum(1 for t in self.tracks if t.get("youtube"))
        downloaded = sum(1 for t in self.tracks if t.get("downloaded_path"))
        parts = [f"{total} canciones"]
        if matched:
            parts.append(f"{matched}/{total} encontradas")
        if downloaded:
            parts.append(f"{downloaded} ya descargadas")
        self.count_lbl.configure(text="  ·  ".join(parts))


    def _set_search_state(self, state: str):
        self._search_state = state
        if state == "idle":
            self.search_btn.configure(
                text="Buscar",
                fg_color=HEX_LIME, hover_color=HEX_LIME_HOVER,
                text_color=HEX_BG, state="normal",
            )
        elif state == "searching":
            self.search_btn.configure(
                text="◾  Detener",
                fg_color=HEX_ORANGE, hover_color=HEX_ORANGE_HOVER,
                text_color=HEX_BG, state="normal",
            )
        elif state == "paused":
            self.search_btn.configure(
                text="▶  Reanudar",
                fg_color=HEX_LIME, hover_color=HEX_LIME_HOVER,
                text_color=HEX_BG, state="normal",
            )

    def _on_search_btn(self):
        if self._search_state == "idle":
            self._start_new_search()
        elif self._search_state == "searching":
            self._stop_search()
        elif self._search_state == "paused":
            self._resume_search()

    def _on_url_changed(self, _evt=None):
        if self._search_state != "paused":
            return
        cur = self.url_entry.get().strip()
        if cur != self._loaded_url:
            self._set_search_state("idle")
            self._set_status("Texto cambió · empieza una nueva búsqueda",
                             HEX_TEXT_MUTED)


    def _start_new_search(self):
        raw = self.url_entry.get().strip()
        if not raw:
            self._set_status("Pega una URL o un texto", HEX_RED)
            return
        kind, value = detect_source(raw)

        if kind == "unknown_url":
            self._set_status("URL no reconocida", HEX_RED)
            messagebox.showerror(
                "URL no reconocida",
                "Esa URL no parece ser de Spotify, YouTube o SoundCloud.\n\n"
                "Si quieres hacer una búsqueda libre, escribe texto sin "
                "'http://' al principio.",
            )
            return

        if kind in ("spotify_playlist", "spotify_track"):
            cid = self.config_data.get("client_id", "").strip()
            csec = self.config_data.get("client_secret", "").strip()
            if not cid or not csec:
                self._set_status("Configura credenciales (Ajustes)", HEX_RED)
                self._open_settings()
                return

        self._clear_tracks()
        self.tracks = []
        self._loaded_url = raw
        self.current_source = kind
        self.playlist_lbl.configure(text="Cargando…")
        self.count_lbl.configure(text="")
        self.yt_btn.configure(state="disabled")
        self.dl_btn.configure(state="disabled")
        self.m3u_btn.configure(state="disabled")
        self._show_retry_button(False)
        self._has_failed_dl = False
        self.progress.set(0)
        self._set_status("Obteniendo…", HEX_TEXT_SOFT)
        self._stop_event.clear()
        self._set_search_state("searching")
        self._worker_active = True


        threading.Thread(
            target=self._load_worker, args=(kind, value), daemon=True,
        ).start()

    def _stop_search(self):
        self._stop_event.set()
        self._set_status("Deteniendo búsqueda…", HEX_ORANGE)

    def _resume_search(self):
        pending = [t for t in self.tracks if t.get("youtube") is None]
        if not pending:
            self._set_status("Nada que reanudar · todas tienen match",
                             HEX_TEXT_MUTED)
            self._set_search_state("idle")
            return
        for i, t in enumerate(self.tracks):
            if t.get("youtube") is None and i < len(self.track_rows):
                self.track_rows[i].set_state("wait")
        self._stop_event.clear()
        self._set_search_state("searching")
        self._worker_active = True
        self._set_status(f"Reanudando · {len(pending)} pendientes",
                         HEX_TEXT_SOFT)
        threading.Thread(
            target=self._search_remaining_worker, daemon=True,
        ).start()


    def _load_worker(self, kind: str, value: str):
        try:
            if kind == "spotify_playlist":
                cid = self.config_data["client_id"]
                csec = self.config_data["client_secret"]
                name, tracks = get_spotify_playlist(value, cid, csec)
            elif kind == "spotify_track":
                cid = self.config_data["client_id"]
                csec = self.config_data["client_secret"]
                name, tracks = get_spotify_track(value, cid, csec)
            elif kind == "youtube_video":
                name, tracks = get_youtube_video(value)
            elif kind == "youtube_playlist":
                name, tracks = get_youtube_playlist(value)
            elif kind == "soundcloud_track":
                name, tracks = get_soundcloud(value, is_playlist=False)
            elif kind == "soundcloud_playlist":
                name, tracks = get_soundcloud(value, is_playlist=True)
            elif kind == "text_search":
                name, tracks = get_text_search_track(value)
            else:
                self.msg_queue.put(("error", f"Fuente desconocida: {kind}"))
                self.msg_queue.put(("worker_done",))
                return
        except Exception as e:
            self.msg_queue.put(("error", f"Error cargando: {e}"))
            self.msg_queue.put(("worker_done",))
            return

        if not tracks:
            self.msg_queue.put(("playlist_loaded", name, []))
            self.msg_queue.put(("done", 0, 0))
            self.msg_queue.put(("worker_done",))
            return


        out_base = self.config_data.get("download_dir", DEFAULT_DOWNLOAD_DIR)
        out_dir = effective_download_dir(out_base, name, kind)
        if os.path.isdir(out_dir):
            for t in tracks:
                t["downloaded_path"] = find_existing_download(t, out_dir)

        self.msg_queue.put(("playlist_loaded", name, tracks))


        need_search = [t for t in tracks if t.get("youtube") is None]
        if not need_search:
            matched = sum(1 for t in tracks if t.get("youtube"))
            self.msg_queue.put(("done", matched, 0))
            self.msg_queue.put(("worker_done",))
            return


        for i, t in enumerate(tracks):
            if t.get("youtube") is None:
                self.msg_queue.put(("set_state", i, "wait"))
        self._search_remaining(tracks)
        self.msg_queue.put(("worker_done",))

    def _search_remaining_worker(self):
        self._search_remaining(self.tracks)
        self.msg_queue.put(("worker_done",))

    def _search_remaining(self, tracks: list[dict]):
        indices_pending = [i for i, t in enumerate(tracks)
                           if t.get("youtube") is None]
        total_pending = len(indices_pending)
        if total_pending == 0:
            matched = sum(1 for t in tracks if t.get("youtube"))
            self.msg_queue.put(("done", matched, 0))
            return

        completed = 0
        total_all = len(tracks)
        matched_already = sum(1 for t in tracks if t.get("youtube"))

        def task(idx: int):
            if self._stop_event.is_set():
                return (idx, None, None)
            try:
                match = search_youtube(tracks[idx]["query"])
            except Exception as e:
                print(f"[search task] {e}")
                match = None
            if self._stop_event.is_set():
                return (idx, match, None)
            thumb = None
            if match:
                thumb = fetch_thumbnail(match["id"])
            return (idx, match, thumb)

        executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=SEARCH_WORKERS)
        futures = {executor.submit(task, i): i for i in indices_pending}
        try:
            pending_futures = set(futures.keys())
            while pending_futures:
                if self._stop_event.is_set():
                    for f in pending_futures:
                        f.cancel()
                    break
                done, pending_futures = concurrent.futures.wait(
                    pending_futures, timeout=0.3,
                    return_when=concurrent.futures.FIRST_COMPLETED,
                )
                for f in done:
                    try:
                        idx, match, thumb = f.result()
                    except concurrent.futures.CancelledError:
                        continue
                    except Exception as e:
                        print(f"[future] {e}")
                        continue
                    if match is None and self._stop_event.is_set():
                        continue
                    completed += 1
                    if match:
                        matched_already += 1
                    self.msg_queue.put(("matched", idx, match, thumb))
                    name_short = tracks[idx]["name"][:38]
                    self.msg_queue.put((
                        "progress", min(1.0, completed / total_pending),
                        f"{matched_already}/{total_all} encontradas · {name_short}",
                    ))
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

        if self._stop_event.is_set():
            still_pending = [i for i, t in enumerate(tracks)
                             if t.get("youtube") is None]
            for i in still_pending:
                self.msg_queue.put(("set_state", i, "stopped"))
            self.msg_queue.put(("stopped", matched_already, len(still_pending)))
        else:
            self.msg_queue.put(("done", matched_already, 0))


    def _drain_queue(self):
        processed = 0
        max_per_tick = 30
        try:
            while processed < max_per_tick:
                msg = self.msg_queue.get_nowait()
                processed += 1
                tag = msg[0]

                if tag == "playlist_loaded":
                    _, name, tracks = msg
                    self.playlist_name = name
                    self.tracks = tracks
                    self.playlist_lbl.configure(text=name)
                    self._populate_rows()
                    self._update_count_label()

                elif tag == "progress":
                    _, frac, text = msg
                    try: self.progress.set(frac)
                    except Exception: pass
                    self._set_status(text, HEX_TEXT_SOFT)

                elif tag == "set_state":
                    _, idx, state = msg
                    if 0 <= idx < len(self.track_rows):
                        self.track_rows[idx].set_state(state)

                elif tag == "matched":
                    _, idx, match, thumb_pil = msg
                    if 0 <= idx < len(self.tracks):
                        self.tracks[idx]["youtube"] = match
                        if 0 <= idx < len(self.track_rows):
                            self.track_rows[idx].set_youtube_match(match, thumb_pil)

                        if self.tracks[idx].get("downloaded_path"):
                            self.track_rows[idx].mark_downloaded(
                                self.tracks[idx]["downloaded_path"])
                        self._update_count_label()

                elif tag == "done":
                    _, matched, _x = msg
                    self.progress.set(1.0)
                    self._set_search_state("idle")
                    total = len(self.tracks)
                    if matched > 0 or total > 0:

                        any_matched = any(t.get("youtube") for t in self.tracks)
                        if any_matched:
                            self.yt_btn.configure(state="normal")
                            self.dl_btn.configure(state="normal")
                            self.m3u_btn.configure(state="normal")
                            color = HEX_LIME if matched == total else HEX_ORANGE
                            self._set_status(
                                f"✓  {matched} de {total} listas", color)
                        else:
                            self._set_status("✗  Sin coincidencias", HEX_RED)
                    else:
                        self._set_status("Sin canciones", HEX_RED)

                elif tag == "stopped":
                    _, matched, remaining = msg
                    self._set_search_state("paused")
                    if matched > 0:
                        self.yt_btn.configure(state="normal")
                        self.dl_btn.configure(state="normal")
                        self.m3u_btn.configure(state="normal")
                    self._set_status(
                        f"◾ Detenido · {matched} encontradas · "
                        f"{remaining} pendientes (pulsa Reanudar)",
                        HEX_ORANGE,
                    )

                elif tag == "worker_done":
                    self._worker_active = False

                elif tag == "error":
                    _, err = msg
                    self._set_search_state("idle")
                    self.progress.set(0)
                    self._set_status(err, HEX_RED)
                    self.playlist_lbl.configure(text="Error")

                elif tag == "download_progress":
                    _, frac, text = msg
                    try: self.progress.set(frac)
                    except Exception: pass
                    self._set_status(text, HEX_TEXT_SOFT)

                elif tag == "track_downloaded":
                    _, idx, path = msg
                    if 0 <= idx < len(self.tracks):
                        self.tracks[idx]["downloaded_path"] = path
                    if 0 <= idx < len(self.track_rows):
                        self.track_rows[idx].mark_downloaded(path)
                    self._update_count_label()

                elif tag == "track_dl_failed":
                    _, idx = msg
                    if 0 <= idx < len(self.track_rows):
                        self.track_rows[idx].mark_fail_download()

                elif tag == "download_done":
                    _, ok, fail, first_err, failed_names = msg
                    self.progress.set(1.0)
                    self._download_active = False
                    self.dl_btn.configure(state="normal")
                    self.yt_btn.configure(state="normal")
                    color = HEX_LIME if fail == 0 else HEX_ORANGE
                    self._set_status(
                        f"⬇  Descarga: {ok} OK · {fail} fallidas", color)
                    self._has_failed_dl = fail > 0
                    self._show_retry_button(self._has_failed_dl)
                    if fail > 0 and ok == 0 and first_err:
                        err_low = first_err.lower()
                        is_folder = ("winerror 2" in err_low or
                                     "no se pudo crear" in err_low or
                                     "permission denied" in err_low or
                                     "[errno 13]" in err_low)
                        is_ffmpeg = ("ffmpeg" in err_low or
                                     "ffprobe" in err_low)
                        if is_folder:
                            tips = (
                                "Problema con la CARPETA DE DESCARGA:\n"
                                "• Abre Ajustes y elige una carpeta accesible\n"
                                "• Evita carpetas sincronizadas con OneDrive"
                            )
                        elif is_ffmpeg:
                            tips = (
                                "Problema con FFmpeg:\n"
                                "• Descarga de https://www.gyan.dev/ffmpeg/builds/\n"
                                "• Añade 'bin' al PATH y reinicia"
                            )
                        else:
                            tips = (
                                "Posibles soluciones:\n"
                                "• Actualiza yt-dlp:  pip install -U yt-dlp\n"
                                "• YouTube puede estar limitando · espera\n"
                                "• Algunos vídeos restringidos por región/edad"
                            )
                        messagebox.showerror(
                            "Error de descarga",
                            f"Ninguna de las {fail} canciones se pudo descargar.\n\n"
                            f"Detalle:\n{first_err[:500]}\n\n{tips}",
                        )
                    elif fail > 0 and first_err:
                        print(f"[Descarga parcial] Primer error: "
                              f"{first_err[:300]}")
        except queue.Empty:
            pass
        next_delay = 10 if processed >= max_per_tick else 100
        self.after(next_delay, self._drain_queue)

    def _populate_rows(self):
        if self.empty_lbl:
            try: self.empty_lbl.grid_forget()
            except Exception: pass
        self._populate_batch(0)

    def _populate_batch(self, start: int, batch_size: int = 20):
        end = min(start + batch_size, len(self.tracks))
        for i in range(start, end):
            tr = self.tracks[i]
            row = TrackRow(self.tracks_scroll, idx=i + 1, track=tr,
                           on_click_match=self._on_row_click)
            row.grid(row=i + 1, column=0, sticky="ew", padx=4, pady=4)
            self.track_rows.append(row)
        if end < len(self.tracks):
            self.after(10, lambda: self._populate_batch(end, batch_size))


    def _on_row_click(self, row: "TrackRow"):
        if self._download_active:
            return
        idx = self.track_rows.index(row) if row in self.track_rows else -1
        if idx < 0 or idx >= len(self.tracks):
            return
        track = self.tracks[idx]


        if track.get("source") != "youtube":
            self._set_status(
                "Solo se puede cambiar el match en tracks de YouTube/Spotify",
                HEX_TEXT_MUTED,
            )
            return

        def on_picked(new_match: dict):
            track["youtube"] = new_match
            row.set_youtube_match(new_match)

            def load_thumb():
                img = fetch_thumbnail(new_match["id"])
                if img:
                    self.after(0,
                               lambda: row.set_youtube_match(new_match, img))
            threading.Thread(target=load_thumb, daemon=True).start()
            self._set_status("✓  Match actualizado", HEX_LIME)
            self._update_count_label()

        MatchPickerDialog(self, track, on_picked)


    def _selected_with_match(self) -> list[dict]:
        out = []
        for r in self.track_rows:
            if r.selected.get() and r.youtube:
                out.append(r.track)
        return out

    def _on_yt_playlist(self):
        """Compat: alias hacia el nuevo chooser de conversión."""
        self._on_convert_playlist()

    def _on_convert_playlist(self):
        sel = self._selected_with_match()
        if not sel:
            self._set_status("Selecciona al menos una", HEX_RED)
            return
        ConvertPlaylistDialog(self, lambda kind: self._do_convert(kind, sel))

    def _do_convert(self, kind: str, sel: list[dict]):
        if kind == "youtube":
            self._convert_to_youtube(sel)
        elif kind == "spotify":
            self._convert_to_csv(sel, "spotify")
        elif kind == "soundcloud":
            self._convert_to_csv(sel, "soundcloud")

    def _convert_to_youtube(self, sel: list[dict]):
        only_yt = [t for t in sel if t.get("source") == "youtube"]
        sc_count = len(sel) - len(only_yt)
        if not only_yt:
            messagebox.showinfo(
                "Solo SoundCloud",
                "Todas las canciones seleccionadas son de SoundCloud.\n"
                "YouTube Playlist solo soporta tracks con match en YouTube.\n"
                "Usa la opción Spotify o SoundCloud (CSV) en su lugar."
            )
            return
        parts = chunk_playlists(only_yt, self.playlist_name or "Playlist")
        if not parts:
            return
        msg_extra = f"  ({sc_count} de SoundCloud omitidas)" if sc_count else ""
        if len(parts) == 1:
            webbrowser.open(parts[0]["url"])
            self._set_status(
                f"🎬  Playlist abierta ({parts[0]['count']} canciones){msg_extra}",
                HEX_LIME)
        else:
            PlaylistsDialog(self, parts)
            self._set_status(
                f"🎬  {len(parts)} playlists ({len(only_yt)} canciones){msg_extra}",
                HEX_LIME)

    def _convert_to_csv(self, sel: list[dict], platform: str):
        base = self.config_data.get("download_dir", DEFAULT_DOWNLOAD_DIR)
        suggested_dir = effective_download_dir(
            base, self.playlist_name, self.current_source)
        if not os.path.isdir(suggested_dir):
            try: os.makedirs(suggested_dir, exist_ok=True)
            except OSError: suggested_dir = base if os.path.isdir(base) else str(Path.home())
        default_name = (playlist_subfolder_name(
            self.playlist_name, self.current_source) or "playlist") \
            + f"_{platform}.csv"
        path = filedialog.asksaveasfilename(
            title=f"Guardar CSV para importar a {platform.capitalize()}",
            initialdir=suggested_dir,
            initialfile=default_name,
            defaultextension=".csv",
            filetypes=[("CSV", "*.csv"), ("Todos", "*.*")],
        )
        if not path:
            return
        ok = export_tracks_csv(sel, path)
        if not ok:
            self._set_status("✗  No se pudo escribir el CSV", HEX_RED)
            return
        importer_url = ("https://www.tunemymusic.com/transfer"
                        if platform == "spotify"
                        else "https://soundiiz.com/transfer")
        platform_name = "Spotify" if platform == "spotify" else "SoundCloud"
        if messagebox.askyesno(
            f"CSV generado · {len(sel)} pistas",
            f"Se generó:\n{path}\n\n"
            f"Para importar a {platform_name} usa una herramienta como "
            f"TuneMyMusic o Soundiiz (gratis hasta cierto número de pistas):\n"
            f"  1. Abre la web del importador.\n"
            f"  2. Elige 'Archivo' o 'File' como fuente.\n"
            f"  3. Sube el .csv.\n"
            f"  4. Elige {platform_name} como destino.\n\n"
            f"¿Abrir TuneMyMusic en el navegador ahora?",
        ):
            webbrowser.open(importer_url)
        self._set_status(
            f"📄  CSV {platform_name}: {len(sel)} pistas → "
            f"{os.path.basename(path)}",
            HEX_LIME)


    def _on_download(self):
        sel = self._selected_with_match()
        if not sel:
            self._set_status("Selecciona al menos una", HEX_RED)
            return
        self._do_download(sel)

    def _on_retry_failed(self):
        """Reintentar solo las que tienen state='fail_dl'."""
        failed = []
        failed_indices = []
        for i, r in enumerate(self.track_rows):
            if r.pill.label.cget("text").startswith("✗ Error") and r.youtube:
                failed.append(r.track)
                failed_indices.append(i)
        if not failed:
            self._set_status("No hay descargas fallidas", HEX_TEXT_MUTED)
            self._show_retry_button(False)
            return

        for i in failed_indices:
            self.track_rows[i].set_state("ok")
        self._show_retry_button(False)
        self._do_download(failed)

    def _do_download(self, tracks_to_dl: list[dict]):
        if not check_ffmpeg():
            messagebox.showerror(
                "FFmpeg no encontrado",
                "FFmpeg y FFprobe deben estar en el PATH del sistema.\n\n"
                "Descarga: https://www.gyan.dev/ffmpeg/builds/\n"
                "Añade la carpeta 'bin' al PATH de Windows y reinicia la app.",
            )
            return
        preferred = self.config_data.get("download_dir", DEFAULT_DOWNLOAD_DIR)
        try:
            base_dir, warning = ensure_writable_dir(preferred)
        except Exception as e:
            messagebox.showerror(
                "Carpeta de descarga inaccesible",
                f"No se pudo preparar ninguna carpeta para las descargas.\n\n"
                f"Detalle:\n{str(e)[:400]}\n\n"
                f"Abre Ajustes y elige una carpeta concreta.",
            )
            return
        if warning:
            self._set_status(f"⚠  {warning}", HEX_ORANGE)
            self.config_data["download_dir"] = base_dir
            save_config(self.config_data)


        out_dir = effective_download_dir(
            base_dir, self.playlist_name, self.current_source)
        try:
            os.makedirs(out_dir, exist_ok=True)
        except OSError as e:
            messagebox.showerror(
                "Subcarpeta inaccesible",
                f"No se pudo crear la subcarpeta de la playlist:\n{out_dir}\n\n"
                f"Detalle: {e}",
            )
            return

        self._download_active = True
        self.dl_btn.configure(state="disabled")
        self.yt_btn.configure(state="disabled")
        self.progress.set(0)
        if not warning:
            subfolder = playlist_subfolder_name(self.playlist_name,
                                                 self.current_source)
            location = f"/{subfolder}/" if subfolder else "(raíz)"
            self._set_status(
                f"Descargando {len(tracks_to_dl)} · {self.audio_format.upper()} "
                f"{self.audio_quality} → {location}",
                HEX_TEXT_SOFT,
            )
        threading.Thread(
            target=self._download_worker,
            args=(tracks_to_dl, out_dir,
                  self.audio_format, self.audio_quality),
            daemon=True,
        ).start()

    def _download_worker(self, tracks: list[dict], output_dir: str,
                          audio_format: str, audio_quality: str):
        ok = 0
        fail = 0
        first_error = ""
        failed_names: list[str] = []
        total = len(tracks)

        global_indices: dict[int, int] = {}
        for i, t in enumerate(self.tracks):
            for tt in tracks:
                if tt is t:
                    global_indices[id(tt)] = i
                    break

        for i, t in enumerate(tracks):
            name = t["name"][:38] + ("…" if len(t["name"]) > 38 else "")
            self.msg_queue.put((
                "download_progress", i / total,
                f"⬇  {i + 1}/{total}: {name}",
            ))
            yt = t.get("youtube") or {}
            media_url = yt.get("url", "")
            source = t.get("source", "youtube")
            try:
                out_path = download_track(
                    media_url, output_dir,
                    source=source,
                    filename_hint=f"{t['artists']} - {t['name']}",
                    audio_format=audio_format,
                    quality=audio_quality,
                )

                if out_path:
                    embed_metadata(out_path, t)
                    t["downloaded_path"] = out_path
                    gidx = global_indices.get(id(t), -1)
                    self.msg_queue.put(("track_downloaded", gidx, out_path))
                    ok += 1
                else:
                    fail += 1
            except Exception as e:
                err = str(e)
                print(f"[Descarga FALLÓ] {t.get('query', '')}: {err}")
                if not first_error:
                    first_error = err
                failed_names.append(t["name"])
                gidx = global_indices.get(id(t), -1)
                self.msg_queue.put(("track_dl_failed", gidx))
                fail += 1

        self.msg_queue.put(("download_done", ok, fail,
                            first_error, failed_names))


if __name__ == "__main__":
    try:
        app = App()
        app.mainloop()
    except KeyboardInterrupt:
        pass
