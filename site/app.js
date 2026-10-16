// SnowPump site: wallet connect, play flow, HUD, cash out.
import { createArena } from './game.js';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gt = (el, text) => { if (el.textContent !== text) { el.textContent = text; el.dataset.t = text; } };
let tT = 0; const toast = (m) => { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tT); tT = setTimeout(() => t.classList.remove('on'), 2400); };
const store = { get(k, d) { try { const v = localStorage.getItem('snowpump.' + k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem('snowpump.' + k, JSON.stringify(v)); } catch (_) { } } };
const CFG = window.SNOWPUMP || {};   // { ca, live, x, discord, pumpfun } set at build time from site/config.json

const arena = createArena($('arena'), $('tags'), { bots: 15 });
arena.setMap($('map'));
document.querySelectorAll('#cmin,.cminT').forEach((e) => { e.textContent = arena.CASH_MIN; });
const money = arena.money;

// ---------------- wallet ----------------
const W = { list: [], w: null, acc: null, addr: '', ph: null };
const addW = (w) => { if (!w || !w.features || !(w.chains || []).some((c) => String(c).startsWith('solana:')) || !w.features['standard:connect']) return; if (W.list.some((x) => x.name === w.name)) return; W.list.push(w); };
try { addEventListener('wallet-standard:register-wallet', (e) => { try { e.detail({ register: addW }); } catch (_) { } }); dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: { register: addW } })); } catch (_) { }
const short = (a) => a.slice(0, 4) + '…' + a.slice(-4);
function setAddr(a, w) { W.addr = a; $('wBtn').innerHTML = (w && w.icon ? `<img src="${w.icon}" alt="">` : '') + short(a); store.set('wallet', w ? w.name : 'Phantom'); }
let afterConnect = null;
function pop(html) { $('popC').innerHTML = html; $('pop').classList.add('on'); }
const close = () => $('pop').classList.remove('on');
$('pop').addEventListener('click', (e) => { if (e.target === $('pop') && !arena.playing) close(); });
function openWallets(then) {
  afterConnect = then || null;
  const opts = W.list.map((w, i) => `<button data-w="${i}"><img src="${w.icon}" alt="">${esc(w.name)}</button>`);
  if (!W.list.length && window.phantom && window.phantom.solana) opts.push('<button data-p="1">Phantom</button>');
  pop(`<h3 class="gt" data-t="Connect">Connect</h3><p>Your wallet is your player. Connecting shares your public address only.</p><div class="wl">${opts.join('') || `<p>No Solana wallet found. Install <a href="https://phantom.com" target="_blank" rel="noopener" style="color:var(--p2)">Phantom</a>, Solflare or Backpack, then reload.${location.protocol === 'file:' ? '<br><br>Wallets connect on the site’s web address, not on a local file.' : ''}</p>`}</div>`);
}
$('popC').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.w != null || b.dataset.p) {
    try { if (b.dataset.p) { const r = await window.phantom.solana.connect(); W.ph = window.phantom.solana; setAddr(r.publicKey.toString()); }
      else { const w = W.list[+b.dataset.w], r = await w.features['standard:connect'].connect(), acc = (r && r.accounts || w.accounts)[0]; W.w = w; W.acc = acc; setAddr(acc.address, w); }
      close(); toast('Wallet connected'); if (afterConnect) { const f = afterConnect; afterConnect = null; f(); } } catch (_) { toast('Connection cancelled'); }
  }
  if (b.dataset.col) { $('popC').querySelectorAll('.cols button').forEach((x) => x.classList.toggle('on', x === b)); PICK.col = b.dataset.col; arena.sfx.ui(); }
  if (b.id === 'go') start();
  if (b.id === 'again') setup();
  if (b.id === 'home') { close(); leave(); }
});
$('wBtn').onclick = async () => { if (!W.addr) return openWallets();
  try { if (W.w && W.w.features['standard:disconnect']) await W.w.features['standard:disconnect'].disconnect(); else if (W.ph) await W.ph.disconnect(); } catch (_) { }
  W.addr = ''; W.w = null; store.set('wallet', ''); $('wBtn').textContent = 'Connect wallet'; toast('Disconnected'); if (arena.playing) leave(); };
setTimeout(async () => { const n = store.get('wallet', ''); if (!n) return; const w = W.list.find((x) => x.name === n);
  try { if (w) { const r = await w.features['standard:connect'].connect({ silent: true }), acc = (r && r.accounts || w.accounts)[0]; if (acc) { W.w = w; W.acc = acc; setAddr(acc.address, w); } }
    else if (n === 'Phantom' && window.phantom && window.phantom.solana) { const r = await window.phantom.solana.connect({ onlyIfTrusted: true }); W.ph = window.phantom.solana; setAddr(r.publicKey.toString()); } } catch (_) { } }, 400);

