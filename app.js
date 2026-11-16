/* PANDEMONKS · Crunch Night: shared client code (API, polling, board, cards) */

const PM = { cfg: null, state: null, v: 0, onState: null, clockAt: 0 };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);

async function apiGet(a, extra = '') {
  const r = await fetch(`api.php?a=${a}${extra}`, { cache: 'no-store' });
  return r.json();
}

let inflight = 0;
async function act(type, params = {}) {
  // one click, one action: block the buttons while the server answers
  if (inflight && !['tutorial', 'sound', 'speed'].includes(type)) return false;
  inflight++;
  document.body.classList.add('busy');
  try {
    const r = await fetch('api.php?a=act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ...params }) });
    const data = await r.json();
    if (!data.ok) { toast(data.error || 'Something went wrong'); return false; }
    setState(data.state);
    return true;
  } catch (e) { toast('No connection to the game server'); return false; }
  finally { inflight = Math.max(0, inflight - 1); if (!inflight) document.body.classList.remove('busy'); }
}

function setState(s) { PM.state = s; PM.v = s.v; PM.clockAt = Date.now(); if (PM.onState) PM.onState(s); }

async function boot(onState) {
  PM.onState = onState;
  PM.cfg = await apiGet('config');
  injectDefs();
  const loop = async () => {
    try {
      const s = await apiGet('state', `&since=${PM.v}`);
      if (s.same) { if (PM.state && typeof s.clockLeft === 'number') { PM.state.clockLeft = s.clockLeft; PM.clockAt = Date.now(); } }
      else setState(s);
    } catch (e) { /* keep polling */ }
    setTimeout(loop, 900);
  };
  loop();
}

/* filters used by coffee stains etc. */
function injectDefs() {
  if ($('#pm-defs')) return;
  const d = document.createElement('div');
  d.id = 'pm-defs';
  d.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <filter id="roughen"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="9"/></filter>
  </defs></svg>`;
  document.body.appendChild(d);
}

function clockNow() {
  const s = PM.state;
  if (!s) return 0;
  let left = s.clockLeft;
  if (s.status === 'playing' && s.clock && !s.clock.pausedAt) left -= (Date.now() - PM.clockAt) / 1000;
  return Math.max(0, Math.floor(left));
}
const fmtClock = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
/* the game clock mapped onto one office day: 09:00 until go-live at 17:30 */
function nightTime() {
  const s = PM.state;
  const total = (s && s.clock && s.clock.seconds) || ((s && s.settings && s.settings.minutes) || 45) * 60;
  const frac = Math.min(1, Math.max(0, 1 - clockNow() / total));
  const m = Math.floor(9 * 60 + frac * 510) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

let toastTimer = null;
function toast(msg) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.style.display = 'none'), 3400);
}

/* ---------- helpers ---------- */

const teamsList = (s) => Object.entries(s.teams || {}).map(([id, t]) => ({ id: String(id), ...t })).sort((a, b) => a.id - b.id);
const activeTeamId = (s) => (s.status === 'playing' ? String(s.order[s.turnIdx]) : null);
const roomOf = (card) => (card && card.startsWith('r:') ? card.slice(2).split('#')[0] : null);
const colorOfRoom = (room) => PM.cfg.rooms[room].color;
const teamColor = (id) => PM.cfg.teamColors[id] || '#fff';
function neighbours(room) {
  const out = [];
  for (const [a, b] of PM.cfg.links) { if (a === room) out.push(b); if (b === room) out.push(a); }
  return out;
}
function shapeSvg(kind, x, y, size, fill, stroke = '#000', sw = 2.5) {
  const h = size / 2;
  const st = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`;
  if (kind === 'circle') return `<circle cx="${x + h}" cy="${y + h}" r="${h}" ${st}/>`;
  if (kind === 'square') return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size / 5}" ${st}/>`;
  if (kind === 'triangle') return `<polygon points="${x + h},${y} ${x + size},${y + size} ${x},${y + size}" ${st}/>`;
  return `<polygon points="${x + h},${y} ${x + size},${y + h} ${x + h},${y + size} ${x},${y + h}" ${st}/>`;
}
function glyph(color, size = 16) {
  const c = PM.cfg.colors[color];
  return `<svg width="${size + 4}" height="${size + 4}" viewBox="-2 -2 ${size + 4} ${size + 4}" aria-hidden="true" style="vertical-align:-3px">${shapeSvg(c.shape, 0, 0, size, c.hex)}</svg>`;
}

/* ---------- board ---------- */

const OFFICES = [
  { x: 14, w: 772, label: 'HPark', bx: 30 },
  { x: 814, w: 772, label: 'AMS', bx: 1060 },
];
const ZONES = [
  { color: 'deadline', x: 30, y: 92, w: 510, h: 348 },
  { color: 'client', x: 30, y: 470, w: 510, h: 350 },
  { color: 'resources', x: 1060, y: 92, w: 510, h: 348 },
  { color: 'scope', x: 1060, y: 470, w: 510, h: 350 },
];
const STICKIES = [
  { x: 586, y: 24, r: -6, t: ['deadline =', 'yesterday'] },
  { x: 868, y: 22, r: 5, t: ['WHO TOOK MY', 'CHARGER??'] },
  { x: 566, y: 392, r: 4, t: ['it works on', 'my machine'] },
  { x: 870, y: 390, r: -5, t: ['pls wash', 'your mug', '- mgmt'], pink: true },
  { x: 580, y: 800, r: -3, t: ['v12_FINAL_', 'final2.psd'] },
  { x: 880, y: 800, r: 6, t: ['book a room,', 'not the open', 'space!!'], pink: true },
];
const STAINS = [[546, 455], [1052, 118], [1560, 868], [40, 868], [800, 640]].map(([x, y], i) => [x, y, [30, 26, 38, 28, 22][i]]);

