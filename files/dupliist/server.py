"""
server.py — DUPLiiST web backend
==================================
Servidor Flask local que expone la misma funcionalidad que main.py
(búsqueda, matching, descarga, conversión, exportación) vía HTTP +
Server-Sent Events para progreso en vivo.
"""
from __future__ import annotations

import io
import json
import os
import queue
import subprocess
import sys
import tempfile
import threading
import uuid
import webbrowser
import zipfile
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_file

import core


app = Flask(__name__, static_folder="static", static_url_path="")

# ─── Estado global (single-user, local) ──────────────────────────────
STATE = {
    "tracks": [],
    "playlist_name": "",
    "current_source": "",
    "config": core.load_config(),
    "failed_indices": set(),
}
STOP_EVENT = threading.Event()
SEARCH_LOCK = threading.Lock()

JOBS: dict[str, "queue.Queue"] = {}


def _new_job() -> tuple[str, "queue.Queue"]:
    job_id = uuid.uuid4().hex
    q: "queue.Queue" = queue.Queue()
    JOBS[job_id] = q
    return job_id, q


def _yt_thumb(video_id: str) -> str:
    return f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"


# ─── Páginas estáticas ────────────────────────────────────────────────
@app.route("/")
def index():
    return app.send_static_file("index.html")


# ─── Configuración ──────────────────────────────────────────────────
def _mask_secret(value: str) -> str:
    """Enmascara una credencial dejando solo los últimos 4 caracteres
    visibles, para no exponer client_id/client_secret en texto claro."""
    if not value:
        return ""
    if len(value) <= 4:
        return "•" * len(value)
    return "•" * 8 + value[-4:]


@app.route("/api/config", methods=["GET"])
def get_config():
    cfg = dict(STATE["config"])
    cfg["client_id"] = _mask_secret(cfg.get("client_id") or "")
    cfg["client_secret"] = _mask_secret(cfg.get("client_secret") or "")
    cfg["client_id_set"] = bool(STATE["config"].get("client_id"))
    cfg["client_secret_set"] = bool(STATE["config"].get("client_secret"))
    return jsonify(cfg)


@app.route("/api/config", methods=["POST"])
def set_config():
    data = request.get_json(force=True) or {}
    cfg = STATE["config"]
    for key in ("client_id", "client_secret", "download_dir",
                 "audio_format", "audio_quality"):
        if key in data:
            value = data[key]
            # Ignora valores enmascarados (placeholders "••••..."): el
            # usuario no los ha modificado, así que conservamos el real.
            if key in ("client_id", "client_secret") and \
                    isinstance(value, str) and "•" in value:
                continue
            cfg[key] = value
    core.save_config(cfg)
    resp = dict(cfg)
    resp["client_id"] = _mask_secret(resp.get("client_id") or "")
    resp["client_secret"] = _mask_secret(resp.get("client_secret") or "")
    return jsonify(resp)


# ─── Carga de playlist / track / búsqueda ─────────────────────────────
@app.route("/api/load", methods=["POST"])
def api_load():
    data = request.get_json(force=True) or {}
    raw = (data.get("input") or "").strip()
    if not raw:
        return jsonify({"error": "Introduce una URL o texto de búsqueda."}), 400

    kind, value = core.detect_source(raw)

    if kind in ("spotify_playlist", "spotify_track"):
        cfg = STATE["config"]
        if not cfg.get("client_id") or not cfg.get("client_secret"):
            return jsonify({
                "error": "Necesitas credenciales de Spotify en Ajustes.",
                "needs_spotify_credentials": True,
            }), 400

    if kind == "unknown_url":
        return jsonify({"error": "URL no reconocida."}), 400

    STOP_EVENT.clear()
    STATE["failed_indices"] = set()
    job_id, q = _new_job()
    threading.Thread(target=_load_worker, args=(job_id, q, kind, value),
                      daemon=True).start()
    return jsonify({"job_id": job_id, "kind": kind})


