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

  initMagnetic();
  initRipples();
  initCoverTilt();
  initFxCanvas();
  window.addEventListener('resize', resizeConfettiCanvas);
  resizeConfettiCanvas();
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
    g('scid').dataset.masked = cfg.client_id || '';
    g('scs').dataset.masked = cfg.client_secret || '';
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
  const body = { download_dir: g('dpath').value.trim() };
  const cid = g('scid').value.trim();
  const cs = g('scs').value.trim();
  // Solo enviamos las credenciales si el usuario las ha tocado; si el
  // campo sigue mostrando el placeholder enmascarado, conservamos la
  // credencial guardada en el servidor sin reenviarla.
  if (cid !== (g('scid').dataset.masked || '')) body.client_id = cid;
  if (cs !== (g('scs').dataset.masked || '')) body.client_secret = cs;
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
      (S.justDownloaded ||= []).push(msg.index);
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
      if (msg.ok > 0) {
        confettiBurst();
        saveDownloadedFiles(S.justDownloaded || []);
      }
      S.justDownloaded = [];
      es.close();
      break;
  }
}

// ── Rendering ──────────────────────────────────────────────────────
function renderPlaylistHeader() {
  const k = S.currentSourceLabel = PLAT_KEY();
  const p = PLAT[S.lastKind] || {name: 'Música', color: '#8b5cf6'};
  g('pname').textContent = S.playlistName || 'Playlist';
  const totalMs = S.tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
  const durPart = totalMs ? ` · ${fmtDurationLong(totalMs)}` : '';
  g('pinfo').innerHTML = `<span style="color:${p.color};font-weight:500">${p.name}</span> · ${S.tracks.length} canciones${durPart}`;
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
  const filterInput = g('trackFilter');
  if (filterInput) filterInput.value = '';
  const count = g('trackFilterCount');
  if (count) count.textContent = '';
}

function filterTracks(query) {
  const q = query.trim().toLowerCase();
  const rows = document.querySelectorAll('#tlist .ti');
  let shown = 0;
  rows.forEach(row => {
    const i = parseInt(row.dataset.idx, 10);
    const t = S.tracks[i];
    const hay = `${t.name} ${t.artists}`.toLowerCase();
    const match = !q || hay.includes(q);
    row.style.display = match ? '' : 'none';
    if (match) shown++;
  });
  const count = g('trackFilterCount');
  if (count) count.textContent = q ? `${shown} / ${rows.length}` : '';
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

function fmtDurationLong(ms) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
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

async function copyYoutubeLinks() {
  const indices = selectedIndices();
  if (!indices.length) { toast('Selecciona al menos una canción con coincidencia'); return; }
  const links = indices.map(i => {
    const yt = S.tracks[i].youtube;
    return yt.url || (yt.id ? `https://youtu.be/${yt.id}` : null);
  }).filter(Boolean);
  if (!links.length) { toast('Sin enlaces de YouTube disponibles'); return; }
  try {
    await navigator.clipboard.writeText(links.join('\n'));
    toast(`🔗 ${links.length} enlace${links.length === 1 ? '' : 's'} copiado${links.length === 1 ? '' : 's'}`);
  } catch (e) {
    toast('✗ No se pudo copiar (permiso de portapapeles)');
  }
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

// ── Library ────────────────────────────────────────────────────────
async function openLibrary() {
  g('lov').classList.add('open');
  g('libModal').classList.add('open');
  const body = g('libBody');
  body.innerHTML = '<div class="lib-empty">Cargando…</div>';
  try {
    const resp = await fetch('/api/library');
    const data = await resp.json();
    if (!resp.ok) { body.innerHTML = `<div class="lib-empty">✗ ${escapeHtml(data.error || 'Error')}</div>`; return; }
    g('libSub').textContent = data.base_dir;
    if (!data.playlists.length) {
      body.innerHTML = '<div class="lib-empty">Todavía no hay playlists descargadas.</div>';
      return;
    }
    body.innerHTML = data.playlists.map(p => `
      <div class="conv-opt lib-item" onclick="openLibFolder('${p.name.replace(/'/g, "\\'")}')">
        <div class="lib-info">
          <div class="conv-ico" style="background:rgba(139,92,246,.12);color:var(--violet-l)">🎵</div>
          <div>
            <div class="lib-name">${escapeHtml(p.name)}</div>
            <div class="lib-meta">${p.tracks} pista${p.tracks === 1 ? '' : 's'} · ${p.size_mb} MB</div>
          </div>
        </div>
        <span class="lib-open">📂</span>
      </div>`).join('');
  } catch (e) {
    body.innerHTML = '<div class="lib-empty">✗ Error de conexión</div>';
  }
}
function closeLibrary() {
  g('lov').classList.remove('open');
  g('libModal').classList.remove('open');
}
async function openLibFolder(name) {
  try {
    const resp = await fetch('/api/library/open', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name}),
    });
    const data = await resp.json();
    if (!resp.ok) toast('✗ ' + (data.error || 'Error'));
  } catch (e) {
    toast('✗ Error de conexión');
  }
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
  S.justDownloaded = [];
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
  S.justDownloaded = [];
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