function renderBoard(svg, s, opts = {}) {
  const cfg = PM.cfg;
  const hl = opts.highlight || new Set();
  const active = activeTeamId(s);
  const noTrains = s.effects && s.effects.notrains && (s.turnCount || 0) < s.effects.notrains;
  let o = '';
  o += `<defs>
    <pattern id="carpet" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#18161e"/><path d="M40 0H0V40" fill="none" stroke="#211e29" stroke-width="2"/></pattern>
    <pattern id="carpet2" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#1b1820"/><path d="M40 0H0V40" fill="none" stroke="#25212c" stroke-width="2"/></pattern>
    <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="rgba(255,255,255,.06)"/></pattern>
    <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="8"/></filter>
    <radialGradient id="heat"><stop offset="0" stop-color="#ff3b30" stop-opacity=".9"/><stop offset="1" stop-color="#ff3b30" stop-opacity="0"/></radialGradient>
  </defs>`;
  o += `<rect x="0" y="0" width="1600" height="900" rx="26" fill="#0e0d12" stroke="#000" stroke-width="4"/>`;
  OFFICES.forEach((of, i) => {
    o += `<rect x="${of.x}" y="14" width="${of.w}" height="872" rx="22" fill="url(#${i ? 'carpet2' : 'carpet'})" stroke="#000" stroke-width="4"/><rect x="${of.x}" y="14" width="${of.w}" height="872" rx="22" fill="url(#dots)"/>`;
    o += `<g transform="rotate(-1.5 ${of.bx} 40)"><rect x="${of.bx}" y="24" width="${of.label.length * 15 + 40}" height="40" fill="#f4eedf" stroke="#000" stroke-width="3.5"/><text x="${of.bx + 20}" y="53" font-family="Anton, Impact" font-size="26" fill="#000" letter-spacing="1">${esc(of.label.toUpperCase())}</text></g>`;
  });

  for (const z of ZONES) {
    const c = cfg.colors[z.color];
    o += `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="26" fill="${c.hex}" fill-opacity=".06" stroke="${c.hex}" stroke-opacity=".5" stroke-width="2.5" stroke-dasharray="12 9"/>`;
    const label = c.zone;
    const lx = z.x + 22, ly = z.y < 400 ? z.y - 16 : z.y + z.h - 18;
    const lw = label.length * 12.5 + 58;
    o += `<g transform="rotate(-2 ${lx} ${ly})"><rect x="${lx}" y="${ly}" width="${lw}" height="32" fill="${c.hex}" stroke="#000" stroke-width="3"/>${shapeSvg(c.shape, lx + 10, ly + 8, 16, '#000', '#000', 1)}<text x="${lx + 34}" y="${ly + 23}" font-family="Anton, Impact" font-size="19" fill="#000" letter-spacing=".5">${esc(label.toUpperCase())}</text></g>`;
    const sx = lx + lw + 30;
    o += `<text x="${sx}" y="${ly + 23}" font-family="'Permanent Marker', cursive" font-size="17" fill="${c.hex}">${esc(c.name.toLowerCase())}</text>`;
    if (s.cured && s.cured[z.color]) o += `<g transform="rotate(-6 ${z.x + z.w - 90} ${ly + 16})"><rect x="${z.x + z.w - 170}" y="${ly}" width="160" height="34" fill="#0e0d12" stroke="#7dffb2" stroke-width="3.5"/><text x="${z.x + z.w - 90}" y="${ly + 26}" text-anchor="middle" font-family="Bangers, Impact" font-size="24" fill="#7dffb2" letter-spacing="2">DEADLINE MET</text></g>`;
  }

  // walkways
  for (const [a, b, label] of cfg.links) {
    if (label === 'NS Intercity') continue;
    const A = cfg.rooms[a], B = cfg.rooms[b];
    o += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="#2e2a38" stroke-width="18" stroke-linecap="round"/>`;
  }
  for (const [a, b, label] of cfg.links) {
    if (label === 'NS Intercity') continue;
    const A = cfg.rooms[a], B = cfg.rooms[b];
    o += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="#7a7388" stroke-width="2.5" stroke-dasharray="10 10"/>`;
  }
  // the NS: a railway between the two living rooms
  const H = cfg.rooms.hlive, A = cfg.rooms.alive;
  o += `<line x1="${H.x + 90}" y1="${H.y - 8}" x2="${A.x - 90}" y2="${A.y - 8}" stroke="#c9c4d3" stroke-width="4"/><line x1="${H.x + 90}" y1="${H.y + 8}" x2="${A.x - 90}" y2="${A.y + 8}" stroke="#c9c4d3" stroke-width="4"/>`;
  for (let x = H.x + 100; x < A.x - 90; x += 16) o += `<rect x="${x}" y="${H.y - 14}" width="6" height="28" fill="#6b4226"/>`;
  o += `<g transform="rotate(-90 800 ${H.y})"><rect x="725" y="${H.y - 17}" width="150" height="34" rx="6" fill="${noTrains ? '#ff3b30' : '#ffc917'}" stroke="#000" stroke-width="3"/><text x="800" y="${H.y + 7}" text-anchor="middle" font-family="Anton, Impact" font-size="17" fill="#000" letter-spacing="1">${noTrains ? 'NO TRAINS TODAY' : 'NS · +1 ACTION'}</text></g>`;
  for (const [a, b, label] of cfg.links) {
    if (!label || label === 'NS Intercity') continue;
    const P = cfg.rooms[a], Q = cfg.rooms[b];
    const mx = (P.x + Q.x) / 2, my = P.special && Q.special ? 498 : 455;
    const w = label.length * 11 + 28;
    o += `<g transform="rotate(-4 ${mx} ${my})"><rect x="${mx - w / 2}" y="${my - 15}" width="${w}" height="30" fill="#e9e0c9" fill-opacity=".92" stroke="#000" stroke-width="2.5"/><text x="${mx}" y="${my + 7}" text-anchor="middle" font-family="'Permanent Marker', cursive" font-size="17" fill="#000">${esc(label)}</text></g>`;
  }

  for (const [x, y, r] of STAINS) o += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="rgba(150,95,45,.32)" stroke-width="7" filter="url(#rough)"/><circle cx="${x + 4}" cy="${y + 3}" r="${r - 9}" fill="none" stroke="rgba(150,95,45,.14)" stroke-width="3" filter="url(#rough)"/>`;
  for (const n of STICKIES) {
    o += `<g transform="rotate(${n.r} ${n.x + 60} ${n.y + 40})"><rect x="${n.x + 4}" y="${n.y + 6}" width="112" height="${n.t.length * 21 + 24}" fill="rgba(0,0,0,.5)"/><rect x="${n.x}" y="${n.y}" width="112" height="${n.t.length * 21 + 24}" fill="${n.pink ? '#ff9ec7' : '#ffe45c'}"/><rect x="${n.x + 30}" y="${n.y - 8}" width="52" height="16" fill="rgba(255,255,255,.45)"/>`;
    n.t.forEach((line, i) => { o += `<text x="${n.x + 10}" y="${n.y + 28 + i * 21}" font-family="'Permanent Marker', cursive" font-size="15" fill="#1a1a1a">${esc(line)}</text>`; });
    o += `</g>`;
  }

  const pawnsAt = {};
  for (const t of teamsList(s)) if (t.loc) (pawnsAt[t.loc] = pawnsAt[t.loc] || []).push(t);

  for (const [id, r] of Object.entries(cfg.rooms)) {
    const fires = (s.fires && s.fires[id]) || {};
    const hot = Object.values(fires).some((n) => n >= 3);
    const cls = ['pod', opts.onRoom ? 'clickable' : '', hl.has(id) ? 'hl' : '', hot ? 'hot' : ''].join(' ');
    o += `<g class="${cls}" data-room="${id}">`;
    if (r.special) o += r.pantry ? pantrySvg(r, pawnsAt[id] || []) : livingSvg(r);
    else o += deskSvg(r, fires, hot);
    if (s.warRooms && s.warRooms.includes(id)) {
      const bx = r.special ? r.x + 50 : r.x + 66, by = r.special ? r.y + 96 : r.y - 78;
      o += `<g transform="rotate(8 ${bx} ${by})"><rect x="${bx - 52}" y="${by - 15}" width="104" height="30" fill="#000" stroke="#ffe45c" stroke-width="2.5"/><text x="${bx}" y="${by + 7}" text-anchor="middle" font-family="Anton, Impact" font-size="17" fill="#ffe45c" letter-spacing="1.5">WAR ROOM</text></g>`;
    }
    const ps = (pawnsAt[id] || []).filter((t) => !(opts.hidePawns && opts.hidePawns.has(t.id)));
    ps.forEach((t, i) => {
      const px = r.special ? r.x - 66 + (i % 4) * 44 : r.x + 98 - i * 30;
      const py = r.special ? r.y + 12 + Math.floor(i / 4) * 40 : r.y + 54;
      if (t.id === active) o += `<circle class="active-ring" cx="${px}" cy="${py}" r="25" fill="none" stroke="#ffe45c" stroke-width="4" stroke-dasharray="7 6"/>`;
      o += `<circle cx="${px + 3}" cy="${py + 3}" r="18" fill="#000"/><circle cx="${px}" cy="${py}" r="18" fill="${teamColor(t.id)}" stroke="#000" stroke-width="3.5"/><text x="${px}" y="${py + 8}" text-anchor="middle" font-family="Anton, Impact" font-size="22" fill="#000">${t.id}</text>`;
      if (t.meditating) o += `<text x="${px + 12}" y="${py - 18}" font-family="'Permanent Marker', cursive" font-size="18" fill="#b9a6ff">ahh</text>`;
      if (t.bot) o += `<rect x="${px - 14}" y="${py + 16}" width="28" height="14" rx="3" fill="#7dffb2" stroke="#000" stroke-width="2"/><text x="${px}" y="${py + 27}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" fill="#000">CPU</text>`;
    });
    o += `<rect class="hl-ring" x="${r.x - (r.special ? 112 : 128)}" y="${r.y - (r.special ? 140 : 80)}" width="${r.special ? 224 : 256}" height="${r.special ? 256 : 160}" rx="22" fill="none" stroke="#ffe45c" stroke-width="4" stroke-dasharray="14 8"/>`;
    o += `</g>`;
  }

  svg.setAttribute('viewBox', '0 0 1600 900');
  svg.innerHTML = o;
  if (opts.onRoom) svg.querySelectorAll('.pod').forEach((g) => g.addEventListener('click', () => opts.onRoom(g.dataset.room)));
}

function deskSvg(r, fires, hot) {
  const c = PM.cfg.colors[r.color];
  const x = r.x - 115, y = r.y - 56;
  let o = '';
  if (hot) o += `<ellipse class="heat" cx="${r.x}" cy="${r.y}" rx="160" ry="100" fill="url(#heat)"/>`;
  for (const dx of [-70, 0, 70]) o += `<circle cx="${r.x + dx}" cy="${r.y - 62}" r="12" fill="#2b2833" stroke="#000" stroke-width="3"/>`;
  o += `<rect x="${x + 6}" y="${y + 6}" width="230" height="112" rx="14" fill="#000"/>`;
  o += `<rect class="desk-top" x="${x}" y="${y}" width="230" height="112" rx="14" fill="#f4eedf" stroke="#000" stroke-width="4"/>`;
  const nw = Math.min(236, r.name.length * 10.5 + 44);
  o += `<rect x="${x - 4}" y="${y - 2}" width="${nw}" height="28" fill="${c.hex}" stroke="#000" stroke-width="3" transform="rotate(-2 ${x} ${y})"/>`;
  o += `<g transform="rotate(-2 ${x} ${y})">${shapeSvg(c.shape, x + 6, y + 5, 15, '#000', '#000', 1)}<text x="${x + 28}" y="${y + 20}" font-family="Anton, Impact" font-size="17" fill="#000" letter-spacing=".3" textLength="${nw - 40}" lengthAdjust="spacingAndGlyphs">${esc(r.name.toUpperCase())}</text></g>`;
  [[x + 20, 0], [x + 88, 1], [x + 156, 2]].forEach(([mx, i]) => {
    o += `<rect x="${mx}" y="${y + 34}" width="54" height="34" rx="4" fill="#0e0d12" stroke="#000" stroke-width="3"/>`;
    o += `<rect x="${mx + 6}" y="${y + 40}" width="${[30, 38, 22][i]}" height="4" fill="${c.hex}" opacity=".85"/><rect x="${mx + 6}" y="${y + 48}" width="${[20, 14, 34][i]}" height="4" fill="#7a7388"/><rect x="${mx + 6}" y="${y + 56}" width="${[36, 26, 16][i]}" height="4" fill="#7a7388"/>`;
  });
  let tx = x + 14;
  for (const [color, n] of Object.entries(fires)) {
    const cc = PM.cfg.colors[color];
    for (let i = 0; i < n; i++) {
      o += flameSvg(tx, y + 74, cc.hex);
      tx += 30;
    }
  }
  if (tx === x + 14) for (let i = 0; i < 3; i++) o += `<circle cx="${x + 26 + i * 30}" cy="${y + 90}" r="11" fill="none" stroke="#b8ae96" stroke-width="2" stroke-dasharray="4 3"/>`;
  return o;
}

function flameSvg(x, y, hex) {
  return `<path d="M${x + 13} ${y} C ${x + 22} ${y + 9}, ${x + 27} ${y + 15}, ${x + 25} ${y + 22} C ${x + 23} ${y + 30}, ${x + 3} ${y + 30}, ${x + 1} ${y + 22} C ${x - 1} ${y + 14}, ${x + 7} ${y + 12}, ${x + 8} ${y + 5} C ${x + 11} ${y + 9}, ${x + 12} ${y + 5}, ${x + 13} ${y} Z" fill="${hex}" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/><path d="M${x + 13} ${y + 14} C ${x + 18} ${y + 19}, ${x + 18} ${y + 25}, ${x + 13} ${y + 26} C ${x + 8} ${y + 25}, ${x + 8} ${y + 20}, ${x + 13} ${y + 14} Z" fill="#fff" opacity=".7"/>`;
}

function roomFrame(r, fill) {
  const x = r.x, y = r.y;
  return `<rect x="${x - 96}" y="${y - 100}" width="200" height="214" rx="18" fill="#000"/><rect class="desk-top" x="${x - 100}" y="${y - 106}" width="200" height="212" rx="18" fill="${fill}" stroke="#000" stroke-width="4"/>`;
}
function roomLabel(r, text, fill, rot) {
  const w = Math.max(150, text.length * 11 + 30);
  return `<g transform="rotate(${rot} ${r.x} ${r.y - 122})"><rect x="${r.x - w / 2}" y="${r.y - 138}" width="${w}" height="30" fill="${fill}" stroke="#000" stroke-width="3"/><text x="${r.x}" y="${r.y - 116}" text-anchor="middle" font-family="Anton, Impact" font-size="18" fill="#000" letter-spacing="1">${esc(text.toUpperCase())}</text></g>`;
}
function livingSvg(r) {
  const x = r.x, y = r.y;
  let o = roomFrame(r, '#2a2533');
  o += `<ellipse cx="${x}" cy="${y + 14}" rx="84" ry="52" fill="#3a3346" stroke="#000" stroke-width="2.5"/>`;
  o += `<rect x="${x - 82}" y="${y - 92}" width="164" height="38" rx="10" fill="#c8915e" stroke="#000" stroke-width="3"/><line x1="${x - 27}" y1="${y - 88}" x2="${x - 27}" y2="${y - 58}" stroke="#000" stroke-width="2"/><line x1="${x + 27}" y1="${y - 88}" x2="${x + 27}" y2="${y - 58}" stroke="#000" stroke-width="2"/>`;
  o += `<rect x="${x - 60}" y="${y + 80}" width="120" height="12" fill="#e9e0c9" stroke="#000" stroke-width="2.5"/>`;
  o += `<circle cx="${x + 78}" cy="${y - 80}" r="14" fill="#3fbf6b" stroke="#000" stroke-width="3"/><circle cx="${x + 70}" cy="${y - 72}" r="9" fill="#2f9e55" stroke="#000" stroke-width="2"/>`;
  o += roomLabel(r, r.name, '#f4eedf', -2);
  return o;
}
function pantrySvg(r, here) {
  const x = r.x, y = r.y;
  let o = roomFrame(r, '#2a2620');
  o += `<rect x="${x - 88}" y="${y - 94}" width="176" height="40" rx="6" fill="#d9cfb6" stroke="#000" stroke-width="3"/>`;
  o += `<rect x="${x - 82}" y="${y - 104}" width="40" height="56" rx="6" fill="#1a1a1a" stroke="#000" stroke-width="3"/><circle cx="${x - 62}" cy="${y - 90}" r="5" fill="#ff3b30"/>`;
  for (let i = 0; i < 4; i++) o += `<rect x="${x - 28 + i * 28}" y="${y - 86}" width="18" height="22" rx="4" fill="${['#ff2e88', '#22d3ee', '#ffd400', '#ff6b35'][i]}" stroke="#000" stroke-width="2.5"/>`;
  const zen = here.some((t) => t.meditating);
  o += `<ellipse cx="${x}" cy="${y + 20}" rx="80" ry="40" fill="${zen ? '#b9a6ff' : '#3a3346'}" stroke="#000" stroke-width="3"/>`;
  o += `<text x="${x}" y="${y + 92}" text-anchor="middle" font-family="'Permanent Marker', cursive" font-size="14" fill="${zen ? '#b9a6ff' : '#8c84a0'}">${zen ? 'chair massage in progress' : 'massage chair + crackers'}</text>`;
  o += roomLabel(r, r.name, '#c8915e', 2);
  return o;
}

/* ---------- cards ---------- */

function deskIcon(hex) {
  return `<svg width="110" height="44" viewBox="0 0 110 44" aria-hidden="true"><rect x="4" y="10" width="102" height="30" rx="5" fill="#f4eedf" stroke="#000" stroke-width="3"/><rect x="14" y="2" width="26" height="18" rx="2" fill="#0e0d12" stroke="#000" stroke-width="2.5"/><rect x="44" y="2" width="26" height="18" rx="2" fill="#0e0d12" stroke="#000" stroke-width="2.5"/><rect x="74" y="2" width="26" height="18" rx="2" fill="#0e0d12" stroke="#000" stroke-width="2.5"/><rect x="18" y="7" width="14" height="3" fill="${hex}"/><rect x="48" y="7" width="18" height="3" fill="${hex}"/><rect x="78" y="7" width="10" height="3" fill="${hex}"/></svg>`;
}
function cupIcon(size = 70) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 70 70" aria-hidden="true"><path d="M22 10 q4 -6 0 -10 M34 10 q4 -6 0 -10 M46 10 q4 -6 0 -10" stroke="#ffe0b8" stroke-width="3" fill="none" transform="translate(0 6)"/><rect x="12" y="22" width="40" height="34" rx="6" fill="#f4eedf" stroke="#000" stroke-width="3.5"/><path d="M52 30 h6 a8 8 0 0 1 0 16 h-6" fill="none" stroke="#000" stroke-width="3.5"/><rect x="16" y="26" width="32" height="7" fill="#6b4226"/><ellipse cx="32" cy="60" rx="28" ry="5" fill="#000" opacity=".5"/></svg>`;
}