def _load_worker(job_id: str, q: "queue.Queue", kind: str, value: str):
    try:
        if kind == "spotify_playlist":
            cfg = STATE["config"]
            name, tracks = core.get_spotify_playlist(
                value, cfg["client_id"], cfg["client_secret"])
        elif kind == "spotify_track":
            cfg = STATE["config"]
            name, tracks = core.get_spotify_track(
                value, cfg["client_id"], cfg["client_secret"])
        elif kind == "youtube_video":
            name, tracks = core.get_youtube_video(value)
        elif kind == "youtube_playlist":
            name, tracks = core.get_youtube_playlist(value)
        elif kind == "soundcloud_track":
            name, tracks = core.get_soundcloud(value, is_playlist=False)
        elif kind == "soundcloud_playlist":
            name, tracks = core.get_soundcloud(value, is_playlist=True)
        elif kind == "text_search":
            name, tracks = core.get_text_search_track(value)
        else:
            q.put({"type": "error", "message": f"Fuente desconocida: {kind}"})
            q.put(None)
            return
    except Exception as e:
        q.put({"type": "error", "message": f"Error cargando: {e}"})
        q.put(None)
        return

    STATE["playlist_name"] = name
    STATE["current_source"] = kind
    STATE["tracks"] = tracks

    if not tracks:
        q.put({"type": "playlist_loaded", "name": name, "tracks": []})
        q.put({"type": "done", "matched": 0, "total": 0})
        q.put(None)
        return

    out_base = STATE["config"].get("download_dir", core.DEFAULT_DOWNLOAD_DIR)
    out_dir = core.effective_download_dir(out_base, name, kind)
    if os.path.isdir(out_dir):
        for t in tracks:
            t["downloaded_path"] = core.find_existing_download(t, out_dir)

    q.put({"type": "playlist_loaded", "name": name, "tracks": tracks})

    need_search = [t for t in tracks if t.get("youtube") is None]
    if not need_search:
        matched = sum(1 for t in tracks if t.get("youtube"))
        q.put({"type": "done", "matched": matched, "total": len(tracks)})
        q.put(None)
        return

    for i, t in enumerate(tracks):
        if t.get("youtube") is None:
            q.put({"type": "set_state", "index": i, "state": "wait"})

    _search_remaining(tracks, q)
    q.put(None)


@app.route("/api/search/stop", methods=["POST"])
def api_search_stop():
    STOP_EVENT.set()
    return jsonify({"ok": True})


@app.route("/api/search/resume", methods=["POST"])
def api_search_resume():
    tracks = STATE["tracks"]
    pending = [t for t in tracks if t.get("youtube") is None]
    job_id, q = _new_job()
    if not pending:
        q.put({"type": "done", "matched": sum(1 for t in tracks if t.get("youtube")),
               "total": len(tracks)})
        q.put(None)
        return jsonify({"job_id": job_id})

    STOP_EVENT.clear()
    for i, t in enumerate(tracks):
        if t.get("youtube") is None:
            q.put({"type": "set_state", "index": i, "state": "wait"})

    def worker():
        _search_remaining(tracks, q)
        q.put(None)

    threading.Thread(target=worker, daemon=True).start()
    return jsonify({"job_id": job_id})


def _search_remaining(tracks: list[dict], q: "queue.Queue"):
    import concurrent.futures

    indices_pending = [i for i, t in enumerate(tracks)
                       if t.get("youtube") is None]
    total_pending = len(indices_pending)
    if total_pending == 0:
        matched = sum(1 for t in tracks if t.get("youtube"))
        q.put({"type": "done", "matched": matched, "total": len(tracks)})
        return

    completed = 0
    total_all = len(tracks)
    matched_already = sum(1 for t in tracks if t.get("youtube"))

    def task(idx: int):
        if STOP_EVENT.is_set():
            return (idx, None)
        try:
            match = core.search_youtube(tracks[idx]["query"])
        except Exception as e:
            print(f"[search task] {e}")
            match = None
        return (idx, match)

    executor = concurrent.futures.ThreadPoolExecutor(
        max_workers=core.SEARCH_WORKERS)
    futures = {executor.submit(task, i): i for i in indices_pending}
    try:
        pending_futures = set(futures.keys())
        while pending_futures:
            if STOP_EVENT.is_set():
                for f in pending_futures:
                    f.cancel()
                break
            done, pending_futures = concurrent.futures.wait(
                pending_futures, timeout=0.3,
                return_when=concurrent.futures.FIRST_COMPLETED,
            )
            for f in done:
                try:
                    idx, match = f.result()
                except concurrent.futures.CancelledError:
                    continue
                except Exception as e:
                    print(f"[future] {e}")
                    continue
                if match is None and STOP_EVENT.is_set():
                    continue
                completed += 1
                if match:
                    matched_already += 1
                    tracks[idx]["youtube"] = match
                    thumb_url = _yt_thumb(match["id"])
                    q.put({"type": "matched", "index": idx, "match": match,
                           "thumbnail_url": thumb_url})
                else:
                    q.put({"type": "matched", "index": idx, "match": None,
                           "thumbnail_url": None})
                name_short = tracks[idx]["name"][:38]
                q.put({
                    "type": "progress",
                    "frac": min(1.0, completed / total_pending),
                    "text": f"{matched_already}/{total_all} encontradas · {name_short}",
                })
    finally:
        executor.shutdown(wait=False, cancel_futures=True)

    if STOP_EVENT.is_set():
        still_pending = [i for i, t in enumerate(tracks)
                         if t.get("youtube") is None]
        for i in still_pending:
            q.put({"type": "set_state", "index": i, "state": "stopped"})
        q.put({"type": "stopped", "matched": matched_already,
               "remaining": len(still_pending)})
    else:
        q.put({"type": "done", "matched": matched_already, "total": total_all})


