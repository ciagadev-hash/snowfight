// SnowPump world: the arctic scene, the snowball characters and every effect, drawn from a running sim.
// Everything that repeats is instanced, so the whole arena is about 25 draw calls. No shadow maps: soft blob shadows.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPAWN_T, FALL_T } from './sim.js';

export const PAL = { ink: '#152b6b', pink: '#ff4f9e', green: '#2ee07e', blue: '#3aa8ff', white: '#ffffff' };
const SEA_Y = -1.4, MAXC = 64;

// ---- small deterministic noise (geometry only)
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const noise3 = (x, y, z) => { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz, u = (t) => t * t * (3 - 2 * t); let v = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) v += hash3(ix + a, iy + b, iz + c) * (a ? u(fx) : 1 - u(fx)) * (b ? u(fy) : 1 - u(fy)) * (c ? u(fz) : 1 - u(fz)); return v; };
const lumpy = (g0, amp, f1, f2, ao = true) => { g0.deleteAttribute('normal'); g0.deleteAttribute('uv'); const g = mergeVertices(g0), p = g.attributes.position, v = new THREE.Vector3(), cols = []; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = noise3(v.x * f1, v.y * f1, v.z * f1) * .65 + noise3(v.x * f2 + 9, v.y * f2, v.z * f2) * .35; v.multiplyScalar(1 - amp + n * amp * 2); p.setXYZ(i, v.x, v.y, v.z); const a = .86 + n * .14; cols.push(a, a, Math.min(1, a * 1.03)); }
  if (ao) g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); return g; };
const angLerp = (a, b, k) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; };
const ease = { out: (x) => 1 - Math.pow(1 - x, 3), back: (x) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); } };
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// GLSL helpers shared by the custom shaders
const GLSL_NOISE = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), u.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), u.x), u.y); }
float fbm(vec2 p){ return vn(p) * .55 + vn(p * 2.03 + 7.1) * .28 + vn(p * 4.1 + 3.7) * .17; }`;

// snow look for standard materials: cool rim light + glitter that sticks to the surface
function snowify(m, glitter = 1) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjP;\nfloat gh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }')
      .replace('#include <opaque_fragment>', `vec3 vd = normalize(vViewPosition); float rim = pow(1. - clamp(dot(normal, vd), 0., 1.), 2.6);
        outgoingLight += vec3(.42, .72, 1.) * rim * .32;
        vec3 cell = floor(vObjP * 34.); float g = step(.985, gh(cell)) * pow(clamp(dot(normal, normalize(vd + vec3(.3, .7, .2))), 0., 1.), 10.);
        outgoingLight += vec3(1.) * g * ${glitter.toFixed(2)} * 1.6;
        #include <opaque_fragment>`);
  };
  return m;
}

function canvasTex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } t.anisotropy = 4; return t; }