function cardHTML(card, size = '', extra = '') {
  const html = cardHTMLInner(card, size, extra);
  if (!PM.help || typeof helpKeyForCard !== 'function') return html;
  return html.replace(/^(<div class="card[^"]*"[^>]*>)/, `$1<button type="button" class="help oncard" data-help="${helpKeyForCard(card)}" aria-label="What does this card do?" title="What does this card do?">?</button>`);
}
function cardHTMLInner(card, size = '', extra = '') {
  const cfg = PM.cfg;
  if (card === 'friday') return `<div class="card friday ${size}"><div class="kind">Epidemic <span>!!!</span></div><div class="name">Friday 17:00</div><div class="sub">The client sends "small" feedback. Crisis rate up, one room takes 3 fires, old crises come back.</div>${extra}</div>`;
  if (card.startsWith('crash:')) {
    const t = PM.state && PM.state.teams ? PM.state.teams[card.slice(6)] : null;
    return `<div class="card crash ${size}"><div class="kind">Caffeine crash <span>ahh</span></div><div class="name">Crash</div><div class="sub">${esc(t ? t.name : 'A team')} is sent to a chair massage in the pantry and skips a turn.</div><div class="art" style="background:#d9ceff">${cupIcon(54)}</div>${extra}</div>`;
  }
  if (card.startsWith('n:')) {
    const n = cfg.news[card.slice(2)];
    const id = card.slice(2);
    const last = (PM.state && PM.state.newsText && PM.state.newsText[id]) || (PM.state && PM.state.lastNews && PM.state.lastNews.id === id ? PM.state.lastNews.text : n[1].replace('%s', 'an exotic location'));
    return `<div class="card news ${size}"><div class="bar"><span>BREAKING</span><span>#nl-monk-news</span></div><div class="name">${esc(n[0])}</div><div class="sub">${esc(last)}</div>${extra}</div>`;
  }
  if (card.startsWith('x:')) {
    const [name, plus, crash, line] = cfg.espresso[card.slice(2)];
    return `<div class="card espresso ${size}"><div class="kind">Espresso <span>HOT</span></div><div class="name">${esc(name)}</div><div class="sub">${esc(line)}</div><div class="stats"><span>+${plus} act</span><span class="bad">${crash} crash</span></div>${extra}</div>`;
  }
  if (card.startsWith('e:')) {
    const e = cfg.events[card.slice(2)];
    return `<div class="card event ${size}"><div class="kind">Event <span>★</span></div><div class="name">${esc(e.name)}</div><div class="sub">${esc(e.text)}</div>${extra}</div>`;
  }
  const raw = card.slice(2);
  const [room, idx] = raw.split('#');
  const r = cfg.rooms[room];
  const c = cfg.colors[r.color];
  if (idx !== undefined) {
    const num = (room.length * 731 + Number(idx) * 97) % 9000 + 1000;
    return `<div class="card incident ${size}"><div class="bar"><span>INC-${num}</span><span>SEV-1</span></div><div class="name">${esc(r.crises[Number(idx)])}</div><div class="foot">${glyph(r.color, 14)} ${esc(r.name)} +1 fire</div>${extra}</div>`;
  }
  return `<div class="card ${size}"><div class="tape" style="background:${c.hex}"></div><div class="kind"><span>Room card</span>${glyph(r.color, 14)}</div><div class="name">${esc(r.name)}</div><div class="sub">${esc(c.zone)} · ${esc(c.name)}</div><div class="art">${deskIcon(c.hex)}</div>${extra}</div>`;
}

function roleHTML(roleId) {
  const r = PM.cfg.roles[roleId];
  if (!r) return '';
  return `<div class="paper rolecard" style="padding:14px 16px"><div class="kicker" style="color:#6a6258">${esc(r.tag)}</div><div class="head">${esc(r.name)}${PM.help && typeof helpBtn === 'function' ? ' ' + helpBtn('role|' + roleId) : ''}</div><p>${esc(r.text)}</p><div class="accent"><span class="chip">${esc(r.accent)}</span><b>${esc(r.accentName)}</b></div><p class="hand">${esc(r.talk)}</p></div>`;
}

function stressHTML(n, max) {
  return `<span class="cups" title="Stress ${n}/${max}">${Array.from({ length: max }, (_, i) => `<span class="cup ${i < n ? 'on' : ''}"></span>`).join('')}</span>`;
}

const SLACK_AV = { Client: '#ff6b35', Reception: '#ff9ec7', 'Studio Lead': '#ffe45c', 'Lunch Team': '#c8915e', IT: '#22d3ee', 'Timesheet Inspector': '#b9a6ff', Monkbot: '#7dffb2' };
function slackHTML(log, n = 14) {
  return (log || []).slice(-n).reverse().map((l) => {
    const from = l.from || 'Monkbot';
    const t = new Date(l.t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div class="msg ${l.kind}"><div class="av" style="background:${SLACK_AV[from] || '#ccc'}">${esc(from.split(' ').map((w) => w[0]).join('').slice(0, 2))}</div><div><div class="who">${esc(from)}<span class="mono">${t}</span></div><div class="txt">${esc(l.text)}</div></div></div>`;
  }).join('');
}

/* ---------- modal ---------- */

function modal(title, bodyHTML, onMount) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.id = 'modal';
  bg.innerHTML = `<div class="modal" role="dialog" aria-label="${esc(title)}"><div class="row" style="justify-content:space-between;align-items:flex-start"><h2>${esc(title)}</h2><button class="small" data-close>Close</button></div>${bodyHTML}</div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.hasAttribute('data-close')) closeModal(); });
  document.body.appendChild(bg);
  if (onMount) onMount(bg);
  return bg;
}
function closeModal() { const m = $('#modal'); if (m) m.remove(); }

function roomOptions(selected = '', podsOnly = false) {
  return Object.values(PM.cfg.rooms).filter((r) => !podsOnly || !r.special).map((r) => `<option value="${r.id}"${r.id === selected ? ' selected' : ''}>${esc(r.name)}</option>`).join('');
}
function teamOptions(s, selected = '') {
  return teamsList(s).map((t) => `<option value="${t.id}"${t.id === selected ? ' selected' : ''}>${t.id} · ${esc(t.name)}</option>`).join('');
}

/* ---------- how-to-play slides (big screen only, the GM clicks through) ---------- */
const TUTORIAL = [
  {
    kicker: 'Welcome to', title: 'Pandemonks',
    body: () => `<div class="tl"><p class="big">It is <b>09:00</b> at HPark and AMS. The site goes live at <b>17:30</b>, right before the borrel.</p><p>Four teams, one big problem: fires keep breaking out across both offices. Work together, put them out and meet <b>four deadlines</b> before go-live.</p><p class="hand">You win together. You lose together.</p></div>
      <div class="tr"><div class="lcd" style="font-size:90px">09:00</div><div class="sticky" style="font-size:24px;margin-top:30px;transform:rotate(3deg)">Go-live 17:30. Borrel 17:31.</div></div>`,
  },
  {
    kicker: 'Step 1', title: 'The board',
    body: (cfg) => `<div class="tl"><p class="big">Two offices, four zones, sixteen rooms.</p><ul>${Object.values(cfg.colors).map((c) => `<li>${glyph(Object.keys(cfg.colors).find((k) => cfg.colors[k] === c), 22)} <b>${esc(c.zone)}</b>: ${esc(c.name)} fires</li>`).join('')}</ul><p>Each office has a <b>Living Room</b> (a War Room) and a <b>pantry</b>.</p></div>
      <div class="tr"><div class="gtrain" style="font-size:40px;padding:16px 30px"><span>NS</span><b style="background:#fff;width:46px;height:46px;font-size:24px">+1</b></div><p class="hand" style="font-size:28px;margin-top:24px;text-align:center">Changing office takes the train:<br>1 extra action.</p></div>`,
  },
  {
    kicker: 'Step 2', title: 'This screen', wide: true,
    body: () => `<div class="tl small"><ol class="legend">
      <li><b>Now on shift</b>: whose turn it is and how many actions are left</li>
      <li><b>The board</b>: both offices, every fire, every team pawn. Moves and fires play out here</li>
      <li><b>Office clock</b>: 09:00 to go-live at 17:30, plus the real minutes left</li>
      <li><b>Escalations and crisis inbox</b>: how close the client is to pulling the plug</li>
      <li><b>Deadlines</b>: which ones are met and how many fires are left in stock</li>
      <li><b>Breaking news</b> that is active right now</li>
      <li><b>Teams</b>: role, location, stress and cards in hand</li>
      <li><b>#nl-monk-news</b>: everything that just happened</li></ol></div>
      <div class="tr"><div class="wire wscreen">
        <div class="w-head"><span class="w-logo">PANDEMONKS</span><span class="w-box w-shift"><i>1</i>Now on shift</span></div>
        <div class="w-board"><svg class="board" data-demo="1"></svg><i>2</i></div>
        <div class="w-side">
          <div class="w-box"><i>3</i><span class="lcdmini">09:00</span></div>
          <div class="w-box"><i>4</i>Escalations · inbox<div class="w-meter"><b></b><b></b><b></b></div></div>
          <div class="w-box"><i>5</i>Deadlines</div>
          <div class="w-box w-news"><i>6</i>Breaking news</div>
          <div class="w-box"><i>7</i>Teams</div>
          <div class="w-box w-slack"><i>8</i># nl-monk-news</div>
        </div></div></div>`,
    after: demoBoard,
  },
  {
    kicker: 'Step 3', title: 'Your laptop', wide: true,
    body: (cfg) => `<div class="tl small"><ol class="legend">
      <li><b>The board</b>: on your turn, rooms you can reach <b>glow</b>. Click one to move there</li>
      <li><b>Turn box</b>: your actions left and the button for the next step</li>
      <li><b>Stress and espresso</b>: bonus actions, at a risk</li>
      <li><b>Project dashboard</b>: update it, or hand over</li>
      <li><b>Your room</b>: put out fires, open a War Room, trade with teams in the same room, meet a deadline</li>
      <li><b>Your hand</b>: room cards and events. Max ${cfg.handLimit}. Describe them, never show them</li>
      <li><b>Your role</b>: your special power and your accent</li></ol></div>
      <div class="tr"><div class="wire wlaptop">
        <div class="w-head"><span class="w-team">★</span><span>Your team name</span><span class="lcdmini" style="margin-left:auto">09:00</span></div>
        <div class="w-board"><svg class="board" data-demo="2"></svg><i>1</i></div>
        <div class="w-side">
          <div class="w-box w-turn"><i>2</i>Your turn · 4 actions</div>
          <div class="w-box"><i>3</i>Stress · espresso</div>
          <div class="w-box"><i>4</i>Project dashboard</div>
          <div class="w-box w-tall"><i>5</i>You are in: Lotus Lair</div>
          <div class="w-box w-cards"><i>6</i>Your hand <span class="w-card"></span><span class="w-card"></span><span class="w-card"></span></div>
          <div class="w-box"><i>7</i>Your role</div>
        </div></div></div>`,
    after: demoBoard,
  },
  {
    kicker: 'Step 4', title: 'Your turn',
    body: () => `<div class="tl"><ol class="steps"><li><b>Talk for a minute</b>, then do <b>4 actions</b> on your laptop.</li><li><b>Draw 2 project cards.</b> Keep them secret.</li><li><b>Flip the crisis cards.</b> New fires appear on the board.</li></ol><p>Then the next team is up. Watch this screen: everything that happens plays out here.</p></div>
      <div class="tr"><div class="pips big" style="gap:14px"><span class="pip on" style="width:56px;height:56px"></span><span class="pip on" style="width:56px;height:56px"></span><span class="pip on" style="width:56px;height:56px"></span><span class="pip on" style="width:56px;height:56px"></span></div><p class="hand" style="font-size:30px;margin-top:20px">4 actions per turn</p></div>`,
  },
  {
    kicker: 'Step 5', title: 'What you can do',
    body: () => `<div class="tl"><div class="actgrid">
      <div><b>Walk</b> to a connected room</div><div><b>DM</b>: discard a room card, go there</div>
      <div><b>All-hands</b>: discard the card of your room, go anywhere</div><div><b>War Room hop</b> between two War Rooms</div>
      <div><b>Put out a fire</b> in your room</div><div><b>Open a War Room</b> with the card of your room</div>
      <div><b>Trade</b> the card of the room you share with a team</div><div><b>Meet a deadline</b>: 3 cards of one colour in a War Room</div>
    </div></div>
      <div class="tr">${cardHTML('r:lotus', 'big')}</div>`,
  },
  {
    kicker: 'Step 6', title: 'Fires and escalations',
    body: () => `<div class="tl"><p class="big">A room holds <b>3 fires</b> at most.</p><p>A 4th fire <b>escalates to the client</b> and spreads to every connected room. That can chain.</p><p><b>6 escalations</b> and the client pulls the plug. Game over.</p><p>Watch out for <b>Friday 17:00</b>: the client sends "small" feedback, things speed up and old crises come back.</p></div>
      <div class="tr">${cardHTML('r:dojo#0', 'big')}</div>`,
  },
  {
    kicker: 'Step 7', title: 'Breaking news',
    body: () => `<div class="tl"><p class="big">Every round, something happens in #nl-monk-news.</p><p>No trains. No internet in AMS. Thomas stuck abroad with the approvals. Sir Martin wants everyone in AMS. Deal with it together.</p></div>
      <div class="tr">${cardHTML('n:notrains', 'big')}</div>`,
  },
  {
    kicker: 'Step 8', title: 'The handover',
    body: (cfg) => `<div class="tl"><p class="big">Keep your project dashboard up to date.</p><p>Updating it costs <b>1 action</b>. Do it at least <b>every other turn</b>.</p><p>Forget it, and someone else has to cover for you: your team loses <b>${cfg.handoverCost} actions</b> next turn and the next team gets <b>+${cfg.handoverGift}</b> right away. The rest disappears into a status call.</p><p class="hand">The Timesheet Inspector is watching.</p></div>
      <div class="tr"><div class="handover"><div class="hb"><div class="badge" style="background:${teamColor('1')}">1</div><div class="bigdebt">-${cfg.handoverCost}</div><span>forgot it</span></div><svg class="harrow" viewBox="0 0 120 60" width="140" height="70"><path d="M6 30 H88 M70 10 L102 30 L70 50" fill="none" stroke="#000" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"/><path d="M6 30 H88 M70 10 L102 30 L70 50" fill="none" stroke="#ffe45c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="hb"><div class="badge" style="background:${teamColor('2')}">2</div><div class="bigdebt plus">+${cfg.handoverGift}</div><span>covers</span></div></div></div>`,
  },
  {
    kicker: 'Step 9', title: 'Espresso',
    body: () => `<div class="tl"><p class="big">Need more actions? Pull an espresso.</p><p>Once per turn, for free: you get <b>0 to 4 bonus actions</b>, but crash cards get hidden in the crisis deck. When your crash comes up, your team goes to a <b>chair massage</b> in the pantry and skips a turn.</p><p>Matcha never crashes. Decaf does nothing. Someone swapped the beans.</p></div>
      <div class="tr">${cardHTML('x:double', 'big')}</div>`,
  },
  {
    kicker: 'Step 10', title: 'House rules',
    body: () => `<div class="tl"><ol class="steps"><li><b>Hands stay hidden.</b> Describe your cards, never show your laptop.</li><li><b>The team on turn decides.</b> Everyone else may advise once, then lets go.</li><li>Every team gets a <b>role</b> with a special power and an <b>accent</b>. French, Dutch, very British, extremely American, Italian or Russian. Keep it up all game.</li><li><b>Eyes on this screen.</b> Laptops are for your hand and your buttons.</li><li>Forgot your dashboard? Another team covers. No cookies needed.</li></ol></div>
      <div class="tr"><div class="sticky" style="font-size:30px;width:340px;transform:rotate(-3deg)">Rule #1: describe your cards. Never show them.</div></div>`,
  },
  {
    kicker: 'Ready?', title: 'It is 09:00',
    body: () => `<div class="tl"><p class="big">Roles and cards go out the moment the Game Master presses <b>Let's go</b>.</p><p>Laptops at the ready. Coffee in hand. Dashboards... updated?</p></div>
      <div class="tr"><div class="shout" style="font-size:150px;color:#7dffb2;-webkit-text-stroke:3px #000;text-shadow:8px 8px 0 #000;transform:rotate(-4deg)">GO!</div></div>`,
  },
];

/* a small demo board for the how-to-play slides */
function demoBoard(root) {
  const cfg = PM.cfg;
  const ids = Object.keys(cfg.rooms).filter((id) => !cfg.rooms[id].special);
  const fires = {};
  for (const id of ids) fires[id] = Object.fromEntries(Object.keys(cfg.colors).map((c) => [c, 0]));
  [[0, 1], [3, 2], [5, 3], [9, 1], [12, 2], [14, 1]].forEach(([i, n]) => { const id = ids[i % ids.length]; fires[id][cfg.rooms[id].color] = n; });
  const demo = { fires, warRooms: ['hlive', 'alive'], cured: {}, effects: {}, turnCount: 1,
    teams: { 1: { id: '1', name: 'Team 1', loc: 'hlive' }, 2: { id: '2', name: 'Team 2', loc: 'hlive' }, 3: { id: '3', name: 'Team 3', loc: 'alive' }, 4: { id: '4', name: 'Team 4', loc: ids[3] } } };
  root.querySelectorAll('svg[data-demo]').forEach((svg) => {
    const hl = svg.dataset.demo === '2' ? new Set(Object.keys(cfg.rooms).filter((id) => (cfg.links || []).some((l) => (l[0] === 'hlive' && l[1] === id) || (l[1] === 'hlive' && l[0] === id)))) : new Set();
    try { renderBoard(svg, demo, { highlight: hl }); } catch (e) { /* demo only */ }
  });
}
