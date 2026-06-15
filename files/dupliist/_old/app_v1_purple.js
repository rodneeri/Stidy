// ── State ──────────────────────────────────────────────────────────
const S = {
  tracks: [],
  playlistName: '',
  currentSource: '',
  format: 'mp3',
  quality: 'maxima',
  searchState: 'idle',   // idle | searching | paused
  downloadActive: false,
  failedIndices: new Set(),
  matchIdx: null,
};

const PLAT = {
  spotify_playlist:   {name: 'Spotify',    color: '#1db954'},
  spotify_track:      {name: 'Spotify',    color: '#1db954'},
  youtube_playlist:   {name: 'YouTube',    color: '#ff4444'},
  youtube_video:      {name: 'YouTube',    color: '#ff4444'},
  soundcloud_playlist:{name: 'SoundCloud', color: '#ff7700'},
  soundcloud_track:   {name: 'SoundCloud', color: '#ff7700'},
  text_search:        {name: 'Búsqueda',   color: '#a78bfa'},
};

const PILL_LABELS = {
  pending:    ['·  Pendiente', 'ps-pending'],
  wait:       ['⏳ Buscando', 'ps-wait'],
  ok:         ['✓ Encontrado', 'ps-ok'],
  fail:       ['✗ No encontrado', 'ps-fail'],
  stopped:    ['◾ Detenido', 'ps-stopped'],
  downloaded: ['⬇ Descargado', 'ps-downloaded'],
  fail_dl:    ['✗ Error descarga', 'ps-fail_dl'],
};

const g = id => document.getElementById(id);
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

window.addEventListener('error', e => toast('✗ JS error: ' + e.message));
window.addEventListener('unhandledrejection', e => toast('✗ Error: ' + (e.reason?.message || e.reason)));

// ── Init ───────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const splash = g('splash');
  if (splash) {
    const killSplash = () => splash.remove();
    // Only tear down on the master sequence finishing — not the child
    // sweep/ring/glow animations, which now run on their own timelines.
    splash.addEventListener('animationend', (e) => {
      if (e.target === splash && e.animationName === 'splash-seq') killSplash();
    });
    // Safety net: never let the splash get stuck if animationend never fires
    // (reduced-motion, hidden tab on load, missing credits image, etc.).
    setTimeout(killSplash, 4200);
  }
  createSparks();
  try {
    const cfg = await (await fetch('/api/config')).json();
    if (cfg.audio_format) {
      S.format = cfg.audio_format;
      document.querySelectorAll('[data-fmt]').forEach(b => {
        b.classList.toggle('on', b.dataset.fmt === S.format);
      });
    }
    if (cfg.audio_quality) {
      S.quality = cfg.audio_quality;
      document.querySelectorAll('[data-q]').forEach(b => {
        b.classList.toggle('on', b.dataset.q === S.quality);
      });
    }
    applyFormatLock();
  } catch (e) { /* ignore */ }

  g('urlInput').addEventListener('keydown', e => { if (e.key === 'Enter') onSearchBtn(); });
  g('urlInput').addEventListener('input', updateBadge);
  g('matchQuery').addEventListener('input', debounce(loadMatchCandidates, 350));
});

// ── Toast ──────────────────────────────────────────────────────────
let toastTm;
function toast(msg) {
  const t = g('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTm);
  toastTm = setTimeout(() => t.classList.remove('on'), 3200);
}

function debounce(fn, ms) {
  let tm;
  return (...args) => { clearTimeout(tm); tm = setTimeout(() => fn(...args), ms); };
}

// ── Settings drawer ────────────────────────────────────────────────
async function openSett() {
  try {
    const cfg = await (await fetch('/api/config')).json();
    g('scid').value = cfg.client_id || '';
    g('scs').value = cfg.client_secret || '';
    g('dpath').value = cfg.download_dir || '';
  } catch (e) { /* ignore */ }
  g('ov').classList.add('open');
  g('drawer').classList.add('open');
}
function closeSett() {
  g('ov').classList.remove('open');
  g('drawer').classList.remove('open');
}
function togPwd(id) {
  const e = g(id);
  e.type = e.type === 'password' ? 'text' : 'password';
}
async function saveSett() {
  const body = {
    client_id: g('scid').value.trim(),
    client_secret: g('scs').value.trim(),
    download_dir: g('dpath').value.trim(),
  };
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    closeSett();
    toast('✓ Ajustes guardados');
  } catch (e) {
    toast('✗ No se pudieron guardar los ajustes');
  }
}

