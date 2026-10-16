// Snowfight site: wallet connect, play flow, HUD, cash out.
import { createArena } from './game.js';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gt = (el, text) => { if (el.textContent !== text) { el.textContent = text; el.dataset.t = text; } };
let tT = 0; const toast = (m) => { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tT); tT = setTimeout(() => t.classList.remove('on'), 2400); };
const store = { get(k, d) { try { const v = localStorage.getItem('snowfight.' + k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem('snowfight.' + k, JSON.stringify(v)); } catch (_) { } } };
const CFG = window.SNOWFIGHT || {};   // { ca, live } set at build time

const arena = createArena($('arena'), $('tags'), { bots: 15 });
arena.setMap($('map'));
$('cmin').textContent = arena.CASH_MIN;
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
let hintT = 0;
function start() {
  PICK.name = ($('pn') && $('pn').value.trim()) || short(W.addr); store.set('name', PICK.name); store.set('hat', PICK.col); close();
  arena.play(PICK.name, PICK.col); $('hud').classList.add('on'); document.body.style.overflow = 'hidden'; scrollTo({ top: 0 }); hide(true);
  $('feed').innerHTML = ''; $('hint').style.opacity = 1; clearTimeout(hintT); hintT = setTimeout(() => { $('hint').style.opacity = 0; }, 7000); last.v = 0;
}
function leave() { arena.stop(); $('hud').classList.remove('on'); document.body.style.overflow = ''; hide(false); }
$('play').onclick = setup;
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
const note = CFG.live ? '' : '<p style="font-size:14px;margin:-6px 0 16px">Payouts switch on when $SNOW launches. Until then every round is a warm-up.</p>';
arena.on('fell', (f) => setTimeout(() => pop(`<h3 class="gt p" data-t="Splash!">Splash!</h3><p>${f.by ? `${esc(f.by)} shoved you into the sea.` : 'You rolled off the edge.'}</p>
  <div class="stats"><div><b>${money(f.v)}</b><small>LOST</small></div><div><b>${money(f.best)}</b><small>BEST</small></div><div><b>${f.kills}</b><small>KOS</small></div></div>
  <button class="btn" id="again">Play again</button><button class="btn wh" id="home">Back to the site</button>`), 1300));
arena.on('cashout', (c) => setTimeout(() => pop(`<h3 class="gt g" data-t="Cashed out!">Cashed out!</h3><p>Your snowball is safe in your wallet.</p><span class="gt g big" data-t="${money(c.v)}">${money(c.v)}</span>${note}
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

// coin
if (CFG.ca) $('ca').textContent = CFG.ca;
$('caB').onclick = () => { if (!CFG.ca) return toast('CA drops at launch'); navigator.clipboard.writeText(CFG.ca).then(() => toast('CA copied')); };
document.addEventListener('click', (e) => { const a = e.target.closest('a[href^="#"]'); if (!a) return; const t = document.querySelector(a.getAttribute('href')); if (!t) return; e.preventDefault(); scrollTo({ top: t.getBoundingClientRect().top + scrollY - 10, behavior: 'smooth' }); });