// ── Save-As para audios descargados ──────────────────────────────────
// Dispara el diálogo "Guardar como" del navegador para los archivos que
// el servidor acaba de descargar a disco: uno solo → descarga directa,
// varios → empaquetados en un .zip.
async function saveDownloadedFiles(indices) {
  if (!indices.length) return;
  try {
    if (indices.length === 1) {
      const resp = await fetch(`/api/download/file/${indices[0]}`);
      if (!resp.ok) return;
      await downloadBlobResponse(resp, 'audio');
    } else {
      const resp = await fetch('/api/download/zip', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({indices}),
      });
      if (!resp.ok) return;
      await downloadBlobResponse(resp, 'playlist.zip');
    }
  } catch (e) { /* descarga silenciosa, no crítica */ }
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

// ── Magnetic buttons ───────────────────────────────────────────────
// Tracks the pointer over the primary action buttons so their glow
// (driven by --mx/--my in CSS) follows the cursor.
function initMagnetic() {
  if (prefersReducedMotion()) return;
  document.querySelectorAll('.sbtn').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      btn.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });
}

// ── Ripple clicks ──────────────────────────────────────────────────
function initRipples() {
  document.addEventListener('click', (e) => {
    if (prefersReducedMotion()) return;
    const btn = e.target.closest('.sbtn,.abtn,.fqp,.conv-opt,.cand,.dico,.save-btn,.dclose,.sett-btn,.retry-btn');
    if (!btn || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
    const prevOverflow = getComputedStyle(btn).overflow;
    if (prevOverflow === 'visible') btn.style.overflow = 'hidden';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), {once: true});
  });
}

// ── Playlist cover tilt ────────────────────────────────────────────
function initCoverTilt() {
  if (prefersReducedMotion()) return;
  const cover = g('pcov');
  const card = cover?.closest('.ph');
  if (!cover || !card) return;
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    cover.style.transform = `perspective(400px) rotateX(${-py * 22}deg) rotateY(${px * 22}deg) scale(1.06)`;
  });
  card.addEventListener('mouseleave', () => { cover.style.transform = ''; });
}

// ── Confetti celebration ───────────────────────────────────────────
function resizeConfettiCanvas() {
  const c = g('confetti');
  if (!c) return;
  c.width = window.innerWidth;
  c.height = window.innerHeight;
}
function confettiBurst() {
  if (prefersReducedMotion()) return;
  const canvas = g('confetti');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  resizeConfettiCanvas();
  const colors = ['#8b5cf6', '#ec4899', '#fb923c', '#22d3ee', '#4ade80', '#fbbf24'];
  const pieces = Array.from({length: 140}, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.4,
    w: 5 + Math.random() * 6,
    h: 4 + Math.random() * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 3,
    rot: Math.random() * 360,
    vr: (Math.random() - 0.5) * 12,
  }));
  let frame = 0;
  const maxFrames = 150;
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame++;
    if (frame < maxFrames) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  })();
}

// ── Interactive background field ───────────────────────────────────
// "Aurora ink" — a small flock of fat, glowing ribbons that drift across
// the screen, each trailing a short fading tail of its own colour. The
// canvas is fully cleared every frame (so nothing lingers or smears), the
// whole field gently flows toward the cursor and whips into a tight
// vortex around it, and the glowing "light" heads breathe smoothly
// in/out rather than popping in and out.
const FX_COLORS = ['#8b5cf6', '#ec4899', '#fb923c', '#22d3ee', '#34d399'];
const FX_CURSOR_RADIUS = 340;
const FX_TRAIL_LEN = 14;
const FX_FADE_FRAMES = 45;