// ---------------- play ----------------
const HATS = ['#ff4f9e', '#2ee07e', '#3aa8ff', '#ff8f3a', '#9a63ff', '#16d3c4', '#ff5d5d', '#e757ff'];
const PICK = { col: store.get('hat', HATS[0]), name: store.get('name', '') };
if (!HATS.includes(PICK.col)) PICK.col = HATS[0];
function setup() {
  if (!W.addr) return openWallets(setup);
  pop(`<h3 class="gt" data-t="Your snowball">Your snowball</h3><p>Pick a beanie and a name.</p><input class="nm" id="pn" maxlength="14" placeholder="${esc(short(W.addr))}" value="${esc(PICK.name)}">
    <div class="cols">${HATS.map((c) => `<button data-col="${c}" class="${c === PICK.col ? 'on' : ''}" style="background:${c}" aria-label="beanie colour"></button>`).join('')}</div>
    <button class="btn" id="go">Roll in</button>`);
  setTimeout(() => $('pn') && $('pn').focus(), 50);
}
const hide = (on) => { for (const s of ['.hc', '.pot', 'header']) document.querySelector(s).style.display = on ? 'none' : ''; };
const playNow = () => { if (page !== 'home') { location.hash = '#/'; setTimeout(setup, 60); } else setup(); };
let hintT = 0;
function start() {
  PICK.name = ($('pn') && $('pn').value.trim()) || short(W.addr); store.set('name', PICK.name); store.set('hat', PICK.col); close();
  arena.play(PICK.name, PICK.col); $('hud').classList.add('on'); document.body.style.overflow = 'hidden'; scrollTo({ top: 0 }); hide(true);
  $('feed').innerHTML = ''; $('hint').style.opacity = 1; clearTimeout(hintT); hintT = setTimeout(() => { $('hint').style.opacity = 0; }, 7000); last.v = 0;
}
function leave() { arena.stop(); $('hud').classList.remove('on'); document.body.style.overflow = ''; hide(false); }
document.querySelectorAll('.playBtn').forEach((b) => { b.onclick = playNow; });
$('quit').onclick = leave;

