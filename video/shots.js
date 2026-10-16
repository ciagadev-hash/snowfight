// SnowPump showcase: the physics side of every shot. Each shot is its own small, deterministic sim scenario,
// so the shoves, knockouts and splashes in the film are real simulation, not keyframes.
// Times are in beats of the 128 BPM track; time(u) maps seconds into the shot to sim seconds (slow motion, hit-stops, time-lapse).
import { createSim } from '../site/sim.js';

export const BPM = 128, BEAT = 60 / BPM, FPS = 60;
export const HERO = { name: 'you', col: '#ff4f9e' };
export const MULT = 2;                                         // film dollars per game dollar
let DASH_AT = 2.55; export const setDashAt = (v) => { DASH_AT = v; };
export const filmMoney = (r) => '$' + (r * r * 1.6 * MULT).toFixed(2);
export const rFor = (dollars) => Math.sqrt(dollars / (1.6 * MULT));

const ease = (x) => x * x * (3 - 2 * x), cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
// smooth speed ramp: keys [[filmSec, speed], ...], eased between keys; sim time is the integral, so slow motion never jumps or freezes dead
const ramp = (keys) => { const N = 2400, last = keys[keys.length - 1], tab = [0];
  const sp = (u) => { if (u <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return va + (vb - va) * ease((u - a) / (b - a)); } return last[1]; };
  for (let i = 1, s = 0; i <= (last[0] + 3) * N; i++) { s += sp((i - .5) / N) / N; tab.push(s); }
  return (u) => { if (u <= 0) return u * keys[0][1]; const x = u * N, i = Math.floor(x); if (i + 1 >= tab.length) return tab[tab.length - 1] + (x - tab.length + 1) / N * last[1]; return tab[i] + (tab[i + 1] - tab[i]) * (x - i); }; };
const sim = (seed, o = {}) => createSim({ seed, auto: false, floe: 30, ...o });
const put = (S, name, col, x, z, r, o = {}) => { const e = S.spawn({ bot: !!o.ai, name, col, x, z, r, instant: true }); e.puppet = !o.ai; if (o.face != null) e.face = o.face; return e; };
const crowd = (S, n, avoid, rad = 26, seed = 0) => { const names = ['Blizz', 'Frosty', 'Slushie', 'Pebble', 'Igloo', 'Flurry', 'Nippy', 'Drift', 'Sleet', 'Chill', 'Powder', 'Glacier', 'Brrr', 'Puffin', 'Hailey', 'Tundra', 'Mittens', 'Krill', 'Polar', 'Cocoa', 'Juno', 'Ziggy', 'Lumi', 'Tofu', 'Pip', 'Sora'], cols = ['#2ee07e', '#3aa8ff', '#ff8f3a', '#9a63ff', '#16d3c4', '#ff5d5d', '#5b6bff', '#e757ff', '#86e04a', '#00b8ff', '#ffd23f'];
  const out = []; let k = seed; for (let i = 0; i < n; i++) { let x, z, ok, tries = 0; do { const a = S.R() * 6.283, d = Math.sqrt(S.R()) * rad; x = Math.cos(a) * d; z = Math.sin(a) * d; ok = !avoid.some(([ax, az, ar]) => Math.hypot(ax - x, az - z) < ar) && !out.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 2.6); } while (!ok && ++tries < 60);
    out.push(put(S, names[(k + i) % names.length], cols[(k + i) % cols.length], x, z, .9 + S.R() * .9, { ai: true })); } return out; };