// ── Format / Quality pills ────────────────────────────────────────
function applyFormatLock() {
  const loss = S.format === 'flac';
  g('qualg').classList.toggle('disabled', loss);
  g('qlab').style.opacity = loss ? '.4' : '1';
}
function setFmt(btn) {
  document.querySelectorAll('[data-fmt]').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  S.format = btn.dataset.fmt;
  applyFormatLock();
  persistFormat();
}
function setQ(btn) {
  document.querySelectorAll('[data-q]').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  S.quality = btn.dataset.q;
  persistFormat();
}
function persistFormat() {
  fetch('/api/config', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({audio_format: S.format, audio_quality: S.quality}),
  }).catch(() => {});
}

// ── Source badge on input ─────────────────────────────────────────
function detectClient(text) {
  const s = text.trim();
  if (!s) return null;
  if (/open\.spotify\.com|spotify:/.test(s)) return 'spotify_playlist';
  if (/soundcloud\.com/i.test(s)) return 'soundcloud_playlist';
  if (/youtube\.com|youtu\.be/.test(s)) return 'youtube_video';
  if (s.toLowerCase().startsWith('http')) return null;
  return 'text_search';
}
function updateBadge() {
  const val = g('urlInput').value;
  const k = detectClient(val);
  const b = g('pbadge');
  if (k && PLAT[k]) {
    const p = PLAT[k];
    b.innerHTML = `<span class="pdot" style="background:${p.color};box-shadow:0 0 7px ${p.color}"></span>` +
      `<span style="color:${p.color};font-weight:500">${p.name} detectado</span>`;
  } else {
    b.innerHTML = '<span style="font-size:.9rem">🎵</span> Pega una URL de Spotify/YouTube/SoundCloud o escribe una búsqueda';
  }
}

// ── Search button state machine ───────────────────────────────────
function setSearchState(state) {
  S.searchState = state;
  const btn = g('sbtn'), txt = g('btxt'), bico = g('bico');
  btn.classList.remove('stop', 'resume');
  btn.disabled = false;
  if (state === 'searching') {
    txt.textContent = 'Detener';
    btn.classList.add('stop');
    bico.outerHTML = '<span id="bico" class="spin"></span>';
  } else if (state === 'paused') {
    txt.textContent = 'Reanudar';
    btn.classList.add('resume');
    if (g('bico').classList?.contains('spin')) {
      g('bico').outerHTML = svgArrow();
    }
  } else {
    txt.textContent = 'Buscar';
    if (g('bico').classList?.contains('spin')) {
      g('bico').outerHTML = svgArrow();
    }
  }
}
function svgArrow() {
  return '<svg id="bico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
}

function onSearchBtn() {
  if (S.searchState === 'idle') {
    doLoad();
  } else if (S.searchState === 'searching') {
    stopSearch();
  } else if (S.searchState === 'paused') {
    resumeSearch();
  }
}

// ── Load playlist / track / search ────────────────────────────────
async function doLoad() {
  const raw = g('urlInput').value.trim();
  if (!raw) {
    const e = g('urlInput');
    e.style.animation = 'shake .4s ease';
    setTimeout(() => e.style.animation = '', 400);
    return;
  }

  S.tracks = [];
  S.failedIndices = new Set();
  g('res').style.display = 'none';
  g('retryBtn').classList.remove('show');
  g('progwrap').classList.add('show');
  g('progfill').style.width = '0%';
  g('progtext').textContent = 'Obteniendo…';
  setSearchState('searching');

  let resp, data;
  try {
    resp = await fetch('/api/load', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({input: raw}),
    });
    data = await resp.json();
  } catch (e) {
    setSearchState('idle');
    g('progtext').textContent = '';
    toast('✗ Error de conexión con el servidor');
    return;
  }

  if (!resp.ok) {
    setSearchState('idle');
    g('progwrap').classList.remove('show');
    if (data.needs_spotify_credentials) {
      toast('⚠ Añade tus credenciales de Spotify en Ajustes');
      openSett();
    } else {
      toast('✗ ' + (data.error || 'Error desconocido'));
    }
    return;
  }

  S.lastKind = data.kind;
  openEvents(data.job_id);
}

function stopSearch() {
  fetch('/api/search/stop', {method: 'POST'}).catch(() => {});
  g('progtext').textContent = 'Deteniendo búsqueda…';
}