// ---------------- HUD ----------------
const last = { v: 0, can: null, rank: 0, kills: -1, shield: null, dash: -1 };
arena.on('hud', (h) => {
  const hv = $('hV'); gt(hv, money(h.v)); if (h.v > last.v + .009) { hv.classList.add('bump'); setTimeout(() => hv.classList.remove('bump'), 110); } last.v = h.v;
  if (h.rank !== last.rank) { $('hR').textContent = '#' + h.rank; last.rank = h.rank; }
  if (h.kills !== last.kills) { $('hK').textContent = h.kills; last.kills = h.kills; }
  if (h.shield !== last.shield) { $('shieldT').classList.toggle('on', h.shield); last.shield = h.shield; }
  $('vig').style.opacity = h.danger.toFixed(2);
  const c = $('cash'); c.disabled = !h.can; c.classList.toggle('ready', h.can && h.cash <= 0);
  $('cashT').textContent = h.can ? `CASH OUT ${money(h.v)}` : `CASH OUT AT $${arena.CASH_MIN}`; $('cashS').textContent = h.can ? (h.cash > 0 ? 'HOLD STILL...' : 'HOLD E OR PRESS') : 'GROW TO UNLOCK';
  $('cpr').style.width = (h.cash * 100).toFixed(1) + '%';
  const d = Math.round(h.dash * 100); if (d !== last.dash) { $('dashR').style.strokeDashoffset = (276.5 * (1 - h.dash)).toFixed(1); $('dash').classList.toggle('cool', h.dash < 1); last.dash = d; }
});
arena.on('lb', (top) => { $('lbL').innerHTML = top.map((o, i) => `<li class="${o.me ? 'me' : ''}"><em>${o.rank || i + 1}</em><i style="background:${o.col}"></i><span>${esc(o.name)}</span><b>${money(o.v)}</b></li>`).join(''); });
arena.on('pop', (p) => { const e = document.createElement('div'); e.className = 'pp gt g'; e.textContent = e.dataset.t = p.text; e.style.left = p.x + 'px'; e.style.top = p.y + 'px'; $('pops').appendChild(e); setTimeout(() => e.remove(), 1000); });
arena.on('ko', (k) => { const el = $('kopop'); gt($('koV'), '+' + money(k.v)); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); });
arena.on('feed', (f) => {
  const el = document.createElement('div'); el.className = 'kf glass' + (f.me || f.mine ? ' me' : '');
  el.innerHTML = f.cash ? `<span style="color:${f.vcol}">${esc(f.name)}</span> cashed out <em>${money(f.v)}</em>` : f.by ? `<span style="color:${f.col}">${esc(f.by)}</span> shoved <span style="color:${f.vcol}">${esc(f.name)}</span> <em>+${money(f.gain)}</em>` : `<span style="color:${f.vcol}">${esc(f.name)}</span> slipped into the sea`;
  const fd = $('feed'); fd.prepend(el); while (fd.children.length > 4) fd.lastChild.remove(); setTimeout(() => el.remove(), 4200);
});
let banT = 0; const banner = (txt, ms = 2600) => { const b = $('banner'); gt(b, txt); b.classList.add('on'); clearTimeout(banT); banT = setTimeout(() => b.classList.remove('on'), ms); };
arena.on('phase', (p) => { if (p.phase === 'soon') banner('The ice is about to crack!', 2800); if (p.phase === 'shrink') banner('The ice is cracking!', 2600); if (p.phase === 'refreeze') banner('The ice refreezes', 2200); });
arena.on('cashbreak', () => { toast('Bumped! Cash out reset'); });
// first round clock (config.json firstRound, set by build.py --first-in); every round before it is practice
const FR_AT = CFG.firstRound ? Date.parse(CFG.firstRound) : 0, frLeft = () => Math.max(0, FR_AT - Date.now());
const mmss = (ms) => { const s = Math.ceil(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const note = () => CFG.live ? '' : `<p style="font-size:14px;margin:-6px 0 16px">${FR_AT && frLeft() > 0 ? `Practice round. The first round starts in ${mmss(frLeft())}.` : FR_AT ? 'Practice round. The first round is opening: watch @SnowPumpPvP for the go-live.' : 'Practice round. Payouts open with the first round.'}</p>`;
if (FR_AT) { const box = $('fr'); box.hidden = false; const tick = () => { const l = frLeft(); if (l > 0) gt($('frT'), mmss(l)); else { $('frK').textContent = 'FIRST ROUND'; gt($('frT'), 'OPENING'); $('frS').textContent = 'Watch @SnowPumpPvP for the go-live'; } }; tick(); setInterval(tick, 250); }
arena.on('fell', (f) => { saveRun({ out: 'splash', v: f.v, best: f.best, kills: f.kills }); });
arena.on('fell', (f) => setTimeout(() => pop(`<h3 class="gt p" data-t="Splash!">Splash!</h3><p>${f.by ? `${esc(f.by)} shoved you into the sea.` : 'You rolled off the edge.'}</p>
  <div class="stats"><div><b>${money(f.v)}</b><small>LOST</small></div><div><b>${money(f.best)}</b><small>BEST</small></div><div><b>${f.kills}</b><small>KOS</small></div></div>
  <button class="btn" id="again">Play again</button><button class="btn wh" id="home">Back to the site</button>`), 1300));
arena.on('cashout', (c) => { saveRun({ out: 'cash', v: c.v, best: c.best || c.v, kills: c.kills }); });
arena.on('cashout', (c) => setTimeout(() => pop(`<h3 class="gt g" data-t="Cashed out!">Cashed out!</h3><p>${CFG.live ? 'Your snowball is safe in your wallet.' : 'Practice cash out. Nice run.'}</p><span class="gt g big" data-t="${money(c.v)}">${money(c.v)}</span>${note()}
  <button class="btn" id="again">Roll again</button><button class="btn wh" id="home">Back to the site</button>`), 900));

// cash out: hold the button or E
const cash = $('cash'); cash.addEventListener('pointerdown', (e) => { e.preventDefault(); arena.cashout(true); });
['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => cash.addEventListener(t, () => arena.cashout(false)));
const dash = $('dash'); dash.addEventListener('pointerdown', (e) => { e.preventDefault(); arena.dash(); });
// sound toggle
const SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/>', ON = SPK + '<path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>', OFF = SPK + '<path d="M17 9l5 6M22 9l-5 6"/></svg>';
const muteIcon = () => { $('mute').innerHTML = arena.sfx.muted ? OFF : ON; }; muteIcon();
$('mute').onclick = () => { arena.sfx.mute(!arena.sfx.muted); muteIcon(); };
// touch joystick
const joy = $('joy'), knob = $('joyK');
const jmove = (e) => { const b = joy.getBoundingClientRect(), dx = e.clientX - (b.left + b.width / 2), dz = e.clientY - (b.top + b.height / 2), d = Math.min(52, Math.hypot(dx, dz)), a = Math.atan2(dz, dx);
  knob.style.transform = `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px)`; arena.steer(Math.cos(a) * d / 52, Math.sin(a) * d / 52); };
joy.addEventListener('pointerdown', (e) => { joy.setPointerCapture(e.pointerId); jmove(e); }); joy.addEventListener('pointermove', (e) => { if (e.buttons) jmove(e); });
['pointerup', 'pointercancel'].forEach((t) => joy.addEventListener(t, () => { knob.style.transform = ''; arena.steer(null); }));

// ---------------- pages ----------------
const PAGES = { home: 'SnowPump · Push. Grow. Cash out.', leaderboard: 'Leaderboard · SnowPump', how: 'How to play · SnowPump', snow: '$SNOWPVP · SnowPump', community: 'Community · SnowPump' };
let page = 'home';
function route() {
  const r = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'home'; page = PAGES[r] ? r : 'home';
  if (arena.playing && page !== 'home') leave();
  document.querySelectorAll('main.page').forEach((m) => { m.hidden = m.dataset.page !== page; });
  document.body.classList.toggle('sub', page !== 'home'); document.body.classList.remove('navon');
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === page));
  document.title = PAGES[page]; scrollTo({ top: 0 });
  if (page === 'leaderboard' || page === 'home') loadBoard(); if (page === 'leaderboard') renderMine();
}
addEventListener('hashchange', route);
$('burger').onclick = () => document.body.classList.toggle('navon');

// snowball avatars (SVG), in the beanie colour of the player
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; };
function avatar(col, face = '') {
  const ink = '#152b6b', eye = (x) => face === 'happy' ? `<path d="M${x - 6} 63q6-8 12 0" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>` : `<ellipse cx="${x}" cy="62" rx="${face === 'scared' ? 6 : 5.4}" ry="${face === 'scared' ? 8.4 : 7.4}" fill="${ink}"/><circle cx="${x + 2}" cy="59" r="2.2" fill="#fff"/>`;
  const mouth = face === 'scared' ? `<ellipse cx="50" cy="77" rx="4.5" ry="5.5" fill="#3a1830"/>` : face === 'happy' || face === 'angry' ? `<path d="M41 73q9 11 18 0z" fill="#3a1830"/>` : `<path d="M44 74q6 6 12 0" fill="none" stroke="#3a1830" stroke-width="3.4" stroke-linecap="round"/>`;
  const brows = face === 'angry' ? `<path d="M30 50l11 4M70 50l-11 4" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>` : '';
  return `<svg viewBox="0 0 100 100"><circle cx="50" cy="60" r="36" fill="#fff" stroke="${ink}" stroke-width="4"/><path d="M24 72a36 36 0 0 0 52 8a34 34 0 0 1-52-8z" fill="#d6ebff"/>`
    + `<path d="M15 47q2-33 35-34q33 1 35 34z" fill="${col}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/><rect x="12" y="40" width="76" height="14" rx="7" fill="${shade(col, .86)}" stroke="${ink}" stroke-width="4"/>`
    + `<circle cx="50" cy="12" r="8" fill="#fff" stroke="${ink}" stroke-width="4"/>${eye(38)}${eye(62)}${brows}<ellipse cx="29" cy="70" rx="5" ry="3" fill="#ff8fb8" opacity=".7"/><ellipse cx="71" cy="70" rx="5" ry="3" fill="#ff8fb8" opacity=".7"/>${mouth}</svg>`;
}
const paintAvatars = (root = document) => root.querySelectorAll('.av[data-av]').forEach((e) => { e.innerHTML = avatar(e.dataset.av, e.dataset.face); });