# ─── SSE ────────────────────────────────────────────────────────────
@app.route("/api/events/<job_id>")
def api_events(job_id):
    q = JOBS.get(job_id)
    if q is None:
        def empty():
            yield f"data: {json.dumps({'type': 'error', 'message': 'job desconocido'})}\n\n"
        return Response(empty(), mimetype="text/event-stream")

    def stream():
        try:
            while True:
                try:
                    msg = q.get(timeout=30)
                except queue.Empty:
                    yield ": keep-alive\n\n"
                    continue
                if msg is None:
                    break
                yield f"data: {json.dumps(msg)}\n\n"
        finally:
            JOBS.pop(job_id, None)

    return Response(stream(), mimetype="text/event-stream",
                     headers={"Cache-Control": "no-cache",
                              "X-Accel-Buffering": "no"})


# ─── Match picker ──────────────────────────────────────────────────
@app.route("/api/match/candidates", methods=["POST"])
def api_match_candidates():
    data = request.get_json(force=True) or {}
    query = (data.get("query") or "").strip()
    if not query:
        return jsonify({"candidates": []})
    candidates = core.search_youtube_candidates(query, n=10)
    out = []
    for c in candidates:
        vid = c.get("id")
        out.append({
            "id": vid,
            "title": c.get("title", "(sin título)"),
            "url": f"https://www.youtube.com/watch?v={vid}",
            "duration": c.get("duration"),
            "uploader": core._parse_uploader(c.get("uploader") or c.get("channel")),
            "thumbnail_url": _yt_thumb(vid) if vid else "",
        })
    return jsonify({"candidates": out})


@app.route("/api/match/select", methods=["POST"])
def api_match_select():
    data = request.get_json(force=True) or {}
    idx = data.get("index")
    candidate = data.get("candidate") or {}
    tracks = STATE["tracks"]
    if idx is None or not (0 <= idx < len(tracks)):
        return jsonify({"error": "Índice inválido"}), 400

    match = {
        "id": candidate.get("id"),
        "title": candidate.get("title", "(sin título)"),
        "url": candidate.get("url") or f"https://www.youtube.com/watch?v={candidate.get('id')}",
        "duration": candidate.get("duration"),
        "thumbnail_url": "",
    }
    tracks[idx]["youtube"] = match
    STATE["failed_indices"].discard(idx)
    return jsonify({"ok": True, "match": match,
                     "thumbnail_url": _yt_thumb(match["id"]) if match["id"] else ""})