async function resumeSearch() {
  setSearchState('searching');
  g('progtext').textContent = 'Reanudando…';
  try {
    const resp = await fetch('/api/search/resume', {method: 'POST'});
    const data = await resp.json();
    openEvents(data.job_id);
  } catch (e) {
    setSearchState('paused');
  }
}

// ── SSE ────────────────────────────────────────────────────────────
function openEvents(jobId) {
  const es = new EventSource(`/api/events/${jobId}`);
  es.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    handleEvent(msg, es);
  };
  es.onerror = () => { es.close(); };
}

function handleEvent(msg, es) {
  switch (msg.type) {
    case 'playlist_loaded':
      S.playlistName = msg.name;
      S.tracks = msg.tracks;
      renderPlaylistHeader();
      renderTracks();
      g('res').style.display = 'flex';
      setTimeout(() => g('res').scrollIntoView({behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start'}), 50);
      break;

    case 'progress':
      g('progfill').style.width = `${Math.round(msg.frac * 100)}%`;
      g('progtext').textContent = msg.text;
      break;

    case 'set_state':
      setRowState(msg.index, msg.state);
      break;

    case 'matched':
      if (msg.match) {
        S.tracks[msg.index].youtube = msg.match;
        updateRowMatch(msg.index, msg.match, msg.thumbnail_url);
        setRowState(msg.index, 'ok');
      } else {
        setRowState(msg.index, 'fail');
      }
      break;

    case 'done': {
      g('progfill').style.width = '100%';
      setSearchState('idle');
      const total = S.tracks.length;
      const matched = msg.matched;
      const anyMatched = S.tracks.some(t => t.youtube);
      updateActionButtons();
      if (anyMatched) {
        g('progtext').textContent = matched === total
          ? `✓ ${matched} de ${total} listas`
          : `✓ ${matched} de ${total} listas`;
      } else {
        g('progtext').textContent = total > 0 ? '✗ Sin coincidencias' : 'Sin canciones';
      }
      es.close();
      break;
    }

    case 'stopped':
      setSearchState('paused');
      updateActionButtons();
      g('progtext').textContent =
        `◾ Detenido · ${msg.matched} encontradas · ${msg.remaining} pendientes (pulsa Reanudar)`;
      es.close();
      break;

    case 'error':
      setSearchState('idle');
      g('progwrap').classList.remove('show');
      toast('✗ ' + msg.message);
      es.close();
      break;

    case 'download_progress':
      g('progfill').style.width = `${Math.round(msg.frac * 100)}%`;
      g('progtext').textContent = msg.text;
      break;

    case 'track_downloaded':
      if (S.tracks[msg.index]) S.tracks[msg.index].downloaded_path = msg.path;
      setRowState(msg.index, 'downloaded');
      break;

    case 'track_dl_failed':
      S.failedIndices.add(msg.index);
      setRowState(msg.index, 'fail_dl');
      break;

    case 'download_done':
      g('progfill').style.width = '100%';
      S.downloadActive = false;
      updateActionButtons();
      g('progtext').textContent = `⬇  Descarga: ${msg.ok} OK · ${msg.fail} fallidas`;
      g('retryBtn').classList.toggle('show', msg.fail > 0);
      if (msg.fail > 0) {
        toast(`⚠ ${msg.fail} descarga(s) fallaron`);
      } else {
        toast('✓ Descarga completada');
      }
      es.close();
      break;
  }
}

// ── Rendering ──────────────────────────────────────────────────────
function renderPlaylistHeader() {
  const k = S.currentSourceLabel = PLAT_KEY();
  const p = PLAT[S.lastKind] || {name: 'Música', color: '#8b5cf6'};
  g('pname').textContent = S.playlistName || 'Playlist';
  g('pinfo').innerHTML = `<span style="color:${p.color};font-weight:500">${p.name}</span> · ${S.tracks.length} canciones`;
}
function PLAT_KEY() { return S.lastKind; }

function trackInitialState(t) {
  if (t.downloaded_path) return 'downloaded';
  if (t.youtube) return 'ok';
  return 'pending';
}

function renderTracks() {
  const list = g('tlist');
  if (!S.tracks.length) {
    list.innerHTML = '<div class="empty-msg">No se encontraron canciones.</div>';
    return;
  }
  list.innerHTML = S.tracks.map((t, i) => rowHtml(t, i)).join('');
  g('selAll').checked = true;
}

function rowHtml(t, i) {
  const state = trackInitialState(t);
  const [label, cls] = PILL_LABELS[state];
  const yt = t.youtube || {};
  const thumb = thumbUrlFor(t);
  const badge = t.source === 'soundcloud'
    ? '<span class="badge badge-sc">SC</span>'
    : '<span class="badge badge-yt">YT</span>';
  const dur = fmtDuration(t.duration_ms);
  return `
    <label class="ti" data-idx="${i}" style="--i:${i}">
      <input type="checkbox" class="track-ck" data-idx="${i}" checked onclick="event.stopPropagation()">
      <div class="tnum">${i + 1}</div>
      <img class="tthumb" src="${thumb}" loading="lazy" onerror="this.style.visibility='hidden'">
      <div class="tinfo">
        <span class="ttitle">${escapeHtml(t.name)}</span>
        <span class="tartist">${escapeHtml(t.artists)}</span>
      </div>
      ${badge}
      <span class="tdur">${dur}</span>
      <span class="pillstate ${cls}" data-pill="${i}">${label}</span>
    </label>`;
}

function thumbUrlFor(t) {
  const yt = t.youtube;
  if (yt) {
    if (yt.thumbnail_url) return yt.thumbnail_url;
    if (yt.id) return `https://i.ytimg.com/vi/${yt.id}/mqdefault.jpg`;
  }
  if (t.album_cover_url) return t.album_cover_url;
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="52" height="39"%3E%3Crect width="100%25" height="100%25" fill="%2315152a"/%3E%3C/svg%3E';
}

function fmtDuration(ms) {
  if (!ms) return '—';
  const totalS = Math.floor(ms / 1000);
  const m = Math.floor(totalS / 60), s = totalS % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function setRowState(idx, state) {
  const pill = document.querySelector(`[data-pill="${idx}"]`);
  if (!pill) return;
  const [label, cls] = PILL_LABELS[state] || PILL_LABELS.pending;
  pill.textContent = label;
  pill.className = `pillstate ${cls} pop`;
  pill.dataset.pill = idx;
  pill.addEventListener('animationend', () => pill.classList.remove('pop'), {once: true});
}

function updateRowMatch(idx, match, thumbUrl) {
  const row = document.querySelector(`.ti[data-idx="${idx}"]`);
  if (!row) return;
  const img = row.querySelector('.tthumb');
  if (img && thumbUrl) {
    img.src = thumbUrl;
    img.style.visibility = 'visible';
  }
  const dur = match.duration ? fmtDuration(match.duration * 1000) : null;
  if (dur) {
    const durEl = row.querySelector('.tdur');
    if (durEl) durEl.textContent = dur;
  }
}

// ── Selection ──────────────────────────────────────────────────────
function togAll(cb) {
  document.querySelectorAll('.track-ck').forEach(c => c.checked = cb.checked);
}
function selectedIndices() {
  return [...document.querySelectorAll('.track-ck:checked')]
    .map(c => parseInt(c.dataset.idx, 10))
    .filter(i => S.tracks[i] && S.tracks[i].youtube);
}

function updateActionButtons() {
  const anyMatched = S.tracks.some(t => t.youtube);
  g('convBtn').disabled = !anyMatched;
  g('dlBtn').disabled = !anyMatched || S.downloadActive;
  g('m3uBtn').disabled = !anyMatched;
}

// ── Row click → match picker ──────────────────────────────────────
document.addEventListener('click', (e) => {
  const row = e.target.closest('.ti');
  if (!row) return;
  if (S.downloadActive) return;
  const idx = parseInt(row.dataset.idx, 10);
  const track = S.tracks[idx];
  if (!track) return;
  if (track.source !== 'youtube') {
    toast('Solo se puede cambiar el match en tracks de YouTube/Spotify');
    return;
  }
  openMatchPicker(idx);
});

function openMatchPicker(idx) {
  S.matchIdx = idx;
  const t = S.tracks[idx];
  g('matchSub').textContent = `${t.artists} – ${t.name}`;
  g('matchQuery').value = t.query || `${t.artists} - ${t.name}`;
  g('matchResults').innerHTML = '<div class="empty-msg">Buscando…</div>';
  g('mov').classList.add('open');
  g('matchModal').classList.add('open');
  loadMatchCandidates();
}
function closeMatchPicker() {
  g('mov').classList.remove('open');
  g('matchModal').classList.remove('open');
  S.matchIdx = null;
}

async function loadMatchCandidates() {
  if (S.matchIdx === null) return;
  const query = g('matchQuery').value.trim();
  if (!query) return;
  g('matchResults').innerHTML = '<div class="empty-msg">Buscando…</div>';
  try {
    const resp = await fetch('/api/match/candidates', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({query}),
    });
    const data = await resp.json();
    const candidates = data.candidates || [];
    if (!candidates.length) {
      g('matchResults').innerHTML = '<div class="empty-msg">Sin resultados.</div>';
      return;
    }
    g('matchResults').innerHTML = candidates.map((c, i) => `
      <div class="cand" onclick="selectCandidate(${i})">
        <img src="${c.thumbnail_url}" loading="lazy">
        <div class="cand-info">
          <div class="cand-title">${escapeHtml(c.title)}</div>
          <div class="cand-meta">${escapeHtml(c.uploader || '')} · ${fmtDuration((c.duration || 0) * 1000)}</div>
        </div>
      </div>`).join('');
    S._candidates = candidates;
  } catch (e) {
    g('matchResults').innerHTML = '<div class="empty-msg">Error al buscar.</div>';
  }
}

async function selectCandidate(i) {
  const idx = S.matchIdx;
  const candidate = S._candidates[i];
  if (idx === null || !candidate) return;
  try {
    const resp = await fetch('/api/match/select', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({index: idx, candidate}),
    });
    const data = await resp.json();
    if (!resp.ok) { toast('✗ ' + (data.error || 'Error')); return; }
    S.tracks[idx].youtube = data.match;
    S.failedIndices.delete(idx);
    updateRowMatch(idx, data.match, data.thumbnail_url);
    setRowState(idx, S.tracks[idx].downloaded_path ? 'downloaded' : 'ok');
    updateActionButtons();
    toast('✓ Match actualizado');
  } catch (e) {
    toast('✗ Error de conexión');
  }
  closeMatchPicker();
}

// ── Convert ────────────────────────────────────────────────────────
function openConvert() {
  if (g('convBtn').disabled) return;
  resetConvertModal();
  g('cov').classList.add('open');
  g('convertModal').classList.add('open');
}
function closeConvert() {
  g('cov').classList.remove('open');
  g('convertModal').classList.remove('open');
}
function resetConvertModal() {
  g('convertModal').querySelector('.modal-body').innerHTML = `
      <div class="conv-opt" onclick="doConvert('youtube')">
        <div class="conv-ico" style="background:rgba(255,68,68,.12);color:var(--yt-c)">▶</div>
        <div><div class="conv-name">Playlist temporal de YouTube</div><div class="conv-desc">Abre una watch_videos URL con las canciones seleccionadas</div></div>
      </div>
      <div class="conv-opt" onclick="doConvert('spotify')">
        <div class="conv-ico" style="background:rgba(29,185,84,.12);color:var(--sp-c)">♫</div>
        <div><div class="conv-name">CSV para Spotify</div><div class="conv-desc">Exporta un .csv compatible con TuneMyMusic / Soundiiz</div></div>
      </div>
      <div class="conv-opt" onclick="doConvert('soundcloud')">
        <div class="conv-ico" style="background:rgba(255,119,0,.12);color:var(--sc-c)">☁</div>
        <div><div class="conv-name">CSV para SoundCloud</div><div class="conv-desc">Exporta un .csv compatible con Soundiiz</div></div>
      </div>`;
}

async function doConvert(kind) {
  const indices = selectedIndices();
  if (!indices.length) { toast('Selecciona al menos una'); return; }

  if (kind === 'youtube') {
    try {
      const resp = await fetch('/api/convert/youtube', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({indices}),
      });
      const data = await resp.json();
      if (!resp.ok) { toast('✗ ' + (data.error || 'Error')); return; }
      const parts = data.parts || [];
      if (parts.length === 1) {
        window.open(parts[0].url, '_blank');
        closeConvert();
        toast(`🎬 Playlist abierta (${parts[0].count} canciones)`);
      } else {
        g('convertModal').querySelector('.modal-body').innerHTML = parts.map(p => `
          <div class="conv-opt" onclick="window.open('${p.url}','_blank')">
            <div class="conv-ico" style="background:rgba(255,68,68,.12);color:var(--yt-c)">▶</div>
            <div><div class="conv-name">${escapeHtml(p.label)}</div><div class="conv-desc">${p.count} canciones</div></div>
          </div>`).join('');
        toast(`🎬 ${parts.length} playlists generadas`);
      }
    } catch (e) {
      toast('✗ Error de conexión');
    }
    return;
  }

  // CSV (spotify / soundcloud)
  try {
    const resp = await fetch('/api/convert/csv', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({indices, platform: kind}),
    });
    if (!resp.ok) {
      const data = await resp.json();
      toast('✗ ' + (data.error || 'Error'));
      return;
    }
    await downloadBlobResponse(resp, `${kind}.csv`);
    closeConvert();
    const importer = kind === 'spotify'
      ? 'https://www.tunemymusic.com/transfer'
      : 'https://soundiiz.com/transfer';
    toast(`📄 CSV generado · ${indices.length} pistas`);
    setTimeout(() => window.open(importer, '_blank'), 600);
  } catch (e) {
    toast('✗ Error de conexión');
  }
}