// leaderboard: real data from /api/leaderboard (filled by the payout server); an honest empty state until then
const BOARD = { data: null, tab: 'earners' };
const COLS = { earners: 'Cashed out', biggest: 'Cash out', kos: 'Knockouts' };
const val = (tab, o) => tab === 'kos' ? String(o.kos) : money(tab === 'earners' ? o.total : o.v);
const who = (o) => esc(o.name || (o.wallet ? short(o.wallet) : 'Snowball'));
async function loadBoard() { if (BOARD.data) return renderBoard(); try { const r = await fetch('/api/leaderboard', { cache: 'no-store' }); BOARD.data = r.ok ? await r.json() : {}; } catch (_) { BOARD.data = {}; } renderBoard(); }
function podium(list, tab) {
  const ghost = !list.length, L = ghost ? [{ name: 'Open spot', col: '#cfe0f5' }, { name: 'Open spot', col: '#cfe0f5' }, { name: 'Open spot', col: '#cfe0f5' }] : list;
  const RK = ['linear-gradient(#ffe39a,#ffbe3d)', 'linear-gradient(#f2f6fb,#c3d0e2)', 'linear-gradient(#ffcfa8,#f29b5c)'];
  return [1, 0, 2].map((i) => { const o = L[i]; if (!o) return '<div></div>';
    return `<div class="pod card p${i + 1}${ghost ? ' ghost' : ''}"><div class="rk" style="background:${RK[i]}"><span class="gt" data-t="${i + 1}">${i + 1}</span></div><div class="av" data-av="${o.col || '#ff4f9e'}" data-face="${ghost ? '' : 'happy'}"></div><h4>${who(o)}</h4><small>${ghost ? 'Season 1' : o.wallet ? short(o.wallet) : ''}</small><span class="gt ${tab === 'kos' ? 'p' : 'g'}" data-t="${ghost ? '$0.00' : val(tab, o)}">${ghost ? '$0.00' : val(tab, o)}</span></div>`; }).join('');
}
function renderBoard() {
  const d = BOARD.data || {}, tab = BOARD.tab, list = (d[tab] || []).slice(0, 50);
  $('podium').innerHTML = podium(list.slice(0, 3), tab); $('lbCol').textContent = COLS[tab];
  $('homePodium').innerHTML = podium((d.earners || []).slice(0, 3), 'earners');
  $('lbRows').innerHTML = list.length > 3 ? list.slice(3).map((o, i) => `<div class="tr"><em>${i + 4}</em><span class="pl"><span class="av" data-av="${o.col || '#3aa8ff'}"></span><span>${who(o)}</span></span><b>${val(tab, o)}</b></div>`).join('')
    : `<div class="empty"><div class="avs"><div class="av" data-av="#2ee07e"></div><div class="av" data-av="#ff4f9e" data-face="happy"></div><div class="av" data-av="#3aa8ff"></div></div><h3>${list.length ? 'More spots open' : 'Season 1 starts with the first round'}</h3><p>${list.length ? 'Cash out big and take one.' : 'Every cash out lands on this board when $SNOWPVP goes live. Get your warm-up in now.'}</p><button class="btn playBtn">Play now</button></div>`;
  document.querySelectorAll('.playBtn').forEach((b) => { b.onclick = playNow; }); paintAvatars();
}
$('lbTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; BOARD.tab = b.dataset.lb; $('lbTabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); renderBoard(); });

