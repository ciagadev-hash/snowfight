// Snowfight simulation: deterministic, fixed step, no rendering. The game, the hero backdrop and the showcase film all run it.
// Units are metres and seconds. A ball's mass is its snow area (r²), and its dollar value is r² × RATE.
export const STEP = 1 / 120;
export const RATE = 1.6, CASH_MIN = 8, CASH_HOLD = 3;
export const FMAX = 30, FMIN = 13;
const VMAX = 9.5, ACC = 34, FRICTION = 1.6, DASH_V = 13, DASH_T = .24, DASH_CD = 1.1, SHOVE = 6.5, BOUNCE = .55;
export const SPAWN_T = .7, FALL_T = 1.6;
const RMAX = 4.5, DECAY_AT = 6, DECAY = .012, PILES = 150, PILE_GAIN = .065, KILL_SHARE = .6, CREDIT_T = 3.5;

export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const value = (e) => e.r * e.r * RATE;
export const money = (v) => '$' + v.toFixed(2);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// The floe breathes on a 90 s loop: calm, shrink to FMIN, a short hold, then it refreezes.
export function floeAt(t) {
  const p = t % 90;
  if (p < 14) return { r: FMAX, next: FMAX, phase: 'calm', left: 14 - p };
  if (p < 74) { const k = (p - 14) / 60, e = (x) => x * x * (3 - 2 * x), r = FMAX - (FMAX - FMIN) * e(k); return { r, next: FMAX - (FMAX - FMIN) * e(Math.min(1, k + .12)), phase: 'shrink', left: 74 - p }; }
  if (p < 82) return { r: FMIN, next: FMIN, phase: 'hold', left: 82 - p };
  const k = (p - 82) / 8; return { r: FMIN + (FMAX - FMIN) * (1 - Math.pow(1 - k, 3)), next: FMAX, phase: 'refreeze', left: 90 - p };
}