// ── Download ───────────────────────────────────────────────────────
async function onDownload() {
  const indices = selectedIndices();
  if (!indices.length) { toast('Selecciona al menos una'); return; }

  S.downloadActive = true;
  updateActionButtons();
  g('progwrap').classList.add('show');
  g('progfill').style.width = '0%';
  g('progtext').textContent = `Preparando descarga de ${indices.length} canciones…`;
  g('retryBtn').classList.remove('show');

  try {
    const resp = await fetch('/api/download', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({indices, format: S.format, quality: S.quality}),
    });
    const data = await resp.json();
    if (!resp.ok) {
      S.downloadActive = false;
      updateActionButtons();
      if (data.needs_ffmpeg) {
        toast('✗ FFmpeg/FFprobe no encontrados. Instálalos y añádelos al PATH.');
      } else {
        toast('✗ ' + (data.error || 'Error'));
      }
      g('progwrap').classList.remove('show');
      return;
    }
    if (data.warning) toast('⚠ ' + data.warning);
    openEvents(data.job_id);
  } catch (e) {
    S.downloadActive = false;
    updateActionButtons();
    toast('✗ Error de conexión');
  }
}

async function onRetryFailed() {
  g('retryBtn').classList.remove('show');
  S.downloadActive = true;
  updateActionButtons();
  g('progwrap').classList.add('show');
  g('progfill').style.width = '0%';
  g('progtext').textContent = 'Reintentando descargas fallidas…';
  try {
    const resp = await fetch('/api/download/retry', {method: 'POST'});
    const data = await resp.json();
    if (!resp.ok) {
      S.downloadActive = false;
      updateActionButtons();
      toast('✗ ' + (data.error || 'Error'));
      return;
    }
    openEvents(data.job_id);
  } catch (e) {
    S.downloadActive = false;
    updateActionButtons();
    toast('✗ Error de conexión');
  }
}

