// The hero title as real 3D: Sniglet ExtraBold extruded with a deep round bevel, so the letters look inflated.
// Line 1 is glossy icy blue with a soap-bubble sheen, line 2 is polished gold.
import * as THREE from 'three';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export async function mountTitle(canvas, lines, fontUrl) {
  const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = .95;
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(18, 1, .1, 100);
  sc.environment = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), .02).texture; sc.environmentIntensity = 1.2;
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 6, 8); const rim = new THREE.DirectionalLight(0x9fd2ff, 2); rim.position.set(5, 2, -6); sc.add(key, rim, new THREE.AmbientLight(0xffffff, .35));
  const buf = await (await fetch(fontUrl)).arrayBuffer(), font = new Font(new TTFLoader().parse(buf));
  const ice = new THREE.MeshPhysicalMaterial({ color: 0x2f86ff, roughness: .08, clearcoat: 1, clearcoatRoughness: .03, iridescence: .25, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 750], sheen: .3, sheenColor: new THREE.Color(0xbfe6ff), envMapIntensity: 1.0, emissive: 0x1550c8, emissiveIntensity: .18 });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xffb81a, metalness: .75, roughness: .12, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.3, emissive: 0xff8a00, emissiveIntensity: .08 });
  const G = new THREE.Group(); sc.add(G);
  const mk = (text, mat, y) => { const g = new TextGeometry(text, { font, size: 1, depth: .3, curveSegments: 16, bevelEnabled: true, bevelThickness: .22, bevelSize: .08, bevelSegments: 12 });
    g.computeBoundingBox(); const b = g.boundingBox; g.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, -.15); const m = new THREE.Mesh(g, mat); m.position.y = y; G.add(m); return b.max.x - b.min.x; };
  const w = Math.max(mk(lines[0], ice, .66), mk(lines[1], gold, -.66));
  const size = () => { const cw = canvas.clientWidth, ch = canvas.clientHeight; if (!cw || !ch) return; R.setSize(cw, ch, false); cam.aspect = cw / ch;
    const fitH = 2.9 / (2 * Math.tan(9 * Math.PI / 180)), fitW = (w + .6) / (2 * Math.tan(9 * Math.PI / 180) * cam.aspect); cam.position.set(0, 0, Math.max(fitH, fitW)); cam.updateProjectionMatrix(); };
  size(); addEventListener('resize', size);
  let mx = 0, my = 0, tx = 0, ty = 0, vis = true; const t0 = performance.now();
  addEventListener('pointermove', (e) => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; }, { passive: true });
  new IntersectionObserver((es) => { vis = es[0].isIntersecting; }).observe(canvas);
  const loop = (now) => { requestAnimationFrame(loop); if (!vis) return; const t = (now - t0) / 1000; mx += (tx - mx) * .05; my += (ty - my) * .05;
    G.rotation.set(Math.sin(t * .8) * .035 + my * .12, Math.sin(t * .55) * .07 + mx * .22, 0); G.position.y = Math.sin(t * 1.1) * .04; R.render(sc, cam); };
  requestAnimationFrame(loop);
}