export function createSim(o = {}) {
  const R = rng(o.seed || 7);
  const S = { t: o.t0 || 0, FR: FMAX, next: FMAX, phase: 'calm', auto: o.auto !== false, ents: [], piles: [], ev: [], uid: 0, R };
  const emit = (k, d) => S.ev.push(Object.assign({ k, t: S.t }, d));
  const live = (e) => e.st === 'live';

  // ---- snow piles
  function placePile(p, delay) { const a = R() * Math.PI * 2, d = Math.sqrt(R()) * Math.max(2, S.FR - 2.2); p.x = Math.cos(a) * d; p.z = Math.sin(a) * d; p.s = .75 + R() * .6; p.t0 = S.t + delay; p.on = true; }
  for (let i = 0; i < PILES; i++) { const p = { i }; placePile(p, -R() * 2); S.piles.push(p); }

  // ---- players
  S.spawn = (d = {}) => {
    const e = { id: ++S.uid, bot: !!d.bot, name: d.name || 'Snowball', col: d.col || '#ff4f9e', x: 0, z: 0, px: 0, pz: 0, vx: 0, vz: 0, r: d.r || 1, rT: d.r || 1, face: R() * 6.28,
      st: 'spawn', st0: S.t, dashT: 0, dashCD: 0, stun: 0, cash: 0, hitBy: null, hitT: -9, kills: 0, best: 0, born: S.t, ctl: { x: 0, z: 0, dash: false, cash: false },
      shield: d.shield != null ? d.shield : 0, ai: { next: 0, mode: 'collect', aggr: .25 + R() * .6, wantDash: false, brave: R(), cashAt: 9 + R() * 14, tx: 0, tz: 0, prey: null, wob: R() * 9 } };
    if (d.x != null) { e.x = d.x; e.z = d.z; } else {
      let best = -1; for (let k = 0; k < 40; k++) { const a = R() * Math.PI * 2, r = Math.sqrt(R()) * S.FR * .78, x = Math.cos(a) * r, z = Math.sin(a) * r;
        let gap = 99; for (const o of S.ents) if (o.st === 'live' || o.st === 'spawn') gap = Math.min(gap, Math.hypot(o.x - x, o.z - z) - o.r - e.r); if (gap > best) { best = gap; e.x = x; e.z = z; } if (gap > 4) break; }
    }
    e.px = e.x; e.pz = e.z; if (d.instant) { e.st = 'live'; e.st0 = S.t - SPAWN_T; }
    S.ents.push(e); emit('spawn', { e }); return e;
  };
  S.remove = (e) => { const i = S.ents.indexOf(e); if (i >= 0) S.ents.splice(i, 1); };

  // ---- bots: collect snow, hunt smaller balls from the inside so the shove sends them out, flee bigger ones, keep off the edge
  function think(e) {
    const A = e.ai, t = S.t; A.next = t + .16 + R() * .22;
    const dc = Math.hypot(e.x, e.z), edge = S.FR - dc - e.r;
    let threat = null, ts = 0, prey = null, ps = 0;
    for (const o of S.ents) { if (o === e || !live(o)) continue; const gap = Math.hypot(o.x - e.x, o.z - e.z) - o.r - e.r;
      if (o.r > e.r * 1.1 && gap < 7) { const s = (7 - gap) * (o.dashT > 0 ? 2 : 1); if (s > ts) { ts = s; threat = o; } }
      if (o.r < e.r * .97 && gap < 12 && o.shield <= 0) { const oe = S.FR - Math.hypot(o.x, o.z) - o.r, s = (12 - gap) * (1 + clamp((9 - oe) / 9, 0, 1) * 2 + (o.cash > 0 ? 2 : 0)) * A.aggr; if (s > ps) { ps = s; prey = o; } } }
    A.prey = null; A.threat = threat;
    A.wantDash = R() < .35 * A.aggr;
    if (edge < 4.2 + e.r * .6) { A.mode = 'center'; const j = (R() - .5) * .9; A.tx = -e.x / (dc || 1) + -e.z / (dc || 1) * j; A.tz = -e.z / (dc || 1) + e.x / (dc || 1) * j; }
    else if (threat && ts > 2.2 + A.brave * 3) { A.mode = 'flee'; let fx = e.x - threat.x, fz = e.z - threat.z; const f = Math.hypot(fx, fz) || 1; fx /= f; fz /= f; const w = clamp((10 - edge) / 10, 0, 1); A.tx = fx * (1 - w) - e.x / (dc || 1) * w; A.tz = fz * (1 - w) - e.z / (dc || 1) * w; }
    else if (prey && ps > 4.5) { A.mode = 'hunt'; A.prey = prey; }
    else if (value(e) > A.cashAt && !threat) { A.mode = 'cash'; }
    else { A.mode = 'collect'; let best = null, bd = 1e9; for (const p of S.piles) { if (!p.on || p.t0 > t) continue; const d = (p.x - e.x) ** 2 + (p.z - e.z) ** 2 + (Math.hypot(p.x, p.z) > S.FR - 4 ? 60 : 0); if (d < bd) { bd = d; best = p; } }
      if (best) { A.tx = best.x - e.x; A.tz = best.z - e.z; } else { A.tx = Math.sin(t * .3 + A.wob); A.tz = Math.cos(t * .27 + A.wob); } }
  }
  function steerBot(e) {
    const A = e.ai, c = e.ctl; c.cash = A.mode === 'cash'; c.dash = false;
    if (A.mode === 'cash') { c.x = c.z = 0; return; }
    let tx = A.tx, tz = A.tz;
    if (A.mode === 'hunt' && A.prey && live(A.prey)) {
      const p = A.prey, pd = Math.hypot(p.x, p.z) || 1, ox = p.x / pd, oz = p.z / pd;    // outward direction at the prey
      const gx = p.x - ox * (p.r + e.r) * .9, gz = p.z - oz * (p.r + e.r) * .9;           // get on its inner side
      const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1, align = (dx * ox + dz * oz) / d;
      if (align > .55 || d < p.r + e.r + 1.2) { tx = dx; tz = dz; } else { tx = gx - e.x; tz = gz - e.z; }
      if (A.wantDash && e.dashCD <= 0 && d - p.r - e.r < 2.4 + e.r && (dx * e.vx + dz * e.vz) / d > 2 && align > .3) { c.dash = true; A.wantDash = false; }
    }
    const l = Math.hypot(tx, tz) || 1; c.x = tx / l; c.z = tz / l;
  }

  // ---- one fixed step
  S.step = () => {
    const dt = STEP, t = (S.t += dt);
    if (S.auto) { const f = floeAt(t); S.FR = f.r; S.next = f.next; S.phase = f.phase; S.left = f.left; }
    for (const e of S.ents) { e.px = e.x; e.pz = e.z; }
    for (const e of S.ents) {
      if (e.st === 'spawn') { if (t - e.st0 >= SPAWN_T) { e.st = 'live'; emit('land', { e }); } continue; }
      if (e.st === 'fall') { const k = Math.exp(-2.5 * dt); e.vx *= k; e.vz *= k; e.x += e.vx * dt; e.z += e.vz * dt; if (t - e.st0 > FALL_T) { e.st = 'gone'; emit('gone', { e }); } continue; }
      if (e.st !== 'live') continue;
      if (e.bot) { if (t >= e.ai.next) think(e); steerBot(e); }
      const c = e.ctl; e.dashCD -= dt; e.dashT -= dt; e.stun -= dt; e.shield -= dt;
      if (e.rT * e.rT > DECAY_AT) e.rT = Math.sqrt(e.rT * e.rT - (e.rT * e.rT - DECAY_AT) * DECAY * dt);   // big balls slowly shed snow
      e.r += (e.rT - e.r) * Math.min(1, dt * 7);
      // cash out: stand still and hold; a bump resets it
      const canCash = value(e) >= CASH_MIN && e.stun <= 0;
      if (c.cash && canCash) { if (e.cash <= 0) emit('cashstart', { e }); e.cash += dt; if (e.cash >= CASH_HOLD) { e.st = 'cashed'; e.st0 = t; emit('cashout', { e, v: value(e) }); continue; } }
      else if (e.cash > 0) { e.cash = 0; emit('cashstop', { e }); }
      const cashing = e.cash > 0;
      let ix = cashing || e.stun > 0 ? 0 : c.x, iz = cashing || e.stun > 0 ? 0 : c.z; const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
      if (c.dash && e.dashCD <= 0 && !cashing && e.stun <= 0) {
        let dx = ix, dz = iz, l = Math.hypot(dx, dz); if (l < .2) { dx = e.vx; dz = e.vz; l = Math.hypot(dx, dz); } if (l < .2) { dx = Math.sin(e.face); dz = Math.cos(e.face); l = 1; }
        dx /= l; dz /= l; const sp = Math.max(0, e.vx * dx + e.vz * dz); e.vx += dx * (DASH_V - sp * .35); e.vz += dz * (DASH_V - sp * .35); e.dashT = DASH_T; e.dashCD = DASH_CD; e.shield = 0; emit('dash', { e, dx, dz });
      }
      c.dash = false;
      const vmax = VMAX / (.7 + .3 * e.r), acc = ACC / (.62 + .38 * e.r), sp = Math.hypot(e.vx, e.vz);
      if (e.dashT > 0) { /* committed: the dash carries you */ }
      else if (Math.hypot(ix, iz) > .05) { let dvx = ix * vmax - e.vx, dvz = iz * vmax - e.vz; const dl = Math.hypot(dvx, dvz), lim = acc * dt * (sp > vmax * 1.05 ? .45 : 1); if (dl > lim) { dvx *= lim / dl; dvz *= lim / dl; } e.vx += dvx; e.vz += dvz; }
      else { const k = Math.exp(-FRICTION * dt * (cashing ? 3 : 1)); e.vx *= k; e.vz *= k; }
      if (e.stun > 0) { const k = Math.exp(-.6 * dt); e.vx *= k; e.vz *= k; }
      e.x += e.vx * dt; e.z += e.vz * dt;
      const fs = Math.hypot(e.vx, e.vz), want = fs > .4 ? Math.atan2(e.vx, e.vz) : Math.hypot(ix, iz) > .1 ? Math.atan2(ix, iz) : e.face;
      let da = want - e.face; da = Math.atan2(Math.sin(da), Math.cos(da)); e.face += da * Math.min(1, dt * 10);
    }
    // ---- collisions: full positional separation (no ball ever sits inside another) + one impulse per contact
    const L = S.ents;
    for (let it = 0; it < 3; it++) for (let i = 0; i < L.length; i++) { const a = L[i]; if (a.st !== 'live') continue;
      for (let j = i + 1; j < L.length; j++) { const b = L[j]; if (b.st !== 'live') continue;
        const dx = b.x - a.x, dz = b.z - a.z, rr = a.r + b.r, d2 = dx * dx + dz * dz; if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-4, nx = d2 ? dx / d : 1, nz = d2 ? dz / d : 0, ma = a.r * a.r, mb = b.r * b.r, ia = 1 / ma, ib = 1 / mb, k = (rr - d) / (ia + ib);
        a.x -= nx * k * ia; a.z -= nz * k * ia; b.x += nx * k * ib; b.z += nz * k * ib;
        if (it) continue;
        const vrel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz; if (vrel >= 0) continue;
        const sa = a.dashT > 0 ? a.vx * nx + a.vz * nz : 0, sb = b.dashT > 0 ? -(b.vx * nx + b.vz * nz) : 0;
        const jn = -(1 + BOUNCE) * vrel / (ia + ib); a.vx -= jn * ia * nx; a.vz -= jn * ia * nz; b.vx += jn * ib * nx; b.vz += jn * ib * nz;
        let shove = 0;
        if (sa > 1.5 && b.shield <= 0) { const s = SHOVE * (2 * ma / (ma + mb)); b.vx += nx * s; b.vz += nz * s; a.vx -= nx * s * .25 * mb / ma; a.vz -= nz * s * .25 * mb / ma; b.stun = .42; a.dashT = 0; shove = s; }
        if (sb > 1.5 && a.shield <= 0) { const s = SHOVE * (2 * mb / (ma + mb)); a.vx -= nx * s; a.vz -= nz * s; b.vx += nx * s * .25 * ma / mb; b.vz += nz * s * .25 * ma / mb; a.stun = .42; b.dashT = 0; shove = Math.max(shove, s); }
        if (!shove) { const st = Math.min(.25, -vrel * .03); a.stun = Math.max(a.stun, st); b.stun = Math.max(b.stun, st); }
        // credit: whoever came in faster along the normal is the pusher
        const pa = a.vx * nx + a.vz * nz, pb = -(b.vx * nx + b.vz * nz);
        if (sa > 1.5 || (!(sb > 1.5) && pa >= pb)) { b.hitBy = a; b.hitT = t; } else { a.hitBy = b; a.hitT = t; }
        const s = -vrel + shove;
        if (s > 1.2) for (const e of [a, b]) if (e.cash > 0) { e.cash = 0; emit('cashbreak', { e }); }
        if (s > 1) emit('hit', { a, b, x: a.x + nx * a.r, z: a.z + nz * a.r, nx, nz, s, dash: shove > 0 });
      } }
    // ---- snow piles and the edge
    for (const e of L) { if (e.st !== 'live') continue;
      for (const p of S.piles) { if (!p.on || p.t0 > t) continue; const rr = e.r + .35 * p.s; if ((p.x - e.x) ** 2 + (p.z - e.z) ** 2 < rr * rr) { e.rT = Math.min(RMAX, Math.sqrt(e.rT * e.rT + PILE_GAIN * p.s)); p.on = false; emit('pile', { e, x: p.x, z: p.z, s: p.s, v: PILE_GAIN * p.s * RATE }); placePile(p, 1.2 + R() * 3); } }
      e.best = Math.max(e.best, value(e));
      const dc = Math.hypot(e.x, e.z);
      if (dc > S.FR + e.r * .12) {
        e.st = 'fall'; e.st0 = t; e.cash = 0; const by = e.hitBy && t - e.hitT < CREDIT_T && e.hitBy.st === 'live' ? e.hitBy : null, v = value(e);
        if (by) { by.rT = Math.min(RMAX, Math.sqrt(by.rT * by.rT + e.r * e.r * KILL_SHARE)); by.kills++; }
        const ox = e.x / (dc || 1), oz = e.z / (dc || 1), out = e.vx * ox + e.vz * oz; if (out < 2.5) { e.vx += ox * (2.5 - out); e.vz += oz * (2.5 - out); }
        emit('fall', { e, by, v, gain: v * KILL_SHARE, x: e.x, z: e.z });
      }
    }
    for (const p of S.piles) if (p.on && Math.hypot(p.x, p.z) > S.FR - .9) { emit('melt', { x: p.x, z: p.z, s: p.s }); placePile(p, 1 + R() * 2); }
  };
  S.run = (until) => { while (S.t + STEP <= until + 1e-9) S.step(); };
  S.alpha = (time) => clamp((time - (S.t - STEP)) / STEP, 0, 1);
  S.rank = (e) => 1 + S.ents.filter((o) => o !== e && o.st === 'live' && o.r > e.r).length;
  S.alive = () => S.ents.filter((o) => o.st === 'live' || o.st === 'spawn').length;
  return S;
}

export const HATS = ['#ff4f9e', '#2ee07e', '#3aa8ff', '#ff8f3a', '#9a63ff', '#16d3c4', '#ff5d5d', '#5b6bff', '#e757ff', '#ffd23f', '#86e04a', '#00b8ff'];
export const NAMES = ['Mochi', 'Blizz', 'Frosty', 'Slushie', 'Pebble', 'Igloo', 'Flurry', 'Yeti', 'Nippy', 'Drift', 'Sleet', 'Chill', 'Powder', 'Glacier', 'Brrr', 'Puffin', 'Snowbae', 'Hailey', 'Tundra', 'Avalanche', 'Mittens', 'Krill', 'Polar', 'Cocoa', 'Sledd', 'Penguin', 'Wisp', 'Fjord', 'Kelvin', 'Nova', 'Orca', 'Biscuit', 'Juno', 'Ziggy', 'Lumi', 'Tofu', 'Frost', 'Pip', 'Maple', 'Sora', 'Yuki', 'Bram'];