# ─── Descarga ───────────────────────────────────────────────────────
@app.route("/api/download", methods=["POST"])
def api_download():
    data = request.get_json(force=True) or {}
    indices = data.get("indices") or []
    fmt = (data.get("format") or core.DEFAULT_FORMAT).lower()
    quality = (data.get("quality") or core.DEFAULT_QUALITY).lower()

    if fmt not in core.SUPPORTED_FORMATS:
        fmt = core.DEFAULT_FORMAT
    if quality not in core.QUALITY_KBPS:
        quality = core.DEFAULT_QUALITY

    if not indices:
        return jsonify({"error": "Selecciona al menos una canción."}), 400

    if not core.check_ffmpeg():
        return jsonify({
            "error": "FFmpeg y FFprobe deben estar en el PATH del sistema.",
            "needs_ffmpeg": True,
        }), 400

    cfg = STATE["config"]
    preferred = cfg.get("download_dir", core.DEFAULT_DOWNLOAD_DIR)
    try:
        base_dir, warning = core.ensure_writable_dir(preferred)
    except Exception as e:
        return jsonify({"error": f"Carpeta de descarga inaccesible: {e}"}), 400

    if warning:
        cfg["download_dir"] = base_dir
        core.save_config(cfg)

    out_dir = core.effective_download_dir(
        base_dir, STATE["playlist_name"], STATE["current_source"])
    try:
        os.makedirs(out_dir, exist_ok=True)
    except OSError as e:
        return jsonify({"error": f"No se pudo crear la subcarpeta: {e}"}), 400

    cfg["audio_format"] = fmt
    cfg["audio_quality"] = quality
    core.save_config(cfg)

    job_id, q = _new_job()
    threading.Thread(target=_download_worker,
                      args=(job_id, q, indices, fmt, quality, out_dir),
                      daemon=True).start()
    return jsonify({"job_id": job_id, "warning": warning, "output_dir": out_dir})


@app.route("/api/download/retry", methods=["POST"])
def api_download_retry():
    indices = sorted(STATE["failed_indices"])
    if not indices:
        return jsonify({"error": "No hay descargas fallidas."}), 400

    if not core.check_ffmpeg():
        return jsonify({"error": "FFmpeg/FFprobe no encontrados.",
                         "needs_ffmpeg": True}), 400

    cfg = STATE["config"]
    preferred = cfg.get("download_dir", core.DEFAULT_DOWNLOAD_DIR)
    try:
        base_dir, _warning = core.ensure_writable_dir(preferred)
    except Exception as e:
        return jsonify({"error": f"Carpeta de descarga inaccesible: {e}"}), 400

    out_dir = core.effective_download_dir(
        base_dir, STATE["playlist_name"], STATE["current_source"])
    os.makedirs(out_dir, exist_ok=True)

    fmt = cfg.get("audio_format", core.DEFAULT_FORMAT)
    quality = cfg.get("audio_quality", core.DEFAULT_QUALITY)

    job_id, q = _new_job()
    threading.Thread(target=_download_worker,
                      args=(job_id, q, indices, fmt, quality, out_dir),
                      daemon=True).start()
    return jsonify({"job_id": job_id})


def _download_worker(job_id: str, q: "queue.Queue", indices: list[int],
                      fmt: str, quality: str, out_dir: str):
    import concurrent.futures

    tracks = STATE["tracks"]
    valid_indices = [gidx for gidx in indices if 0 <= gidx < len(tracks)]
    total = len(valid_indices)
    ok = 0
    fail = 0
    completed = 0
    first_error = ""
    failed_names: list[str] = []

    for gidx in valid_indices:
        STATE["failed_indices"].discard(gidx)

    def task(gidx: int):
        t = tracks[gidx]
        yt = t.get("youtube") or {}
        media_url = yt.get("url", "")
        source = t.get("source", "youtube")
        try:
            out_path = core.download_track(
                media_url, out_dir,
                source=source,
                filename_hint=core.expected_audio_filename(t, fmt).rsplit(".", 1)[0],
                audio_format=fmt,
                quality=quality,
            )
            if out_path:
                core.embed_metadata(out_path, t)
            return (gidx, out_path, None)
        except Exception as e:
            return (gidx, None, str(e))

    if total == 0:
        q.put({"type": "download_done", "ok": 0, "fail": 0,
               "first_error": "", "failed_names": []})
        q.put(None)
        return

    workers = max(1, min(core.DOWNLOAD_WORKERS, total))
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=workers)
    try:
        futures = [executor.submit(task, gidx) for gidx in valid_indices]
        for f in concurrent.futures.as_completed(futures):
            gidx, out_path, err = f.result()
            t = tracks[gidx]
            completed += 1
            name = t["name"][:38] + ("…" if len(t["name"]) > 38 else "")
            if out_path:
                t["downloaded_path"] = out_path
                q.put({"type": "track_downloaded", "index": gidx, "path": out_path})
                ok += 1
            else:
                if err:
                    print(f"[Descarga FALLÓ] {t.get('query', '')}: {err}")
                    if not first_error:
                        first_error = err
                failed_names.append(t["name"])
                STATE["failed_indices"].add(gidx)
                q.put({"type": "track_dl_failed", "index": gidx})
                fail += 1
            q.put({"type": "download_progress", "frac": completed / total,
                   "text": f"⬇  {completed}/{total}: {name}"})
    finally:
        executor.shutdown(wait=True)

    q.put({"type": "download_done", "ok": ok, "fail": fail,
           "first_error": first_error, "failed_names": failed_names})
    q.put(None)


