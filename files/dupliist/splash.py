"""
splash.py — Splash minimalista
================================
Solo la foto de créditos. La foto aparece con zoom-in y después se
desvanece. Sin tarjeta, sin logo, sin barra de progreso, sin texto.
Duración total ≈ 2.6 s.
"""
from __future__ import annotations
import os
import customtkinter as ctk
from PIL import Image


class SplashScreen(ctk.CTkToplevel):
    """Splash ultra-minimal: zoom-in → hold → fade-out. Solo la imagen."""

    def __init__(self, master, credits_path: str | None,
                 on_complete=None,
                 zoom_ms: int = 550,
                 hold_ms: int = 1500,
                 fade_ms: int = 550):
        super().__init__(master)
        self.on_complete = on_complete
        self._refs: list = []
        self._ended = False


        self.zoom_ms = zoom_ms
        self.hold_ms = hold_ms
        self.fade_ms = fade_ms


        self.overrideredirect(True)
        try:
            self.attributes("-topmost", True)
        except Exception:
            pass
        try:
            self.attributes("-alpha", 0.0)
        except Exception:
            pass
        self.configure(fg_color="#0a0a0a")


        self._base_img = None
        if credits_path and os.path.exists(credits_path):
            try:
                self._base_img = Image.open(credits_path).convert("RGBA")
            except Exception as e:
                print(f"[splash] no se pudo cargar imagen: {e}")

        if self._base_img is None:

            self.after(50, self._finish)
            return


        max_dim = 1600
        bw, bh = self._base_img.size
        if max(bw, bh) > max_dim:
            scale = max_dim / max(bw, bh)
            self._base_img = self._base_img.resize(
                (int(bw * scale), int(bh * scale)), Image.LANCZOS,
            )


        sh = self.winfo_screenheight()
        sw = self.winfo_screenwidth()
        target_h = int(sh * 0.42)
        bw, bh = self._base_img.size
        scale = target_h / bh
        self._final_w = int(bw * scale)
        self._final_h = target_h

        if self._final_w > int(sw * 0.7):
            scale2 = int(sw * 0.7) / self._final_w
            self._final_w = int(self._final_w * scale2)
            self._final_h = int(self._final_h * scale2)


        W = self._final_w + 80
        H = self._final_h + 80
        x = (sw - W) // 2
        y = (sh - H) // 2
        self.geometry(f"{W}x{H}+{x}+{y}")


        self.img_label = ctk.CTkLabel(self, text="", fg_color="#0a0a0a")
        self.img_label.place(relx=0.5, rely=0.5, anchor="center")


        self._start_ms = None
        self._tick_id = None
        self.after(20, self._begin)


    def _begin(self):

        try:
            self.attributes("-alpha", 1.0)
        except Exception:
            pass
        self._start_ms = self._now()
        self._tick()

    def _now(self) -> int:

        return self.tk.call("clock", "milliseconds")

    def _tick(self):
        if self._ended:
            return
        elapsed = self._now() - self._start_ms
        total = self.zoom_ms + self.hold_ms + self.fade_ms

        if elapsed >= total:
            self._finish()
            return


        if elapsed < self.zoom_ms:

            t = elapsed / self.zoom_ms
            t_eased = 1 - pow(1 - t, 3)
            scale = 0.75 + 0.25 * t_eased
            alpha = 1.0
        elif elapsed < self.zoom_ms + self.hold_ms:
            scale = 1.0
            alpha = 1.0
        else:

            t = (elapsed - self.zoom_ms - self.hold_ms) / self.fade_ms
            t = min(1.0, t)
            t_eased = t * t
            alpha = 1.0 - t_eased
            scale = 1.0 + 0.05 * t_eased


        w = max(1, int(self._final_w * scale))
        h = max(1, int(self._final_h * scale))
        try:
            cimg = ctk.CTkImage(
                light_image=self._base_img, dark_image=self._base_img,
                size=(w, h),
            )
            self._refs.append(cimg)
            if len(self._refs) > 4:
                self._refs = self._refs[-4:]
            self.img_label.configure(image=cimg)
        except Exception:
            return


        try:
            self.attributes("-alpha", max(0.0, min(1.0, alpha)))
        except Exception:
            pass


        self._tick_id = self.after(33, self._tick)

    def _finish(self):
        if self._ended:
            return
        self._ended = True
        if self._tick_id:
            try:
                self.after_cancel(self._tick_id)
            except Exception:
                pass
        try:
            self.destroy()
        except Exception:
            pass
        if self.on_complete:
            try:
                self.on_complete()
            except Exception as e:
                print(f"[splash] on_complete err: {e}")