export const SHOTS = [
  { id: 'hook', b0: 0, b1: 6,
    setup() { const S = sim(11, { piles: 90 }); const H = put(S, HERO.name, HERO.col, .4, -15.6, 2.05, { face: Math.PI }), V = put(S, 'Mochi', '#16d3c4', .6, -22.2, 1.55, { face: 0 });
      H.vz = -7; crowd(S, 7, [[0, -18, 9]], 25, 3); S.hero = H; S.victim = V;
      S.pre = (S, t) => { H.ctl.x = 0; H.ctl.z = t < .3 ? -1 : .7; if (t > .08 && t < .09) H.ctl.dash = true; V.ctl.x = Math.sin(t * 2) * .2; };
      return S; },
    time: ramp([[0, 1], [.215, 1], [.235, .07], [.31, .07], [.5, .34], [1.55, .36], [2.2, .95], [2.9, 1]]) },
  { id: 'logo', b0: 6, b1: 10,
    setup() { const S = sim(21, { piles: 150 }); crowd(S, 18, [], 25, 0); return S; }, time: (u) => u + 2 },
  { id: 'grow', b0: 10, b1: 18,
    setup() { const S = sim(31, { piles: 320 }); const H = put(S, HERO.name, HERO.col, -3, -12, 1.0); crowd(S, 9, [[-3, -2, 9], [-3, -12, 5]], 25, 6); S.hero = H;
      S.pre = (S, t) => { H.rT = 1 + 1.25 * ease(cl(t / 6)); let best = null, bd = 1e9; for (const p of S.piles) { if (!p.on || p.t0 > t) continue; const dx = p.x - H.x, dz = p.z - H.z; if (dz < -1) continue; const d = dx * dx + dz * dz + Math.abs(dx) * 4; if (d < bd) { bd = d; best = p; } }
        const tx = best ? best.x - H.x : 0, tz = best ? best.z - H.z : 1, l = Math.hypot(tx, tz) || 1; H.ctl.x = tx / l * .8; H.ctl.z = tz / l * .8 + .45; };
      return S; },
    time: (u) => u * 1.55 },
  { id: 'bonk', b0: 18, b1: 21,
    setup() { const S = sim(41); const H = put(S, HERO.name, HERO.col, 17.2, 2.2, 2.45, { face: Math.PI / 2 }), V = put(S, 'Blizz', '#3aa8ff', 24.2, 1.4, 1.45, { face: -Math.PI / 2 }); H.vx = 5;
      crowd(S, 8, [[19, 2, 9], [21, 14, 9]], 25, 2); S.hero = H; S.victim = V; S.pre = (S, t) => { H.ctl.x = 1; H.ctl.z = -.05; if (t > .08 && t < .1) H.ctl.dash = true; };
      return S; },
    time: ramp([[0, 1], [.23, 1], [.25, .08], [.32, .08], [.5, 1.2], [1.5, 1.2]]) },
  { id: 'strike', b0: 21, b1: 24,
    setup() { const S = sim(51); const H = put(S, HERO.name, HERO.col, -17.7, .25, 2.5, { face: -Math.PI / 2 }); H.vx = -6;
      const pins = [[-24, 0, 'Pip'], [-26, 1.35, 'Tofu'], [-26, -1.35, 'Juno'], [-28, 0, 'Lumi']].map(([x, z, n], i) => put(S, n, ['#ff8f3a', '#9a63ff', '#2ee07e', '#e757ff'][i], x, z, 1.05, { face: Math.PI / 2 }));
      crowd(S, 8, [[-19, 0, 10]], 24, 9); S.hero = H; S.pins = pins; S.pre = (S, t) => { H.ctl.x = t < .4 ? -1 : .6; H.ctl.z = 0; if (t > .08 && t < .09) H.ctl.dash = true; };
      return S; },
    time: ramp([[0, 1], [.205, 1], [.225, .08], [.29, .08], [.47, 1.2], [1.5, 1.2]]) },
  { id: 'bye', b0: 24, b1: 29,
    setup() { const S = sim(61); const Y = put(S, 'Yeti', '#5b6bff', -.6, -26.4, 2.7, { face: 0 }), H = put(S, HERO.name, HERO.col, .4, -18.4, 2.55, { face: Math.PI });
      crowd(S, 7, [[0, -22, 10]], 24, 12); S.hero = H; S.victim = Y; S.pre = (S, t) => { H.ctl.z = t < .35 ? -1 : .8; H.ctl.x = -.05; if (t > .1 && t < .12) H.ctl.dash = true; Y.ctl.x = 0; Y.ctl.z = .25; };
      return S; },
    time: ramp([[0, 1], [.265, 1], [.285, .08], [.37, .08], [.55, .4], [1.2, .42], [1.45, 1.2], [2.4, 1.2]]) },
  { id: 'ice', b0: 29, b1: 36,
    setup() { const S = sim(71, { piles: 140 }); const H = put(S, HERO.name, HERO.col, 1.5, 2, 2.6, { ai: true }); H.bot = true; crowd(S, 26, [[1.5, 2, 4]], 28, 4); S.hero = H;
      S.pre = (S, t) => { const k = ease(cl((t - .35) / 3.4)); S.FR = 30 - 17 * k; S.next = Math.max(12.5, S.FR - 6); }; return S; },
    time: (u) => u * 1.25 },
  { id: 'price', b0: 36, b1: 42,
    setup() { const S = sim(81, { piles: 120 }); const row = [[-9.5, 2.4, 'Pebble', '#2ee07e'], [-5.4, 6.8, 'Flurry', '#3aa8ff'], [0, 48.2, HERO.name, HERO.col], [5.6, 13.5, 'Sleet', '#9a63ff'], [10.6, 24.9, 'Glacier', '#ff8f3a']];
      S.row = row.map(([x, v, n, c], i) => { const e = put(S, n, c, x, -2 + Math.abs(x) * .25, rFor(v)); e.face = 0; e.v = v; e.order = [0, 1, 4, 2, 3][i]; return e; }); S.hero = S.row[2];
      crowd(S, 8, [[0, 0, 15]], 26, 14); S.pre = (S, t) => { for (const e of S.row) { e.ctl.z = .35; e.ctl.x = 0; } }; return S; },
    time: (u) => u },
  { id: 'cash', b0: 42, b1: 52,
    setup() { const S = sim(91, { piles: 120, cashHold: 2.5125 }); const H = put(S, HERO.name, HERO.col, 0, 0, rFor(48.2), { face: 0 }), Y = put(S, 'Yeti', '#5b6bff', -23, 7, 2.3, { face: Math.PI / 2 });
      crowd(S, 10, [[0, 0, 10], [-9, 3, 6]], 26, 20); S.hero = H; S.rival = Y;
      S.pre = (S, t) => { H.ctl.x = H.ctl.z = 0; H.ctl.cash = t > .3; const dx = H.x - Y.x, dz = H.z - Y.z, d = Math.hypot(dx, dz); const go = t > .45 && t < 3.4; Y.ctl.x = go ? dx / d : 0; Y.ctl.z = go ? dz / d : 0; if (t > DASH_AT && t < DASH_AT + .01) Y.ctl.dash = true; };
      return S; },
    time: (u) => u },
  { id: 'end', b0: 52, b1: 64,
    setup() { const S = sim(101, { piles: 90 }); const squad = [[0, 0, 2.3, HERO.name, HERO.col], [-5.4, 1.6, 1.55, 'Mochi', '#16d3c4'], [5.4, 1.6, 1.55, 'Blizz', '#3aa8ff'], [-9.8, 4.2, 1.2, 'Pip', '#ff8f3a'], [9.8, 4.2, 1.2, 'Lumi', '#9a63ff']];
      S.squad = squad.map(([x, z, r, n, c]) => { const e = put(S, n, c, x, z, r, { face: 0 }); return e; }); S.hero = S.squad[0];
      crowd(S, 12, [[0, 2, 14]], 25, 5); S.pre = (S) => { for (const e of S.squad) { e.ctl.x = e.ctl.z = 0; e.vx = e.vz = 0; } }; return S; }, time: (u) => u },
];
for (const s of SHOTS) { s.t0 = s.b0 * BEAT; s.t1 = s.b1 * BEAT; s.f0 = Math.round(s.t0 * FPS); s.f1 = Math.round(s.t1 * FPS); }
export const DUR = SHOTS[SHOTS.length - 1].t1;
export const shotAtFrame = (f) => SHOTS.find((s) => f >= s.f0 && f < s.f1) || SHOTS[SHOTS.length - 1];
