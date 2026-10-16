// Snowfight site: wallet connect, play flow, HUD, cash out.
import { createArena } from './game.js';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let tT = 0; const toast = (m) => { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tT); tT = setTimeout(() => t.classList.remove('on'), 2400); };
const store = { get(k, d) { try { const v = localStorage.getItem('snowfight.' + k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem('snowfight.' + k, JSON.stringify(v)); } catch (_) { } } };
const CFG = window.SNOWFIGHT || {};   // { ca, live } set at build time

const arena = createArena($('arena'), $('tags'), { cashMin: 8 });
$('cmin').textContent = arena.CASH_MIN;

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
  pop(`<h3>Connect a wallet</h3><p>Your wallet is your player. Connecting shares your public address only.</p><div class="wl">${opts.join('') || `<p>No Solana wallet found. Install <a href="https://phantom.com" target="_blank" rel="noopener" style="color:var(--red)">Phantom</a>, Solflare or Backpack, then reload.${location.protocol === 'file:' ? '<br><br>Wallets connect on the site’s web address, not on a local file.' : ''}</p>`}</div>`);
}
$('popC').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.w != null || b.dataset.p) {
    try { if (b.dataset.p) { const r = await window.phantom.solana.connect(); W.ph = window.phantom.solana; setAddr(r.publicKey.toString()); }
      else { const w = W.list[+b.dataset.w], r = await w.features['standard:connect'].connect(), acc = (r && r.accounts || w.accounts)[0]; W.w = w; W.acc = acc; setAddr(acc.address, w); }
      close(); toast('Wallet connected'); if (afterConnect) { const f = afterConnect; afterConnect = null; f(); } } catch (_) { toast('Connection cancelled'); }
  }
  if (b.dataset.col) { $('popC').querySelectorAll('.cols button').forEach((x) => x.classList.toggle('on', x === b)); PICK.col = b.dataset.col; }
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
const HATS = ['#ff4d5e', '#2fd3a0', '#ffc233', '#3d6bff', '#ff7a2f', '#b45cff', '#00b7ff', '#ff5fc8'];
const PICK = { col: store.get('hat', HATS[0]), name: store.get('name', '') };
function setup() {
  if (!W.addr) return openWallets(setup);
  pop(`<h3>Your snowball</h3><p>Pick a beanie and a name.</p><input class="nm" id="pn" maxlength="14" placeholder="${esc(short(W.addr))}" value="${esc(PICK.name)}">
    <div class="cols">${HATS.map((c) => `<button data-col="${c}" class="${c === PICK.col ? 'on' : ''}" style="background:${c}" aria-label="beanie colour"></button>`).join('')}</div>
    <button class="bb" id="go" style="width:100%">Roll in</button>`);
  setTimeout(() => $('pn') && $('pn').focus(), 50);
}
function start() {
  PICK.name = ($('pn') && $('pn').value.trim()) || short(W.addr); store.set('name', PICK.name); store.set('hat', PICK.col); close();
  arena.play(PICK.name, PICK.col); arena.playing = true; $('hud').classList.add('on'); document.body.style.overflow = 'hidden'; scrollTo({ top: 0 });
  document.querySelector('.hc').style.display = 'none'; document.querySelector('.pot').style.display = 'none'; document.querySelector('header').style.display = 'none';
}
function leave() { arena.stop(); arena.playing = false; $('hud').classList.remove('on'); document.body.style.overflow = ''; document.querySelector('.hc').style.display = ''; document.querySelector('.pot').style.display = ''; document.querySelector('header').style.display = ''; }
$('play').onclick = setup;
$('quit').onclick = leave;

arena.on('hud', (h) => { $('hV').textContent = arena.money(h.v); $('hR').textContent = `Rank #${h.rank} of ${h.n}`; $('hK').textContent = `Knockouts ${h.kills}`; $('hF').textContent = `Ice ${Math.round(h.floe * 100)}%`;
  const c = $('cash'); c.disabled = !h.can || !h.alive; $('cashT').textContent = h.can ? `Hold to cash out ${arena.money(h.v)}` : `Cash out at $${arena.CASH_MIN}`; });
arena.on('cashing', (p) => { $('cpr').style.width = Math.min(100, p * 100) + '%'; });
arena.on('cashbreak', () => { $('cpr').style.width = '0'; toast('Bumped! Cash out reset'); });
arena.on('knock', (k) => toast(`You knocked ${k.name} off the ice  +${arena.money(k.v)}`));
const note = CFG.live ? '' : '<p style="font-size:14px;margin:-6px 0 16px">Payouts switch on when $SNOW launches. Until then every round is a warm-up.</p>';
arena.on('fell', (v) => setTimeout(() => pop(`<h3>Splash!</h3><p>You went over the edge and lost your snowball.</p><big>-${arena.money(v)}</big><button class="bb" id="again" style="width:100%;margin-bottom:10px">Play again</button><button class="bb w2" id="home" style="width:100%">Back to the site</button>`), 900));
arena.on('cashout', (v) => { $('cpr').style.width = '0'; pop(`<h3>Cashed out!</h3><p>Your snowball is safe in your wallet.</p><big>${arena.money(v)}</big>${note}<button class="bb" id="again" style="width:100%;margin-bottom:10px">Roll again</button><button class="bb w2" id="home" style="width:100%">Back to the site</button>`); });

// cash out: hold the button or E
const cash = $('cash'); ['pointerdown'].forEach((t) => cash.addEventListener(t, () => arena.cashout(true))); ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => cash.addEventListener(t, () => { arena.cashout(false); $('cpr').style.width = '0'; }));
addEventListener('keydown', (e) => { if (e.code === 'KeyE' && arena.playing && !e.repeat) arena.cashout(true); });
addEventListener('keyup', (e) => { if (e.code === 'KeyE' && arena.playing) { arena.cashout(false); $('cpr').style.width = '0'; } });
const boost = $('boost'); boost.addEventListener('pointerdown', () => arena.boost(true)); ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => boost.addEventListener(t, () => arena.boost(false)));
// touch joystick
const joy = $('joy'), knob = $('joyK');
const jmove = (e) => { const b = joy.getBoundingClientRect(), dx = e.clientX - (b.left + b.width / 2), dz = e.clientY - (b.top + b.height / 2), d = Math.min(46, Math.hypot(dx, dz)), a = Math.atan2(dz, dx);
  knob.style.transform = `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px)`; arena.steer(Math.cos(a) * d / 92, Math.sin(a) * d / 92); };
joy.addEventListener('pointerdown', (e) => { joy.setPointerCapture(e.pointerId); jmove(e); }); joy.addEventListener('pointermove', (e) => { if (e.buttons) jmove(e); });
joy.addEventListener('pointerup', () => { knob.style.transform = ''; arena.steer(0, 0); });

// coin
if (CFG.ca) $('ca').textContent = CFG.ca;
$('caB').onclick = () => { if (!CFG.ca) return toast('CA drops at launch'); navigator.clipboard.writeText(CFG.ca).then(() => toast('CA copied')); };
document.addEventListener('click', (e) => { const a = e.target.closest('a[href^="#"]'); if (!a) return; const t = document.querySelector(a.getAttribute('href')); if (!t) return; e.preventDefault(); scrollTo({ top: t.getBoundingClientRect().top + scrollY - 10, behavior: 'smooth' }); });
