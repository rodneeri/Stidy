# 🎵 Music Downloader — Guía completa

App de escritorio (Windows / macOS / Linux) que convierte playlists y canciones sueltas de **Spotify**, **YouTube** y **SoundCloud** en archivos **MP3 a 320 kbps** con metadatos y portada embebidos.

> ⚠️ Para uso personal legítimo: digitalización de tu propia colección de CDs, contenido Creative Commons, etc. Tú asumes la responsabilidad de tener los derechos sobre la música que descargues.

---

## 📋 Índice

1. [Requisitos previos](#-requisitos-previos)
2. [Instalación](#-instalación)
3. [Configuración inicial](#-configuración-inicial)
4. [Fuentes soportadas](#-fuentes-soportadas)
5. [Uso paso a paso](#-uso-paso-a-paso)
6. [Funcionalidades detalladas](#-funcionalidades-detalladas)
7. [Estructura de carpetas de descarga](#-estructura-de-carpetas-de-descarga)
8. [Metadatos y cover art](#-metadatos-y-cover-art)
9. [Interfaz: elementos visuales](#-interfaz-elementos-visuales)
10. [Solución de problemas](#-solución-de-problemas)
11. [Archivos del proyecto](#-archivos-del-proyecto)
12. [Aviso legal](#️-aviso-legal)

---

## 🧩 Requisitos previos

### Python 3.10 o superior

```powershell
winget install Python.Python.3.12
```
Reinicia la terminal después de instalar.

### FFmpeg + FFprobe (imprescindible para convertir a MP3)

```powershell
winget install ffmpeg
```
Reinicia la terminal para que `ffmpeg` y `ffprobe` estén en el PATH.

Verifica que funciona:
```powershell
ffmpeg -version
ffprobe -version
```

> La app verifica automáticamente si FFmpeg está disponible antes de cada descarga y muestra un error claro si no lo encuentra.

---

## 🚀 Instalación

1. Descomprime o clona esta carpeta donde quieras.
2. Abre **PowerShell** en esa carpeta (Mayús + clic derecho → "Abrir ventana de PowerShell aquí").
3. (Opcional pero recomendado) crea un entorno virtual:

   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```

4. Instala las dependencias:

   ```powershell
   pip install -r requirements.txt
   ```

5. Lanza la app:

   ```powershell
   python main.py
   ```

---

## ⚙️ Configuración inicial

Antes de usar la app con Spotify necesitas configurar tus credenciales. Abre **⚙ Ajustes** (sidebar izquierdo) y rellena:

### Credenciales de Spotify (gratis, 1 minuto)

Solo son necesarias si vas a usar URLs de Spotify. Las URLs de YouTube y SoundCloud no las requieren.

1. Entra a [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) e inicia sesión.
2. Pulsa **Create app**:
   - **App name**: lo que quieras (p. ej. *MiDescargador*).
   - **Redirect URI**: pon `http://127.0.0.1:8888/callback` (no se usa, pero es obligatorio).
   - Acepta los términos y crea la app.
3. En la app creada → **Settings**. Copia el **Client ID** y pulsa **View client secret** para copiar el **Client Secret**.
4. En **⚙ Ajustes** de la app, pega ambos valores y guarda.

Las credenciales se guardan en `~/.spotify_yt_converter.json` y no hay que volver a introducirlas.

### Carpeta de descarga

En **⚙ Ajustes** también puedes cambiar la carpeta base donde se guardan los MP3. Por defecto: `~/Downloads/MusicDownloader`.

La app tiene un sistema de fallbacks automático: si la carpeta configurada no es accesible, intenta `~/Downloads/MusicDownloader`, luego `~/Desktop/MusicDownloader` y finalmente `~/MusicDownloader`.

---

## 🌐 Fuentes soportadas

La app detecta automáticamente el tipo de URL que pegues. Soporta:

| Tipo de entrada | Ejemplo |
|---|---|
| Playlist de Spotify | `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M` |
| Canción de Spotify | `https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT` |
| Playlist de YouTube | `https://www.youtube.com/playlist?list=PL...` |
| Vídeo de YouTube | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` |
| Vídeo corto (Shorts) | `https://www.youtube.com/shorts/...` |
| Playlist de SoundCloud | `https://soundcloud.com/artista/sets/mi-playlist` |
| Canción de SoundCloud | `https://soundcloud.com/artista/cancion` |
| Búsqueda libre | `daft punk get lucky` (cualquier texto sin URL) |

También acepta el formato URI de Spotify (`spotify:playlist:...`, `spotify:track:...`).

---

## 🎯 Uso paso a paso

1. **Pega** la URL (o el texto de búsqueda) en el campo principal y pulsa **Buscar** (o tecla Enter).
2. La app carga la lista de canciones y empieza a **buscar automáticamente** cada una en YouTube (para fuentes Spotify y búsqueda libre).
3. Mientras se busca, puedes ver el progreso canción a canción. El botón **Buscar** se convierte en **◾ Detener** para pausar en cualquier momento.
4. Una vez completada la búsqueda:
   - Marca o desmarca canciones con los **checkboxes** (por defecto todas seleccionadas).
   - Usa los botones **Todas** / **Ninguna** para selección rápida.
5. Elige una acción:
   - **🎬 YouTube Playlist** — abre en el navegador una playlist temporal de YouTube con las canciones seleccionadas.
   - **⬇ Descargar MP3** — descarga los MP3 a la carpeta configurada.

---

## 🔧 Funcionalidades detalladas

### Búsqueda paralela en YouTube

Para playlists de Spotify y búsquedas libres, la app lanza hasta **8 búsquedas simultáneas** en YouTube (usando un `ThreadPoolExecutor` con 8 workers). Esto hace que una playlist de 50 canciones se resuelva en segundos en lugar de minutos.

El algoritmo de matching usa un sistema de puntuación que tiene en cuenta la similitud del título, artista y duración para elegir el mejor resultado entre los 5 candidatos recuperados.

### Detener y reanudar la búsqueda

Durante una búsqueda activa, el botón cambia a **◾ Detener**. Si lo pulsas:
- La búsqueda se detiene limpiamente (las canciones ya encontradas se conservan).
- El botón pasa a **▶ Reanudar**.
- Puedes descargar las que ya tienen match mientras tanto, y reanudar el resto después.

Si cambias el texto del campo URL mientras está pausado, la búsqueda se descarta y vuelve al estado inicial.

### Match picker manual

Haz clic sobre cualquier fila de la lista para abrir el **selector de match manual**. Esto te permite elegir un vídeo de YouTube diferente al que la app encontró automáticamente. Útil cuando el algoritmo elige una versión en directo, un cover o una mala calidad.

El diálogo muestra hasta 10 candidatos rankeados con sus miniaturas, título, canal y duración. Solo está disponible para canciones cuya fuente sea YouTube o Spotify (no para SoundCloud, cuya URL directa ya es definitiva).

### Detección de archivos ya descargados

Al cargar una playlist, la app escanea automáticamente la subcarpeta correspondiente en tu directorio de descargas. Las canciones que ya existen aparecen con el estado **⬇ Ya descargado** y se desmarcan automáticamente del checkbox para evitar descargas duplicadas.

Si cambias la carpeta en Ajustes, la app re-escanea al guardar.

### Reintentar canciones fallidas

Cuando una descarga falla, la canción queda marcada en rojo como **✗ Error descarga**. Al terminar el lote aparece el botón **↻ Reintentar fallidas**, que vuelve a intentar solo las canciones con error usando el mismo match de YouTube. No tienes que volver a buscar nada.

### YouTube Playlist temporal (abrir en navegador)

Genera una URL del tipo `youtube.com/watch_videos?video_ids=...` con los IDs de las canciones seleccionadas y la abre en el navegador. Útil para escuchar la playlist en YouTube sin descargar nada.

**Límite de YouTube**: la URL de watch_videos solo acepta hasta 50 vídeos. Si tienes más, la app divide la selección automáticamente en partes de 50 y abre un diálogo con los enlaces a cada parte (ej: "Mi Playlist — Part 1 50/120", "Part 2 100/120", etc.).

Las canciones de SoundCloud se omiten de esta función (solo funciona con IDs de YouTube) y se indica cuántas se han omitido.

### Estrategias anti-bloqueo de YouTube

YouTube bloquea intermitentemente el cliente web estándar de yt-dlp con el error "Sign in to confirm you're not a bot". La app prueba automáticamente **5 estrategias en cascada** usando diferentes clientes de reproducción: `android+web`, `ios`, `mweb`, `tv_embedded` y finalmente sin cliente específico. Si una estrategia falla, pasa a la siguiente sin intervención del usuario.

### Fallback de carpeta de descarga

Si la carpeta configurada en Ajustes no es accesible (por ejemplo, una unidad desmontada o un problema de permisos), la app intenta automáticamente las siguientes rutas en orden:

1. La carpeta configurada por el usuario.
2. `~/Downloads/MusicDownloader`
3. `~/Desktop/MusicDownloader`
4. `~/MusicDownloader`

Si usa un fallback, muestra una advertencia en la barra de estado y actualiza la config para no volver a fallar.

---

## 📁 Estructura de carpetas de descarga

Cada playlist se descarga en su propia subcarpeta, nombrada a partir del nombre de la playlist con los espacios reemplazados por guiones bajos y los caracteres especiales eliminados.

**Ejemplo con la carpeta base `~/Downloads/MusicDownloader`:**

```
~/Downloads/MusicDownloader/
├── Playlist_1/
│   ├── Artista A - Cancion 1.mp3
│   ├── Artista B - Cancion 2.mp3
│   └── ...
├── Playlist_2/
│   ├── Artista C - Cancion 1.mp3
│   └── ...
├── Rock_Clasico_70s/
│   └── ...
└── Búsqueda_daft_punk_get_lucky/
    └── Daft Punk - Get Lucky.mp3
```

Esto garantiza que las canciones de playlists distintas nunca se mezclan, y que la detección de "ya descargado" funciona por playlist: si tienes "Get Lucky" en dos playlists, cada una tiene su propia copia en su subcarpeta.

El nombre de la subcarpeta se genera con estas reglas:
- Caracteres inválidos para nombres de archivo (`< > : " / \ | ? *` y caracteres de control) → `_`
- Espacios → `_`
- Se eliminan puntos y espacios al principio y al final
- Longitud máxima: 120 caracteres

---

## 🏷️ Metadatos y cover art

Si tienes instalada la librería `mutagen` (incluida en `requirements.txt`), la app escribe automáticamente **tags ID3v2** completos en cada MP3 descargado:

| Tag ID3 | Contenido |
|---|---|
| `TIT2` | Título de la canción |
| `TPE1` | Artista(s) |
| `TALB` | Álbum |
| `TRCK` | Número de pista |
| `TDRC` | Fecha de lanzamiento (YYYY o YYYY-MM-DD) |
| `APIC` | Portada del álbum (cover art embebido) |

La portada se obtiene en este orden de prioridad:
1. Imagen de alta resolución del álbum desde la API de Spotify (≥600 px).
2. Miniatura del vídeo de YouTube en calidad `hqdefault`.
3. Miniatura de SoundCloud.

Si `mutagen` no está instalado, los MP3 se descargan igualmente pero sin metadatos enriquecidos (yt-dlp añade los tags básicos por su cuenta).

---

## 🖥️ Interfaz: elementos visuales

### Sidebar izquierdo

- **Icono verde** — logo de la app (rounded square con triángulo de play).
- **⚙ Ajustes** — abre el diálogo de credenciales Spotify y carpeta de descarga.
- **📁 Carpeta** — abre en el explorador de archivos la carpeta base de descarga.
- **? Ayuda** — muestra un diálogo con información de uso y aviso legal.
- **EREK / TC CREW** — créditos del desarrollador (parte inferior del sidebar).

### Tarjeta de tracks

Cada fila de la lista muestra:

- **Checkbox** — para incluir/excluir la canción de la descarga.
- **Miniatura** — imagen del vídeo de YouTube o placeholder mientras se carga. Clic en la miniatura o en el título abre el match picker.
- **Título** — nombre de la canción y número de orden.
- **Artista** — nombre del artista o canal.
- **Match** — título del vídeo de YouTube encontrado (línea pequeña con ▸).
- **Badge de fuente** — chip pequeño que indica el origen: `YT` (amarillo/rojo) para YouTube/Spotify o `SC` (naranja) para SoundCloud.
- **Pill de estado** — indica el estado actual de la canción:

| Estado | Significado |
|---|---|
| `· Pendiente` | Aún no se ha buscado en YouTube |
| `⏳ Buscando` | Búsqueda en curso |
| `✓ Encontrado` | Tiene match en YouTube |
| `✗ No encontrado` | No se encontró coincidencia |
| `◾ Detenido` | La búsqueda fue detenida antes de llegar aquí |
| `⬇ Ya descargado` | El archivo ya existe en la carpeta |
| `✗ Error descarga` | El archivo falló al descargarse |

- **Duración** — duración de la canción en formato `m:ss`.

### Barra de estado y barra de progreso

En la parte inferior del área principal hay una barra de progreso lineal (verde lima) y una etiqueta de texto que informa del estado actual en tiempo real: qué canción se está buscando o descargando, cuántas están listas, etc.

---

## 🛠️ Solución de problemas

**"FFmpeg no encontrado"**
Instálalo con `winget install ffmpeg` y reinicia completamente la app (cierra y vuelve a abrir). Verifica con `ffmpeg -version` en una terminal nueva.

**"Error de Spotify: Invalid client"**
Revisa Client ID y Client Secret en ⚙ Ajustes: no deben tener espacios extra al inicio o al final. Asegúrate de estar copiando las credenciales de la misma app del dashboard.

**"La playlist no contiene canciones"**
La playlist de Spotify debe ser **pública**. Las playlists privadas o colaborativas (solo visibles para ti) requieren autenticación OAuth de usuario, que no está implementada.

**"URL no reconocida"**
La app solo acepta URLs de Spotify, YouTube y SoundCloud. Para buscar cualquier otra cosa, escribe el texto de búsqueda directamente sin pegar una URL (sin `http://`).

**Una canción no encuentra match en YouTube**
Es normal con títulos atípicos, remixes raros o canciones muy recientes. Puedes hacer clic en esa fila para abrir el match picker y elegir manualmente entre los 10 candidatos que la app sugiere.

**La descarga falla en alguna canción**
Puede ser un vídeo con restricción de edad o de región, o un bloqueo temporal de YouTube. Las demás canciones del lote se descargan igualmente. Usa el botón **↻ Reintentar fallidas** para reintentarlas más tarde.

**Actualización de yt-dlp**
YouTube cambia su API con frecuencia. Si empiezan a fallar muchas descargas, actualiza yt-dlp:
```powershell
pip install -U yt-dlp
```

**Problema con OneDrive / carpeta sincronizada**
Evita usar como carpeta de descarga una carpeta que esté sincronizándose con OneDrive o Dropbox en tiempo real: puede generar errores de escritura intermitentes. Usa una carpeta local normal o configura una en Ajustes.

**La app se abre pero no aparece nada**
La pantalla de splash (imagen de créditos) se muestra durante ~2.6 segundos al arrancar. Si no existe el archivo `credits.png`, el splash se salta automáticamente y la ventana principal aparece de inmediato.

---

## 📁 Archivos del proyecto

```
spotify_yt_app/
├── main.py              # Aplicación principal (UI + lógica de descarga)
├── aero_assets.py       # Paleta de colores, iconos, helpers de imágenes
├── splash.py            # Pantalla de splash animada (zoom-in + fade)
├── requirements.txt     # Dependencias Python
├── credits.png          # Imagen opcional para la pantalla de splash
└── README.md            # Esta guía
```

La configuración (credenciales y carpeta de descarga) se guarda en:
- **Windows**: `C:\Users\<TuUsuario>\.spotify_yt_converter.json`
- **macOS/Linux**: `~/.spotify_yt_converter.json`

---

## ⚖️ Aviso legal

Esta herramienta automatiza acciones que el usuario podría realizar manualmente. **Tú eres el único responsable** de respetar los Términos de Servicio de Spotify, YouTube y SoundCloud, así como los derechos de autor del material que descargues.

Su propósito previsto es la digitalización de música sobre la que el usuario ya posee derechos (CDs propios, contenido bajo licencia Creative Commons, etc.). El desarrollador no se hace responsable del uso que se haga de la herramienta.