// your warm-up runs, saved on this device
function saveRun(r) { const runs = store.get('runs', []); runs.unshift(Object.assign({ at: Date.now() }, r)); store.set('runs', runs.slice(0, 60)); renderMine(); }
const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago'; };
function renderMine() {
  const runs = store.get('runs', []), cash = runs.filter((r) => r.out === 'cash');
  const st = [[money(cash.reduce((m, r) => Math.max(m, r.v), 0)), 'BEST CASH OUT'], [money(runs.reduce((m, r) => Math.max(m, r.best || r.v), 0)), 'BIGGEST BALL'], [runs.reduce((m, r) => m + (r.kills || 0), 0), 'KNOCKOUTS'], [runs.length, 'GAMES']];
  $('mineStats').innerHTML = st.map(([b, s]) => `<div><b>${b}</b><small>${s}</small></div>`).join('');
  $('mineRuns').innerHTML = runs.length ? runs.slice(0, 6).map((r) => `<div class="run"><i class="${r.out === 'cash' ? 'c' : ''}">${r.out === 'cash' ? 'CASHED OUT' : 'SPLASHED'}</i><span>${money(r.v)} · ${r.kills || 0} KO${r.kills === 1 ? '' : 's'}</span><small>${ago(r.at)}</small></div>`).join('') : '<p>No runs yet. Roll in and they show up here.</p>';
  updateShare(runs);
}

