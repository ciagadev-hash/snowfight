// Snowfight arena: snowballs on a shrinking ice floe. Push others off, scoop snow, grow, cash out.
// One engine runs both the hero backdrop (attract mode, bots only) and the game (you + bots).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const COLS = ['#ff4d5e', '#2fd3a0', '#ffc233', '#3d6bff', '#ff7a2f', '#b45cff', '#00b7ff', '#ff5fc8', '#7ed957', '#ffffff'];
const NAMES = ['Frosty', 'Slushie', 'Blizz', 'Pebble', 'Mochi', 'Flurry', 'Igloo', 'Sleet', 'Nippy', 'Chill', 'Drift', 'Powder', 'Yeti', 'Glacier'];
const $$ = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };

// value noise for lumpy snow
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const noise3 = (x, y, z) => { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz, u = (t) => t * t * (3 - 2 * t);
  let v = 0; for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) v += hash(ix + a, iy + b, iz + c) * (a ? u(fx) : 1 - u(fx)) * (b ? u(fy) : 1 - u(fy)) * (c ? u(fz) : 1 - u(fz)); return v; };

export function createArena(canvas, ui, opts = {}) {
  const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false }); R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.outputColorSpace = THREE.SRGBColorSpace;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = .9; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(36, 1, .1, 400);
  sc.environment = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), .02).texture; sc.environmentIntensity = .5;
  { const c = $$('canvas'); c.width = 16; c.height = 512; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#6fb7ff'); g.addColorStop(.45, '#b9dcff'); g.addColorStop(.62, '#ffe6d6'); g.addColorStop(1, '#ffd2bd'); x.fillStyle = g; x.fillRect(0, 0, 16, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; sc.background = t; }
  sc.fog = new THREE.Fog(0xffe2d2, 70, 190);
  sc.add(new THREE.HemisphereLight(0xd6ebff, 0x3f7ea6, .8));
  const sun = new THREE.DirectionalLight(0xffecd6, 3); sun.position.set(-16, 26, 12); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 5; sun.shadow.bias = -.0005;
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 90 }); sc.add(sun, sun.target);
  const back = new THREE.DirectionalLight(0x9fd2ff, 1.2); back.position.set(12, 8, -16); sc.add(back);
  let sd = 9; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const grain = () => { const c = $$('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 4000; i++) { const v = 90 + rnd() * 165 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.beginPath(); x.arc(rnd() * 256, rnd() * 256, rnd() * 1.6 + .3, 0, 7); x.fill(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); return t; };
  const bump = grain();
  // sea + icebergs
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshPhysicalMaterial({ color: 0x0f6f8c, roughness: .38, clearcoat: .2, envMapIntensity: .25 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -1.4; sea.receiveShadow = true; sc.add(sea);
  const iceM = new THREE.MeshPhysicalMaterial({ color: 0xd9efff, roughness: .55, sheen: 1, sheenColor: new THREE.Color(0x9fd6ff), flatShading: true });
  for (let i = 0; i < 9; i++) { const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position; for (let k = 0; k < p.count; k++) { const v = new THREE.Vector3().fromBufferAttribute(p, k); v.multiplyScalar(.7 + noise3(v.x * 1.6 + i, v.y * 1.6, v.z * 1.6) * .7); if (v.y < 0) v.y *= .2; p.setXYZ(k, v.x, v.y, v.z); } g.computeVertexNormals();
    const m = new THREE.Mesh(g, iceM), a = i / 9 * Math.PI * 2 + rnd(), d = 85 + rnd() * 40; m.scale.set(6 + rnd() * 8, 4 + rnd() * 6, 6 + rnd() * 6); m.position.set(Math.cos(a) * d, -1.4, Math.sin(a) * d); sc.add(m); }
  // the floe: radius changes with the round
  const FMAX = 30; let FR = FMAX;
  const floeTop = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshPhysicalMaterial({ color: 0xeef5fc, roughness: .8, sheen: .8, sheenColor: new THREE.Color(0xbfe4ff), bumpMap: bump, bumpScale: .5 })); floeTop.rotation.x = -Math.PI / 2; floeTop.receiveShadow = true;
  const floeSide = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.04, 1.4, 96, 1, true), new THREE.MeshPhysicalMaterial({ color: 0x7fd0ff, roughness: .08, clearcoat: 1, emissive: 0x1d6fa8, emissiveIntensity: .25 })); floeSide.position.y = -.7;
  const edge = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 96), new THREE.MeshBasicMaterial({ color: 0x7fc4ff, transparent: true, opacity: .7 })); edge.rotation.x = -Math.PI / 2; edge.position.y = .03;
  const floe = new THREE.Group(); floe.add(floeTop, floeSide, edge); sc.add(floe);
  // snow piles to scoop up
  const pileG = new THREE.IcosahedronGeometry(.42, 2), pileM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .9, sheen: 1, sheenColor: new THREE.Color(0xbfe4ff) });
  const PILES = 140, piles = new THREE.InstancedMesh(pileG, pileM, PILES); piles.castShadow = true; sc.add(piles); const pile = [];
  const dummy = new THREE.Object3D();
  const placePile = (i) => { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (FR - 1.5); pile[i] = { x: Math.cos(a) * d, z: Math.sin(a) * d, s: .7 + rnd() * .6 }; };
  for (let i = 0; i < PILES; i++) placePile(i);
  // falling snow
  const flakeT = (() => { const c = $$('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const FL = 900, fg = new THREE.BufferGeometry(), fp = new Float32Array(FL * 3); for (let i = 0; i < FL; i++) { fp[i * 3] = (rnd() - .5) * 120; fp[i * 3 + 1] = rnd() * 40; fp[i * 3 + 2] = (rnd() - .5) * 120; } fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const flakes = new THREE.Points(fg, new THREE.PointsMaterial({ map: flakeT, size: .35, transparent: true, depthWrite: false, opacity: .9 })); sc.add(flakes);

  // ---- snowball players
  const bodyG = (() => { const g = new THREE.IcosahedronGeometry(1, 14), p = g.attributes.position, cols = []; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i), n = noise3(v.x * 2.4, v.y * 2.4, v.z * 2.4) * .6 + noise3(v.x * 5, v.y * 5, v.z * 5) * .4; v.multiplyScalar(.94 + n * .12); p.setXYZ(i, v.x, v.y, v.z); const ao = .84 + n * .16; cols.push(ao, ao, ao * 1.02); } g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); return g; })();
  const bodyM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: .78, bumpMap: bump, bumpScale: .8, sheen: 1, sheenColor: new THREE.Color(0xa9d8ff), sheenRoughness: .5, clearcoat: .2, clearcoatRoughness: .5 });
  const eyeM = new THREE.MeshPhysicalMaterial({ color: 0x0b1626, roughness: .05, clearcoat: 1 }), shineM = new THREE.MeshBasicMaterial({ color: 0xffffff }), blushM = new THREE.MeshBasicMaterial({ color: 0xff8fa3, transparent: true, opacity: .6 });
  const eyeG = new THREE.SphereGeometry(.15, 20, 14), shG = new THREE.SphereGeometry(.05, 10, 8), sh2G = new THREE.SphereGeometry(.022, 8, 6), blG = new THREE.CircleGeometry(.11, 16), mouthG = new THREE.TorusGeometry(.11, .03, 8, 20, Math.PI);
  const capG = new THREE.SphereGeometry(1.03, 40, 20, 0, Math.PI * 2, 0, Math.PI * .36), bandG = new THREE.TorusGeometry(.92, .13, 12, 40), pomG = new THREE.IcosahedronGeometry(.24, 2);
  const hatM = {}; const hatMat = (c) => hatM[c] || (hatM[c] = new THREE.MeshPhysicalMaterial({ color: c, roughness: .65, sheen: 1, sheenColor: new THREE.Color(c) }));
  function makeBall(col) {
    const g = new THREE.Group(), spin = new THREE.Group(), body = new THREE.Mesh(bodyG, bodyM); body.castShadow = true; spin.add(body);
    const F = new THREE.Group(); for (const s of [-1, 1]) { const e = new THREE.Mesh(eyeG, eyeM); e.scale.set(1, 1.35, .5); e.position.set(s * .3, .14, .96); const h = new THREE.Mesh(shG, shineM); h.position.set(s * .3 + .05, .22, 1.03); const h2 = new THREE.Mesh(sh2G, shineM); h2.position.set(s * .3 - .04, .07, 1.03); const b = new THREE.Mesh(blG, blushM); b.position.set(s * .5, -.08, .87); b.lookAt(s * 3, -.4, 5); F.add(e, h, h2, b); }
    const m = new THREE.Mesh(mouthG, eyeM); m.rotation.z = Math.PI; m.position.set(0, -.1, .99); F.add(m);
    const hm = hatMat(col), hat = new THREE.Group(), cap = new THREE.Mesh(capG, hm), band = new THREE.Mesh(bandG, hm), pom = new THREE.Mesh(pomG, pileM); band.rotation.x = Math.PI / 2; band.position.y = .42; pom.position.y = 1.12; cap.castShadow = true; hat.add(cap, band, pom); hat.rotation.z = -.12;
    g.add(spin, F, hat); g.userData = { spin, F }; sc.add(g); return g;
  }
  const ents = []; let me = null, uid = 0;
  function spawn(bot, name, col) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (FR * .7); const e = { id: ++uid, bot, name, col, x: Math.cos(a) * d, z: Math.sin(a) * d, vx: 0, vz: 0, r: bot ? .8 + rnd() * .9 : 1, alive: true, fall: 0, mesh: makeBall(col), dir: rnd() * 7, last: null, lastT: 0, tgt: null, think: 0, boost: 0, cash: 0, kills: 0 };
    e.tag = $$('div', 'ptag'); e.tag.innerHTML = `<b></b><span>${name}${bot ? ' <i>bot</i>' : ''}</span>`; ui.appendChild(e.tag); ents.push(e); return e; }
  function remove(e) { sc.remove(e.mesh); e.tag.remove(); ents.splice(ents.indexOf(e), 1); }
  const BOTS = opts.bots || 13; for (let i = 0; i < BOTS; i++) spawn(true, NAMES[i % NAMES.length], COLS[i % (COLS.length - 1)]);

  // value: every unit of snow area is worth RATE dollars (the pot spread over all snow in play)
  const RATE = opts.rate || 1.6, value = (e) => e.r * e.r * RATE, money = (v) => '$' + v.toFixed(2);
  const CASH_MIN = opts.cashMin || 8;

  // input
  const input = { x: 0, z: 0, active: false, boost: false, cash: false };
  function onPointer(e) { const b = canvas.getBoundingClientRect(), px = (e.clientX - b.left) / b.width - .5, py = (e.clientY - b.top) / b.height - .5; input.x = px; input.z = py; input.active = true; }
  canvas.addEventListener('pointermove', onPointer); canvas.addEventListener('pointerdown', (e) => { onPointer(e); if (e.pointerType !== 'mouse') input.touch = true; });
  addEventListener('keydown', (e) => { if (e.code === 'Space') { input.boost = true; e.preventDefault(); } if (e.code === 'KeyE') input.cash = true; });
  addEventListener('keyup', (e) => { if (e.code === 'Space') input.boost = false; if (e.code === 'KeyE') input.cash = false; });

  let round = 0, t0 = performance.now(), last = t0, vis = true, state = 'attract', listeners = {};
  const emit = (k, v) => (listeners[k] || []).forEach((f) => f(v));
  new IntersectionObserver((es) => { vis = es[0].isIntersecting; }).observe(canvas);

  function size() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  size(); addEventListener('resize', size);

  function step(dt, t) {
    // the floe breathes: shrinks over 90 s, then refreezes
    const ph = (t / 90) % 1; FR = ph < .85 ? FMAX - (FMAX - 13) * (ph / .85) : 13 + (FMAX - 13) * ((ph - .85) / .15);
    floe.scale.set(FR, 1, FR);
    // bots think
    for (const e of ents) if (e.bot && e.alive && !e.fall) {
      e.think -= dt; if (e.think <= 0) { e.think = .4 + rnd() * .6;
        let best = null, bd = 1e9; for (const o of ents) if (o !== e && o.alive && !o.fall && o.r < e.r * .85) { const d = Math.hypot(o.x - e.x, o.z - e.z); if (d < 9 && d < bd) { bd = d; best = o; } }
        if (best) e.tgt = { x: best.x, z: best.z, hunt: true }; else { let pi = -1, pd = 1e9; for (let i = 0; i < PILES; i++) { const p = pile[i], d = Math.hypot(p.x - e.x, p.z - e.z); if (d < pd) { pd = d; pi = i; } } e.tgt = pile[pi] ? { x: pile[pi].x, z: pile[pi].z } : null; }
        const dc = Math.hypot(e.x, e.z); if (dc > FR - 3) e.tgt = { x: 0, z: 0 }; e.boost = e.tgt && e.tgt.hunt && rnd() < .5 ? .5 : 0; }
      if (e.tgt) { const dx = e.tgt.x - e.x, dz = e.tgt.z - e.z, d = Math.hypot(dx, dz) || 1; push(e, dx / d, dz / d, dt); }
      if (e.boost > 0) e.boost -= dt; }
    // you
    if (me && me.alive && !me.fall) {
      if (me.cashing) { me.cash += dt; emit('cashing', me.cash / 3); if (me.cash >= 3) { const v = value(me); me.alive = false; me.cashed = v; emit('cashout', v); } }
      else if (input.active) { const d = Math.hypot(input.x, input.z) || 1; push(me, input.x / d, input.z / d, dt * Math.min(1, d * 4)); }
      if (input.boost && me.r > .9 && !me.cashing) { me.boost = .1; me.r = Math.sqrt(Math.max(.8, me.r * me.r - dt * .35)); }
    }
    // physics
    for (const e of ents) { if (!e.alive) continue; const k = Math.pow(.18, dt); e.vx *= k; e.vz *= k; e.x += e.vx * dt; e.z += e.vz * dt; }
    for (let i = 0; i < ents.length; i++) for (let j = i + 1; j < ents.length; j++) { const a = ents[i], b = ents[j]; if (!a.alive || !b.alive || a.fall || b.fall) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = a.r + b.r; if (d > 0 && d < m) { const nx = dx / d, nz = dz / d, ov = m - d, ma = a.r * a.r, mb = b.r * b.r, rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        a.x -= nx * ov * mb / (ma + mb); a.z -= nz * ov * mb / (ma + mb); b.x += nx * ov * ma / (ma + mb); b.z += nz * ov * ma / (ma + mb);
        if (rel > 0) { const imp = rel * 2.2 / (ma + mb); a.vx -= imp * mb * nx; a.vz -= imp * mb * nz; b.vx += imp * ma * nx; b.vz += imp * ma * nz; }
        b.last = a; b.lastT = t; a.last = b; a.lastT = t; if (a.cashing) a.cashing = false, a.cash = 0, emit('cashbreak'); if (b.cashing) b.cashing = false, b.cash = 0, emit('cashbreak'); } }
    // scoop snow, fall off the edge
    for (const e of ents) { if (!e.alive) continue;
      if (!e.fall) { for (let i = 0; i < PILES; i++) { const p = pile[i]; if (Math.hypot(p.x - e.x, p.z - e.z) < e.r + .3) { e.r = Math.sqrt(e.r * e.r + .06 * p.s); placePile(i); } }
        if (Math.hypot(e.x, e.z) > FR + e.r * .2) { e.fall = .001; const k = e.last && t - e.lastT < 3 && e.last.alive ? e.last : null; if (k) { k.r = Math.sqrt(k.r * k.r + e.r * e.r * .6); k.kills++; if (k === me) emit('knock', { name: e.name, v: value(e) * .6 }); } if (e === me) emit('fell', value(e)); } }
      else { e.fall += dt; if (e.fall > 1.6) { if (e.bot) { remove(e); spawn(true, NAMES[(uid) % NAMES.length], COLS[uid % (COLS.length - 1)]); } else e.alive = false; } } }
    for (let i = 0; i < PILES; i++) { const p = pile[i]; if (Math.hypot(p.x, p.z) > FR - 1) placePile(i); dummy.position.set(p.x, .12, p.z); dummy.scale.set(p.s, p.s * .55, p.s); dummy.updateMatrix(); piles.setMatrixAt(i, dummy.matrix); } piles.instanceMatrix.needsUpdate = true;
  }
  function push(e, dx, dz, dt) { const acc = (e.boost > 0 ? 34 : 16) / (.7 + e.r * .35); e.vx += dx * acc * dt; e.vz += dz * acc * dt; e.dir = Math.atan2(dx, dz); }

  const v3 = new THREE.Vector3();
  function draw(t) {
    for (const e of ents) { const g = e.mesh; g.visible = e.alive || e.fall > 0 && e.fall < 1.6; if (!g.visible) { e.tag.style.display = 'none'; continue; }
      const y = e.fall ? e.r * .95 - e.fall * e.fall * 6 : e.r * .95; g.position.set(e.x, y, e.z); g.scale.setScalar(e.r); g.rotation.y += ((e.dir) - g.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI > 0 ? .08 : -.08;
      g.rotation.y = e.dir; const sp = Math.hypot(e.vx, e.vz); g.userData.spin.rotation.x += sp * .016 / e.r; g.rotation.z = e.fall ? e.fall * 1.5 : 0;
      v3.set(e.x, y + e.r * 2.2, e.z).project(cam); const vis2 = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1; e.tag.style.display = vis2 ? '' : 'none';
      if (vis2) { e.tag.style.transform = `translate(${(v3.x * .5 + .5) * canvas.clientWidth}px,${(-v3.y * .5 + .5) * canvas.clientHeight}px) translate(-50%,-100%)`; e.tag.firstChild.textContent = money(value(e)); e.tag.classList.toggle('me', e === me); e.tag.classList.toggle('rich', value(e) >= CASH_MIN); } }
    // camera: orbit in attract mode, follow you in play
    if (state === 'play' && me) { const f = me.fall ? 0 : 1, h = 13 + me.r * 5, d = 16 + me.r * 5; cam.position.lerp(v3.set(me.x, h, me.z + d), .08); cam.lookAt(me.x, 0, me.z - 2); }
    else { const a = t * .05; cam.position.set(Math.sin(a) * 46, 22, Math.cos(a) * 46); cam.lookAt(0, -2, 0); }
    sun.position.set(cam.position.x - 16, 26, cam.position.z + 12); sun.target.position.set(cam.position.x, 0, cam.position.z - 16);
    const p = fg.attributes.position; for (let i = 0; i < FL; i++) { let y = p.getY(i) - .04; if (y < -1) y = 40; p.setY(i, y); } p.needsUpdate = true; flakes.position.set(cam.position.x, 0, cam.position.z - 20);
    R.render(sc, cam);
  }
  function loop(now) { requestAnimationFrame(loop); if (!vis) { last = now; return; } const dt = Math.min(.05, (now - last) / 1000); last = now; const t = (now - t0) / 1000; step(dt, t); draw(t);
    if (state === 'play' && me) emit('hud', { v: value(me), r: me.r, alive: me.alive, fall: me.fall, rank: 1 + ents.filter((o) => o.alive && o !== me && o.r > me.r).length, n: ents.filter((o) => o.alive).length, can: value(me) >= CASH_MIN, kills: me.kills, floe: FR / FMAX }); }
  requestAnimationFrame(loop);
  return {
    on(k, f) { (listeners[k] = listeners[k] || []).push(f); },
    play(name, col) { if (me) remove(me); me = spawn(false, name, col); me.x = 0; me.z = 0; me.r = 1; state = 'play'; input.active = false; },
    stop() { if (me) remove(me); me = null; state = 'attract'; },
    cashout(on) { if (me && me.alive && !me.fall && value(me) >= CASH_MIN) { me.cashing = on; if (!on) me.cash = 0; } },
    boost(on) { input.boost = on; },
    steer(x, z) { input.x = x; input.z = z; input.active = true; },
    CASH_MIN, money,
  };
}