# ─── Conversión / Exportación ────────────────────────────────────────
def _selected_tracks(indices: list[int]) -> list[dict]:
    tracks = STATE["tracks"]
    return [tracks[i] for i in indices if 0 <= i < len(tracks)]


@app.route("/api/download/file/<int:index>", methods=["GET"])
def api_download_file(index):
    """Sirve un audio ya descargado como adjunto, para que el navegador
    muestre el diálogo de "Guardar como" del explorador de Windows."""
    tracks = STATE["tracks"]
    if not (0 <= index < len(tracks)):
        return jsonify({"error": "Índice inválido."}), 400
    t = tracks[index]
    path = t.get("downloaded_path")
    if not path or not os.path.exists(path):
        return jsonify({"error": "El archivo no está descargado todavía."}), 404
    fname = os.path.basename(path)
    return send_file(path, as_attachment=True, download_name=fname)


@app.route("/api/download/zip", methods=["POST"])
def api_download_zip():
    """Empaqueta los audios ya descargados de las pistas indicadas en un
    .zip y lo sirve como adjunto (diálogo de descarga del navegador)."""
    data = request.get_json(force=True) or {}
    indices = data.get("indices") or []
    sel = _selected_tracks(indices)
    if not sel:
        return jsonify({"error": "Selecciona al menos una."}), 400

    available = [t for t in sel if t.get("downloaded_path")
                  and os.path.exists(t["downloaded_path"])]
    if not available:
        return jsonify({"error": "Ninguna de las pistas seleccionadas "
                                  "está descargada todavía."}), 404

    buf = io.BytesIO()
    used_names = set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for t in available:
            path = t["downloaded_path"]
            arcname = os.path.basename(path)
            base, ext = os.path.splitext(arcname)
            n = 2
            while arcname in used_names:
                arcname = f"{base} ({n}){ext}"
                n += 1
            used_names.add(arcname)
            zf.write(path, arcname)

        m3u_lines = ["#EXTM3U"]
        for t in available:
            dur = (int(t.get("duration_ms") or 0) // 1000) or -1
            artist = t.get("artists") or ""
            name = t.get("name") or "Track"
            title = f"{artist} - {name}" if artist else name
            m3u_lines.append(f"#EXTINF:{dur},{title}")
            m3u_lines.append(os.path.basename(t["downloaded_path"]))
        zf.writestr("playlist.m3u", "\n".join(m3u_lines) + "\n")

    buf.seek(0)
    fname = (core.playlist_subfolder_name(
        STATE["playlist_name"], STATE["current_source"]) or "playlist") + ".zip"
    return send_file(buf, as_attachment=True, download_name=fname,
                      mimetype="application/zip")


@app.route("/api/convert/youtube", methods=["POST"])
def api_convert_youtube():
    data = request.get_json(force=True) or {}
    indices = data.get("indices") or []
    sel = _selected_tracks(indices)
    if not sel:
        return jsonify({"error": "Selecciona al menos una."}), 400

    only_yt = [t for t in sel if t.get("source") == "youtube"]
    sc_count = len(sel) - len(only_yt)
    if not only_yt:
        return jsonify({"error": "Todas las canciones seleccionadas son de "
                                  "SoundCloud. YouTube Playlist solo soporta "
                                  "tracks con match en YouTube."}), 400

    parts = core.chunk_playlists(only_yt, STATE["playlist_name"] or "Playlist")
    return jsonify({"parts": parts, "soundcloud_skipped": sc_count})


@app.route("/api/convert/csv", methods=["POST"])
def api_convert_csv():
    data = request.get_json(force=True) or {}
    indices = data.get("indices") or []
    platform = (data.get("platform") or "spotify").lower()
    sel = _selected_tracks(indices)
    if not sel:
        return jsonify({"error": "Selecciona al menos una."}), 400

    fname = (core.playlist_subfolder_name(
        STATE["playlist_name"], STATE["current_source"]) or "playlist") \
        + f"_{platform}.csv"

    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False,
                                      encoding="utf-8") as tmp:
        tmp_path = tmp.name
    ok = core.export_tracks_csv(sel, tmp_path)
    if not ok:
        return jsonify({"error": "No se pudo generar el CSV."}), 500

    return send_file(tmp_path, as_attachment=True, download_name=fname,
                      mimetype="text/csv")