// ── Export M3U ─────────────────────────────────────────────────────
async function onExportM3u() {
  const indices = selectedIndices();
  if (!indices.length) { toast('Selecciona al menos una'); return; }
  try {
    const resp = await fetch('/api/export/m3u', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({indices}),
    });
    if (!resp.ok) {
      const data = await resp.json();
      toast('✗ ' + (data.error || 'Error'));
      return;
    }
    await downloadBlobResponse(resp, 'playlist.m3u');
    toast('📋 Archivo .m3u descargado');
  } catch (e) {
    toast('✗ Error de conexión');
  }
}

async function downloadBlobResponse(resp, fallbackName) {
  const blob = await resp.blob();
  let filename = fallbackName;
  const cd = resp.headers.get('Content-Disposition');
  if (cd) {
    const m = /filename="?([^"]+)"?/.exec(cd);
    if (m) filename = m[1];
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

// ── Open folder ────────────────────────────────────────────────────
async function onOpenFolder() {
  try {
    const resp = await fetch('/api/folder/open', {method: 'POST'});
    const data = await resp.json();
    if (!resp.ok) { toast('✗ ' + (data.error || 'Error')); return; }
    toast('📂 ' + data.path);
  } catch (e) {
    toast('✗ Error de conexión');
  }
}

// ── Sparkles ───────────────────────────────────────────────────────
function createSparks() {
  const c = g('sparks');
  for (let i = 0; i < 45; i++) {
    const s = document.createElement('div');
    s.className = 'sk';
    s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;` +
      `width:${1 + Math.random() * 3}px;height:${1 + Math.random() * 3}px;` +
      `animation-delay:${Math.random() * 7}s;animation-duration:${2 + Math.random() * 5}s`;
    c.appendChild(s);
  }
}