export function createWorld(canvas, o = {}) {
  const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: !!o.alpha, powerPreference: 'high-performance', preserveDrawingBuffer: !!o.film });
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.NeutralToneMapping; R.toneMappingExposure = 1.04;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, .3, 900);
  const W = { R, scene, cam, time: 0, faceCam: o.faceCam ?? .25, faceMax: o.faceMax ?? 1.05, rigs: new Map(), FR: 30, next: 30, sun: new THREE.Vector3(-.45, .78, .42).normalize() };
  const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(new RoomEnvironment(), .03).texture; scene.environmentIntensity = .6;
  scene.add(new THREE.HemisphereLight(0xe4f4ff, 0x7cc4ee, 1.15));
  const sunL = new THREE.DirectionalLight(0xfff3e4, 2.3); sunL.position.copy(W.sun).multiplyScalar(50); scene.add(sunL);
  const fill = new THREE.DirectionalLight(0xb8e0ff, .7); fill.position.set(30, 12, -40); scene.add(fill);
  scene.fog = new THREE.Fog(0xc4ecff, 140, 420);
  const U = { uT: { value: 0 }, uSun: { value: W.sun }, uCam: { value: cam.position }, uFR: { value: 30 }, uNext: { value: 30 } };

  // ---- sky dome
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: U.uSun },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec3 vD; uniform vec3 uSun;
      void main(){ float y = vD.y; vec3 top = vec3(.10, .45, 1.), mid = vec3(.36, .74, 1.), hor = vec3(.80, .95, 1.);
        vec3 c = mix(hor, mid, smoothstep(.0, .2, y)); c = mix(c, top, smoothstep(.18, .75, y)); c = mix(c, vec3(.72, .9, 1.), smoothstep(.02, -.1, y));
        float s = max(dot(vD, uSun), 0.); c += vec3(1., .96, .86) * (pow(s, 60.) * .5 + pow(s, 6.) * .12);
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }` }));
  sky.renderOrder = -10; scene.add(sky);
  // soft clouds on the horizon, one merged billboard mesh
  { const tex = canvasTex(256, 128, (x, w, h) => { const puff = (cx, cy, r, a) => { const g = x.createRadialGradient(cx, cy - r * .3, r * .1, cx, cy, r); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(.7, `rgba(240,248,255,${a * .9})`); g.addColorStop(1, 'rgba(230,244,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
      [[70, 80, 46], [118, 64, 56], [168, 78, 44], [200, 90, 30], [44, 94, 28], [128, 92, 40]].forEach(([a, b, r]) => puff(a, b, r, .95)); });
    const gs = []; let sd = 5; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + rr() * .3, d = 480, w = 120 + rr() * 140, g = new THREE.PlaneGeometry(w, w * .5); g.rotateY(-a - Math.PI / 2); g.translate(Math.cos(a) * d, 18 + rr() * 50, Math.sin(a) * d); gs.push(g); }
    const cm = new THREE.Mesh(mergeGeometries(gs), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: .95 })); cm.renderOrder = -9; scene.add(cm); }

  // ---- sea: shallow shelf by the floe, deep blue further out, foam at the edge, ripples from splashes
  const rip = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -99, 0)); let ripI = 0;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ fog: false,
    uniforms: { ...U, uRip: { value: rip } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform float uT, uFR; uniform vec3 uSun, uCam; uniform vec4 uRip[8];
      ${GLSL_NOISE}
      void main(){
        vec2 p = vW.xz; float d = length(p), dd = d - uFR;
        vec2 g = vec2(cos(p.x * .33 + uT * 1.1), cos(p.y * .29 - uT * .9)) * .1;
        g += (vec2(vn(p * .5 + uT * .35), vn(p * .5 - uT * .3 + 4.)) - .5) * .5;
        g += (vec2(vn(p * 1.7 - uT * .8), vn(p * 1.7 + uT * .7 + 9.)) - .5) * .22;
        float rf = 0.;
        for (int i = 0; i < 8; i++) { vec4 r = uRip[i]; float a = uT - r.z; if (a < 0. || a > 3.2) continue; vec2 q = p - r.xy; float l = length(q), ring = 1.2 + a * 5.;
          float w = exp(-pow((l - ring) * 1.2, 2.)) * (1. - a / 3.2) * r.w; g += q / (l + .001) * sin((l - ring) * 5.) * w * .9; rf += w * (.6 + .4 * sin((l - ring) * 5.)); }
        vec3 n = normalize(vec3(-g.x, 1., -g.y)), v = normalize(uCam - vW);
        float fr = pow(1. - max(dot(n, v), 0.), 4.);
        vec3 shallow = vec3(.2, .84, .86), mid = vec3(.02, .6, .86), deep = vec3(.01, .33, .74);
        vec3 col = mix(shallow, mid, smoothstep(.5, 9., dd)); col = mix(col, deep, smoothstep(10., 70., dd));
        col *= .7 + .45 * clamp(dot(n, normalize(uSun + vec3(0., 0., 0.))) , 0., 1.); col += vec3(.08, .2, .24) * smoothstep(.6, .85, fbm(p * 1.1 + g * 2. + uT * .2)) * smoothstep(9., 0., dd);
        col = mix(col, vec3(.7, .9, 1.), fr * .5);
        vec3 h = normalize(uSun + v); col += vec3(1., .98, .92) * pow(max(dot(n, h), 0.), 260.) * 2.2;
        col += step(.993, h21(floor(p * 2.6) + floor(uT * 5.) * .31)) * pow(max(dot(n, h), 0.), 30.) * 1.4;
        float fn = fbm(p * .45 + vec2(uT * .25, -uT * .2)), band = dd - .15 - fn * .9;
        float foam = smoothstep(.75, .1, abs(band)) * smoothstep(2.4, .3, dd) * (.55 + .45 * fbm(p * 1.3 + uT * .4));
        foam += smoothstep(.15, -.2, dd) * .7;
        col = mix(col, vec3(.97, .99, 1.), clamp(foam + rf * .7, 0., 1.));
        col = mix(col, vec3(.77, .93, 1.), smoothstep(140., 520., length(vW.xz - uCam.xz)));
        gl_FragColor = vec4(col, 1.);
        #include <colorspace_fragment>
      }` }));
  sea.position.y = SEA_Y; scene.add(sea);
  W.ripple = (x, z, s = 1) => { rip[ripI].set(x, z, W.time, s); ripI = (ripI + 1) % rip.length; };

  // icebergs: one merged, flat-shaded mesh with white tops and cyan sides
  { const gs = []; let sd = 11; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 11; i++) { let g = lumpy(new THREE.IcosahedronGeometry(1, 2), .32, 1.3, 3.1, false); const pp = g.attributes.position; for (let k = 0; k < pp.count; k++) if (pp.getY(k) < 0) pp.setY(k, pp.getY(k) * .25);
      g = g.toNonIndexed(); const p = g.attributes.position, cols = []; for (let k = 0; k < p.count; k += 3) { const y = (p.getY(k) + p.getY(k + 1) + p.getY(k + 2)) / 3, c = y > .5 ? [.98, .995, 1] : y > .15 ? [.8, .95, 1] : [.5, .86, 1]; cols.push(...c, ...c, ...c); }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
      const a = i / 11 * Math.PI * 2 + rr() * .4, d = 95 + rr() * 90, s = 6 + rr() * 12; g.scale(s * (1 + rr() * .6), s * (.7 + rr() * .8), s * (1 + rr() * .5)); g.rotateY(rr() * 6); g.translate(Math.cos(a) * d, SEA_Y, Math.sin(a) * d); gs.push(g); }
    const berg = new THREE.Mesh(mergeGeometries(gs), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .5, metalness: 0 })); scene.add(berg); W.berg = berg; }

  // ---- the floe: snow top with soft blue patches, a wet rim, cracks in the zone that is about to break off
  const OUT = 180, outline = []; for (let i = 0; i <= OUT; i++) { const a = i / OUT * Math.PI * 2, n = noise3(Math.cos(a) * 3, Math.sin(a) * 3, 1) - .5; outline.push([Math.cos(a), Math.sin(a), 1 + n * .022]); }
  const topG = new THREE.BufferGeometry(); { const pos = [0, 0, 0], idx = []; outline.forEach(([c, s, k]) => pos.push(c * k, 0, s * k)); for (let i = 1; i <= OUT; i++) idx.push(0, i + 1 > OUT + 1 ? 1 : i + 1, i); topG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); topG.setIndex(idx); topG.computeVertexNormals(); }
  const floeTop = new THREE.Mesh(topG, new THREE.ShaderMaterial({ uniforms: U,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform float uT, uFR, uNext; uniform vec3 uSun, uCam;
      ${GLSL_NOISE}
      vec2 h22(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
      float crack(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 b = vec2(float(x), float(y)), r = b + h22(i + b) - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; } return sqrt(d2) - sqrt(d1); }
      void main(){
        vec2 p = vW.xz; float d = length(p), te = uFR - d;
        float n = fbm(p * .09) * .6 + fbm(p * .35 + 3.) * .4;
        vec3 col = mix(vec3(.8, .89, .99), vec3(.93, .965, 1.), smoothstep(.3, .66, n));
        float e = .6, hx = fbm((p + vec2(e, 0.)) * .35) - fbm((p - vec2(e, 0.)) * .35), hz = fbm((p + vec2(0., e)) * .35) - fbm((p - vec2(0., e)) * .35);
        col *= 1. + (hx * uSun.x + hz * uSun.z) * -.22;
        col = mix(vec3(.72, .89, 1.), col, smoothstep(.0, .9, te));
        float gap = uFR - uNext, dz = smoothstep(uNext - .3, uNext + .8, d) * smoothstep(.3, 1.2, gap);
        float pulse = .5 + .5 * sin(uT * 7.);
        float c = crack(p * .42), line = smoothstep(.07, .0, c) * dz;
        col = mix(col, vec3(.7, .88, 1.), dz * .45);
        col = mix(col, vec3(.25, .5, .95), line * (.55 + .35 * pulse));
        float an = atan(p.y, p.x) / 6.28318, dash = step(.45, fract(an * floor(uNext * 2.) - uT * .3));
        col = mix(col, vec3(1., .33, .6), smoothstep(.16, .0, abs(d - uNext)) * smoothstep(.3, 1.2, gap) * dash * (.75 + .25 * pulse));
        vec3 v = normalize(uCam - vW);
        col += step(.991, h21(floor(p * 6.) + floor(v.xz * 14.) * .17)) * .55;
        gl_FragColor = vec4(col, 1.);
        #include <colorspace_fragment>
      }` }));
  const sideG = new THREE.BufferGeometry(); { const rows = [[1.0, 0], [1.004, -.06], [1.008, -.4], [1.018, -1.4], [1.03, -2.6]], pos = [], uv = [], idx = [];
    rows.forEach(([k, y], r) => outline.forEach(([c, s, n], i) => { pos.push(c * n * k, y, s * n * k); uv.push(i / OUT, r / (rows.length - 1)); }));
    for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < OUT; i++) { const a = r * (OUT + 1) + i, b = a + 1, c = a + OUT + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    sideG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sideG.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sideG.setIndex(idx); sideG.computeVertexNormals(); }
  const floeSide = new THREE.Mesh(sideG, new THREE.ShaderMaterial({ uniforms: U,
    vertexShader: 'varying vec3 vW; varying vec3 vN; varying vec2 vUv; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; varying vec3 vN; varying vec2 vUv; uniform vec3 uSun, uCam; uniform float uFR;
      ${GLSL_NOISE}
      void main(){ float y = vW.y; vec3 v = normalize(uCam - vW), n = normalize(vec3(vN.x, vN.y * .2, vN.z));
        vec3 col = mix(vec3(.12, .66, .93), vec3(.5, .9, 1.), smoothstep(-1.45, -.25, y)); col = mix(col, vec3(.93, .99, 1.), smoothstep(-.09, -.01, y));
        float st = vn(vec2(vW.x * .9 + vW.z * .3, y * .7)) * abs(vN.z) + vn(vec2(vW.z * .9 - vW.x * .3, y * .7) + 5.) * abs(vN.x); col *= .9 + st * .18;
        col += vec3(.7, .95, 1.) * pow(1. - abs(dot(n, v)), 3.) * .35;
        col *= .85 + .2 * clamp(dot(n, uSun) * .5 + .5, 0., 1.);
        gl_FragColor = vec4(col, 1.);
        #include <colorspace_fragment>
      }` }));
  const floe = new THREE.Group(); floe.add(floeTop, floeSide); scene.add(floe);

  // ---- shared snow + character materials
  const snowM = snowify(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .82, metalness: 0 }));
  const knit = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const cx = c * 16 + 8, cy = r * 16 + 8;
    for (const s of [-1, 1]) { const g = x.createRadialGradient(cx + s * 3.5, cy, 1, cx + s * 3.5, cy, 7); g.addColorStop(0, '#f2f2f2'); g.addColorStop(1, '#5a5a5a'); x.fillStyle = g; x.save(); x.translate(cx + s * 3.5, cy); x.rotate(s * .5); x.scale(.55, 1.15); x.beginPath(); x.arc(0, 0, 7, 0, 7); x.fill(); x.restore(); } } }, [1, 1]);
  const ribs = canvasTex(64, 16, (x, w, h) => { for (let i = 0; i < w; i++) { const v = 128 + Math.sin(i / w * Math.PI * 2 * 8) * 60 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, 0, 1, h); } }, [1, 1]);
  knit.colorSpace = ribs.colorSpace = THREE.NoColorSpace;
  const capM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .72, bumpMap: knit, bumpScale: 1.5, sheen: .8, sheenRoughness: .6, sheenColor: new THREE.Color(0xffffff) });
  const bandM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .75, bumpMap: ribs, bumpScale: 1.6, sheen: .8, sheenRoughness: .6, sheenColor: new THREE.Color(0xffffff) });
  const eyeM = new THREE.MeshPhysicalMaterial({ color: 0x0d1430, roughness: .1, clearcoat: 1, clearcoatRoughness: .04, metalness: 0 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x25142e, roughness: .4 });
  const shineM = new THREE.MeshBasicMaterial({ color: 0xffffff }), blushM = new THREE.MeshBasicMaterial({ color: 0xff7fb0, transparent: true, opacity: .5, depthWrite: false });
  const pomM = snowify(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1 }), .4);

  // ---- character geometry (unit radius, centre at the origin)
  const bodyG = lumpy(new THREE.IcosahedronGeometry(1, o.lowPoly ? 8 : 12), .035, 2.3, 5.2);
  const eyeG = new THREE.SphereGeometry(.15, 22, 16); eyeG.scale(1, 1.38, .52);
  const shineG = mergeGeometries([new THREE.SphereGeometry(.052, 12, 8).translate(.05, .085, .07), new THREE.SphereGeometry(.024, 8, 6).translate(-.045, -.07, .07)]);
  const blushG = new THREE.CircleGeometry(.12, 20);
  const smileG = new THREE.TorusGeometry(.105, .03, 8, 22, Math.PI); smileG.rotateZ(Math.PI);
  const ohG = new THREE.SphereGeometry(.1, 16, 12); ohG.scale(.9, 1.2, .45);
  const grinG = new THREE.CircleGeometry(.15, 24, Math.PI, Math.PI); grinG.scale(1, .85, 1);
  const browG = new THREE.CapsuleGeometry(.032, .15, 4, 10); browG.rotateZ(Math.PI / 2);
  const arcG = new THREE.TorusGeometry(.1, .032, 8, 18, Math.PI);
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  const capG = lathe([[.9, .44], [.9, .58], [.84, .74], [.71, .89], [.52, 1.01], [.28, 1.08], [0, 1.1]], 40); capG.attributes.uv.array.forEach((v, i, a) => { a[i] = i % 2 ? v * 2 : v * 7; });
  const bandG = lathe([[.84, .33], [.95, .34], [1.0, .4], [1.01, .47], [.99, .54], [.93, .58], [.84, .59]], 48); bandG.attributes.uv.array.forEach((v, i, a) => { a[i] = i % 2 ? v : v * 7; });
  const pomG = lumpy(new THREE.IcosahedronGeometry(.27, 3), .16, 7, 15);
  const pileG = (() => { const bl = [[0, 0, 0, .5], [.34, -.06, .12, .32], [-.26, -.08, .22, .3], [.05, -.08, -.32, .3]].map(([x, y, z, r], i) => { const g = lumpy(new THREE.IcosahedronGeometry(r, 3), .14, 4 + i, 9); g.scale(1, .78, 1); g.translate(x, y + .08, z); return g; }); return mergeGeometries(bl); })();
  const shieldM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: U.uT },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.); vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; uniform float uT; void main(){ float f = pow(1. - abs(dot(normalize(vN), vV)), 2.5); gl_FragColor = vec4(vec3(.45, .85, 1.) * (f * .9 + .05) * (.8 + .2 * sin(uT * 6.)), 1.); }' });

  // instanced parts, filled per frame
  const parts = {};
  const mk = (name, geo, mat, per, color) => { const m = new THREE.InstancedMesh(geo, mat, MAXC * per); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; if (color) m.setColorAt(0, new THREE.Color()); scene.add(m); parts[name] = { m, i: 0, color }; return m; };
  mk('body', bodyG, snowM, 1); mk('eye', eyeG, eyeM, 2); mk('shine', shineG, shineM, 2); mk('blush', blushG, blushM, 2); mk('smile', smileG, darkM, 1); mk('oh', ohG, darkM, 1); mk('grin', grinG, darkM, 1);
  mk('brow', browG, darkM, 2); mk('arc', arcG, darkM, 2); mk('cap', capG, capM, 1, true); mk('band', bandG, bandM, 1, true); mk('pom', pomG, pomM, 1); mk('shield', new THREE.IcosahedronGeometry(1, 4), shieldM, 1);
  parts.blush.m.renderOrder = 2; parts.shield.m.renderOrder = 5;
  // blob shadows + cash-out rings on the ice
  const blobT = canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(20,60,130,.42)'); g.addColorStop(.55, 'rgba(30,80,160,.2)'); g.addColorStop(1, 'rgba(40,90,170,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const shadowM = new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  mk('shadow', new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shadowM, 1); parts.shadow.m.renderOrder = 1;
  const ringG = new THREE.RingGeometry(.86, 1, 64, 1).rotateX(-Math.PI / 2); const progA = new THREE.InstancedBufferAttribute(new Float32Array(MAXC), 1); ringG.setAttribute('aProg', progA);
  const ringM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: U.uT },
    vertexShader: 'attribute float aProg; varying float vP; varying vec2 vXY; void main(){ vP = aProg; vXY = position.xz; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.); }',
    fragmentShader: `varying float vP; varying vec2 vXY; uniform float uT; void main(){ float a = atan(vXY.x, -vXY.y) / 6.28318 + .5; float on = step(a, vP);
      vec3 c = mix(vec3(1.), vec3(.18, .88, .49), on); gl_FragColor = vec4(c, mix(.55, 1., on) * (.85 + .15 * sin(uT * 10.)));
      #include <colorspace_fragment>
    }` });
  mk('ring', ringG, ringM, 1); parts.ring.m.renderOrder = 3;

  // piles
  const piles = new THREE.InstancedMesh(pileG, snowM, 200); piles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); piles.frustumCulled = false; scene.add(piles);

  // falling snow: animated entirely on the GPU
  { const N = o.flakes ?? 700, g = new THREE.BufferGeometry(), seed = new Float32Array(N * 4); let sd = 3; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < N; i++) seed.set([rr() * 90, rr() * 46, rr() * 90, .5 + rr()], i * 4); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: U.uT, uCam: U.uCam, uPx: { value: 1 } },
      vertexShader: `attribute vec4 aSeed; uniform float uT, uPx; uniform vec3 uCam; varying float vA;
        void main(){ vec3 p; p.x = mod(aSeed.x + uT * .7 * aSeed.w + sin(uT * .8 + aSeed.y) * .8 - uCam.x, 90.) - 45. + uCam.x; p.y = mod(aSeed.y - uT * 2.1 * aSeed.w, 46.) - 3.; p.z = mod(aSeed.z - uCam.z, 90.) - 45. + uCam.z;
          vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * 150. * aSeed.w / -mv.z; vA = smoothstep(-3., 1., p.y) * smoothstep(120., 30., -mv.z); }`,
      fragmentShader: 'varying float vA; void main(){ vec2 q = gl_PointCoord - .5; float a = smoothstep(.5, .1, length(q)); gl_FragColor = vec4(1., 1., 1., a * vA * .9); }' }));
    pts.frustumCulled = false; scene.add(pts); W.flakes = pts; }

  // ---- particle pools
  const dummy = new THREE.Object3D(), tmpC = new THREE.Color(), tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  class Pool { constructor(geo, mat, max) { this.m = new THREE.InstancedMesh(geo, mat, max); this.m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.m.frustumCulled = false; this.m.count = 0; this.m.setColorAt(0, tmpC.set(0xffffff)); this.a = []; this.max = max; scene.add(this.m); }
    add(p) { if (this.a.length >= this.max) this.a.shift(); p.age = 0; this.a.push(p); return p; }
    update(dt) { const a = this.a; let j = 0; for (let i = 0; i < a.length; i++) { const p = a[i]; p.age += dt; if (p.age >= p.life) continue; this.step(p, dt); a[j++] = p; } a.length = j;
      for (let i = 0; i < j; i++) { const p = a[i]; this.pose(p); dummy.updateMatrix(); this.m.setMatrixAt(i, dummy.matrix); this.m.setColorAt(i, p.c); }
      this.m.count = j; this.m.instanceMatrix.needsUpdate = true; if (this.m.instanceColor) this.m.instanceColor.needsUpdate = true; } }
  const puffM = snowify(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9 }), .2);
  const snowP = new Pool(new THREE.IcosahedronGeometry(1, 1), puffM, 900);
  snowP.step = (p, dt) => { p.vy -= p.g * dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.floor != null && p.y < p.floor) { p.y = p.floor; p.vy *= -.25; p.vx *= .6; p.vz *= .6; } if (p.sea && p.y < SEA_Y) p.age = p.life; };
  snowP.pose = (p) => { const k = p.age / p.life, s = p.s * (p.grow ? Math.sin(Math.min(1, k * 1.6) * Math.PI * .5) * (1 - k * k) : 1 - k * k * k); dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(s, s * (p.flat || 1), s); };
  const chunkP = new Pool(new THREE.DodecahedronGeometry(1, 0).scale(1, .45, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3, flatShading: true }), 120);
  chunkP.step = (p, dt) => { if (p.y > SEA_Y + .05) { p.vy -= 16 * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.z += p.vz * dt; if (p.y <= SEA_Y + .05) { p.y = SEA_Y + .05; W.ripple(p.x, p.z, .25); } }
    else { p.x += p.vx * dt * .3; p.z += p.vz * dt * .3; p.y = SEA_Y + .05 + Math.sin(p.age * 2 + p.ph) * .06 - Math.max(0, p.age - p.life + 1.5) * .5; } p.ry += p.vr * dt; };
  chunkP.pose = (p) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(Math.sin(p.age * 1.3 + p.ph) * .12, p.ry, 0); dummy.scale.setScalar(p.s); };
  const confP = new Pool(new THREE.PlaneGeometry(.26, .15), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5, side: THREE.DoubleSide, emissive: 0x222222 }), 400);
  confP.step = (p, dt) => { p.vy -= 7 * dt; const k = Math.exp(-2.2 * dt); p.vx *= k; p.vy *= k; p.vz *= k; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < .03) { p.y = .03; p.vx = p.vy = p.vz = 0; } };
  confP.pose = (p) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.age * p.r1, p.age * p.r2, p.age * p.r3); dummy.scale.setScalar(1 - Math.max(0, p.age - p.life + .5) * 2); };
  const ringFxM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: 'attribute float aA; varying float vA; varying vec3 vC; void main(){ vA = aA; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying float vA; varying vec3 vC; void main(){ gl_FragColor = vec4(vC, vA);\n#include <colorspace_fragment>\n}' });
  const ringFxG = new THREE.RingGeometry(.8, 1, 72, 1).rotateX(-Math.PI / 2), ringA = new THREE.InstancedBufferAttribute(new Float32Array(80), 1); ringFxG.setAttribute('aA', ringA);
  const ringP = new Pool(ringFxG, ringFxM, 80); ringP.m.renderOrder = 4;
  ringP.step = () => {}; ringP.pose = (p) => { const k = p.age / p.life, r = p.r0 + (p.r1 - p.r0) * ease.out(k); dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(r, 1, r); };
  const ringUpd = ringP.update.bind(ringP); ringP.update = (dt) => { ringUpd(dt); ringP.a.forEach((p, i) => { ringA.array[i] = p.a * (1 - p.age / p.life); }); ringA.needsUpdate = true; };

  const C = (hex) => new THREE.Color(hex);
  const SNOWC = [C(0xffffff), C(0xeef7ff), C(0xdcefff)], WATERC = [C(0xffffff), C(0xc9f5ff), C(0x8fe6ff)], CONF = ['#ff4f9e', '#2ee07e', '#3aa8ff', '#9a63ff', '#ffffff', '#16d3c4'].map(C);
  let sd = 1; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  W.puff = (x, y, z, n, sp = 4, size = .25, up = 3, col = SNOWC) => { for (let i = 0; i < n; i++) { const a = rnd() * 6.283, v = sp * (.3 + rnd() * .7); snowP.add({ x, y, z, vx: Math.cos(a) * v, vy: up * (.4 + rnd()), vz: Math.sin(a) * v, g: 9, drag: 2.4, floor: .05, s: size * (.5 + rnd() * .8), life: .45 + rnd() * .5, c: col[i % col.length], grow: true }); } };
  W.ringFx = (x, y, z, r0, r1, life, color = 0xffffff, a = .8) => ringP.add({ x, y, z, r0, r1, life, a, c: C(color) });
  W.splash = (x, z, s = 1) => { for (let i = 0; i < 46 * s; i++) { const a = rnd() * 6.283, v = 1.5 + rnd() * 4.2 * s; snowP.add({ x: x + Math.cos(a) * .6, y: SEA_Y + .1, z: z + Math.sin(a) * .6, vx: Math.cos(a) * v, vy: 5 + rnd() * 8 * s, vz: Math.sin(a) * v, g: 20, drag: .6, sea: true, s: .1 + rnd() * .2 * s, life: 1.4, c: WATERC[i % 3] }); }
    for (let k = 0; k < 3; k++) W.ringFx(x, SEA_Y + .03, z, .5 + k * .4, 4.5 + k * 2.5 * s, 1.1 + k * .35, 0xffffff, .85 - k * .2); W.ripple(x, z, 1.3 * s); };
  W.confetti = (x, y, z, n = 140) => { for (let i = 0; i < n; i++) { const a = rnd() * 6.283, v = 2 + rnd() * 6; confP.add({ x, y, z, vx: Math.cos(a) * v, vy: 6 + rnd() * 9, vz: Math.sin(a) * v, r1: rnd() * 12 - 6, r2: rnd() * 12 - 6, r3: rnd() * 12 - 6, life: 2.2 + rnd(), c: CONF[i % CONF.length] }); } };
  W.chunk = (x, z, s = 1) => { const d = Math.hypot(x, z) || 1; chunkP.add({ x, y: -.1, z, vx: x / d * (1 + rnd() * 2), vy: 1.5 + rnd() * 2, vz: z / d * (1 + rnd() * 2), s: (.35 + rnd() * .5) * s, ry: rnd() * 6, vr: rnd() * 2 - 1, ph: rnd() * 6, life: 5 + rnd() * 3, c: C(rnd() < .5 ? 0xffffff : 0xd6f3ff) }); };

  // ---- character rig template: one Object3D tree reused to pose every snowball
  const root = new THREE.Object3D(), body = new THREE.Object3D(), head = new THREE.Object3D(), hat = new THREE.Object3D(); root.add(body, head); head.rotation.order = 'YXZ'; head.add(hat); hat.rotation.z = -.13; hat.position.y = -.02;
  const node = (parent, name, x = 0, y = 0, z = 0) => { const n = new THREE.Object3D(); n.position.set(x, y, z); n.userData.part = name; parent.add(n); return n; };
  const eyes = [-1, 1].map((s) => { const e = node(head, 'eye', s * .3, .13, .95); e.rotation.y = s * .3; e.rotation.x = -.12; return e; });
  const shines = eyes.map((e) => node(e, 'shine'));
  const blush = [-1, 1].map((s) => { const b = node(head, 'blush', s * .5, -.1, .885); b.lookAt(s * 2.6, -.5, 4.4); return b; });
  const smile = node(head, 'smile', 0, -.1, 1.01), oh = node(head, 'oh', 0, -.19, .99), grin = node(head, 'grin', 0, -.07, 1.025);
  smile.rotation.x = .1; oh.rotation.x = .2; grin.rotation.x = .08;
  const brows = [-1, 1].map((s) => node(head, 'brow', s * .3, .4, .93)), arcs = [-1, 1].map((s) => node(head, 'arc', s * .3, .1, .975));
  const cap = node(hat, 'cap'), band = node(hat, 'band'), pom = node(hat, 'pom', 0, 1.13, 0);
  const put = (n, mat) => { const P = parts[n.userData.part]; P.m.setMatrixAt(P.i, n.matrixWorld); if (mat) P.m.setColorAt(P.i, mat); P.i++; };
  const putM = (name, m, col) => { const P = parts[name]; P.m.setMatrixAt(P.i, m); if (col) P.m.setColorAt(P.i, col); P.i++; return P.i - 1; };

  function rigFor(e) { let g = W.rigs.get(e.id); if (!g) { g = { e, col: new THREE.Color(e.col), q: new THREE.Quaternion(), sq: 0, sqv: 0, air: 0, vy: 0, vr: e.r, blinkAt: 1 + (e.id * 1.37 % 3), blink: 1, happy: 0, hurt: 0, angry: 0, splashed: false, yaw: e.face, seen: W.time, wob: 0 }; W.rigs.set(e.id, g); } return g; }
  W.kick = (e, s) => { const g = W.rigs.get(e.id); if (g) g.sqv += s; };

  // ---- sim events -> effects
  W.event = (ev) => {
    const e = ev.e, g = e && W.rigs.get(e.id);
    if (ev.k === 'hit') { const s = ev.s; W.puff(ev.x, .5, ev.z, Math.min(26, 4 + s * 1.6), 2 + s * .3, .16 + Math.min(.2, s * .015), 2.5); const a = W.rigs.get(ev.a.id), b = W.rigs.get(ev.b.id);
      if (a) { a.sqv += Math.min(5, s * .35); } if (b) { b.sqv += Math.min(5, s * .35); }
      if (ev.dash) { W.ringFx(ev.x, .08, ev.z, .4, 3.4 + s * .12, .45, 0xffffff, .9); const v = ev.b.hitBy === ev.a ? b : a; if (v) { v.hurt = .8; v.vy = Math.max(v.vy, 3.5 + Math.min(7, s * .28)); v.spin = 1; } const at = v === b ? a : b; if (at) at.angry = .5;
        W.puff(ev.x, .9, ev.z, 14, 5 + s * .15, .22, 4.5); } }
    else if (ev.k === 'dash' && g) { g.angry = .55; g.sqv -= 2.2; W.puff(e.x - ev.dx * e.r, .3, e.z - ev.dz * e.r, 10, 3, .2, 1.5); }
    else if (ev.k === 'pile') { const pg = W.rigs.get(e.id); for (let i = 0; i < 6; i++) snowP.add({ x: ev.x, y: .3, z: ev.z, vx: (e.x - ev.x) * 3 + (rnd() - .5) * 3, vy: 2 + rnd() * 3, vz: (e.z - ev.z) * 3 + (rnd() - .5) * 3, g: 12, drag: 3, floor: .05, s: .14 + rnd() * .1, life: .35 + rnd() * .2, c: SNOWC[i % 3], grow: true }); if (pg) { pg.sqv += .9; pg.happy = Math.max(pg.happy, .35); } }
    else if (ev.k === 'land' && g) { g.sqv += 4; W.puff(e.x, .1, e.z, 16, 4.5, .26, 1.2); W.ringFx(e.x, .07, e.z, e.r * .8, e.r * 3, .5, 0xffffff, .7); }
    else if (ev.k === 'fall') { if (g) { g.hurt = 0; g.fallDir = Math.atan2(e.x, e.z); } if (ev.by) { const kg = W.rigs.get(ev.by.id); if (kg) kg.happy = 1.2; } for (let i = 0; i < 3; i++) W.chunk(e.x * .97, e.z * .97, .8); }
    else if (ev.k === 'cashout' && g) { W.confetti(e.x, e.r * 1.5, e.z, 160); W.ringFx(e.x, .08, e.z, e.r, e.r * 5, .9, 0x2ee07e, .9); W.ringFx(e.x, .08, e.z, e.r, e.r * 3.4, .7, 0xffffff, .9); g.happy = 3; }
    else if (ev.k === 'melt') { W.puff(ev.x, .1, ev.z, 5, 2, .18, 1); }
  };

  // ---- per-frame update
  let lastFR = 30, chunkAcc = 0;
  W.update = (sim, alpha, dt) => {
    W.time += dt; U.uT.value = W.time; W.FR = sim.FR; W.next = sim.next ?? sim.FR; U.uFR.value = W.FR; U.uNext.value = Math.min(W.FR, W.next);
    floe.scale.set(W.FR, 1, W.FR);
    // the ice breaks off in chunks while it shrinks
    if (W.FR < lastFR - 1e-4) { chunkAcc += (lastFR - W.FR) * 9; while (chunkAcc > 1) { chunkAcc--; const a = rnd() * 6.283; W.chunk(Math.cos(a) * W.FR, Math.sin(a) * W.FR); } } lastFR = W.FR;
    for (const k in parts) parts[k].i = 0;
    const t = sim.t, camYaw = Math.atan2(cam.position.x, cam.position.z);
    for (const e of sim.ents) {
      if (e.st === 'gone') continue;
      const g = rigFor(e); g.seen = W.time;
      const x = e.px + (e.x - e.px) * alpha, z = e.pz + (e.z - e.pz) * alpha, age = t - e.st0;
      g.vr += (e.r - g.vr) * Math.min(1, dt * 10); const r = g.vr;
      // squash spring
      g.sqv += (-g.sq * 160 - g.sqv * 11) * dt; g.sq += g.sqv * dt; g.sq = cl(g.sq, -.35, .4);
      g.happy -= dt; g.hurt -= dt; g.angry -= dt;
      if (g.air > 0 || g.vy > 0) { g.vy -= 30 * dt; g.air += g.vy * dt; if (g.air <= 0) { g.air = 0; if (g.vy < -4 && e.st === 'live') { g.sqv += Math.min(4, -g.vy * .35); W.puff(e.x, .1, e.z, 8, 3, .2, 1); } g.vy = 0; g.spin = 0; } }
      if (W.time > g.blinkAt) { g.blinkAt = W.time + 2.2 + ((e.id * 7.13 + W.time * 3.1) % 2.6); g.blinkS = W.time; } const bk = W.time - (g.blinkS || -9); g.blink = bk < .13 ? Math.abs(bk / .065 - 1) * .9 + .1 : 1;
      const sp = Math.hypot(e.vx, e.vz);
      let y = r * .94, tip = 0, scale = r, vis = true, faceYaw = e.face;
      if (e.st === 'spawn') { const k = cl(age / SPAWN_T); y += 16 * (1 - k * k); }
      if (e.st === 'fall') { const k = age; y = r * .94 - 11 * Math.max(0, k - .12) ** 2; tip = Math.min(.55, k * 1.4); faceYaw = g.fallDir ?? faceYaw;
        if (!g.splashed && y < SEA_Y + r * .2) { g.splashed = true; W.splash(x, z, cl(.7 + r * .25, .7, 1.6)); if (W.onSplash) W.onSplash(e); }
        if (y < SEA_Y - r * 2.2) vis = false; }
      if (e.st === 'cashed') { const k = cl(age / .55); scale = r * (1 - ease.out(k)) * (1 + Math.sin(k * 9) * .1); y += k * 2.5; faceYaw += k * 12; if (k >= 1) vis = false; }
      if (!vis) continue;
      y += g.air;
      // rolling: the snow turns under the face, which keeps looking where it goes
      if (sp > .05 && e.st !== 'cashed') { tmpV.set(e.vz, 0, -e.vx).normalize(); g.q.premultiply(tmpQ.setFromAxisAngle(tmpV, sp * dt / r * (g.spin ? 2.2 : 1))); }
      let dy = faceYaw - camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); const want = camYaw + cl(dy * (1 - W.faceCam), -W.faceMax, W.faceMax); g.yaw = angLerp(g.yaw, want, Math.min(1, dt * 12));
      const edge = W.FR - Math.hypot(x, z) - r * .55, teeter = e.st === 'live' && edge < 0;
      if (teeter) g.wob += dt * 22;
      // expression
      const expr = e.expr || (e.st === 'fall' ? 'scared' : g.hurt > 0 ? 'hurt' : g.happy > 0 || e.st === 'cashed' ? 'happy' : (g.angry > 0 || e.dashT > 0) ? 'angry' : teeter ? 'scared' : e.cash > 0 ? 'happy' : 'normal');
      const s1 = 1 + g.sq * .55, s2 = 1 - g.sq;
      root.position.set(x, y + (e.st === 'live' ? Math.abs(Math.sin(W.time * 9 + e.id)) * Math.min(.08, sp * .006) * r : 0), z); root.scale.set(scale * s1, scale * s2, scale * s1); root.rotation.set(0, 0, 0);
      body.quaternion.copy(g.q);
      head.rotation.y = g.yaw; head.rotation.x = Math.min(.22, sp * .02) + tip + (teeter ? Math.sin(g.wob) * .12 : 0) - Math.min(.5, g.air * .25);
      // face pieces per expression
      const wide = expr === 'scared' ? 1.18 : 1, sqz = expr === 'angry' ? .78 : 1;
      eyes.forEach((n) => { n.scale.set(wide, (e.expr ? 1 : g.blink) * wide * sqz, wide); n.visible = expr !== 'happy' && expr !== 'hurt'; });
      shines.forEach((n) => { n.visible = e.expr || g.blink > .6; });
      arcs.forEach((n, i) => { n.visible = expr === 'happy' || expr === 'hurt'; n.rotation.z = expr === 'hurt' ? (i ? 1 : -1) * Math.PI / 2 : 0; n.position.y = expr === 'hurt' ? .12 : .1; });
      brows.forEach((n, i) => { n.visible = expr === 'angry' || expr === 'scared'; n.rotation.z = (i ? 1 : -1) * (expr === 'angry' ? .42 : -.38); n.position.y = expr === 'angry' ? .37 : .45; });
      smile.visible = expr === 'normal'; oh.visible = expr === 'scared' || expr === 'hurt'; grin.visible = expr === 'happy' || expr === 'angry' || expr === 'grin';
      pom.position.y = 1.13 + g.sq * -.15; pom.rotation.z = Math.sin(W.time * 4 + e.id) * .04 * Math.min(1, sp * .1);
      root.updateMatrixWorld(true);
      putM('body', body.matrixWorld);
      eyes.forEach((n) => n.visible && put(n)); shines.forEach((n, i) => n.visible && eyes[i].visible && put(n)); blush.forEach((n) => put(n));
      for (const n of [smile, oh, grin, ...brows, ...arcs]) if (n.visible) put(n);
      put(cap, g.col); put(band, g.col); put(pom);
      // shadow, shield, cash ring live on the ice
      if (e.st !== 'fall') { const air = e.st === 'spawn' ? 1 - cl(age / SPAWN_T) : 0, ss = r * (2.3 - air * 1.2) * (1 + g.sq * .3) / (1 + g.air * .35); dummy.position.set(x, .03, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(ss, 1, ss); dummy.updateMatrix(); putM('shadow', dummy.matrix); }
      if (e.shield > 0 && e.st === 'live') { dummy.position.set(x, y, z); dummy.scale.setScalar(r * 1.3 * (1 + Math.sin(W.time * 8) * .02)); dummy.updateMatrix(); putM('shield', dummy.matrix); }
      if (e.cash > 0 && e.st === 'live') { dummy.position.set(x, .06, z); dummy.scale.setScalar(r * 1.55); dummy.updateMatrix(); const i = putM('ring', dummy.matrix); progA.array[i] = e.cash / 3; progA.needsUpdate = true; }
    }
    for (const [id, g] of W.rigs) if (g.seen < W.time - 1e-6) W.rigs.delete(id);
    for (const k in parts) { const P = parts[k]; P.m.count = P.i; P.m.instanceMatrix.needsUpdate = true; if (P.color && P.m.instanceColor) P.m.instanceColor.needsUpdate = true; }
    // piles grow in with a little bounce
    let n = 0; for (const p of sim.piles) { if (!p.on || p.t0 > t) continue; const k = cl((t - p.t0) / .45), s = p.s * ease.back(k); if (s <= .01) continue; dummy.position.set(p.x, 0, p.z); dummy.rotation.set(0, p.i * 2.4, 0); dummy.scale.set(s, s * (1 + Math.sin(W.time * 2 + p.i) * .03), s); dummy.updateMatrix(); piles.setMatrixAt(n++, dummy.matrix); }
    piles.count = n; piles.instanceMatrix.needsUpdate = true;
    snowP.update(dt); chunkP.update(dt); confP.update(dt); ringP.update(dt);
    // keep the sun and clouds with the camera
    sky.position.copy(cam.position); W.flakes.material.uniforms.uPx.value = R.getPixelRatio() * (R.domElement.height / R.getPixelRatio()) / 900;
  };
  // start a fresh scene (the film cuts between independent shots)
  W.reset = () => { W.rigs.clear(); for (const P of [snowP, chunkP, confP, ringP]) { P.a.length = 0; P.update(0); } rip.forEach((r) => r.set(0, 0, -99, 0)); W.time = 0; sd = 1; lastFR = W.FR; chunkAcc = 0; };
  W.env = [sky, sea, floe, piles, W.berg, W.flakes, ...scene.children.filter((c) => c.isMesh && c.material && c.material.map && c.renderOrder === -9)];
  W.setSize = (w, h, dpr) => { R.setPixelRatio(dpr); R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); W.w = w; W.h = h; };
  W.render = () => { U.uCam.value = cam.position; R.render(scene, cam); };
  const pv = new THREE.Vector3();
  W.project = (x, y, z) => { pv.set(x, y, z).project(cam); return { x: (pv.x * .5 + .5) * W.w, y: (-pv.y * .5 + .5) * W.h, on: pv.z < 1 && Math.abs(pv.x) < 1.15 && Math.abs(pv.y) < 1.15 }; };
  return W;
}
