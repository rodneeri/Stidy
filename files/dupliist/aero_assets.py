"""
aero_assets.py — DUPLiist (purple/cyan dark theme)
=====================================================
Paleta inspirada en la versión web DUPLiist: morado/cyan sobre fondo
casi negro con leve tinte azul. Nombres de constantes mantenidos por
compatibilidad — los valores ahora corresponden al nuevo theme.
"""
from __future__ import annotations
import io
import urllib.request
import urllib.error
from PIL import Image, ImageDraw, ImageFilter


HEX_BG          = "#06060f"
HEX_BG_ALT      = "#0b0b1a"
HEX_CARD        = "#0d0d20"
HEX_CARD_ALT    = "#15152a"
HEX_CARD_HI     = "#1c1c35"
HEX_BORDER      = "#1f1f3a"
HEX_BORDER_HI   = "#2d2d4f"
HEX_DIVIDER     = "#16162a"


HEX_TEXT        = "#f1f5f9"
HEX_TEXT_SOFT   = "#cbd5e1"
HEX_TEXT_MUTED  = "#64748b"
HEX_TEXT_DIM    = "#475569"


HEX_LIME        = "#8b5cf6"
HEX_LIME_HOVER  = "#a78bfa"
HEX_LIME_DEEP   = "#6d28d9"
HEX_LIME_DIM    = "#1a1230"


HEX_CYAN        = "#22d3ee"
HEX_CYAN_DIM    = "#0a2d3a"


HEX_GREEN       = "#4ade80"
HEX_GREEN_DIM   = "#0a2510"


HEX_ORANGE      = "#fbbf24"
HEX_ORANGE_HOVER = "#fcd34d"
HEX_ORANGE_DIM  = "#2d2310"


HEX_RED         = "#f87171"
HEX_RED_DIM     = "#2a1a20"


HEX_BLUE        = "#22d3ee"
HEX_BLUE_DIM    = "#0a2d3a"


HEX_SPOTIFY     = "#1db954"
HEX_SPOTIFY_HV  = "#1ed760"


HEX_YOUTUBE     = "#ff4444"
HEX_YOUTUBE_DIM = "#2d1217"
HEX_SOUNDCLOUD  = "#ff7700"
HEX_SOUNDCLOUD_DIM = "#2d1f10"


def _rounded_rect_mask(size: tuple[int, int], radius: int,
                       supersample: int = 4) -> Image.Image:
    """Máscara alpha de rectángulo redondeado, anti-aliased."""
    w, h = size[0] * supersample, size[1] * supersample
    r = radius * supersample
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    return m.resize(size, Image.LANCZOS)


def make_app_icon(size: int = 64) -> Image.Image:
    """Icono DUPLiist: rounded square con gradiente vertical púrpura→cyan
    y triángulo de play blanco. El gradiente se simula con dos rectángulos
    semitranparentes superpuestos."""
    ss = 4
    s = size * ss
    radius = int(s * 0.24)


    base = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    bd = ImageDraw.Draw(base)
    bd.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius,
                         fill=(139, 92, 246, 255))


    grad = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)

    cy_top = (139, 92, 246, 0)
    cy_bot = (34, 211, 238, 220)
    bands = 60
    for i in range(bands):
        t = i / (bands - 1)
        r = int(cy_top[0] + (cy_bot[0] - cy_top[0]) * t)
        g = int(cy_top[1] + (cy_bot[1] - cy_top[1]) * t)
        b = int(cy_top[2] + (cy_bot[2] - cy_top[2]) * t)
        a = int(cy_top[3] + (cy_bot[3] - cy_top[3]) * t)
        y0 = int(s * i / bands)
        y1 = int(s * (i + 1) / bands)
        gd.rectangle([0, y0, s, y1], fill=(r, g, b, a))

    mask = _rounded_rect_mask((s, s), radius)
    grad.putalpha(mask)
    base = Image.alpha_composite(base, grad)


    hl = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl)
    hd.rounded_rectangle([0, 0, s - 1, int(s * 0.55)], radius=radius,
                         fill=(255, 255, 255, 22))
    hl = hl.filter(ImageFilter.GaussianBlur(radius=s * 0.05))
    base = Image.alpha_composite(base, hl)


    d = ImageDraw.Draw(base)
    cx, cy = s // 2, s // 2
    tri_w = int(s * 0.32)
    tri_h = int(tri_w * 1.05)
    cx += int(s * 0.025)
    pts = [
        (cx - tri_w // 2, cy - tri_h // 2),
        (cx + tri_w // 2, cy),
        (cx - tri_w // 2, cy + tri_h // 2),
    ]
    d.polygon(pts, fill=(255, 255, 255, 255))

    return base.resize((size, size), Image.LANCZOS)


def make_placeholder_thumb(width: int = 86, height: int = 64) -> Image.Image:
    """Miniatura placeholder mientras se descarga la real de YouTube."""
    img = Image.new("RGB", (width, height), color=(30, 30, 34))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, width - 1, height - 1],
                   outline=(56, 56, 64), width=1)

    cx, cy = width // 2, height // 2 + 2
    r = max(3, min(width, height) // 8)
    draw.ellipse([cx - r - r, cy + 1, cx, cy + 1 + r * 2], fill=(95, 95, 105))
    draw.rectangle([cx - 2, cy - r * 3, cx, cy + r + 1], fill=(95, 95, 105))
    return img


def make_thumb_with_play(base_img: Image.Image,
                        width: int = 86, height: int = 64) -> Image.Image:
    """Recorta/escala a width×height + overlay sutil + play icon."""
    bw, bh = base_img.size
    target_ratio = width / height
    src_ratio = bw / bh
    if src_ratio > target_ratio:
        new_w = int(bh * target_ratio)
        x = (bw - new_w) // 2
        base_img = base_img.crop((x, 0, x + new_w, bh))
    elif src_ratio < target_ratio:
        new_h = int(bw / target_ratio)
        y = (bh - new_h) // 2
        base_img = base_img.crop((0, y, bw, y + new_h))
    base_img = base_img.resize((width, height), Image.LANCZOS).convert("RGB")
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 50))
    return Image.alpha_composite(base_img.convert("RGBA"), overlay).convert("RGB")


def fetch_image(url: str, timeout: float = 6.0) -> Image.Image | None:
    """Descarga una imagen de cualquier URL HTTP(S) como PIL Image."""
    if not url:
        return None
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read()
        img = Image.open(io.BytesIO(data))
        img.load()
        return img
    except (urllib.error.URLError, urllib.error.HTTPError,
            TimeoutError, OSError, ValueError):
        return None


def fetch_image_bytes(url: str, timeout: float = 8.0) -> bytes | None:
    """Devuelve los bytes brutos de una imagen (para embebido ID3)."""
    if not url:
        return None
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except (urllib.error.URLError, urllib.error.HTTPError,
            TimeoutError, OSError):
        return None


def fetch_thumbnail(video_id_or_url: str,
                    timeout: float = 4.0) -> Image.Image | None:
    """Acepta un ID de video de YouTube o una URL HTTP directa.
    Si es ID: prueba mqdefault → default en i.ytimg.com.
    Si es URL: descarga directamente."""
    if not video_id_or_url:
        return None
    if video_id_or_url.startswith(("http://", "https://")):
        return fetch_image(video_id_or_url, timeout)

    for variant in ("mqdefault.jpg", "default.jpg"):
        url = f"https://i.ytimg.com/vi/{video_id_or_url}/{variant}"
        img = fetch_image(url, timeout)
        if img:
            return img
    return None