@app.route("/api/export/m3u", methods=["POST"])
def api_export_m3u():
    data = request.get_json(force=True) or {}
    indices = data.get("indices") or []
    sel = _selected_tracks(indices)
    if not sel:
        return jsonify({"error": "Selecciona al menos una."}), 400

    fname = (core.playlist_subfolder_name(
        STATE["playlist_name"], STATE["current_source"]) or "playlist") + ".m3u"

    cfg = STATE["config"]
    base_dir = cfg.get("download_dir", core.DEFAULT_DOWNLOAD_DIR)
    out_dir = core.effective_download_dir(
        base_dir, STATE["playlist_name"], STATE["current_source"])
    try:
        os.makedirs(out_dir, exist_ok=True)
        tmp_path = os.path.join(out_dir, fname)
    except OSError:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".m3u", delete=False,
                                          encoding="utf-8") as tmp:
            tmp_path = tmp.name

    ok = core.export_m3u(sel, tmp_path)
    if not ok:
        return jsonify({"error": "No se pudo generar el M3U."}), 500

    return send_file(tmp_path, as_attachment=True, download_name=fname,
                      mimetype="audio/x-mpegurl")


@app.route("/api/folder/open", methods=["POST"])
def api_folder_open():
    cfg = STATE["config"]
    base = cfg.get("download_dir", core.DEFAULT_DOWNLOAD_DIR)
    out_dir = core.effective_download_dir(
        base, STATE["playlist_name"], STATE["current_source"])
    target = out_dir if os.path.isdir(out_dir) else base
    os.makedirs(target, exist_ok=True)
    try:
        if sys.platform.startswith("win"):
            os.startfile(target)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.run(["open", target], check=False)
        else:
            subprocess.run(["xdg-open", target], check=False)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify({"ok": True, "path": target})


_LIBRARY_AUDIO_EXTS = {".mp3", ".flac", ".m4a", ".opus", ".wav"}


@app.route("/api/library", methods=["GET"])
def api_library():
    cfg = STATE["config"]
    base = cfg.get("download_dir", core.DEFAULT_DOWNLOAD_DIR)
    items = []
    if os.path.isdir(base):
        for entry in os.scandir(base):
            if not entry.is_dir():
                continue
            count = 0
            size = 0
            for root, _, files in os.walk(entry.path):
                for f in files:
                    if os.path.splitext(f)[1].lower() in _LIBRARY_AUDIO_EXTS:
                        count += 1
                        try:
                            size += os.path.getsize(os.path.join(root, f))
                        except OSError:
                            pass
            if count == 0:
                continue
            items.append({
                "name": entry.name,
                "tracks": count,
                "size_mb": round(size / (1024 * 1024), 1),
                "mtime": entry.stat().st_mtime,
            })
    items.sort(key=lambda x: x["mtime"], reverse=True)
    return jsonify({"base_dir": base, "playlists": items})


@app.route("/api/library/open", methods=["POST"])
def api_library_open():
    cfg = STATE["config"]
    base = os.path.normpath(cfg.get("download_dir", core.DEFAULT_DOWNLOAD_DIR))
    data = request.get_json(silent=True) or {}
    name = data.get("name", "")
    target = base if not name else os.path.normpath(os.path.join(base, name))
    if name and (os.path.dirname(target) != base or not os.path.isdir(target)):
        return jsonify({"error": "Carpeta no válida."}), 400
    try:
        if sys.platform.startswith("win"):
            os.startfile(target)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.run(["open", target], check=False)
        else:
            subprocess.run(["xdg-open", target], check=False)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify({"ok": True, "path": target})


if __name__ == "__main__":
    threading.Timer(1.0, lambda: webbrowser.open("http://127.0.0.1:5000")).start()
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
