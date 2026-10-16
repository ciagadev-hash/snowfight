// SnowPump arena: runs the sim, draws it with the world, and turns input, camera, sound and HUD into a game.
// One engine runs both the hero backdrop (attract mode, bots only) and the game (you + bots).
import { createSim, value, money, CASH_MIN, CASH_HOLD, FMAX, NAMES, HATS } from './sim.js';
import { createWorld } from './world.js';
import { createSfx } from './sfx.js';

const $$ = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lerp = (a, b, k) => a + (b - a) * k;

export function createArena(canvas, tagsEl, opts = {}) {
  const W = createWorld(canvas, { faceCam: .45, faceMax: .5 }), cam = W.cam, sfx = createSfx();
  const BOTS = opts.bots || 15, listeners = {}, emit = (k, v) => (listeners[k] || []).forEach((f) => f(v));
  let S, me = null, state = 'attract', simTime = 0, nameI = 0, respawn = [], slow = [], shake = 0, hudT = 0, lbT = 0, popAcc = 0, popT = 0, phase = '', warned = false;

  function addBot(instant) { const i = nameI++; return S.spawn({ bot: true, name: NAMES[i % NAMES.length], col: HATS[(i * 5) % HATS.length], r: .85 + S.R() * .75, instant }); }
  function newSim() { S = createSim({ seed: 1 + (Math.random() * 1e6 | 0) }); simTime = S.t; respawn = []; for (let i = 0; i < BOTS; i++) addBot(true); }
  newSim();

  // ---- input: mouse steers toward the pointer, WASD/arrows or the touch stick override it
  const input = { mx: 0, my: 0, mouse: false, keys: new Set(), joy: null };
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const b = canvas.getBoundingClientRect(); input.mx = e.clientX - b.left; input.my = e.clientY - b.top; input.mouse = true; });
  canvas.addEventListener('pointerdown', (e) => { if (state === 'play' && e.pointerType === 'mouse' && e.button === 0) api.dash(); });
  const KEYS = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  addEventListener('keydown', (e) => { if (state !== 'play') return; if (KEYS[e.code]) { input.keys.add(e.code); e.preventDefault(); } if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) api.dash(); } if (e.code === 'KeyE' && !e.repeat) api.cashout(true); });
  addEventListener('keyup', (e) => { input.keys.delete(e.code); if (e.code === 'KeyE') api.cashout(false); });
  addEventListener('blur', () => { input.keys.clear(); if (me) me.ctl.cash = false; });
  function steerMe() {
    if (!me || me.st !== 'live') return; let x = 0, z = 0;
    if (input.keys.size) { for (const k of input.keys) { x += KEYS[k][0]; z += KEYS[k][1]; } const l = Math.hypot(x, z); if (l) { x /= l; z /= l; } }
    else if (input.joy) { x = input.joy.x; z = input.joy.z; }
    else if (input.mouse) { const a = S.alpha(simTime), p = W.project(lerp(me.px, me.x, a), me.r * .9, lerp(me.pz, me.z, a)), dx = input.mx - p.x, dy = input.my - p.y, d = Math.hypot(dx, dy); if (d > 16) { const k = cl((d - 16) / 150); x = dx / d * k; z = dy / d * k; } }
    me.ctl.x = x; me.ctl.z = z;
  }

  // ---- name + price tags (DOM, updated only when something changes)
  const tags = new Map();
  function tagFor(e) { let t = tags.get(e.id); if (!t) { const el = $$('div', 'ptag' + (e === me ? ' me' : '')); el.innerHTML = `<b></b><span>${e.name.replace(/[<>&]/g, '')}${e.bot && opts.botLabel !== false ? '<i>bot</i>' : ''}</span>`; tagsEl.appendChild(el); t = { el, b: el.firstChild, txt: '', on: null, rich: null, tt: 0 }; tags.set(e.id, t); } return t; }
  function updateTags(a, now) {
    const seen = new Set(), D = W.discs(S, a);
    for (const e of S.ents) { if (e.st !== 'live' && e.st !== 'spawn') continue; seen.add(e.id); const t = tagFor(e);
      const x = lerp(e.px, e.x, a), z = lerp(e.pz, e.z, a), p = W.project(x, e.r * 2.18 + (e.st === 'spawn' ? 99 : 0), z), dist = Math.hypot(cam.position.x - x, cam.position.y, cam.position.z - z);
      const on = p.on && (state !== 'play' || dist < 75 || e === me); if (on !== t.on) { t.el.style.display = on ? '' : 'none'; t.on = on; } if (!on) continue;
      const sc = cl(26 / dist, .55, 1.15) * (e === me ? 1.1 : 1); t.el.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0) translate(-50%,-100%) scale(${sc.toFixed(3)})`;
      const op = (1 - W.cover(p.x, p.y, Math.hypot(cam.position.x - x, cam.position.y - e.r * .94, cam.position.z - z), e.id, D)).toFixed(2); if (op !== t.op) { t.el.style.opacity = op; t.op = op; }
      if (now - t.tt > 120) { t.tt = now; const s = money(value(e)); if (s !== t.txt) { t.b.textContent = s; t.txt = s; } const rich = value(e) >= CASH_MIN; if (rich !== t.rich) { t.el.classList.toggle('rich', rich); t.rich = rich; } } }
    for (const [id, t] of tags) if (!seen.has(id)) { t.el.remove(); tags.delete(id); }
  }

  // ---- camera: smooth follow with look-ahead, zooms out as you grow; slow orbit in attract mode
  const C = { x: 46, y: 22, z: 0, lx: 0, ly: -2, lz: 0, k: 1 };
  function updateCam(dt, a, now) {
    let tx, ty, tz, lx, ly, lz, rate = 4.5;
    if (state !== 'attract' && me) {
      const x = lerp(me.px, me.x, a), z = lerp(me.pz, me.z, a), r = me.r, fall = me.st === 'fall';
      lx = x + (fall ? 0 : me.vx * .3); lz = z + (fall ? 0 : me.vz * .3) - 1.2; ly = fall ? -.8 : 0;
      tx = lx; ty = (fall ? 9 : 11) + r * 3; tz = lz + (fall ? 9.5 : 12.8) + r * 3.8; rate = C.k < 1 ? 1.6 + C.k * 3 : 5;
    } else { const t = now / 1000 * .045; tx = Math.sin(t) * 47; ty = 21 + Math.sin(t * 1.7) * 2; tz = Math.cos(t) * 47; lx = 0; ly = -2.5; lz = 0; rate = 2; }
    C.k = Math.min(1, C.k + dt * .7); const k = 1 - Math.exp(-dt * rate);
    C.x += (tx - C.x) * k; C.y += (ty - C.y) * k; C.z += (tz - C.z) * k; C.lx += (lx - C.lx) * k; C.ly += (ly - C.ly) * k; C.lz += (lz - C.lz) * k;
    shake *= Math.exp(-dt * 7); const sh = shake * shake, n = now / 1000;
    cam.position.set(C.x + Math.sin(n * 61) * sh, C.y + Math.sin(n * 47 + 1) * sh, C.z + Math.sin(n * 53 + 2) * sh); cam.lookAt(C.lx, C.ly, C.lz); cam.updateMatrixWorld();
  }

  // ---- sim events -> sound, feel and HUD
  W.onSplash = (e) => { const d = Math.hypot(cam.position.x - e.x, cam.position.z - e.z); sfx.splash(d < 30); };
  const hitStop = (dur, scale) => slow.push({ until: performance.now() + dur * 1000, scale });
  function handle(ev) {
    W.event(ev); const e = ev.e, mine = e && e === me;
    switch (ev.k) {
      case 'pile': if (mine) { sfx.pile(); popAcc += ev.v; } break;
      case 'hit': if (me && (ev.a === me || ev.b === me)) { if (ev.dash) { sfx.shove(); hitStop(.075, .06); shake += Math.min(.9, .3 + ev.s * .03); } else { sfx.bump(ev.s); shake += Math.min(.35, ev.s * .025); } } break;
      case 'dash': if (mine) sfx.dash(); break;
      case 'land': if (mine) { sfx.land(); shake += .3; } break;
      case 'fall': {
        emit('feed', { by: ev.by ? ev.by.name : null, name: e.name, gain: ev.gain, v: ev.v, me: mine, mine: ev.by === me && !!me, col: ev.by ? ev.by.col : null, vcol: e.col });
        if (mine) { sfx.fall(); slow.push({ until: performance.now() + 900, scale: .4 }); emit('fell', { v: ev.v, by: ev.by ? ev.by.name : null, kills: me.kills, best: me.best }); }
        if (me && ev.by === me) { sfx.ko(); shake += .5; emit('ko', { name: e.name, v: ev.gain }); }
        break; }
      case 'gone': if (e.bot) respawn.push(S.t + 1.2 + S.R() * 2.5); else if (mine) state = 'over'; break;
      case 'cashstart': if (mine) emit('cashstart'); break;
      case 'cashstop': if (mine) emit('cashstop'); break;
      case 'cashbreak': if (mine) { emit('cashbreak'); sfx.bump(6); } break;
      case 'cashout': if (mine) { sfx.cashout(); state = 'over'; emit('cashout', { v: ev.v, kills: me.kills, best: me.best }); } else { emit('feed', { cash: true, name: e.name, v: ev.v, vcol: e.col }); respawn.push(S.t + 1.5 + S.R() * 2); } break;
    }
  }

  // ---- minimap
  let mapCv = null, mapX = null;
  function drawMap(a) {
    if (!mapCv) return; const s = mapCv.width, h = s / 2, k = (h - 6) / FMAX; mapX.clearRect(0, 0, s, s);
    mapX.fillStyle = 'rgba(18,90,170,.35)'; mapX.beginPath(); mapX.arc(h, h, h - 1, 0, 7); mapX.fill();
    mapX.fillStyle = '#f4faff'; mapX.beginPath(); mapX.arc(h, h, S.FR * k, 0, 7); mapX.fill();
    if (S.next < S.FR - .3) { mapX.strokeStyle = '#ff4f9e'; mapX.lineWidth = 2; mapX.setLineDash([4, 4]); mapX.beginPath(); mapX.arc(h, h, S.next * k, 0, 7); mapX.stroke(); mapX.setLineDash([]); }
    for (const e of S.ents) { if (e.st !== 'live') continue; const x = h + lerp(e.px, e.x, a) * k, y = h + lerp(e.pz, e.z, a) * k; mapX.fillStyle = e.col; mapX.beginPath(); mapX.arc(x, y, Math.max(2.2, e.r * k * 1.3), 0, 7); mapX.fill();
      if (e === me) { mapX.strokeStyle = '#152b6b'; mapX.lineWidth = 2.5; mapX.stroke(); mapX.strokeStyle = '#fff'; mapX.lineWidth = 1.2; mapX.stroke(); } }
  }

  // ---- adaptive resolution keeps the frame rate up on weaker GPUs
  const maxDpr = Math.min(devicePixelRatio || 1, opts.maxDpr || 1.75); let dpr = Math.min(maxDpr, 1.5), ema = 16, tuneT = 0;
  function size() { const w = canvas.clientWidth, h = canvas.clientHeight; if (w && h) W.setSize(w, h, dpr); }
  size(); addEventListener('resize', size);
  let vis = true, last = performance.now(); new IntersectionObserver((es) => { vis = es[0].isIntersecting; }).observe(canvas);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!vis || document.hidden) { last = now; return; }
    const raw = Math.min(.1, (now - last) / 1000); last = now; if (raw <= 0) return;
    ema = ema * .94 + raw * 1000 * .06; tuneT += raw;
    if (tuneT > 1.2) { tuneT = 0; if (ema > 21 && dpr > .7) { dpr = Math.max(.7, dpr - .15); size(); } else if (ema < 12.5 && dpr < maxDpr - .05) { dpr = Math.min(maxDpr, dpr + .1); size(); } }
    slow = slow.filter((s) => s.until > now); const ts = slow.reduce((m, s) => Math.min(m, s.scale), 1), dt = raw * ts;
    steerMe();
    simTime += dt; S.run(simTime);
    for (const ev of S.ev) handle(ev); S.ev.length = 0;
    while (respawn.length && respawn[0] <= S.t) { respawn.shift(); addBot(false); } respawn.sort((x, y) => x - y);
    if (S.phase !== phase) { phase = S.phase; warned = false; if (state === 'play') emit('phase', { phase }); }
    if (state === 'play' && phase === 'calm' && S.left < 4 && !warned) { warned = true; emit('phase', { phase: 'soon' }); sfx.warn(); }
    const a = S.alpha(simTime);
    W.update(S, a, dt); updateCam(raw, a, now); W.render(); updateTags(a, now); drawMap(a);
    if (state !== 'attract' && me) {
      if (now - popT > 260 && popAcc > 0) { popT = now; const p = W.project(lerp(me.px, me.x, a), me.r * 2.6, lerp(me.pz, me.z, a)); emit('pop', { text: '+' + money(popAcc), x: p.x, y: p.y }); popAcc = 0; }
      if (now - hudT > 60) { hudT = now; const edge = S.FR - Math.hypot(me.x, me.z) - me.r;
        emit('hud', { v: value(me), r: me.r, alive: me.st === 'live' || me.st === 'spawn', rank: S.rank(me), n: S.alive(), kills: me.kills, can: value(me) >= CASH_MIN && me.st === 'live', cash: me.cash / CASH_HOLD, dash: me.dashCD <= 0 ? 1 : 1 - me.dashCD / 1.1, danger: me.st === 'live' ? cl((3.5 - edge) / 3.5) : 0, shield: me.shield > 0, phase: S.phase, left: S.left, floe: S.FR / FMAX }); }
      if (now - lbT > 400) { lbT = now; const L = S.ents.filter((o) => o.st === 'live').sort((x, y) => y.r - x.r), top = L.slice(0, 5).map((o) => ({ name: o.name, v: value(o), me: o === me, col: o.col }));
        if (me.st === 'live' && !top.some((o) => o.me)) top.push({ name: me.name, v: value(me), me: true, col: me.col, rank: L.indexOf(me) + 1 }); emit('lb', top); }
    }
  }
  requestAnimationFrame(frame);

  const api = {
    on(k, f) { (listeners[k] = listeners[k] || []).push(f); },
    get playing() { return state !== 'attract'; },
    play(name, col) { sfx.init(); if (me) S.remove(me); if (state === 'over' || !S) { /* keep the running arena */ } me = S.spawn({ name, col, r: 1, shield: 4.5 }); state = 'play'; C.k = 0; input.keys.clear(); input.joy = null; popAcc = 0; phase = S.phase; return me; },
    stop() { if (me) S.remove(me); me = null; state = 'attract'; },
    dash() { if (me && me.st === 'live') me.ctl.dash = true; },
    cashout(on) { if (me) me.ctl.cash = !!on && me.st === 'live'; },
    steer(x, z) { input.joy = x == null ? null : { x, z }; },
    setMap(cv) { mapCv = cv; mapX = cv.getContext('2d'); },
    sfx, CASH_MIN, CASH_HOLD, money,
  };
  return api;
}