function initFxCanvas() {
  if (prefersReducedMotion()) return;
  const canvas = g('fx');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const mouse = {x: -9999, y: -9999};
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

  let particles = [];
  function makeParticle() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      life: 0,
      maxLife: 220 + Math.random() * 280,
      color: FX_COLORS[Math.floor(Math.random() * FX_COLORS.length)],
      width: 2 + Math.random() * 3.5,
      trail: [],
      sparklePhase: Math.random() * Math.PI * 2,
      sparkleSpeed: 0.015 + Math.random() * 0.025,
    };
  }
  function spawnParticles() {
    const area = window.innerWidth * window.innerHeight;
    const count = Math.min(110, Math.max(45, Math.round(area / 16000)));
    particles = Array.from({length: count}, makeParticle);
  }
  resizeFxCanvas();
  spawnParticles();

  let running = true;
  let raf = null;
  let t = 0;
  function frame() {
    if (!running) return;
    t += 0.0032;

    // Fully clear every frame — no accumulated residue or smear.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    const hasMouse = mouse.x > -9000;

    for (const p of particles) {
      // Smooth curling flow field — gives every ribbon a unique drifting path.
      const angle = Math.sin(p.x * 0.0022 + t) * Math.PI
                   + Math.cos(p.y * 0.0019 - t * 1.3) * Math.PI;
      let vx = Math.cos(angle) * 0.7, vy = Math.sin(angle) * 0.7;

      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const dist = Math.hypot(dx, dy);
      if (hasMouse && dist > 0.01) {
        // Tight vortex right around the cursor.
        if (dist < FX_CURSOR_RADIUS) {
          const swirl = (1 - dist / FX_CURSOR_RADIUS) * 2.6;
          vx += (-dy / dist) * swirl;
          vy += (dx / dist) * swirl;
        }
        // Gentle pull toward the cursor across the whole field, so the
        // ribbons follow it around the page, not just react locally.
        const pull = Math.min(0.6, 50000 / (dist * dist + 4000));
        vx += (-dx / dist) * pull;
        vy += (-dy / dist) * pull;
      }

      p.x += vx; p.y += vy;
      p.trail.push({x: p.x, y: p.y});
      if (p.trail.length > FX_TRAIL_LEN) p.trail.shift();

      const near = hasMouse ? Math.max(0, 1 - dist / FX_CURSOR_RADIUS) : 0;

      // Fade in over the first frames of life and fade out over the last
      // ones, so respawns never pop in/out abruptly.
      const lifeFade = Math.min(1, p.life / FX_FADE_FRAMES,
                                 (p.maxLife - p.life) / FX_FADE_FRAMES);

      // Draw the trail as a short ribbon that tapers and dims toward its tail.
      for (let i = 1; i < p.trail.length; i++) {
        const a = p.trail[i - 1], b = p.trail[i];
        const f = i / p.trail.length; // 0 (tail) → 1 (head)
        ctx.strokeStyle = hexToRgba(p.color, (0.07 + near * 0.28) * f * lifeFade);
        ctx.lineWidth = p.width * (0.3 + f * 0.7) + near * 3.2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Glowing "light" head — brightness rises smoothly with cursor
      // proximity, plus a slow ambient pulse so lights breathe in/out.
      const pulse = (Math.sin(p.life * p.sparkleSpeed + p.sparklePhase) * 0.5 + 0.5) ** 3;
      const glow = Math.max(near, pulse * 0.45) * lifeFade;
      if (glow > 0.05) {
        ctx.save();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4 + glow * 12;
        ctx.fillStyle = hexToRgba(p.color, (0.25 + glow * 0.5) * lifeFade);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.width * 0.5 + glow * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      p.life++;
      if (p.x < -10 || p.x > canvas.width + 10 || p.y < -10 || p.y > canvas.height + 10
          || p.life > p.maxLife) {
        Object.assign(p, makeParticle());
      }
    }

    raf = requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running && !raf) frame();
    else if (!running && raf) { cancelAnimationFrame(raf); raf = null; }
  });

  window.addEventListener('resize', () => { resizeFxCanvas(); spawnParticles(); });

  frame();
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function resizeFxCanvas() {
  const c = g('fx');
  if (!c) return;
  c.width = window.innerWidth;
  c.height = window.innerHeight;
}