// socials and coin links (filled in site/config.json)
const ICON = {
  x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.4 4.7H5.6z"/></svg>',
  discord: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.6 5.3A16.8 16.8 0 0 0 15.4 4l-.5 1.1a15.6 15.6 0 0 0-5.8 0L8.6 4a16.8 16.8 0 0 0-4.2 1.3C1.8 9.2 1 13 1.4 16.7a17 17 0 0 0 5.2 2.6l1.1-1.8a11 11 0 0 1-1.7-.8l.4-.3a12.1 12.1 0 0 0 11.2 0l.4.3a11 11 0 0 1-1.7.8l1.1 1.8a17 17 0 0 0 5.2-2.6c.5-4.3-.8-8-3-11.4zM8.7 14.5c-1 0-1.9-1-1.9-2.2S7.6 10 8.7 10s1.9 1 1.9 2.3-.8 2.2-1.9 2.2zm6.6 0c-1 0-1.9-1-1.9-2.2s.8-2.3 1.9-2.3 1.9 1 1.9 2.3-.8 2.2-1.9 2.2z"/></svg>',
  pumpfun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="M9.2 6.9l5.2 9.4" transform="rotate(0 12 12)"/></svg>',
  dex: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-6 4 3 6-8"/><path d="M15 6h3v3"/><path d="M3 21h18"/></svg>',
};
const XH = ((CFG.x || '').match(/x\.com\/(\w+)/) || [])[1] || '';   // X handle for share intents (via=)
const SOC = {
  x: { name: 'X', short: 'Follow', tag: 'Follow', col: 'linear-gradient(#3a4566,#111827)', url: CFG.x, text: 'Launch news and the best shoves.' },
  discord: { name: 'Discord', tag: 'Join', col: 'linear-gradient(#8c95ff,#5865f2)', url: CFG.discord, text: 'Hang out, find squads, report bugs.' },
  // buy: config.pumpfun overrides; a pump.fun mint (…pump) opens pump.fun, any other mint opens a Jupiter swap
  pumpfun: { name: CFG.ca && /pump$/.test(CFG.ca) ? 'Buy on pump.fun' : 'Buy $SNOWPVP', tag: 'Buy', col: 'linear-gradient(var(--gb1),var(--gb2))', url: CFG.pumpfun || (CFG.ca ? (/pump$/.test(CFG.ca) ? `https://pump.fun/coin/${CFG.ca}` : `https://jup.ag/swap/SOL-${CFG.ca}`) : ''), text: '' },
  dex: { name: 'Chart', tag: 'Chart', col: 'linear-gradient(var(--b1),var(--b2))', url: CFG.ca ? `https://dexscreener.com/solana/${CFG.ca}` : '', text: '' },
};
document.querySelectorAll('[data-socials]').forEach((box) => { box.innerHTML = box.dataset.socials.split(',').map((k) => { const s = SOC[k], href = s.url ? ` href="${esc(s.url)}" target="_blank" rel="noopener"` : ' href="#" data-soon="1"';
  return box.dataset.big ? `<div class="sc card"><div class="lo" style="background:${s.col}">${ICON[k]}</div><h3>${s.name}</h3><p>${s.text}</p><a class="btn sm"${href}>${s.tag}</a></div>` : `<a class="btn sm ${k === 'pumpfun' ? '' : 'wh'} soc"${href}>${ICON[k]}${s.short || s.name}</a>`; }).join(''); });
document.querySelectorAll('[data-sl]').forEach((a) => { const u = SOC[a.dataset.sl].url; if (u) a.href = u; else a.remove(); });
document.addEventListener('click', (e) => { const a = e.target.closest('a[data-soon]'); if (!a) return; e.preventDefault(); toast('Link drops at launch'); });
function updateShare(runs = store.get('runs', [])) {
  const best = runs.filter((r) => r.out === 'cash').reduce((m, r) => Math.max(m, r.v), 0);
  const text = best ? `I just cashed out ${money(best)} on SnowPump. Push. Grow. Cash out!` : 'Shoving snowballs into the sea on SnowPump. Push. Grow. Cash out!';
  $('shareBtn').href = 'https://x.com/intent/post?text=' + encodeURIComponent(text + ' #SnowPump') + (XH ? '&via=' + XH : '') + (location.protocol.startsWith('http') ? '&url=' + encodeURIComponent(location.origin) : '');
}

// coin
document.querySelectorAll('.caT').forEach((e) => { if (CFG.ca) e.textContent = CFG.ca; });
document.querySelectorAll('.caB').forEach((b) => { b.onclick = () => { if (!CFG.ca) return toast('CA drops at launch'); navigator.clipboard.writeText(CFG.ca).then(() => toast('CA copied')); }; });
paintAvatars(); updateShare(); route();
