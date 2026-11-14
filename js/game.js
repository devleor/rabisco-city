(() => {
'use strict';
const $ = id => document.getElementById(id);
const V3 = THREE.Vector3;
const PAPER = 0xf3eedf, PAPER_CSS = '#f3eedf', INK = 0x2a3fb0, INK_RGB = '42,63,176';
const RED = 0xd42a3a, GREEN = 0x2e9a4a, ORANGE = 0xe08a1e;
let seed = 20261113;
const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.autoClear = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
scene.fog = new THREE.Fog(PAPER, 32, 130);
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 500);
camera.rotation.order = 'YXZ';
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = vmCam.aspect = w / h;
  camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const ANISO = renderer.capabilities.getMaxAnisotropy();

// ---------- texturas de hachura ----------
function tex(draw, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = PAPER_CSS; g.fillRect(0, 0, size, size);
  draw(g, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO;
  return t;
}
function diag(g, s, step, alpha, dir = 1, w = 1.3) {
  g.lineWidth = w; g.lineCap = 'round';
  for (let i = -s; i <= s; i += step) {
    g.strokeStyle = `rgba(${INK_RGB},${alpha * (0.65 + Math.random() * 0.5)})`;
    g.beginPath();
    if (dir > 0) { g.moveTo(i, 0); g.lineTo(i + s, s); } else { g.moveTo(i + s, 0); g.lineTo(i, s); }
    g.stroke();
  }
}
function windows(g, s) {
  for (let ix = 0; ix < 2; ix++) for (let iy = 0; iy < 2; iy++) {
    const x = ix * 128 + 30 + Math.random() * 4, y = iy * 128 + 24 + Math.random() * 4, w = 66, h = 82;
    g.fillStyle = PAPER_CSS; g.fillRect(x, y, w, h);
    g.strokeStyle = `rgba(${INK_RGB},.95)`; g.lineWidth = 3; g.strokeRect(x, y, w, h);
    g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h * 0.45); g.lineTo(x + w, y + h * 0.45); g.stroke();
    g.lineWidth = 2.4; g.beginPath(); g.moveTo(x - 6, y + h + 5); g.lineTo(x + w + 6, y + h + 5); g.stroke();
    g.strokeStyle = `rgba(${INK_RGB},.25)`; g.lineWidth = 1;
    for (let k = 6; k < w; k += 9) { g.beginPath(); g.moveTo(x + k, y + 2); g.lineTo(x + k - 5, y + 14); g.stroke(); }
  }
}
const T = {
  plain: tex((g, s) => { g.fillStyle = `rgba(${INK_RGB},.18)`; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5); }),
  light: tex((g, s) => diag(g, s, 16, 0.36)),
  med: tex((g, s) => diag(g, s, 10, 0.45)),
  dense: tex((g, s) => { diag(g, s, 8, 0.5); diag(g, s, 16, 0.35, -1); }),
  brick: tex((g, s) => {
    diag(g, s, 16, 0.2);
    g.strokeStyle = `rgba(${INK_RGB},.6)`; g.lineWidth = 1.4;
    for (let y = 0; y < s; y += 16) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke();
      const off = (y / 16) % 2 ? 16 : 0;
      for (let x = off; x < s; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
    }
  }),
  winL: tex((g, s) => { diag(g, s, 16, 0.32); windows(g, s); }),
  winM: tex((g, s) => { diag(g, s, 10, 0.42); windows(g, s); }),
  winD: tex((g, s) => { diag(g, s, 8, 0.48); diag(g, s, 16, 0.3, -1); windows(g, s); }),
};
const mkMat = t => new THREE.MeshBasicMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const MAT = {}; for (const k in T) MAT[k] = mkMat(T[k]);
const STYLES = {
  hatch: ['dense', 'light', 'plain', 'plain', 'med', 'light'],
  win: ['winD', 'winL', 'plain', 'plain', 'winM', 'winL'],
  brick: ['brick', 'brick', 'plain', 'plain', 'brick', 'brick'],
  crate: ['med', 'light', 'plain', 'plain', 'light', 'med'],
  plain: ['light', 'plain', 'plain', 'plain', 'plain', 'plain'],
};

// "iluminação": faces viradas pro sol ficam amareladas, as de trás azuladas
const FACE_TINT = ['shade', 'lit', 'top', 'none', 'shade', 'lit'];
const TINTS = { shade: 0xdfe3f5, lit: 0xfff0c2, top: 0xfff8e6, none: 0xffffff };
const litCache = {};
function litMat(k, tint) {
  const key = k + tint;
  if (!litCache[key]) { litCache[key] = mkMat(T[k]); litCache[key].color.setHex(TINTS[tint]); }
  return litCache[key];
}
// UV em coordenadas de mundo pra hachura não esticar
function worldUV(geo, scale = 4) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  if (!uv) return;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    let u, v;
    if (nx > 0.5) { u = p.getZ(i); v = p.getY(i); }
    else if (ny > 0.5) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u / scale, v / scale);
  }
  uv.needsUpdate = true;
}

// ---------- traço de caneta (contorno + rascunho que "ferve") ----------
const lineMats = {};
const boilA = [], boilB = [];
function lm(color, op = 1, fog = true) {
  const k = color + '_' + op + '_' + fog;
  if (!lineMats[k]) lineMats[k] = new THREE.LineBasicMaterial({ color, transparent: op < 1, opacity: op, fog });
  return lineMats[k];
}
function boilMat(color, which) {
  const k = 'boil' + which + '_' + color;
  if (!lineMats[k]) {
    lineMats[k] = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 });
    (which ? boilB : boilA).push(lineMats[k]);
    if (which) lineMats[k].visible = false;
  }
  return lineMats[k];
}
function sketchCopy(src, j) {
  const a = Float32Array.from(src);
  for (let i = 0; i < a.length; i += 6) {
    const dx = a[i + 3] - a[i], dy = a[i + 4] - a[i + 1], dz = a[i + 5] - a[i + 2];
    const L = Math.hypot(dx, dy, dz) || 1;
    const o1 = Math.random() * j * 3 / L, o2 = Math.random() * j * 3 / L;
    a[i] -= dx * o1; a[i + 1] -= dy * o1; a[i + 2] -= dz * o1;
    a[i + 3] += dx * o2; a[i + 4] += dy * o2; a[i + 5] += dz * o2;
    for (let k = 0; k < 6; k++) a[i + k] += (Math.random() - 0.5) * j;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  return g;
}
function ink(geo, color = INK, j = 0.03, thresh = 25) {
  const e = new THREE.EdgesGeometry(geo, thresh);
  const grp = new THREE.Group();
  grp.add(new THREE.LineSegments(e, lm(color)));
  const src = e.attributes.position.array;
  grp.add(new THREE.LineSegments(sketchCopy(src, j), boilMat(color, 0)));
  grp.add(new THREE.LineSegments(sketchCopy(src, j), boilMat(color, 1)));
  return grp;
}

// ---------- mundo ----------
const boxes = [], worldMeshes = [], solids = [];
let colSeq = 0;
function addBox(x, z, w, d, h, style = 'hatch', y0 = 0, color = INK, collide = true, scale = 4, opt = {}) {
  const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, h / 2, 0); worldUV(geo, scale);
  const m = new THREE.Mesh(geo, STYLES[style].map((k, i) => litMat(k, FACE_TINT[i])));
  m.position.set(x, y0, z);
  m.add(ink(geo, color, Math.min(0.08, 0.02 + Math.max(w, h, d) * 0.004)));
  scene.add(m); worldMeshes.push(m);
  const b = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: y0, maxY: y0 + h };
  if (collide) boxes.push(b);
  if (!opt.skip) {
    const vol = w * h * d;
    const sol = { mesh: m, b, collide, alive: true, falling: false, vy: 0, static: !!opt.static, col: opt.col !== undefined ? opt.col : colSeq++, hp: opt.hp || clamp(30 + vol * 4, 40, 200), extras: [], vol, orig: { ...b }, hp0: 0 }; sol.hp0 = sol.hp;
    solids.push(sol); m.userData.solid = sol;
  }
  return m;
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600),
  new THREE.MeshBasicMaterial({ color: PAPER, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }));
ground.rotation.x = -Math.PI / 2; scene.add(ground); worldMeshes.push(ground);

function lineSegs(pts, mat) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(g, mat); scene.add(l); return l;
}
// faixas tracejadas das ruas
(() => {
  const pts = [];
  for (const s of [-52, -30, -10, 10, 30, 52]) for (let t = -56; t < 56; t += 3.2) {
    const a = t + Math.random() * 0.2, b = t + 1.4 + Math.random() * 0.3;
    pts.push(s, 0.02, a, s + (Math.random() - .5) * .05, 0.02, b);
    pts.push(a, 0.02, s, b, 0.02, s + (Math.random() - .5) * .05);
  }
  lineSegs(pts, lm(INK, 0.6));
  // tufinhos de grama rabiscados
  const tp = [];
  for (let i = 0; i < 260; i++) {
    const x = rand(-57, 57), z = rand(-57, 57), s = rand(.12, .25);
    tp.push(x - s, .02, z, x - s * .4, .02, z - s * 1.4, x - s * .4, .02, z - s * 1.4, x, .02, z, x, .02, z, x + s * .4, .02, z - s * 1.6, x + s * .4, .02, z - s * 1.6, x + s, .02, z);
  }
  lineSegs(tp, lm(INK, 0.35));
})();

// paredes de borda
const ST = { static: true };
addBox(0, -59, 120, 2, 7, 'brick', 0, INK, true, 4, ST); addBox(0, 59, 120, 2, 7, 'brick', 0, INK, true, 4, ST);
addBox(-59, 0, 2, 116, 7, 'brick', 0, INK, true, 4, ST); addBox(59, 0, 2, 116, 7, 'brick', 0, INK, true, 4, ST);

// quarteirões
function building(x, z, w, d, h) {
  const style = rng() < 0.62 ? 'win' : 'hatch';
  const n = Math.max(1, Math.round(h / 4)), sh = h / n, col = colSeq++;
  for (let i = 0; i < n; i++) addBox(x, z, w, d, sh, style, i * sh, INK, true, 4, { col, hp: 190 });
  if (rng() < 0.5) addBox(x + (rng() - .5) * w * .4, z + (rng() - .5) * d * .4, rand(1.2, 2.5), rand(1.2, 2.5), rand(1, 2.2), 'crate', h);
  if (rng() < 0.4) { // toldo / marquise
    addBox(x, z + d / 2 + 0.7, w * 0.6, 1.4, 0.15, 'plain', 3.2, INK, false);
  }
}
function park(bx, bz) {
  for (let i = 0; i < 6; i++) {
    const s = rand(1, 1.8), col = [INK, GREEN, ORANGE][Math.floor(rng() * 3)];
    const x = bx + rand(-5, 5), z = bz + rand(-5, 5);
    addBox(x, z, s, s, s, 'crate', 0, col);
    if (rng() < 0.35) addBox(x, z, s * .7, s * .7, s * .7, 'crate', s, col);
  }
  addBox(bx + rand(-3, 3), bz + rand(-3, 3), 5, 0.6, 1.1, 'brick');
}
function scaffold(bx, bz) {
  const w = 10, d = 8, lh = 3.5;
  for (const px of [-4.85, 0, 4.85]) for (const pz of [-3.85, 3.85]) addBox(bx + px, bz + pz, 0.3, 0.3, lh * 3 + 1.2, 'hatch');
  for (let lv = 1; lv <= 3; lv++) {
    const slab = addBox(bx, bz, w, d, 0.3, 'crate', lv * lh, INK, true, 4, { hp: 150 });
    // guarda-corpo (só desenho)
    const y = lv * lh + 1.2, pts = [];
    const c = [[-5, -4], [5, -4], [5, 4], [-5, 4], [-5, -4]];
    for (let i = 0; i < 4; i++) pts.push(bx + c[i][0], y, bz + c[i][1], bx + c[i + 1][0], y, bz + c[i + 1][1]);
    for (let t = -5; t <= 5; t += 1.25) pts.push(bx + t, y, bz - 4, bx + t, lv * lh + .3, bz - 4);
    slab.attach(lineSegs(pts, lm(INK, 0.8)));
  }
  // escada até o 1º andar
  for (let i = 0; i < 7; i++) addBox(bx - 3 + i * 0.8, bz + 5, 0.8, 1.6, (i + 1) * 0.5, 'crate');
}
seed = 777;
const SPECIAL = { '20,-20': 'scaffold', '-20,20': 'scaffold', '-40,0': 'park', '40,20': 'park', '0,40': 'park', '0,-40': 'park' };
for (const bx of [-40, -20, 0, 20, 40]) for (const bz of [-40, -20, 0, 20, 40]) {
  if (bx === 0 && bz === 0) continue;
  const sp = SPECIAL[bx + ',' + bz];
  if (sp === 'scaffold') { scaffold(bx, bz); continue; }
  if (sp === 'park') { park(bx, bz); continue; }
  const n = 1 + Math.floor(rng() * 3);
  if (n === 1) building(bx, bz, 8 + rng() * 4, 8 + rng() * 4, 6 + rng() * 14);
  else if (n === 2) { const d = 8 + rng() * 4; building(bx - 3, bz, 5.4, d, 5 + rng() * 15); building(bx + 3, bz, 5.4, d - rng() * 3, 5 + rng() * 15); }
  else { building(bx, bz - 3.4, 12, 5, 6 + rng() * 12); building(bx - 3.2, bz + 3.4, 5.2, 5, 4 + rng() * 10); building(bx + 3.2, bz + 3.4, 5.2, 5, 4 + rng() * 14); }
}
// praça central com o lápis gigante
addBox(0, 0, 2.6, 2.6, 1, 'brick', 0, INK, true, 4, ST);
(() => {
  const g1 = new THREE.CylinderGeometry(.62, .62, 0.6, 6); g1.translate(0, 1.3, 0); worldUV(g1, 2);
  const g2 = new THREE.CylinderGeometry(.6, .6, 4.6, 6); g2.translate(0, 3.9, 0); worldUV(g2, 2);
  const g3 = new THREE.ConeGeometry(.6, 1.4, 6); g3.translate(0, 6.9, 0); worldUV(g3, 2);
  const g4 = new THREE.ConeGeometry(.2, .45, 6); g4.translate(0, 7.43, 0);
  [[g1, MAT.dense, RED], [g2, MAT.med, INK], [g3, MAT.plain, INK], [g4, MAT.dense, INK]].forEach(([g, m, c]) => {
    const mesh = new THREE.Mesh(g, m); mesh.add(ink(g, c, .03)); scene.add(mesh); worldMeshes.push(mesh);
  });
  boxes.push({ minX: -.6, maxX: .6, minZ: -.6, maxZ: .6, minY: 0, maxY: 8 });
})();
addBox(7, 6, 1.6, 1.6, 1.6, 'crate', 0, GREEN); addBox(7, 6, 1.1, 1.1, 1.1, 'crate', 1.6, GREEN);
addBox(-7, 4, 1.2, 1.2, 1.2, 'crate', 0, ORANGE); addBox(4, -8, 2.4, 1.4, 1.4, 'crate');
addBox(-7, -7, 4, 0.6, 1.1, 'brick'); addBox(9, -3, 0.6, 3.5, 1.1, 'brick');
addBox(-3, 9, 3, 0.6, 1.1, 'brick');

// skyline lá fora
seed = 99;
for (let a = 0; a < Math.PI * 2; a += 0.16) {
  const r = 70 + rng() * 17;
  addBox(Math.cos(a) * r, Math.sin(a) * r, 7 + rng() * 8, 7 + rng() * 8, 12 + rng() * 17, rng() < .6 ? 'win' : 'hatch', 0, INK, false, 4, { skip: true });
}
// arcos e nuvens no céu
(() => {
  const mk = (R, y, rx, rz, op, segs = 96) => {
    const pts = [];
    for (let i = 0; i <= segs; i++) { const a = i / segs * Math.PI * 2; pts.push(new V3(Math.cos(a) * R + (Math.random() - .5) * R * 0.004, 0, Math.sin(a) * R)); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm(INK, op, false));
    l.position.y = y; l.rotation.set(rx, 0, rz); scene.add(l);
  };
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * 6.28, r = rand(90, 180), y = rand(45, 70), cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    for (let k = 0; k < 4; k++) {
      const pts = [], R = rand(4, 8);
      for (let s = 0; s <= 24; s++) { const t = s / 24 * Math.PI * 2; pts.push(new V3(Math.cos(t) * R, Math.sin(t) * R * .55, 0)); }
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm(INK, .45, false));
      l.position.set(cx + (k - 1.5) * R * 1.1, y + (k % 2) * R * .3, cz); l.lookAt(0, y, 0); scene.add(l);
    }
  }
})();

// ---------- cúpula ----------
const DOME_R = 112, DOME_Y = -26;
const domeHit = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshBasicMaterial({ visible: false, side: THREE.BackSide }));
domeHit.position.y = DOME_Y; scene.add(domeHit); domeHit.updateMatrixWorld();
(() => {
  const ico = new THREE.IcosahedronGeometry(DOME_R, 6);
  const p = ico.attributes.position.array, seen = new Set(), segs = [], panels = [];
  const key = i => Math.round(p[i] * 10) + ',' + Math.round(p[i + 1] * 10) + ',' + Math.round(p[i + 2] * 10);
  for (let t = 0; t < p.length; t += 9) {
    const miny = Math.min(p[t + 1], p[t + 4], p[t + 7]);
    if (miny < 8) continue;
    for (const [a, b] of [[t, t + 3], [t + 3, t + 6], [t + 6, t]]) {
      const ka = key(a), kb = key(b), k = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      if (seen.has(k)) continue; seen.add(k);
      segs.push(p[a], p[a + 1] + DOME_Y, p[a + 2], p[b], p[b + 1] + DOME_Y, p[b + 2]);
    }
    if (miny > 45 && Math.random() < .16) for (let i = 0; i < 9; i++) panels.push(i % 3 === 1 ? p[t + i] + DOME_Y : p[t + i]);
  }
  lineSegs(segs, lm(INK, .5, false));
  scene.add(new THREE.LineSegments(sketchCopy(segs, .7), lm(INK, .22, false)));
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(panels, 3));
  scene.add(new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0xf6d84a, transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false, fog: false })));
  // vigas principais (meridianos)
  const rib = [];
  for (let k = 0; k < 12; k++) {
    const az = k / 12 * Math.PI * 2;
    for (let i = 0; i < 30; i++) {
      const e1 = Math.asin(-DOME_Y / DOME_R) + (Math.PI / 2 - Math.asin(-DOME_Y / DOME_R)) * i / 30, e2 = Math.asin(-DOME_Y / DOME_R) + (Math.PI / 2 - Math.asin(-DOME_Y / DOME_R)) * (i + 1) / 30;
      for (const off of [0, .5]) rib.push(Math.cos(e1) * Math.cos(az) * (DOME_R - off), Math.sin(e1) * DOME_R + DOME_Y, Math.cos(e1) * Math.sin(az) * (DOME_R - off),
        Math.cos(e2) * Math.cos(az) * (DOME_R - off), Math.sin(e2) * DOME_R + DOME_Y, Math.cos(e2) * Math.sin(az) * (DOME_R - off));
    }
  }
  lineSegs(rib, lm(INK, .85, false));
})();

// ---------- luz: sol, raios, postes e sombras hachuradas ----------
const SUN_DIR = new V3(-.55, .85, -.42).normalize();
let sunSprite; const sunRays = [];
function radialTex(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
const glowTex = radialTex([[0, 'rgba(255,214,90,.95)'], [.45, 'rgba(255,214,90,.35)'], [1, 'rgba(255,214,90,0)']]);
(() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.translate(128, 128);
  g.fillStyle = 'rgba(255,224,90,.9)'; g.beginPath(); g.arc(0, 0, 56, 0, 7); g.fill();
  g.strokeStyle = '#e08a1e'; g.lineWidth = 5; g.lineCap = 'round';
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; g.beginPath(); g.moveTo(Math.cos(a) * 70, Math.sin(a) * 70); g.lineTo(Math.cos(a) * (i % 2 ? 98 : 120), Math.sin(a) * (i % 2 ? 98 : 120)); g.stroke(); }
  g.strokeStyle = '#2a3fb0'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 56, 0, 7); g.stroke(); g.beginPath(); g.arc(3, -2, 59, .3, 5.6); g.stroke();
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false, depthWrite: false, transparent: true }));
  sun.position.copy(SUN_DIR).multiplyScalar(175); sun.scale.setScalar(52); scene.add(sun); sunSprite = sun;
  // raios de luz atravessando a cúpula
  const rayMat = new THREE.MeshBasicMaterial({ color: 0xffd95a, transparent: true, opacity: .075, depthWrite: false, side: THREE.DoubleSide, fog: false });
  for (let i = 0; i < 7; i++) {
    const a = SUN_DIR.clone().multiplyScalar(105).add(new V3(rand(-25, 25), rand(-5, 5), rand(-25, 25)));
    const b = new V3(rand(-45, 45), 0, rand(-45, 45));
    const dir = b.clone().sub(a).normalize(), side1 = new V3().crossVectors(dir, new V3(0, 1, 0)).normalize(), side2 = new V3().crossVectors(dir, side1).normalize();
    const w0 = rand(1.5, 3), w1 = rand(6, 11), pos = [];
    for (const sd of [side1, side2]) {
      const p1 = a.clone().addScaledVector(sd, -w0), p2 = a.clone().addScaledVector(sd, w0), p3 = b.clone().addScaledVector(sd, w1), p4 = b.clone().addScaledVector(sd, -w1);
      pos.push(...p1.toArray(), ...p2.toArray(), ...p3.toArray(), ...p1.toArray(), ...p3.toArray(), ...p4.toArray());
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const rm = new THREE.Mesh(geo, rayMat); scene.add(rm); sunRays.push(rm);
  }
})();
const lamps = [];
function lamp(x, z, ax, az) {
  const post = addBox(x, z, .22, .22, 5.3, 'hatch', 0, INK, true, 4, { hp: 50 });
  const hx = x + ax * 1.5, hz = z + az * 1.5;
  const arm = addBox(x + ax * .75, z + az * .75, ax ? 1.6 : .12, az ? 1.6 : .12, .12, 'plain', 5.1, INK, false, 4, { skip: true });
  const headM = addBox(hx, hz, .7, .7, .28, 'crate', 4.85, INK, false, 4, { skip: true });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.3, 4.7, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd95a, transparent: true, opacity: .13, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.set(hx, 4.85 - 2.35, hz); scene.add(cone);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3, 28), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: .7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(hx, .02, hz); scene.add(pool);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
  halo.position.set(hx, 4.7, hz); halo.scale.setScalar(2.6); scene.add(halo);
  post.userData.solid.extras.push(arm, headM, cone, pool, halo);
  lamps.push({ cone, pool, halo, ph: Math.random() * 10, flick: Math.random() < .2, sol: post.userData.solid });
}
for (const s of [-30, -10, 10, 30]) for (const t of [-40, 0, 40]) { lamp(s + 3.4, t, -1, 0); lamp(t, s + 3.4, 0, -1); }
const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.strokeStyle = `rgba(${INK_RGB},.32)`; g.lineWidth = 1.3;
  for (let i = -128; i <= 128; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); }
  g.strokeStyle = `rgba(${INK_RGB},.22)`;
  for (let i = -128; i <= 128; i += 16) { g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})();
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const SH_OFF = new V3(-SUN_DIR.x / SUN_DIR.y, 0, -SUN_DIR.z / SUN_DIR.y);
function hull2(pts) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
let shadowMesh = null;
function buildShadows() {
  const cols = new Map();
  for (const so of solids) {
    if (!so.alive || !so.collide) continue;
    const c = cols.get(so.col);
    if (!c) cols.set(so.col, { minX: so.b.minX, maxX: so.b.maxX, minZ: so.b.minZ, maxZ: so.b.maxZ, lo: so.b.minY, hi: so.b.maxY });
    else { c.minX = Math.min(c.minX, so.b.minX); c.maxX = Math.max(c.maxX, so.b.maxX); c.minZ = Math.min(c.minZ, so.b.minZ); c.maxZ = Math.max(c.maxZ, so.b.maxZ); c.lo = Math.min(c.lo, so.b.minY); c.hi = Math.max(c.hi, so.b.maxY); }
  }
  const pos = [], uv = [];
  for (const c of cols.values()) {
    if (c.hi < .8) continue;
    const lo = Math.min(c.lo, 30), hi = Math.min(c.hi, 30);
    const q = [[c.minX, c.minZ], [c.maxX, c.minZ], [c.maxX, c.maxZ], [c.minX, c.maxZ]];
    const hl = hull2(q.map(([x, z]) => [x + SH_OFF.x * lo, z + SH_OFF.z * lo]).concat(q.map(([x, z]) => [x + SH_OFF.x * hi, z + SH_OFF.z * hi])));
    for (let i = 1; i < hl.length - 1; i++) for (const t of [hl[0], hl[i], hl[i + 1]]) { pos.push(t[0], .012, t[1]); uv.push(t[0] / 3, t[1] / 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (shadowMesh) { scene.remove(shadowMesh); shadowMesh.geometry.dispose(); }
  shadowMesh = new THREE.Mesh(geo, shadowMat); scene.add(shadowMesh);
}
buildShadows();
let GRAPPLE_LIST = worldMeshes.concat([domeHit]);

// ---------- destruição do cenário ----------
const CHUNK_GEOS = [.35, .6, .9].map(sz => { const g = new THREE.BoxGeometry(sz, sz * rand(.5, .9), sz * rand(.6, 1)); worldUV(g, 1.2); return { g, inkP: ink(g, INK, .015) }; });
const chunks = [];
let worldDirtyT = -1;
function boxDist(b, p) {
  const dx = Math.max(b.minX - p.x, 0, p.x - b.maxX), dy = Math.max(b.minY - p.y, 0, p.y - b.maxY), dz = Math.max(b.minZ - p.z, 0, p.z - b.maxZ);
  return Math.hypot(dx, dy, dz);
}
function restoreWorld() {
  for (const so of solids) {
    Object.assign(so.b, so.orig); so.mesh.position.y = so.orig.minY; so.falling = false; so.vy = 0; so.hp = so.hp0; so.hitPlayer = false;
    if (!so.alive) {
      so.alive = true; scene.add(so.mesh); worldMeshes.push(so.mesh);
      if (so.collide) boxes.push(so.b);
      for (const x of so.extras) scene.add(x);
    }
  }
  for (const c of chunks) scene.remove(c.m); chunks.length = 0;
  buildShadows(); GRAPPLE_LIST = worldMeshes.concat([domeHit]); hitDirty = true;
}
function damageEnv(p, R, dmg) {
  let any = false;
  for (const so of solids) {
    if (!so.alive || so.static) continue;
    const d = boxDist(so.b, p);
    if (d >= R) continue;
    so.hp -= dmg * (1 - d / R * .65);
    if (so.hp <= 0) { destroySolid(so, p); any = true; }
  }
  if (any) settle();
}
function removeDecalsIn(b) {
  for (let i = decals.length - 1; i >= 0; i--) {
    const q = decals[i].position;
    if (q.x > b.minX - .1 && q.x < b.maxX + .1 && q.y > b.minY - .1 && q.y < b.maxY + .1 && q.z > b.minZ - .1 && q.z < b.maxZ + .1) { scene.remove(decals[i]); decals.splice(i, 1); }
  }
}
function destroySolid(so, from) {
  so.alive = false; so.falling = false;
  scene.remove(so.mesh);
  const wi2 = worldMeshes.indexOf(so.mesh); if (wi2 >= 0) worldMeshes.splice(wi2, 1);
  const bi = boxes.indexOf(so.b); if (bi >= 0) boxes.splice(bi, 1);
  for (const x of so.extras) scene.remove(x);
  removeDecalsIn(so.b);
  if (G.on && G.a.x > so.b.minX - .3 && G.a.x < so.b.maxX + .3 && G.a.y > so.b.minY - .3 && G.a.y < so.b.maxY + .3 && G.a.z > so.b.minZ - .3 && G.a.z < so.b.maxZ + .3) endGrapple();
  const c = new V3((so.b.minX + so.b.maxX) / 2, (so.b.minY + so.b.maxY) / 2, (so.b.minZ + so.b.maxZ) / 2);
  const n = Math.min(16, 3 + Math.floor(so.vol / 6));
  const mats = so.mesh.material;
  for (let i = 0; i < n; i++) {
    const cg = CHUNK_GEOS[Math.floor(Math.random() * 3)];
    const m = new THREE.Mesh(cg.g, Array.isArray(mats) ? mats[Math.floor(Math.random() * mats.length)] : mats); m.add(cg.inkP.clone());
    m.position.set(rand(so.b.minX, so.b.maxX), rand(so.b.minY, so.b.maxY), rand(so.b.minZ, so.b.maxZ));
    const out = m.position.clone().sub(from); out.y = Math.abs(out.y) + 1; out.normalize();
    const sc = Math.min(1.6, .6 + so.vol / 120); m.scale.setScalar(sc * rand(.7, 1.3));
    scene.add(m);
    chunks.push({ m, v: out.multiplyScalar(rand(5, 14)).add(new V3(0, rand(2, 6), 0)), av: new V3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), t: 0, s: m.scale.x });
    if (chunks.length > 160) { scene.remove(chunks[0].m); chunks.shift(); }
  }
  for (let i = 0; i < Math.min(10, 2 + so.vol / 15); i++) puff(c.clone().add(new V3(rand(-1, 1) * (so.b.maxX - so.b.minX) / 2, rand(-1, 1) * (so.b.maxY - so.b.minY) / 2, rand(-1, 1) * (so.b.maxZ - so.b.minZ) / 2)), rand(1, 2.2), rand(1.2, 2.2), new V3(rand(-1, 1), rand(.3, 1.2), rand(-1, 1)), .5);
  worldDirtyT = .25;
}
function supported(so) {
  if (so.b.minY <= .02) return true;
  for (const o of solids) {
    if (o === so || !o.alive || o.falling) continue;
    if (o.b.maxX <= so.b.minX - .05 || o.b.minX >= so.b.maxX + .05 || o.b.maxZ <= so.b.minZ - .05 || o.b.minZ >= so.b.maxZ + .05) continue;
    if (o.b.minY < so.b.minY + .05 && o.b.maxY >= so.b.minY - .05) return true;
  }
  for (const b of boxes) { // apoios que não são sólidos (estátua do lápis)
    if (solids.some(o => o.b === b)) continue;
    if (b.maxX <= so.b.minX || b.minX >= so.b.maxX || b.maxZ <= so.b.minZ || b.minZ >= so.b.maxZ) continue;
    if (b.minY < so.b.minY + .05 && b.maxY >= so.b.minY - .05) return true;
  }
  return false;
}
function settle() {
  let changed = true, guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    for (const so of solids) if (so.alive && !so.falling && !so.static && !supported(so)) { so.falling = true; so.vy = 0; removeDecalsIn(so.b); changed = true; }
  }
}
function landingY(so) {
  let y = 0;
  for (const o of solids) {
    if (o === so || !o.alive || o.falling) continue;
    if (o.b.maxX <= so.b.minX || o.b.minX >= so.b.maxX || o.b.maxZ <= so.b.minZ || o.b.minZ >= so.b.maxZ) continue;
    if (o.b.maxY <= so.b.minY + .02 && o.b.maxY > y) y = o.b.maxY;
  }
  return y;
}
function updateFalling(dt) {
  let landed = false;
  for (const so of solids) {
    if (!so.alive || !so.falling) continue;
    so.vy -= 26 * dt;
    const ly = landingY(so), h = so.b.maxY - so.b.minY;
    let ny = so.b.minY + so.vy * dt, hit = false;
    if (ny <= ly) { ny = ly; hit = true; }
    so.b.minY = ny; so.b.maxY = ny + h; so.mesh.position.y = ny;
    for (const e of enemies.slice()) {
      const ep = e.g.position;
      if (ep.x > so.b.minX - .3 && ep.x < so.b.maxX + .3 && ep.z > so.b.minZ - .3 && ep.z < so.b.maxZ + .3 && so.b.minY < 2 * e.T.scale) hurtEnemy(e, 999, ep.clone().setY(1), new V3(0, -1, 0), false, 'CENÁRIO');
    }
    if (P.pos.x > so.b.minX - .3 && P.pos.x < so.b.maxX + .3 && P.pos.z > so.b.minZ - .3 && P.pos.z < so.b.maxZ + .3 && so.b.minY < P.pos.y + 1.75 && so.b.maxY > P.pos.y + .5 && !so.hitPlayer) { so.hitPlayer = true; damagePlayer(20); }
    if (hit) {
      so.falling = false; so.vy = 0; landed = true;
      const c = new V3((so.b.minX + so.b.maxX) / 2, ny, (so.b.minZ + so.b.maxZ) / 2);
      const dP = c.distanceTo(P.pos);
      if (so.vol > 20) { shake = Math.max(shake, clamp(.5 - dP / 80, 0, .5)); SFX.land(); }
      for (let i = 0; i < Math.min(8, 2 + so.vol / 20); i++) puff(c.clone().add(new V3(rand(-1, 1) * (so.b.maxX - so.b.minX) / 2, .3, rand(-1, 1) * (so.b.maxZ - so.b.minZ) / 2)), rand(1, 2), rand(1, 1.8), new V3(rand(-2, 2), rand(.2, .8), rand(-2, 2)), .45);
      worldDirtyT = .25;
    }
  }
  if (landed) settle();
  for (let i = chunks.length - 1; i >= 0; i--) {
    const c = chunks[i]; c.t += dt; c.v.y -= 20 * dt;
    c.m.position.addScaledVector(c.v, dt);
    c.m.rotation.x += c.av.x * dt; c.m.rotation.y += c.av.y * dt; c.m.rotation.z += c.av.z * dt;
    if (c.m.position.y < .2) { c.m.position.y = .2; c.v.y *= -.3; c.v.x *= .6; c.v.z *= .6; c.av.multiplyScalar(.5); }
    if (c.t > 4) { const k = 1 - (c.t - 4) / .5; if (k <= 0) { scene.remove(c.m); chunks.splice(i, 1); } else c.m.scale.setScalar(c.s * k); }
  }
  if (worldDirtyT > 0) {
    worldDirtyT -= dt;
    if (worldDirtyT <= 0) { buildShadows(); GRAPPLE_LIST = worldMeshes.concat([domeHit]); hitDirty = true; }
  }
}

// ---------- dia e noite ----------
const NIGHT = { bg: [new THREE.Color(PAPER), new THREE.Color(0xeab48f), new THREE.Color(0x1b2244)], surf: [new THREE.Color(1, 1, 1), new THREE.Color(1, .82, .7), new THREE.Color(.34, .38, .6)] };
let timeK = 0, timeTarget = 0, timeApplied = -1;
const stars = (() => {
  const pos = [];
  for (let i = 0; i < 500; i++) { const a = Math.random() * 6.283, e = Math.random() * 1.3 + .12, r = 190; pos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
  x.strokeStyle = '#fff'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(16, 4); x.lineTo(16, 28); x.moveTo(4, 16); x.lineTo(28, 16); x.stroke();
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, depthWrite: false, fog: false }));
  scene.add(pts); return pts;
})();
const moon = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.translate(128, 128); g.fillStyle = 'rgba(240,244,255,.95)'; g.beginPath(); g.arc(0, 0, 70, 0, 7); g.fill();
  g.fillStyle = 'rgba(160,175,220,.6)'; for (const [x, y, r] of [[-20, -15, 14], [25, 10, 10], [-5, 30, 8], [30, -30, 7]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.strokeStyle = '#aebdff'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 70, 0, 7); g.stroke(); g.beginPath(); g.arc(4, -3, 74, .4, 5.4); g.stroke();
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false, depthWrite: false, transparent: true, opacity: 0 }));
  sp.position.set(SUN_DIR.z * 150, 120, -SUN_DIR.x * 150); sp.scale.setScalar(40); scene.add(sp); return sp;
})();
// lanterna: mancha de luz onde você mira, à noite
const flashPool = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
scene.add(flashPool);
const _c1 = new THREE.Color(), _c2 = new THREE.Color(), WHITE_C = new THREE.Color(1, 1, 1);
function lerp3(arr, k, out) { if (k <= .5) return out.copy(arr[0]).lerp(arr[1], k * 2); return out.copy(arr[1]).lerp(arr[2], (k - .5) * 2); }
let SURF_MATS = null;
function applyTime(k) {
  if (!SURF_MATS) {
    SURF_MATS = [...Object.values(MAT), ...Object.values(litCache), ground.material, paperMat, SKIN, SLEEVE, BRASS, SHELLM];
    for (const m of SURF_MATS) m.userData.base = m.color.clone();
  }
  for (const m of Object.values(litCache)) if (!m.userData.base) m.userData.base = m.color.clone();
  const sc = lerp3(NIGHT.surf, k, _c1);
  for (const m of SURF_MATS) m.color.copy(m.userData.base).multiply(sc);
  const bg = lerp3(NIGHT.bg, k, _c2);
  scene.background.copy(bg); scene.fog.color.copy(bg);
  scene.fog.far = 130 - Math.max(0, k - .5) * 80; scene.fog.near = 32 - Math.max(0, k - .5) * 20;
  const nk = Math.max(0, (k - .5) * 2);
  for (const m of Object.values(lineMats)) { if (!m.userData.base) m.userData.base = m.color.clone(); m.color.copy(m.userData.base).lerp(WHITE_C, .62 * nk); }
  stars.material.opacity = nk; moon.material.opacity = nk;
  if (typeof sunSprite !== 'undefined') sunSprite.material.opacity = 1 - nk;
  for (const r of sunRays) r.visible = k < .45;
  shadowMat.opacity = 1 - nk * .85;
  const hud = _c1.set(INK).lerp(new THREE.Color(0xe3e9ff), nk);
  document.documentElement.style.setProperty('--ink', '#' + hud.getHexString());
  const pe = document.getElementById('paper'), ge = document.getElementById('grain');
  pe.style.mixBlendMode = nk > .3 ? 'normal' : 'multiply'; pe.style.opacity = nk > .3 ? .35 : 1; ge.style.display = nk > .3 ? 'none' : '';
  timeApplied = k;
}
function inkNow(hex) { const nk = Math.max(0, (timeK - .5) * 2); return _c2.set(hex).lerp(WHITE_C, .62 * nk); }
function updateTime(dt) {
  timeK += (timeTarget - timeK) * Math.min(1, dt * .35);
  if (Math.abs(timeK - timeApplied) > .002) applyTime(timeK);
  const nk = Math.max(0, (timeK - .5) * 2);
  for (const l of lamps) if (l.sol.alive) { const cd = Math.hypot(camera.position.x - l.cone.position.x, camera.position.z - l.cone.position.z); l.cone.material.opacity *= (1 + nk * 1.4) * clamp((cd - 1.5) / 2.5, 0, 1); l.pool.material.opacity = Math.min(1, l.pool.material.opacity * (1 + nk)); l.halo.scale.setScalar(2.6 + nk * 2.4); }
  if (nk > .05 && state === 'play') {
    camera.getWorldDirection(_f); ray.set(camera.position, _f); ray.far = 35;
    const h = ray.intersectObjects(worldMeshes, false)[0];
    if (h && h.face) {
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      flashPool.position.copy(h.point).addScaledVector(n, .03); flashPool.lookAt(h.point.clone().add(n));
      flashPool.scale.setScalar(1.2 + h.distance * .09); flashPool.material.opacity = nk * .85 * (1 - h.distance / 40); flashPool.visible = true;
    } else flashPool.visible = false;
  } else flashPool.visible = false;
}
const TIME_CYCLE = [0, .5, 1, 1, .5];
function timeForWave(n) { return n <= 0 ? 0 : TIME_CYCLE[(n - 1) % TIME_CYCLE.length]; }

// ---------- colisão ----------
const STEP = 0.55;
function groundAt(x, z, feet, r) {
  let g = 0;
  for (const b of boxes) {
    if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ && b.maxY <= feet + STEP && b.maxY > g) g = b.maxY;
  }
  return g;
}
function pushOut(pos, r, feet, height) {
  for (const b of boxes) {
    if (b.maxY <= feet + STEP || b.minY >= feet + height) continue;
    const cx = clamp(pos.x, b.minX, b.maxX), cz = clamp(pos.z, b.minZ, b.maxZ);
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = cx + dx / d * r; pos.z = cz + dz / d * r; }
    else {
      const l = pos.x - b.minX, rr = b.maxX - pos.x, n = pos.z - b.minZ, f = b.maxZ - pos.z, m = Math.min(l, rr, n, f);
      if (m === l) pos.x = b.minX - r; else if (m === rr) pos.x = b.maxX + r; else if (m === n) pos.z = b.minZ - r; else pos.z = b.maxZ + r;
    }
  }
}

// ---------- manchas de tinta ----------
function splatTex(color, big = true) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = color; g.strokeStyle = color;
  const n = big ? 7 : 3;
  for (let i = 0; i < n; i++) { g.beginPath(); g.arc(64 + rand(-14, 14), 64 + rand(-14, 14), rand(10, 22) * (big ? 1 : .7), 0, 7); g.fill(); }
  for (let i = 0; i < (big ? 22 : 8); i++) {
    const a = Math.random() * 6.28, r = rand(22, 58), x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
    g.beginPath(); g.arc(x, y, rand(1.5, 5.5), 0, 7); g.fill();
    if (Math.random() < .5) { g.lineWidth = rand(2, 5); g.beginPath(); g.moveTo(64 + Math.cos(a) * 18, 64 + Math.sin(a) * 18); g.lineTo(x, y); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); return t;
}
const decalMat = t => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
const RED_SPLATS = [0, 1, 2, 3, 4, 5].map(i => decalMat(splatTex(i % 2 ? '#c81f33' : '#d42a3a')));
const INK_DOTS = [0, 1, 2].map(() => decalMat(splatTex('#2a3fb0', false)));
const decalGeo = new THREE.PlaneGeometry(1, 1);
const decals = [];
function addDecal(p, n, mat, s) {
  const m = new THREE.Mesh(decalGeo, mat);
  m.position.copy(p).addScaledVector(n, 0.015 + Math.random() * 0.01);
  m.lookAt(m.position.clone().add(n)); m.rotateZ(Math.random() * 6.28); m.scale.setScalar(s);
  scene.add(m); decals.push(m);
  if (decals.length > 260) scene.remove(decals.shift());
}
const ray = new THREE.Raycaster();
const _n = new V3();
function surfaceSplat(origin, dir, far, mat, s) {
  ray.set(origin, dir); ray.far = far;
  const h = ray.intersectObjects(worldMeshes, false)[0];
  if (!h || !h.face) return false;
  _n.copy(h.face.normal).transformDirection(h.object.matrixWorld);
  addDecal(h.point, _n, mat, s); return true;
}
const DOWN = new V3(0, -1, 0);
function floorSplat(x, y, z, s) { surfaceSplat(new V3(x, y + 0.3, z), DOWN, 30, RED_SPLATS[Math.floor(Math.random() * 6)], s); }

// partículas
const partMat = new THREE.SpriteMaterial({ map: RED_SPLATS[0].map, depthWrite: false });
const parts = [];
function burst(p, n, spd) {
  for (let i = 0; i < n; i++) {
    if (parts.length > 320) break;
    const s = new THREE.Sprite(partMat); s.position.copy(p); s.scale.setScalar(rand(.08, .24));
    s.userData.v = new V3(rand(-1, 1), rand(.2, 1.6), rand(-1, 1)).multiplyScalar(spd * rand(.4, 1));
    s.userData.life = rand(.4, .9); scene.add(s); parts.push(s);
  }
}
const fx = [];
function tracer(a, b, color = INK) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .9 }));
  scene.add(l); fx.push({ o: l, life: .08, max: .08, upd: (f, k) => { f.o.material.opacity = k * .9; } });
}
function ringFx(x, z, color = RED) {
  const pts = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.28, r = 1 + Math.sin(i * 1.7) * .12; pts.push(new V3(Math.cos(a) * r, 0.05, Math.sin(a) * r)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true }));
  l.position.set(x, 0, z); scene.add(l);
  fx.push({ o: l, life: .9, max: .9, upd: (f, k) => { f.o.scale.setScalar(.3 + (1 - k) * 2.2); f.o.material.opacity = k; f.o.rotation.y += .05; } });
}

// ---------- som ----------
let AC = null, master = null, noiseBuf = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = .002; comp.release.value = .25;
    master = AC.createGain(); master.gain.value = .45; master.connect(comp); comp.connect(AC.destination);
  } catch (e) { AC = null; }
}
function sNoise(dur, f, q = 1, vol = .5, type = 'lowpass', delay = 0, f2 = 0) {
  if (!AC) return;
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = AC.currentTime + delay, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .004); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + .05);
}
function sTone(f1, f2, dur, vol = .3, type = 'square', delay = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .004); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
}
const SFX = {
  uzi: () => { sNoise(.08, 3400, .8, .5); sNoise(.04, 7000, .7, .25, 'highpass'); sTone(240, 80, .05, .18); },
  escopeta: () => {
    sNoise(.07, 6000, .7, .7, 'highpass'); sTone(110, 30, .45, .8, 'sine');
    sNoise(.8, 2400, .6, 1, 'lowpass', 0, 180); sNoise(.5, 600, .6, .22, 'lowpass', .3, 120);
  },
  sniper: () => {
    sNoise(.06, 7000, .7, 1, 'highpass');
    sTone(120, 26, 1.2, 1.3, 'sine'); sTone(62, 22, 1.6, .9, 'triangle');
    sNoise(1.9, 3400, .5, 1.4, 'lowpass', 0, 85);
    sNoise(1.3, 900, .6, .42, 'lowpass', .3, 110); sNoise(1.1, 620, .6, .24, 'lowpass', .68, 90); sNoise(.9, 450, .6, .13, 'lowpass', 1.05, 80);
  },
  bolt: () => { sTone(380, 280, .06, .2); sNoise(.05, 3000, 3, .25, 'bandpass', .02); sTone(640, 480, .05, .2, 'square', .2); sNoise(.05, 3600, 3, .25, 'bandpass', .22); },
  pump: () => { sNoise(.09, 1800, 2, .4, 'bandpass'); sTone(300, 220, .05, .12); sNoise(.09, 2500, 2, .4, 'bandpass', .14); },
  shell: () => { sTone(rand(2600, 3400), 2100, .05, .05, 'triangle', rand(.25, .4)); sTone(rand(2600, 3400), 2100, .04, .03, 'triangle', rand(.45, .55)); },
  regua: () => sNoise(.2, 900, 3, .5, 'bandpass', 0, 2400),
  hit: () => sTone(900, 650, .05, .1),
  head: () => sTone(1500, 1100, .08, .14, 'triangle'),
  kill: () => { sNoise(.28, 450, 1, .55); sTone(240, 70, .22, .2, 'triangle'); sTone(900, 300, .12, .08, 'square', .05); },
  hurt: () => sTone(210, 80, .25, .32, 'sawtooth'),
  click: () => sTone(1300, 1200, .03, .12),
  reload: () => { sTone(520, 420, .05, .14); sTone(760, 640, .05, .14, 'square', .3); },
  pickup: () => { sTone(600, 1200, .16, .18, 'triangle'); },
  spit: () => sNoise(.22, 700, 2, .3, 'bandpass'),
  wave: () => { sTone(300, 300, .15, .15, 'triangle'); sTone(450, 450, .15, .15, 'triangle', .15); sTone(600, 600, .3, .15, 'triangle', .3); },
  draw: () => sNoise(.07, rand(2200, 3600), 3, .07, 'bandpass'),
  hook: () => { sNoise(.2, 3000, 2, .4, 'bandpass', 0, 800); sTone(1600, 300, .15, .1, 'sawtooth'); },
  hookHit: () => { sTone(260, 170, .07, .3); sNoise(.05, 4000, 2, .3, 'bandpass'); },
  gas: () => sNoise(.22, 2200, .7, .14, 'highpass'),
  miss: () => sTone(420, 200, .12, .1, 'triangle'),
  ak: () => { sNoise(.13, 2600, .8, .6); sNoise(.05, 6500, .7, .3, 'highpass'); sTone(160, 55, .1, .32, 'sine'); },
  pistola: () => { sNoise(.06, 6500, .7, .6, 'highpass'); sNoise(.28, 2200, .6, .65, 'lowpass', 0, 300); sTone(150, 45, .16, .5, 'sine'); },
  bazuca: () => { sNoise(.55, 700, 1, .7, 'bandpass', 0, 2600); sTone(95, 45, .3, .45, 'sine'); sNoise(.05, 5000, .7, .4, 'highpass'); },
  boom: (v = 1) => {
    sNoise(.1, 5000, .7, .8 * v, 'highpass'); sTone(85, 18, 1.7, 1.4 * v, 'sine'); sTone(50, 18, 2, .9 * v, 'triangle');
    sNoise(2.3, 1800, .5, 1.5 * v, 'lowpass', 0, 55); sNoise(1.4, 700, .6, .4 * v, 'lowpass', .35, 80); sNoise(1.1, 500, .6, .2 * v, 'lowpass', .8, 70);
  },
  magOut: () => { sTone(900, 700, .04, .14); sNoise(.06, 2000, 3, .2, 'bandpass'); },
  magIn: () => { sTone(700, 500, .05, .2); sNoise(.05, 3000, 3, .3, 'bandpass'); sTone(1100, 900, .03, .12, 'square', .06); },
  charge: () => { sNoise(.07, 2600, 3, .3, 'bandpass'); sTone(500, 300, .06, .16, 'square', .08); },
  boltBack: () => { sTone(420, 300, .05, .2); sNoise(.06, 3200, 3, .28, 'bandpass'); },
  boltFwd: () => { sTone(650, 480, .05, .2); sNoise(.05, 3600, 3, .28, 'bandpass'); },
  land: () => { sTone(90, 40, .15, .4, 'sine'); sNoise(.1, 600, 1, .3); },
};

// ---------- armas (viewmodel) ----------
const hold = new THREE.Group(); vmScene.add(hold);
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (r, l, s = 8) => { const g = new THREE.CylinderGeometry(r, r, l, s); g.rotateX(Math.PI / 2); return g; };
function vpart(grp, geo, x, y, z, mk = 'light', rx = 0, color = INK) {
  worldUV(geo, .35);
  const m = new THREE.Mesh(geo, typeof mk === 'string' ? MAT[mk] : mk); m.position.set(x, y, z); m.rotation.x = rx;
  m.add(ink(geo, color, .004)); grp.add(m); return m;
}
const dotTex = radialTex([[0, 'rgba(255,40,50,1)'], [.35, 'rgba(255,40,50,.9)'], [.6, 'rgba(255,60,60,.25)'], [1, 'rgba(255,60,60,0)']], 64);
const Y_AX = new V3(0, 1, 0);
const SKIN = mkMat(T.plain); SKIN.color.setHex(0xf2c6a0);
const SLEEVE = mkMat(T.dense); SLEEVE.color.setHex(0xb9c6f2);
let NO_ARMS = false;
function addArm(parent, x, y, z, side, dir) {
  const grp = new THREE.Group(); grp.position.set(x, y, z);
  if (NO_ARMS) return grp;
  parent.add(grp);
  vpart(grp, B(.064, .078, .1), side * .02, -.014, 0, SKIN);               // mão
  vpart(grp, B(.024, .024, .056), -side * .03, .028, -.035, SKIN);         // polegar
  const d = (dir || new V3(side * .38, -.55, .75)).clone().normalize();
  const fa = new THREE.CylinderGeometry(.032, .038, .42, 7); fa.translate(0, .21, 0);
  const m1 = vpart(grp, fa, side * .012, -.012, .04, SKIN); m1.quaternion.setFromUnitVectors(Y_AX, d);
  const sl = new THREE.CylinderGeometry(.052, .058, .55, 7); sl.translate(0, .36 + .275, 0);
  const m2 = vpart(grp, sl, side * .012, -.012, .04, SLEEVE); m2.quaternion.setFromUnitVectors(Y_AX, d);
  const cuff = new THREE.CylinderGeometry(.056, .056, .04, 7); cuff.translate(0, .38, 0);
  const m3 = vpart(grp, cuff, side * .012, -.012, .04, 'plain', 0, RED); m3.quaternion.setFromUnitVectors(Y_AX, d);
  return grp;
}
function buildUzi() {
  const g = new THREE.Group();
  vpart(g, B(.075, .1, .34), 0, 0, -.05, 'light');          // caixa da culatra
  vpart(g, B(.06, .022, .3), 0, .061, -.05, 'plain');        // tampa
  vpart(g, C(.02, .1), 0, .012, -.265, 'plain');            // cano
  vpart(g, C(.032, .035), 0, .012, -.235, 'dense');         // porca do cano
  vpart(g, B(.068, .05, .1), 0, -.07, -.15, 'med');          // guarda-mão
  vpart(g, B(.056, .17, .075), 0, -.13, .01, 'dense', .1);    // empunhadura
  const magU = new THREE.Group(); g.add(magU); g.userData.mag = magU;
  vpart(magU, B(.042, .17, .052), 0, -.3, -.008, 'med', .1);     // carregador (dentro da empunhadura)
  vpart(magU, B(.046, .02, .058), 0, -.39, -.017, 'dense', .1);
  vpart(g, B(.012, .05, .07), 0, -.07, -.075, 'plain');      // guarda-mato
  vpart(g, B(.02, .022, .04), 0, .078, -.16, 'dense');        // alavanca de manejo
  for (const s of [-1, 1]) vpart(g, B(.008, .008, .26), s * .036, -.035, .2, 'plain'); // coronha dobrada
  vpart(g, B(.08, .07, .014), 0, -.045, .33, 'med');
  // red dot
  vpart(g, B(.05, .016, .1), 0, .078, -.02, 'dense');
  const fr = .028, sy = .115, sz = -.03;
  vpart(g, B(.07, .01, .03), 0, sy + fr, sz, 'plain'); vpart(g, B(.07, .01, .03), 0, sy - fr, sz, 'plain');
  vpart(g, B(.01, .066, .03), -fr - .005, sy, sz, 'plain'); vpart(g, B(.01, .066, .03), fr + .005, sy, sz, 'plain');
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(.056, .05), new THREE.MeshBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: .16, depthWrite: false }));
  glass.position.set(0, sy, sz); g.add(glass);
  const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, depthTest: false, transparent: true }));
  dot.scale.setScalar(.011); dot.position.set(0, sy, sz - .03); dot.renderOrder = 5; g.add(dot);
  g.userData.port = new V3(.04, .04, -.08);
  g.userData.armR = addArm(g, .0, -.12, .02, 1); g.userData.armL = addArm(g, -.012, -.33, -.01, -1, new V3(-.3, -.75, .55));
  return g;
}
function buildEscopeta() {
  const g = new THREE.Group();
  vpart(g, B(.085, .11, .32), 0, 0, 0, 'light');
  vpart(g, C(.026, .64), 0, .035, -.47, 'plain');
  vpart(g, C(.02, .5), 0, -.022, -.4, 'med');
  g.userData.pump = vpart(g, B(.08, .07, .2), 0, -.025, -.36, 'dense');
  vpart(g, B(.07, .11, .34), 0, -.05, .32, 'med', .12);
  vpart(g, B(.012, .045, .06), 0, -.075, .05, 'plain');
  vpart(g, B(.014, .02, .014), 0, .062, -.76, 'plain');
  g.userData.port = new V3(.045, .02, -.03);
  addArm(g, 0, -.09, .19, 1); addArm(g.userData.pump, -.01, -.045, 0, -1, new V3(-.6, -.42, .68));
  return g;
}
function buildSniper() {
  const g = new THREE.Group();
  vpart(g, B(.065, .09, .44), 0, 0, 0, 'light');
  vpart(g, C(.019, .78), 0, .015, -.6, 'plain');
  vpart(g, B(.05, .042, .09), 0, .015, -1.02, 'dense');      // freio de boca
  vpart(g, C(.04, .36), 0, .115, -.04, 'plain', 0, ORANGE);   // luneta
  vpart(g, C(.056, .09), 0, .115, -.26, 'med', 0, ORANGE);
  vpart(g, C(.05, .06), 0, .115, .16, 'med', 0, ORANGE);
  for (const z of [-.12, .06]) vpart(g, B(.026, .05, .025), 0, .07, z, 'dense');
  const bolt = new THREE.Group(); bolt.position.set(0, .03, .12);
  vpart(bolt, B(.075, .014, .014), .04, 0, 0, 'plain'); vpart(bolt, new THREE.SphereGeometry(.02, 8, 6), .085, 0, 0, 'dense');
  g.add(bolt); g.userData.bolt = bolt;
  vpart(g, B(.06, .13, .36), 0, -.045, .4, 'dense');
  vpart(g, B(.05, .04, .2), 0, .04, .4, 'med');
  vpart(g, B(.05, .14, .06), 0, -.11, .14, 'med', .35);
  for (const s of [-1, 1]) vpart(g, B(.008, .008, .32), s * .018, -.06, -.42, 'plain');
  g.userData.port = new V3(.045, .035, .06);
  const magS = new THREE.Group(); g.add(magS); g.userData.mag = magS;
  vpart(magS, B(.05, .1, .11), 0, -.085, -.06, 'dense');            // carregador da AWP
  g.userData.armR = addArm(g, 0, -.12, .15, 1); g.userData.armL = addArm(g, -.01, -.06, -.3, -1, new V3(-.6, -.42, .68));
  return g;
}
function buildAK() {
  const g = new THREE.Group();
  vpart(g, B(.07, .1, .42), 0, 0, 0, 'light');                 // caixa
  vpart(g, B(.06, .03, .36), 0, .064, 0, 'plain');               // tampa
  vpart(g, C(.017, .5), 0, .02, -.45, 'plain');                  // cano
  vpart(g, C(.014, .3), 0, .066, -.33, 'med');                   // tubo de gás
  vpart(g, B(.076, .075, .2), 0, -.01, -.3, 'med', 0, ORANGE);   // guarda-mão de madeira
  vpart(g, B(.04, .03, .04), 0, .035, -.67, 'dense');            // base da massa
  vpart(g, B(.008, .04, .012), 0, .073, -.67, 'dense');          // massa de mira
  for (const sx of [-1, 1]) vpart(g, B(.01, .022, .03), sx * .014, .088, .0, 'plain'); // alça (entalhe)
  const magA = new THREE.Group(); g.add(magA); g.userData.mag = magA;
  vpart(magA, B(.044, .1, .07), 0, -.1, -.09, 'dense', -.15);        // carregador curvo (pente)
  vpart(magA, B(.044, .1, .07), 0, -.19, -.06, 'dense', -.38);
  vpart(magA, B(.044, .09, .07), 0, -.27, -.01, 'dense', -.62);
  vpart(g, B(.05, .14, .06), 0, -.11, .13, 'med', .35, ORANGE);  // empunhadura
  vpart(g, B(.06, .1, .32), 0, -.04, .37, 'med', .12, ORANGE);   // coronha
  g.userData.port = new V3(.04, .04, -.02);
  g.userData.armR = addArm(g, 0, -.12, .14, 1); g.userData.armL = addArm(g, -.01, -.06, -.31, -1, new V3(-.6, -.42, .68));
  return g;
}
function buildPistola() {
  const g = new THREE.Group();
  g.userData.slide = vpart(g, B(.056, .062, .27), 0, .031, -.05, 'light');
  vpart(g, B(.05, .04, .22), 0, -.016, -.06, 'med');
  vpart(g, C(.014, .04), 0, .03, -.2, 'dense');
  vpart(g, B(.052, .16, .068), 0, -.1, .05, 'dense', .25);
  vpart(g, B(.012, .04, .05), 0, -.048, -.045, 'plain');
  vpart(g, B(.009, .018, .012), 0, .07, -.17, 'dense');
  for (const sx of [-1, 1]) vpart(g, B(.01, .016, .012), sx * .012, .07, .07, 'dense');
  g.userData.port = new V3(.035, .05, -.03);
  addArm(g, 0, -.1, .06, 1); addArm(g, -.02, -.12, .07, -1, new V3(-.45, -.6, .6));
  return g;
}
function buildBazuca() {
  const g = new THREE.Group();
  vpart(g, C(.07, 1.0, 10), 0, .02, -.15, 'light');
  vpart(g, C(.086, .12, 10), 0, .02, -.66, 'dense');
  vpart(g, C(.082, .1, 10), 0, .02, .38, 'dense');
  vpart(g, C(.075, .06, 10), 0, .02, .05, 'med', 0, ORANGE);
  vpart(g, B(.05, .13, .06), 0, -.11, .05, 'med', .3);
  vpart(g, B(.05, .12, .06), 0, -.1, -.26, 'med', .2);
  vpart(g, B(.04, .07, .12), -.09, .09, -.1, 'plain', 0, ORANGE);
  const wg = new THREE.ConeGeometry(.06, .16, 8); wg.rotateX(-Math.PI / 2); worldUV(wg, .3);
  const wh = new THREE.Mesh(wg, MAT.dense); wh.add(ink(wg, RED, .004)); wh.position.set(0, .02, -.76); g.add(wh);
  g.userData.warhead = wh;
  addArm(g, 0, -.13, .05, 1); addArm(g, -.01, -.12, -.26, -1, new V3(-.6, -.42, .68));
  return g;
}
function buildRegua() {
  const g = new THREE.Group();
  vpart(g, B(.014, .075, 1.0), 0, 0, -.45, 'plain');
  vpart(g, B(.035, .095, .17), 0, 0, .1, 'dense', 0, RED);
  const pts = [];
  for (let i = 0; i <= 18; i++) { const z = -.03 - i * .05, l = i % 5 === 0 ? .03 : .015; pts.push(.008, .037, z, .008, .037 - l, z); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(geo, lm(INK)));
  addArm(g, 0, 0, .1, 1, new V3(.4, -.5, .75));
  g.rotation.z = -.5;
  g.userData = {};
  return g;
}
const WEAPONS = [
  { id: 'uzi', name: 'UZI', desc: 'rajada · botão direito mira na red dot', dmg: 15, rate: .062, magSize: 32, reserveMax: 256, spread: .022, pellets: 1, reload: 1.4, auto: true, kick: .008, build: buildUzi, muzzle: new V3(0, .012, -.33), ring: 24, ads: { pos: new V3(0, -.115, -.36), fov: 52 }, bullet: 'uzi', fl: .14, casing: 'small' },
  { id: 'escopeta', name: 'ESCOPETA', desc: 'de perto apaga tudo · BOOM', dmg: 13, rate: .85, magSize: 6, reserveMax: 42, spread: .075, pellets: 10, reload: 2.0, kick: .06, build: buildEscopeta, muzzle: new V3(0, .035, -.8), ring: 56, bullet: 'pellet', fl: .3, casing: 'shell', boom: 'BOOM!', action: 'pump' },
  { id: 'sniper', name: 'SNIPER', desc: 'ferrolho · atravessa tudo · BLAM', dmg: 170, rate: 1.3, magSize: 5, reserveMax: 30, spread: .03, pellets: 1, reload: 2.4, kick: .12, zoom: true, pierce: true, build: buildSniper, muzzle: new V3(0, .015, -1.07), ring: 10, bullet: 'sniper', fl: .55, casing: 'big', boom: 'BLAM!', action: 'bolt' },
  { id: 'ak', name: 'AK-47', desc: 'fuzil automático · botão direito mira na massa', dmg: 25, rate: .1, magSize: 30, reserveMax: 210, spread: .018, pellets: 1, reload: 1.9, auto: true, kick: .016, build: buildAK, muzzle: new V3(0, .02, -.71), ring: 22, ads: { pos: new V3(0, -.092, -.42), fov: 58 }, bullet: 'rifle', fl: .2, casing: 'small' },
  { id: 'pistola', name: 'PISTOLA', desc: 'semi · forte e precisa · PAH', dmg: 48, rate: .26, magSize: 7, reserveMax: 63, spread: .008, pellets: 1, reload: 1.3, kick: .05, build: buildPistola, muzzle: new V3(0, .03, -.23), ring: 14, ads: { pos: new V3(0, -.079, -.36), fov: 62 }, bullet: 'pistol', fl: .22, casing: 'small', boom: 'PAH!', slide: true },
  { id: 'bazuca', name: 'BAZUCA', desc: 'foguete · explode tudo em volta · KABOOM', dmg: 220, rate: 1.2, magSize: 1, reserveMax: 10, spread: .004, pellets: 1, reload: 2.1, kick: .09, build: buildBazuca, muzzle: new V3(0, .02, -.8), ring: 30, fl: .5, rocket: true },
  { id: 'regua', name: 'RÉGUA', desc: 'corpo a corpo · voando no gancho corta mais', dmg: 80, rate: .5, melee: true, range: 2.9, build: buildRegua, ring: 0 },
];
{ const ord = ['uzi', 'ak', 'pistola', 'escopeta', 'sniper', 'bazuca', 'regua']; WEAPONS.sort((a, b) => ord.indexOf(a.id) - ord.indexOf(b.id)); }
WEAPONS.forEach(w => { w.model = w.build(); w.model.visible = false; hold.add(w.model); });
const WID = id => WEAPONS.find(w => w.id === id);
WID('bazuca').model.position.set(.02, .07, .05);
WID('sniper').model.scale.setScalar(.8); WID('sniper').model.position.set(.02, .01, -.1);
const _mz = new V3();
const starTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.beginPath();
  for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283, r = i % 2 ? 22 : rand(46, 62); g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
  g.closePath(); g.fillStyle = 'rgba(246,195,68,.95)'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#2a3fb0'; g.stroke();
  g.fillStyle = 'rgba(255,250,220,.95)'; g.beginPath(); g.arc(64, 64, 14, 0, 7); g.fill();
  return new THREE.CanvasTexture(c);
})();
const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, depthTest: false, transparent: true }));
flash.scale.setScalar(.22); flash.visible = false; hold.add(flash);

// ---------- animações das mãos: trocar pente e puxar ferrolho ----------
function kfv(k, keys) {
  if (k <= keys[0][0]) return keys[0][1].clone();
  for (let i = 1; i < keys.length; i++) if (k <= keys[i][0]) {
    const [t0, a] = keys[i - 1], [t1, b] = keys[i]; let u = (k - t0) / (t1 - t0); u = u * u * (3 - 2 * u);
    return a.clone().lerp(b, u);
  }
  return keys[keys.length - 1][1].clone();
}
const v3 = (x, y, z) => new V3(x, y, z);
const RELOADS = {
  ak: { L0: v3(-.01, -.06, -.31), LM: v3(-.03, -.2, -.07), drop: .32, insert: .68, charge: .84,
    keys: [[0, v3(-.01, -.06, -.31)], [.12, v3(-.03, -.2, -.07)], [.3, v3(-.03, -.42, -.01)], [.38, v3(-.08, -.7, .05)], [.48, v3(-.08, -.7, .05)], [.6, v3(-.03, -.4, -.02)], [.68, v3(-.03, -.2, -.07)], [.76, v3(.07, .05, -.1)], [.84, v3(.07, .05, .02)], [.94, v3(-.01, -.06, -.31)]],
    attach: [[.12, .34], [.48, .68]] },
  uzi: { L0: v3(-.012, -.33, -.01), LM: v3(-.012, -.33, -.01), drop: .28, insert: .7, charge: .86,
    keys: [[0, v3(-.012, -.33, -.01)], [.25, v3(-.012, -.55, .03)], [.34, v3(-.07, -.75, .05)], [.5, v3(-.07, -.75, .05)], [.62, v3(-.012, -.52, .02)], [.7, v3(-.012, -.33, -.01)], [.8, v3(.0, .1, -.16)], [.86, v3(.0, .1, -.07)], [.95, v3(-.012, -.33, -.01)]],
    attach: [[0, .3], [.5, .7]] },
  sniper: { L0: v3(-.01, -.06, -.3), LM: v3(-.02, -.13, -.06), drop: .28, insert: .58, bolt: [.68, .96],
    keys: [[0, v3(-.01, -.06, -.3)], [.1, v3(-.02, -.13, -.06)], [.26, v3(-.02, -.35, -.02)], [.34, v3(-.08, -.65, .05)], [.42, v3(-.08, -.65, .05)], [.52, v3(-.02, -.33, -.03)], [.58, v3(-.02, -.13, -.06)], [.68, v3(-.01, -.06, -.3)]],
    attach: [[.1, .3], [.42, .58]] },
};
// pose do ferrolho num ciclo t de 0 a 1: gira pra cima, puxa, empurra, gira pra baixo
function boltPose(t) {
  if (t <= 0 || t >= 1) return [0, 0];
  if (t < .25) return [1.15 * t / .25, 0];
  if (t < .5) return [1.15, .11 * (t - .25) / .25];
  if (t < .75) return [1.15, .11 * (1 - (t - .5) / .25)];
  return [1.15 * (1 - (t - .75) / .25), 0];
}
const _hp = new V3();
function animHands(w, dt) {
  const md = w.model.userData, cfg = RELOADS[w.id];
  let tiltZ = 0, tiltX = 0, raise = 0, shift = 0;
  if (cfg && md.mag && md.armL) {
    const k = w.reloadT > 0 ? 1 - w.reloadT / w.reload : -1;
    if (k < 0) { md.armL.position.copy(cfg.L0); md.mag.position.set(0, 0, 0); md.mag.visible = true; w.rFlags = {}; }
    else {
      const f = w.rFlags || (w.rFlags = {});
      const hand = kfv(k, cfg.keys); md.armL.position.copy(hand);
      const att = cfg.attach.some(([a, b]) => k >= a && k <= b);
      md.mag.visible = !(k > cfg.drop && k < cfg.attach[1][0]);
      md.mag.position.copy(att ? hand.clone().sub(cfg.LM) : v3(0, 0, 0));
      if (k > cfg.drop && !f.drop) { f.drop = true; dropMag(w); SFX.magOut(); }
      if (k > cfg.insert && !f.ins) { f.ins = true; SFX.magIn(); }
      if (cfg.charge && k > cfg.charge && !f.ch) { f.ch = true; SFX.charge(); }
      const bump = Math.sin(Math.PI * Math.min(1, k * 1.15));
      tiltZ = -.5 * bump; tiltX = -.18 * bump; raise = .13 * bump; shift = -.07 * bump;
      if (cfg.bolt) {
        const [a, b] = cfg.bolt, t = (k - a) / (b - a);
        boltWithHand(md, t, f);
      }
    }
  }
  if (md.bolt && w.reloadT <= 0) {
    let t = -1;
    if (w.timer > 0 && w.action) { const k = 1 - w.timer / w.rate; t = (k - .15) / .6; }
    boltWithHand(md, t, w);
    if (t > 0 && t < 1) { const s3 = Math.sin(Math.PI * t); tiltZ += s3 * .22; tiltX += s3 * .05; }
  }
  return [tiltX, tiltZ, raise, shift];
}
function boltWithHand(md, t, flags) {
  const [rz, pz] = boltPose(t);
  md.bolt.rotation.z = rz; md.bolt.position.z = .12 + pz;
  if (!md.armR) return;
  const R0 = md.armR.userData.rest || (md.armR.userData.rest = md.armR.position.clone());
  const knob = _hp.set(.085 * Math.cos(rz) + .01, .03 + .085 * Math.sin(rz) - .02, .12 + pz + .02);
  let blend = 0;
  if (t > -.18 && t < 0) blend = (t + .18) / .18; else if (t >= 0 && t <= 1) blend = 1; else if (t > 1 && t < 1.18) blend = 1 - (t - 1) / .18;
  blend = blend * blend * (3 - 2 * blend);
  md.armR.position.copy(R0).lerp(knob, blend);
  if (t > .25 && flags && !flags.bUp) { flags.bUp = true; SFX.boltBack(); }
  if (t > .55 && flags && !flags.bFw) { flags.bFw = true; SFX.boltFwd(); }
  if (t < 0 && flags) { flags.bUp = flags.bFw = false; }
}
function dropMag(w) {
  const md = w.model.userData; hold.updateMatrixWorld(true);
  const c = md.mag.clone(true);
  md.mag.updateMatrixWorld(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); c.updateMatrix(); c.applyMatrix4(md.mag.matrixWorld);
  vmScene.add(c);
  casings.push({ m: c, v: new V3(rand(-.1, .1), -.4, .1), av: new V3(rand(-3, 3), rand(-2, 2), rand(-3, 3)), life: .9 });
}
// fumacinha saindo do cano (some rapidinho)
const vmPuffs = [];
function vmSmoke(w, n) {
  hold.updateMatrixWorld(true);
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: .5, depthWrite: false }));
    sp.position.copy(w.model.localToWorld(w.muzzle.clone())); sp.scale.setScalar(rand(.04, .08)); sp.material.rotation = Math.random() * 6;
    vmScene.add(sp); vmPuffs.push({ sp, v: new V3(rand(-.05, .05), rand(.08, .2), rand(-.25, -.08)), life: rand(.35, .6), max: .6, s0: sp.scale.x });
  }
}
function updateVmPuffs(dt) {
  for (let i = vmPuffs.length - 1; i >= 0; i--) {
    const q = vmPuffs[i]; q.life -= dt;
    if (q.life <= 0) { vmScene.remove(q.sp); q.sp.material.dispose(); vmPuffs.splice(i, 1); continue; }
    q.sp.position.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - dt * 2);
    const k = q.life / q.max; q.sp.material.opacity = .5 * k; q.sp.scale.setScalar(q.s0 * (1 + (1 - k) * 2.5));
  }
}
// cápsulas ejetadas (na cena da arma)
const BRASS = new THREE.MeshBasicMaterial({ color: 0xe9c25a });
const SHELLM = new THREE.MeshBasicMaterial({ color: RED });
const CASE_GEO = { small: C(.008, .024, 6), shell: C(.015, .055, 8), big: C(.011, .07, 6) };
const casings = [];
function ejectCasing(w) {
  if (!w.casing || !w.model.userData.port) return;
  hold.updateMatrixWorld(true);
  const geo = CASE_GEO[w.casing];
  const m = new THREE.Mesh(geo, w.casing === 'shell' ? SHELLM : BRASS);
  m.add(ink(geo, INK, .001, 20));
  m.position.copy(w.model.userData.port); w.model.localToWorld(m.position);
  m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
  vmScene.add(m);
  casings.push({ m, v: new V3(rand(.7, 1.2), rand(.8, 1.3), rand(-.1, .25)), av: new V3(rand(-25, 25), rand(-25, 25), rand(-25, 25)), life: .6 });
  SFX.shell();
}
function updateCasings(dt) {
  for (let i = casings.length - 1; i >= 0; i--) {
    const c = casings[i]; c.life -= dt; c.v.y -= 5.5 * dt;
    c.m.position.addScaledVector(c.v, dt);
    c.m.rotation.x += c.av.x * dt; c.m.rotation.y += c.av.y * dt; c.m.rotation.z += c.av.z * dt;
    if (c.life <= 0) { vmScene.remove(c.m); casings.splice(i, 1); }
  }
}

// balas visíveis no mundo
const BUL = {
  uzi: { speed: 230, len: .5, w: .035, color: 0xf6c344, edge: INK, trail: 2.4, tcol: INK },
  pellet: { speed: 160, len: .16, w: .06, color: RED, edge: INK, trail: 1.3, tcol: INK },
  rifle: { speed: 260, len: .6, w: .04, color: ORANGE, edge: INK, trail: 3, tcol: INK },
  pistol: { speed: 210, len: .32, w: .055, color: 0xf6c344, edge: RED, trail: 1.8, tcol: RED },
  sniper: { speed: 480, len: 3.4, w: .09, color: 0xfff07a, edge: RED, trail: 12, tcol: RED },
};
for (const k in BUL) { const b = BUL[k]; b.geo = new THREE.BoxGeometry(b.w, b.w, b.len); b.mat = new THREE.MeshBasicMaterial({ color: b.color }); b.inkP = ink(b.geo, b.edge, .004); }
const bullets = [];
function spawnBullet(type, from, to, onArrive) {
  const b = BUL[type], dir = to.clone().sub(from), L = dir.length();
  if (L < .05) { onArrive(); return; }
  dir.normalize();
  const m = new THREE.Mesh(b.geo, b.mat); m.add(b.inkP.clone()); m.position.copy(from); m.lookAt(to); scene.add(m);
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const tl = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: b.tcol, transparent: true, opacity: .75 })); tl.frustumCulled = false; scene.add(tl);
  m.visible = false;
  bullets.push({ m, tl, from: from.clone(), dir, L, d: 0, b, onArrive, done: false, tail: undefined, age: 0 });
  if (bullets.length > 220) killBullet(0);
}
function killBullet(i, silent) {
  const u = bullets[i]; scene.remove(u.m); scene.remove(u.tl); u.tl.geometry.dispose(); u.tl.material.dispose();
  if (!u.done && !silent) { u.done = true; try { u.onArrive(); } catch (e) { } }
  bullets.splice(i, 1);
}
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const u = bullets[i], b = u.b;
    if (!u.done) {
      u.d += b.speed * dt;
      if (u.d >= u.L) { u.d = u.L; u.done = true; u.m.visible = false; try { u.onArrive(); } catch (e) { console.error(e); } }
      u.m.position.copy(u.from).addScaledVector(u.dir, Math.max(0, u.d - b.len / 2));
      u.m.visible = !u.done && u.d > 2.2;
    }
    let tail, head;
    if (u.done) { u.tail = Math.min(u.L, (u.tail === undefined ? Math.max(0, u.L - b.trail) : u.tail) + b.speed * .6 * dt); tail = u.tail; head = u.L; }
    else { tail = Math.max(1.6, u.d - b.trail); head = Math.max(tail, u.d - b.len); }
    u.age += dt; u.tl.material.opacity = .75 * clamp(1 - u.age * 2.2, .12, 1);
    const a = u.tl.geometry.attributes.position.array;
    a[0] = u.from.x + u.dir.x * tail; a[1] = u.from.y + u.dir.y * tail; a[2] = u.from.z + u.dir.z * tail;
    a[3] = u.from.x + u.dir.x * head; a[4] = u.from.y + u.dir.y * head; a[5] = u.from.z + u.dir.z * head;
    u.tl.geometry.attributes.position.needsUpdate = true;
    if (u.done && tail >= u.L - 1e-3) killBullet(i);
  }
}
const puffTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.strokeStyle = `rgba(${INK_RGB},.6)`; g.lineWidth = 2;
  for (let k = 0; k < 3; k++) { g.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * 6.283, r = 18 + Math.sin(a * 3 + k) * 4 + k * 3; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.stroke(); }
  return new THREE.CanvasTexture(c);
})();
function puff(p, s, life, v, op = .5) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: op, depthWrite: false }));
  sp.position.copy(p); sp.scale.setScalar(s); sp.material.rotation = Math.random() * 6; scene.add(sp);
  fx.push({ o: sp, life, max: life, upd: (f, k, dt) => { f.o.position.addScaledVector(v, dt); f.o.scale.setScalar(s * (1 + (1 - k) * 2.2)); f.o.material.opacity = k * op; } });
}
function smokePuffs(p, n, dir) {
  for (let i = 0; i < n; i++) puff(p.clone().addScaledVector(dir, rand(0, 1.5)), rand(.1, .22), rand(.5, .9), dir.clone().multiplyScalar(rand(1, 3)).add(new V3(0, rand(.3, .9), 0)), .35);
}
function sniperTrail(a, b) {
  for (let k = 0; k < 3; k++) {
    const off = new V3(rand(-.05, .05), rand(-.05, .05), rand(-.05, .05));
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.clone().add(off), b.clone().add(off)]), new THREE.LineBasicMaterial({ color: k ? INK : RED, transparent: true, opacity: .85 }));
    scene.add(l); fx.push({ o: l, life: 1.3, max: 1.3, upd: (f, kk) => { f.o.material.opacity = kk * .85; } });
  }
  const L = a.distanceTo(b), n = Math.min(45, Math.floor(L / 2.2));
  for (let i = 2; i <= n; i++) puff(a.clone().lerp(b, i / n), rand(.25, .5), rand(1.1, 1.7), new V3(rand(-.2, .2), rand(.2, .6), rand(-.2, .2)), .38);
}
const sparkMat = new THREE.SpriteMaterial({ map: INK_DOTS[0].map, depthWrite: false });
function impactFx(p, n, type) {
  const cnt = type === 'sniper' ? 16 : type === 'pellet' ? 2 : 4;
  for (let i = 0; i < cnt; i++) {
    const s = new THREE.Sprite(sparkMat); s.position.copy(p); s.scale.setScalar(rand(.06, type === 'sniper' ? .25 : .14));
    s.userData.v = n.clone().multiplyScalar(rand(2, 6)).add(new V3(rand(-2, 2), rand(0, 3), rand(-2, 2)));
    s.userData.life = rand(.2, .5); s.userData.noSplat = true; scene.add(s); parts.push(s);
  }
  if (type === 'sniper') { puff(p, .8, .8, n.clone(), .6); ringBurst(p, n); }
}
function ringBurst(p, n) {
  const pts = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * 6.283; pts.push(new V3(Math.cos(a), Math.sin(a), 0)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: RED, transparent: true }));
  l.position.copy(p).addScaledVector(n, .05); l.lookAt(p.clone().add(n)); scene.add(l);
  fx.push({ o: l, life: .35, max: .35, upd: (f, k) => { f.o.scale.setScalar(.2 + (1 - k) * 2.5); f.o.material.opacity = k; } });
}
// ---------- bazuca: foguete e explosão ----------
const rockets = [];
const ROCKET = (() => {
  const g = new THREE.Group();
  const body = new THREE.CylinderGeometry(.08, .08, .55, 8); body.rotateX(Math.PI / 2); worldUV(body, .4);
  const tip = new THREE.ConeGeometry(.08, .22, 8); tip.rotateX(-Math.PI / 2); tip.translate(0, 0, -.38);
  const fin = new THREE.BoxGeometry(.32, .02, .14); fin.translate(0, 0, .22);
  const fin2 = new THREE.BoxGeometry(.02, .32, .14); fin2.translate(0, 0, .22);
  [[body, MAT.light, INK], [tip, MAT.dense, RED], [fin, MAT.med, INK], [fin2, MAT.med, INK]].forEach(([geo, m, c]) => { const mesh = new THREE.Mesh(geo, m); mesh.add(ink(geo, c, .01)); g.add(mesh); });
  return g;
})();
const flameMat = new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false });
function spawnRocket(from, dir) {
  const g = ROCKET.clone(); g.position.copy(from); g.lookAt(from.clone().sub(dir)); scene.add(g);
  const fl = new THREE.Sprite(flameMat); fl.scale.setScalar(.45); fl.position.set(0, 0, .45); g.add(fl);
  rockets.push({ g, fl, v: dir.clone().multiplyScalar(44), life: 4, puffT: 0 });
}
function updateRockets(dt) {
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i], prev = r.g.position.clone();
    r.life -= dt;
    r.g.position.addScaledVector(r.v, dt);
    r.g.lookAt(r.g.position.clone().sub(r.v));
    r.fl.scale.setScalar(rand(.3, .55)); r.fl.material.rotation = Math.random() * 6;
    r.puffT -= dt;
    if (r.puffT <= 0) { r.puffT = .025; puff(r.g.position.clone().addScaledVector(r.v, -.012), rand(.2, .35), rand(.7, 1.2), new V3(rand(-.3, .3), rand(.2, .6), rand(-.3, .3)), .45); }
    if (hitDirty) rebuildHitList();
    const seg = r.g.position.clone().sub(prev), L = seg.length();
    ray.set(prev, seg.normalize()); ray.far = L + .3;
    const h = ray.intersectObjects(hitList, false)[0];
    if (h || r.life <= 0 || r.g.position.y < 0) {
      const p = h ? h.point : r.g.position.clone(); p.y = Math.max(p.y, .05);
      const n = h && h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new V3(0, 1, 0);
      if (h && h.object.userData.enemy) n.copy(seg).negate();
      scene.remove(r.g); rockets.splice(i, 1);
      explode(p, n, WID('bazuca').dmg);
    }
  }
}
function explode(p, n, dmg) {
  const R = 7;
  const dP = p.distanceTo(new V3(P.pos.x, P.pos.y + 1, P.pos.z));
  const near = clamp(1 - dP / 40, 0, 1);
  SFX.boom(.5 + near * .6); onomato('KABOOM!', true);
  shake = Math.max(shake, .2 + near * .5); flashFxT = Math.max(flashFxT, .2 + near * .6); fovKick = Math.max(fovKick, near * 8);
  for (const e of enemies.slice()) {
    const c = e.g.position.clone(); c.y = 1.1 * e.T.scale;
    const d = c.distanceTo(p);
    if (d < R + .4 * e.T.scale) {
      const k = 1 - Math.min(1, d / R) * .7;
      const dir = c.clone().sub(p).setY(0); if (dir.lengthSq() < 1e-4) dir.set(rand(-1, 1), 0, rand(-1, 1)); dir.normalize();
      hurtEnemy(e, dmg * k, c, dir, false, 'BAZUCA');
      if (!e.dead) e.vel.addScaledVector(dir, 10 * k);
    }
  }
  if (dP < R) {
    const k = 1 - dP / R, kb = new V3(P.pos.x, P.pos.y + 1, P.pos.z).sub(p).normalize();
    P.vel.x += kb.x * 16 * k; P.vel.z += kb.z * 16 * k; P.vy += Math.max(0, kb.y) * 10 * k + 9 * k; P.onGround = false;
    damagePlayer(Math.round(4 + 12 * k), nomeJogador(), 'BAZUCA');
  }
  damageEnv(p, R, dmg);
  // marca de queimado + bolas de fogo desenhadas + fumaça + anéis
  surfaceSplat(p.clone().addScaledVector(n, .5), n.clone().negate(), 2, INK_DOTS[Math.floor(Math.random() * 3)], rand(3.5, 4.5));
  for (let i = 0; i < 4; i++) floorSplat(p.x + rand(-3, 3), p.y + 1, p.z + rand(-3, 3), rand(.6, 1.4));
  for (let i = 0; i < 7; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false }));
    const off = new V3(rand(-1, 1), rand(0, 1.2), rand(-1, 1)).multiplyScalar(1.4);
    sp.position.copy(p).add(off); sp.material.rotation = Math.random() * 6; scene.add(sp);
    const s0 = rand(1.5, 3.2), delay = i * .03;
    fx.push({ o: sp, life: .55 + delay, max: .55 + delay, upd: (f, k) => { const t = 1 - k; f.o.scale.setScalar(s0 * Math.min(1, t * 4 + .2) * (1 + t)); f.o.material.opacity = k < .5 ? k * 2 : 1; f.o.position.y += .02; } });
  }
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * 6.283, v = new V3(Math.cos(a) * rand(2, 6), rand(1, 4), Math.sin(a) * rand(2, 6));
    puff(p.clone().add(new V3(rand(-1, 1), rand(0, 1.5), rand(-1, 1))), rand(.8, 1.6), rand(1.2, 2.2), v, .55);
  }
  for (const [col, sp, life] of [[RED, 9, .45], [ORANGE, 6, .6], [INK, 4, .8]]) {
    const pts = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.283, r = 1 + Math.sin(i * 2.3) * .08; pts.push(new V3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col, transparent: true }));
    l.position.copy(p).setY(p.y + .1); scene.add(l);
    fx.push({ o: l, life, max: life, upd: (f, k) => { f.o.scale.setScalar(.5 + (1 - k) * sp); f.o.material.opacity = k; } });
  }
  burst(p.clone().addScaledVector(n, .3), 24, 9);
  impactFx(p, n, 'sniper');
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  glow.rotation.x = -Math.PI / 2; glow.position.set(p.x, groundAt(p.x, p.z, p.y + .5, .1) + .03, p.z); scene.add(glow);
  fx.push({ o: glow, life: .7, max: .7, upd: (f, k) => { f.o.scale.setScalar(10 + (1 - k) * 4); f.o.material.opacity = k; } });
}
const boomBox = document.createElement('div'); boomBox.id = 'booms'; document.getElementById('hud').appendChild(boomBox);
function onomato(txt, big) {
  const d = document.createElement('div'); d.className = 'boom' + (big ? ' big' : ''); d.textContent = txt;
  d.style.left = rand(57, 66) + '%'; d.style.top = rand(54, 66) + '%'; d.style.setProperty('--r', rand(-16, 6).toFixed(1) + 'deg');
  boomBox.appendChild(d); setTimeout(() => d.remove(), 750);
}
const lightPool = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
lightPool.rotation.x = -Math.PI / 2; scene.add(lightPool);

// gancho (estilo equipamento de manobra)
const G = { on: false, hit: false, a: new V3(), shoot: 0, dist: 0, missT: 0 };
const rope = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: INK }));
rope.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(72), 3));
rope.frustumCulled = false; rope.visible = false; scene.add(rope);
const rope2 = new THREE.Line(rope.geometry, new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: .6 }));
rope2.frustumCulled = false; rope2.position.y = .03; rope.add(rope2); rope2.position.set(0, .03, 0);
const hookM = (() => {
  const g = new THREE.ConeGeometry(.12, .4, 5); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x3a3f5a })); m.add(ink(g, INK, .01)); m.visible = false; scene.add(m); return m;
})();
function startGrapple() {
  camera.updateMatrixWorld(); camera.getWorldDirection(_f);
  ray.set(camera.position, _f); ray.far = 140;
  const h = ray.intersectObjects(GRAPPLE_LIST, false)[0];
  if (!h) { SFX.miss(); G.on = false; G.missT = .3; G.a.copy(camera.position).addScaledVector(_f, 30); return; }
  G.on = true; G.hit = false; G.a.copy(h.point); G.dist = h.distance; G.shoot = 0; SFX.hook();
  if (P.onGround) { P.vy = Math.max(P.vy, 4.5); P.onGround = false; }
}
function endGrapple() { if (G.on && G.hit) SFX.gas(); G.on = false; G.hit = false; }
let gasT = 0;
function updateGrapple(dt) {
  if (G.on) {
    G.shoot = Math.min(1, G.shoot + dt * 260 / Math.max(8, G.dist));
    if (G.shoot >= 1 && !G.hit) { G.hit = true; SFX.hookHit(); shake = Math.max(shake, .08); }
    if (G.hit) {
      const to = new V3(G.a.x - P.pos.x, G.a.y - (P.pos.y + 1.2), G.a.z - P.pos.z), d = to.length(); to.normalize();
      const pull = 32 + (keys.Space ? 30 : 0);
      P.vel.x += to.x * pull * dt; P.vel.z += to.z * pull * dt; P.vy += to.y * pull * dt + 10 * dt;
      const spd = Math.hypot(P.vel.x, P.vy, P.vel.z), mx = keys.Space ? 44 : 36;
      if (spd > mx) { const k = mx / spd; P.vel.x *= k; P.vy *= k; P.vel.z *= k; }
      P.onGround = false;
      gasT -= dt;
      if (gasT <= 0) { gasT = keys.Space ? .08 : .22; SFX.gas(); puff(new V3(P.pos.x, P.pos.y + .5, P.pos.z), .5, .7, new V3(-P.vel.x * .1, .3, -P.vel.z * .1), .35); }
      if (d < 2.4) { G.on = false; G.hit = false; P.vy = Math.max(P.vy, 5); }
    }
  } else if (G.missT > 0) G.missT -= dt;
}
function updateRope() {
  const show = G.on || G.missT > 0;
  rope.visible = hookM.visible = show;
  if (!show) return;
  const hand = camera.localToWorld(new V3(-.28, -.32, -.45));
  const k = G.on ? G.shoot : 1 - Math.abs(1 - 2 * (1 - G.missT / .3));
  const end = hand.clone().lerp(G.a, k);
  const a = rope.geometry.attributes.position.array, n = 24, t0 = performance.now() / 1000;
  _r.setFromMatrixColumn(camera.matrixWorld, 0);
  const amp = G.hit ? .03 : .45 * (1 - k) + .08;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), p = hand.clone().lerp(end, t);
    p.addScaledVector(_r, Math.sin(t * Math.PI) * amp * Math.sin(t * 18 + t0 * 40));
    if (!G.hit) p.y -= Math.sin(t * Math.PI) * k * (1 - k) * 1.2;
    a[i * 3] = p.x; a[i * 3 + 1] = p.y; a[i * 3 + 2] = p.z;
  }
  rope.geometry.attributes.position.needsUpdate = true;
  hookM.position.copy(end); hookM.lookAt(hand);
}

// ---------- estado ----------
const P = { pos: new V3(0, 0, 4), vel: new V3(), vy: 0, onGround: true, hp: 100, armor: 0, yaw: 0, pitch: 0 };
let inv = { p: null, s: null, m: null }, money = 800, waveTime = 0, buyOpen = false, noPickT = 0;
let W = [], wi = 0, lastWi = 1, swapT = 0, recoil = 0, flashT = 0, swingT = -1, zoomT = 0;
let score = 0, wave = 0, toSpawn = 0, spawnT = 0, inter = 0, kills = 0, shake = 0, vigT = 0;
let state = 'menu', noLock = false, mouseL = false, mouseR = false, swayX = 0, swayY = 0, bobT = 0;
const keys = {};
const enemies = [], dying = [], projs = [], pickups = [];
let hitList = [], hitDirty = true;

const WIDX = id => WEAPONS.findIndex(w => w.id === id);
const owned = i => i !== null && i !== undefined && i >= 0 && (i === inv.p || i === inv.s || i === inv.m);
const slotOf = i => WEAPONS[i].id === 'regua' ? 'm' : WEAPONS[i].id === 'pistola' ? 's' : 'p';
function resetWeapons() {
  W = WEAPONS.map(d => ({ ...d, mag: d.magSize || 0, reserve: d.reserveMax ? Math.floor(d.reserveMax * .5) : 0, timer: 0, reloadT: 0 }));
  inv = { p: null, s: WIDX('pistola'), m: WIDX('regua') };
  wi = inv.s; lastWi = inv.m; swapT = .4;
  WEAPONS.forEach((d, i) => d.model.visible = i === wi);
  buildWList();
}
const cur = () => W[wi];

// ---------- inimigos: bonecos de palito ----------
const TYPES = {
  grunt: { hp: 45, speed: 5, dmg: 10, reach: 1.7, score: 100, scale: 1, cd: 1.0, th: .05, piece: .085 },
  spitter: { hp: 34, speed: 3.4, dmg: 9, reach: 0, score: 150, scale: 1.05, cd: 2.4, th: .045, piece: .085 },
  brute: { hp: 210, speed: 2.7, dmg: 24, reach: 2.3, score: 400, scale: 1.7, cd: 1.5, th: .07, piece: .11 },
};
const SPAWNS = [];
for (const t of [-50, -30, -10, 10, 30, 50]) SPAWNS.push([-52, t], [52, t], [t, -52], [t, 52]);
const eyeMat = new THREE.MeshBasicMaterial({ color: RED });
const orangeMat = new THREE.MeshBasicMaterial({ color: ORANGE });
const paperMat = new THREE.MeshBasicMaterial({ color: PAPER, side: THREE.DoubleSide });
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const ballGeo = new THREE.SphereGeometry(1, 8, 6);
const blobGeo = new THREE.CircleGeometry(.5, 18);
const blobMat = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: .16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const RED_C = new THREE.Color(RED);
function limb(parent, len, th, mat, x, y, z) {
  const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
  const grow = new THREE.Group(); pivot.add(grow);
  const cg = new THREE.CylinderGeometry(th, th * .85, len, 6); cg.translate(0, -len / 2, 0);
  grow.add(new THREE.Mesh(cg, mat));
  const j = new THREE.Mesh(ballGeo, mat); j.scale.setScalar(th * 1.05); grow.add(j);
  const tip = new THREE.Mesh(ballGeo, mat); tip.scale.setScalar(th * .9); tip.position.y = -len; grow.add(tip);
  const end = new THREE.Group(); end.position.y = -len; pivot.add(end);
  grow.userData.len = len; grow.scale.y = .001;
  pivot.userData.grow = grow; pivot.userData.end = end;
  return pivot;
}
const PEN = (() => {
  const g = new THREE.Group();
  const b = new THREE.CylinderGeometry(.07, .07, .9, 6); b.translate(0, .65, 0); worldUV(b, .4);
  const t = new THREE.ConeGeometry(.07, .2, 6); t.rotateX(Math.PI); t.translate(0, .1, 0);
  const cap = new THREE.CylinderGeometry(.078, .078, .22, 6); cap.translate(0, 1.0, 0);
  [[b, MAT.light, INK], [t, MAT.plain, INK], [cap, MAT.dense, RED]].forEach(([geo, m, c]) => { const mesh = new THREE.Mesh(geo, m); mesh.add(ink(geo, c, .01)); g.add(mesh); });
  return g;
})();
function makeEnemy(type, x, z) {
  const T0 = TYPES[type], g = new THREE.Group(), th = T0.th;
  const e = { type, nome: Abates.nomeDeBot(), T: T0, g, hp: T0.hp * (1 + (wave - 1) * .08), vel: new V3(), wind: 0, cd: rand(.6, 1.4), stuck: 0, detour: 0, dDir: 1, walk: rand(0, 6), amp: 0, flash: 0, flinch: 0, slam: 0, drawT: 0, drawIdx: -1, parts: [], strafe: Math.random() < .5 ? -1 : 1, dead: false, power: 5 };
  const mat = new THREE.MeshBasicMaterial({ color: type === 'brute' ? 0x1d2b8f : INK });
  e.mat = mat; e.baseHex = mat.color.getHex(); e.base = mat.color.clone();
  const hipY = .95;
  e.legs = []; e.shins = []; e.arms = []; e.fores = [];
  const body = new THREE.Group(); body.position.y = hipY; g.add(body); e.body = body;
  for (const s of [-1, 1]) {
    const t1 = limb(g, .48, th, mat, s * .07, hipY, 0); e.legs.push(t1);
    e.shins.push(limb(t1.userData.end, .48, th * .9, mat, 0, 0, 0));
  }
  const torso = limb(body, .64, th * 1.15, mat, 0, .64, 0);
  for (const s of [-1, 1]) {
    const ua = limb(body, .37, th * .9, mat, 0, .56, 0); ua.rotation.z = s * .45; e.arms.push(ua);
    const fa = limb(ua.userData.end, .35, th * .85, mat, 0, 0, 0); fa.rotation.x = -.5; e.fores.push(fa);
  }
  const hr = type === 'spitter' ? .32 : type === 'brute' ? .27 : .25;
  const head = new THREE.Group(); head.position.y = .64 + hr + .03; body.add(head); e.head = head;
  const face = new THREE.Group(); head.add(face); e.face = face;
  face.add(new THREE.Mesh(new THREE.CircleGeometry(hr, 24), paperMat));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(hr, th * .85, 6, 28), mat); ring.position.z = .005; face.add(ring);
  const fz = .015;
  if (type === 'spitter') {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(.1, 16), eyeMat); eye.position.set(0, .07, fz); face.add(eye);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(.035, 10), mat); pupil.position.set(0, .07, fz + .004); face.add(pupil);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(.07, .02, 5, 14), orangeMat); mouth.position.set(0, -.15, fz); face.add(mouth);
  } else {
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.CircleGeometry(type === 'brute' ? .06 : .05, 12), eyeMat); eye.position.set(s * .09, .03, fz); face.add(eye);
      const brow = new THREE.Mesh(new THREE.PlaneGeometry(.12, .026), mat); brow.position.set(s * .09, .115, fz); brow.rotation.z = -s * .45; face.add(brow);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(.075, .014, 4, 12, Math.PI), mat); mouth.position.set(0, -.17, fz); face.add(mouth);
    if (type === 'brute') for (const s of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(.06, .24, 5), eyeMat); horn.position.set(s * .2, hr + .07, 0); horn.rotation.z = -s * .5; face.add(horn); }
  }
  face.scale.setScalar(.001);
  if (type === 'brute') {
    const bg = new THREE.SphereGeometry(.26, 10, 8); bg.scale(1, 1.25, .55); worldUV(bg, .5);
    const belly = new THREE.Mesh(bg, MAT.dense); belly.add(ink(bg, INK, .02, 12)); belly.position.y = .33; body.add(belly);
    belly.scale.setScalar(.001); e.belly = belly;
  }
  const hb = (geo, parent, y, isHead) => { const m = new THREE.Mesh(geo, hitMat); m.position.y = y; m.userData.enemy = e; m.userData.head = isHead; parent.add(m); e.parts.push(m); };
  hb(new THREE.BoxGeometry(.46, .72, .34), body, .32, false);
  hb(new THREE.SphereGeometry(hr + .07, 8, 6), head, 0, true);
  hb(new THREE.BoxGeometry(.42, hipY, .32), g, hipY / 2, false);
  const sh = new THREE.Mesh(blobGeo, blobMat); sh.rotation.x = -Math.PI / 2; sh.position.y = .02; g.add(sh);
  e.pieces = [e.legs[0].userData.grow, e.shins[0].userData.grow, e.legs[1].userData.grow, e.shins[1].userData.grow, torso.userData.grow];
  if (e.belly) e.pieces.push(e.belly);
  e.pieces.push(e.arms[0].userData.grow, e.fores[0].userData.grow, e.arms[1].userData.grow, e.fores[1].userData.grow, face);
  e.hr = hr;
  e.pen = PEN.clone(); e.pen.scale.setScalar(T0.scale); scene.add(e.pen);
  g.scale.setScalar(T0.scale); g.position.set(x, 0, z); g.rotation.y = Math.atan2(P.pos.x - x, P.pos.z - z);
  scene.add(g); enemies.push(e); hitDirty = true;
  ringFx(x, z, RED);
  return e;
}
const _tmp = new V3(), _q = new THREE.Quaternion();
// animação de "ser desenhado" pela caneta
function drawEnemy(e, dt) {
  const n = e.pieces.length, P_T = e.T.piece;
  e.drawT += dt;
  const idx = Math.min(n - 1, Math.floor(e.drawT / P_T));
  if (idx !== e.drawIdx) { e.drawIdx = idx; if (Math.hypot(e.g.position.x - P.pos.x, e.g.position.z - P.pos.z) < 45) SFX.draw(); }
  e.g.updateMatrixWorld(true);
  for (let i = 0; i < n; i++) {
    const k = Math.max(.001, clamp((e.drawT - i * P_T) / P_T, 0, 1)), pc = e.pieces[i];
    if (pc.userData.len) pc.scale.y = k; else pc.scale.setScalar(k);
  }
  const pc = e.pieces[idx], k = clamp((e.drawT - idx * P_T) / P_T, 0, 1);
  if (pc.userData.len) _tmp.set(0, -pc.userData.len, 0);
  else if (pc === e.face) { const a = k * 6.283; _tmp.set(Math.cos(a) * e.hr / Math.max(k, .05), Math.sin(a) * e.hr / Math.max(k, .05), .05); }
  else { const a = k * 6.283; _tmp.set(Math.cos(a) * .26 / Math.max(k, .05), Math.sin(a) * .32 / Math.max(k, .05), .15); }
  pc.localToWorld(_tmp);
  if (e.pen) { e.pen.position.copy(_tmp); e.pen.rotation.set(-.35 + Math.sin(e.drawT * 40) * .08, e.g.rotation.y, .45); }
  if (e.drawT >= n * P_T) {
    e.drawn = true; for (const p of e.pieces) { if (p.userData.len) p.scale.y = 1; else p.scale.setScalar(1); }
    if (e.pen) { scene.remove(e.pen); e.pen = null; }
  }
}
function lineSegsLocal(pts, color) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(geo, lm(color));
}
function spawnEnemy() {
  let pts = SPAWNS.filter(p => { const d = Math.hypot(p[0] - P.pos.x, p[1] - P.pos.z); return d > 28 && d < 50; });
  if (!pts.length) pts = SPAWNS.filter(p => Math.hypot(p[0] - P.pos.x, p[1] - P.pos.z) > 28);
  const p = pts[Math.floor(Math.random() * pts.length)] || SPAWNS[0];
  let type = 'grunt'; const r = Math.random();
  if (wave >= 3 && r < Math.min(.2, .05 + wave * .02)) type = 'brute';
  else if (wave >= 2 && r < .42) type = 'spitter';
  makeEnemy(type, p[0] + rand(-2, 2), p[1] + rand(-2, 2));
}
function popup(txt, color) {
  const d = document.createElement('div'); d.className = 'pop'; d.textContent = txt;
  d.style.left = rand(-30, 30) + 'px'; d.style.top = '-40px'; if (color) d.style.color = color;
  $('pops').appendChild(d); setTimeout(() => d.remove(), 950);
}
let hitmT = 0;
function hitmark(kill) { const h = $('hitm'); h.className = kill ? 'kill' : ''; h.style.opacity = 1; hitmT = kill ? .25 : .12; }
function hurtEnemy(e, dmg, point, dir, head, arma) {
  if (e.dead) return;
  if (arma) e.por = arma; // a arma do último acerto: é ela que aparece no feed de abates
  e.hp -= dmg; e.flash = .1; e.flinch = .14;
  e.power = Math.min(24, 4 + dmg * .1);
  e.vel.addScaledVector(new V3(dir.x, 0, dir.z).normalize(), Math.min(7, dmg * .05) / e.T.scale);
  burst(point, Math.min(18, 5 + dmg / 8), 4);
  surfaceSplat(point, dir, 5, RED_SPLATS[Math.floor(Math.random() * 6)], rand(.6, 1.4) * Math.min(1.6, .6 + dmg / 60));
  const fp = point.clone().addScaledVector(dir, rand(.3, 1.8));
  floorSplat(fp.x, point.y, fp.z, rand(.5, 1.1));
  if (head) SFX.head(); else SFX.hit();
  if (e.hp <= 0) killEnemy(e, head, dir); else hitmark(false);
}
// morte: o boneco se desmonta em palitos que voam e são apagados
function shatter(e, dir, power) {
  e.g.updateMatrixWorld(true);
  for (const p of e.pieces) {
    if (!p.parent) continue;
    if (p.userData.len) p.scale.y = Math.max(p.scale.y, .05);
    scene.attach(p);
    const v = new V3(dir.x, 0, dir.z).normalize().multiplyScalar(power * rand(.4, 1)).add(new V3(rand(-2.5, 2.5), rand(3, 7) + power * .15, rand(-2.5, 2.5)));
    dying.push({ o: p, v, av: new V3(rand(-12, 12), rand(-12, 12), rand(-12, 12)), t: rand(0, .2), s: p.scale.clone() });
  }
  scene.remove(e.g);
  if (e.pen) { scene.remove(e.pen); e.pen = null; }
}
function killEnemy(e, head, dir) {
  e.dead = true; kills++;
  const pts = e.T.score + (head ? 50 : 0); score += pts;
  const cash = (e.type === 'brute' ? 900 : e.type === 'spitter' ? 350 : 300) + (head ? 100 : 0); money = Math.min(16000, money + cash);
  setTimeout(() => popup('+$' + cash, '#2e9a4a'), 120);
  popup((head ? 'na cabeça! ' : 'apagado! ') + '+' + pts);
  if (state === 'play') Abates.mostra($('abates'), nomeJogador(), e.por, e.nome, head, true); // bala que chega depois da sua morte não conta
  hitmark(true); SFX.kill();
  const p = e.g.position;
  floorSplat(p.x, 1, p.z, 2.2 * e.T.scale + rand(0, .8));
  for (let i = 0; i < 3; i++) floorSplat(p.x + rand(-1.5, 1.5) + dir.x * 1.5, 1, p.z + rand(-1.5, 1.5) + dir.z * 1.5, rand(.4, 1));
  burst(p.clone().setY(1.4 * e.T.scale), 28, 6);
  const ix = enemies.indexOf(e); if (ix >= 0) enemies.splice(ix, 1); hitDirty = true;
  shatter(e, dir, e.power);
  const r = Math.random();
  if (r < .14) spawnPickup('hp', p.x, p.z); else if (r < .3) spawnPickup('ammo', p.x, p.z);
}
function updateDebris(dt) {
  for (let i = dying.length - 1; i >= 0; i--) {
    const d = dying[i]; d.t += dt; d.v.y -= 20 * dt;
    d.o.position.addScaledVector(d.v, dt);
    d.o.rotation.x += d.av.x * dt; d.o.rotation.y += d.av.y * dt; d.o.rotation.z += d.av.z * dt;
    if (d.o.position.y < .08) { d.o.position.y = .08; d.v.y *= -.35; d.v.x *= .6; d.v.z *= .6; d.av.multiplyScalar(.6); }
    if (d.t > 1.3) {
      const k = 1 - (d.t - 1.3) / .45;
      if (k <= 0) { scene.remove(d.o); dying.splice(i, 1); }
      else d.o.scale.set(d.s.x * k, d.s.y * k, d.s.z * k);
    }
  }
}
function los(from, to) {
  const d = to.clone().sub(from), L = d.length(); d.normalize();
  ray.set(from, d); ray.far = L;
  return ray.intersectObjects(worldMeshes, false).length === 0;
}
const spitGeo = new THREE.IcosahedronGeometry(.2, 1);
const spitMat = new THREE.MeshBasicMaterial({ color: RED });
function spit(e) {
  const s = e.T.scale, from = e.g.position.clone(); from.y = (.95 + .64 + e.hr) * s;
  const fwd = new V3(Math.sin(e.g.rotation.y), 0, Math.cos(e.g.rotation.y));
  from.addScaledVector(fwd, .45);
  const target = P.pos.clone(); target.y += 1.2;
  target.addScaledVector(P.vel, from.distanceTo(target) / 16 * .6);
  const v = target.sub(from).normalize().multiplyScalar(16);
  const m = new THREE.Mesh(spitGeo, spitMat); m.position.copy(from); m.add(ink(spitGeo, INK, .02, 30)); scene.add(m);
  projs.push({ m, v, life: 4, de: e.nome }); SFX.spit();
}
// quem e arma são de quem bateu: aparecem no feed se este for o golpe final
function damagePlayer(d, quem, arma) {
  if (state !== 'play') return;
  if (P.armor > 0) { const ab = Math.min(P.armor, d * .5); P.armor -= ab; d -= ab; }
  P.hp -= d; vigT = 1; shake = .25; SFX.hurt();
  if (P.hp <= 0) { P.hp = 0; Abates.mostra($('abates'), quem || 'CIDADE', arma || 'CENÁRIO', nomeJogador(), false, false); gameOver(); }
}
const nomeJogador = () => $('nome').value.trim() || 'você';

// pickups
function spawnPickup(kind, x, z) {
  const g = new THREE.Group();
  if (kind === 'hp') {
    const bg = B(.55, .55, .55); worldUV(bg, .5);
    const m = new THREE.Mesh(bg, MAT.plain); m.add(ink(bg, GREEN, .01)); g.add(m);
    const cm = new THREE.MeshBasicMaterial({ color: GREEN });
    g.add(new THREE.Mesh(B(.58, .14, .4), cm)); g.add(new THREE.Mesh(B(.58, .4, .14), cm));
    const c2 = new THREE.Mesh(B(.4, .14, .58), cm), c3 = new THREE.Mesh(B(.14, .4, .58), cm); g.add(c2, c3);
  } else {
    const bg = B(.6, .4, .4); worldUV(bg, .5);
    const m = new THREE.Mesh(bg, MAT.light); m.add(ink(bg, ORANGE, .01)); g.add(m);
    for (const x0 of [-.15, 0, .15]) { const sg = C(.04, .12, 6); sg.rotateX(-Math.PI / 2); const s = new THREE.Mesh(sg, MAT.plain); s.position.set(x0, .26, 0); s.add(ink(sg, ORANGE, .005)); g.add(s); }
  }
  const gy = groundAt(x, z, 50, .1);
  g.position.set(x, gy + .5, z); scene.add(g);
  pickups.push({ g, kind, t: Math.random() * 6, gy });
}

// ---------- tiro ----------
const _f = new V3(), _r = new V3(), _u = new V3();
function rebuildHitList() {
  hitList = worldMeshes.slice();
  for (const e of enemies) for (const p of e.parts) hitList.push(p);
  hitDirty = false;
}
function vmMuzzleWorld(w) {
  hold.updateMatrixWorld(true);
  const p = w.model.localToWorld(w.muzzle.clone());
  p.project(vmCam);
  const q = new V3(p.x, p.y, .5).unproject(camera);
  return camera.position.clone().add(q.sub(camera.position).normalize().multiplyScalar(1.1));
}
function fire() {
  const w = cur(); w.timer = w.rate;
  if (w.melee) {
    swingT = 0; SFX.regua();
    camera.getWorldDirection(_f); _f.y = 0; _f.normalize();
    const speed = Math.hypot(P.vel.x, P.vy, P.vel.z), bonus = 1 + speed / 14, range = w.range + speed * .06;
    let hit = false;
    for (const e of enemies.slice()) {
      const ex = e.g.position.x, ez = e.g.position.z, dx = ex - P.pos.x, dz = ez - P.pos.z, d = Math.hypot(dx, dz);
      const dy = (P.pos.y + 1.2) - 1.3 * e.T.scale;
      if (d < range + .4 * e.T.scale && Math.abs(dy) < 2.6 && (dx * _f.x + dz * _f.z) / (d || 1) > .4) {
        hurtEnemy(e, w.dmg * bonus, new V3(ex, clamp(P.pos.y + 1.2, .5, 1.7 * e.T.scale), ez), _f.clone(), false, w.name); hit = true;
      }
    }
    if (hit) { shake = .12; if (speed > 12) popup('CORTE AÉREO!', '#2a3fb0'); }
    return;
  }
  if (w.mag <= 0) { SFX.click(); reload(); return; }
  w.mag--; recoil = 1; flashT = .06; flash.material.rotation = Math.random() * 6; vmSmoke(w, w.auto ? (Math.random() < .35 ? 1 : 0) : 3); SFX[w.id](); muzzleLightT = .09; curFl = w.fl;
  w.actDone = false; w.actSnd = false;
  if (!w.action) ejectCasing(w);
  const kick = w.kick * (adsT > .5 ? .55 : 1) * (zoomT > .5 ? .6 : 1);
  P.pitch += kick * rand(.6, 1.1); P.yaw += rand(-1, 1) * kick * .3;
  if (w.boom) onomato(w.boom, w.id === 'sniper');
  if (w.id === 'pistola') { shake = Math.max(shake, .08); fovKick = 2; }
  if (w.rocket) { shake = .3; fovKick = 5; flashFxT = .3; }
  if (w.id === 'sniper') { shake = .45; fovKick = 9; flashFxT = .55; }
  else if (w.id === 'escopeta') { shake = .22; fovKick = 4; flashFxT = .25; }
  else shake = Math.max(shake, .035);
  if (hitDirty) rebuildHitList();
  camera.updateMatrixWorld();
  camera.getWorldDirection(_f);
  _r.setFromMatrixColumn(camera.matrixWorld, 0); _u.setFromMatrixColumn(camera.matrixWorld, 1);
  const moving = Math.hypot(P.vel.x, P.vel.z) > 1.5;
  let spread = w.spread * (moving ? 1.7 : 1) * (P.onGround ? 1 : 2) * (1 - .75 * adsT);
  if (w.zoom) spread = zoomT > .85 ? .0004 : .035;
  const muzzle = zoomT > .5 ? camera.position.clone().addScaledVector(_u, -.25).addScaledVector(_f, .6) : vmMuzzleWorld(w);
  if (w.rocket) { smokePuffs(muzzle.clone().addScaledVector(_f, 1.2), 5, _f); for (let i = 0; i < 6; i++) puff(camera.position.clone().addScaledVector(_f, -1).add(new V3(rand(-.6, .6), rand(-.3, .3), rand(-.6, .6))), rand(.4, .8), rand(.6, 1), _f.clone().multiplyScalar(-rand(2, 4)), .4); { if (hitDirty) rebuildHitList(); ray.set(camera.position, _f); ray.far = 300; const ah = ray.intersectObjects(hitList, false)[0]; const aimP = ah ? ah.point : camera.position.clone().addScaledVector(_f, 150); spawnRocket(muzzle, aimP.sub(muzzle).normalize()); } return; }
  if (!w.auto || Math.random() < .25) smokePuffs(muzzle.clone().addScaledVector(_f, 1.2), w.id === 'sniper' ? 6 : w.id === 'escopeta' ? 3 : 1, _f);
  for (let i = 0; i < w.pellets; i++) {
    const d = _f.clone().addScaledVector(_r, gauss() * spread).addScaledVector(_u, gauss() * spread).normalize();
    ray.set(camera.position, d); ray.far = 300;
    const hits = ray.intersectObjects(hitList, false);
    let end = camera.position.clone().addScaledVector(d, 150), wallHit = null;
    const victims = [];
    for (const h of hits) {
      const e = h.object.userData.enemy;
      if (e) { if (e.dead || victims.some(v => v.e === e)) continue; victims.push({ e, h }); if (!w.pierce) { end = h.point; break; } }
      else { end = h.point; wallHit = h; break; }
    }
    spawnBullet(w.bullet, muzzle, end, () => {
      for (const { e, h } of victims) {
        let dmg = w.dmg * (h.object.userData.head ? 2 : 1);
        if (w.pellets > 1) dmg *= Math.max(.3, 1 - Math.max(0, h.distance - 7) / 20);
        hurtEnemy(e, dmg, h.point, d, h.object.userData.head, w.name);
      }
      if (wallHit && wallHit.face) {
        const nn = wallHit.face.normal.clone().transformDirection(wallHit.object.matrixWorld);
        addDecal(wallHit.point, nn, INK_DOTS[Math.floor(Math.random() * 3)], rand(.14, .26) * (w.zoom ? 2.2 : 1));
        impactFx(wallHit.point, nn, w.bullet);
      }
    });
    if (w.id === 'sniper') sniperTrail(muzzle, end);
  }
}
function reload() {
  const w = cur();
  if (w.melee || w.reloadT > 0 || w.mag >= w.magSize || w.reserve <= 0) return;
  w.reloadT = w.reload; SFX.reload();
}
function switchTo(i, force) {
  if (!owned(i) || (i === wi && !force)) return;
  cur().reloadT = 0; cur().rFlags = {}; lastWi = wi; wi = i; swapT = .35; swingT = -1; adsT = 0;
  WEAPONS.forEach((d, k) => d.model.visible = k === wi);
  updateWList();
}

// ---------- loja (estilo CS) e armas no chão ----------
const SHOP = [
  { id: 'uzi', price: 1200 }, { id: 'escopeta', price: 1800 }, { id: 'ak', price: 2700 }, { id: 'sniper', price: 4750 }, { id: 'bazuca', price: 5000 },
  { kind: 'ammo', name: 'MUNIÇÃO', price: 300, desc: 'enche a reserva das suas armas' },
  { kind: 'hp', name: 'KIT DE VIDA', price: 400, desc: '+50 de vida' },
  { kind: 'armor', name: 'COLETE', price: 650, desc: 'segura metade do dano' },
  { id: 'pistola', price: 500 },
];
const canBuy = () => state === 'play' && (inter > 0 || wave === 0 || waveTime < 20);
function openBuy() { buyOpen = true; $('buy').classList.remove('hidden'); refreshBuy(); SFX.click(); }
function closeBuy() { buyOpen = false; const b = $('buy'); if (b) b.classList.add('hidden'); }
function refreshBuy() {
  $('buyMoney').textContent = '$ ' + money;
  $('buyList').innerHTML = SHOP.map((it, n) => {
    const w = it.id ? WEAPONS[WIDX(it.id)] : null, name = w ? w.name : it.name, desc = w ? w.desc : it.desc;
    const have = w && owned(WIDX(it.id));
    return `<div class="bi${money < it.price ? ' no' : ''}${have ? ' have' : ''}"><span class="k">${n + 1}</span><b>${name}</b><em>$${it.price}</em><small>${have ? 'você já tem · compra = munição cheia' : desc}</small></div>`;
  }).join('');
}
function buy(n) {
  const it = SHOP[n - 1]; if (!it) return;
  if (money < it.price) { SFX.click(); popup('sem dinheiro!', '#d42a3a'); return; }
  if (it.kind === 'hp' && P.hp >= 100) { popup('vida cheia', '#2e9a4a'); return; }
  money -= it.price; SFX.pickup();
  if (it.id) giveWeapon(WIDX(it.id));
  else if (it.kind === 'ammo') { for (const sl of ['p', 's']) if (inv[sl] !== null) W[inv[sl]].reserve = W[inv[sl]].reserveMax; popup('+munição', '#e08a1e'); }
  else if (it.kind === 'hp') { P.hp = Math.min(100, P.hp + 50); popup('+50 HP', '#2e9a4a'); }
  else if (it.kind === 'armor') { P.armor = 100; popup('+colete', '#2a3fb0'); }
  refreshBuy();
}
function giveWeapon(i, state0) {
  const sl = slotOf(i);
  if (inv[sl] !== null && inv[sl] !== i) dropWeapon(inv[sl], true);
  const w = W[i];
  if (state0) { w.mag = state0.mag; w.reserve = state0.reserve; }
  else { w.mag = w.magSize; w.reserve = Math.max(w.reserve, Math.floor(w.reserveMax * .6)); }
  w.reloadT = 0; inv[sl] = i;
  buildWList(); switchTo(i, true);
}
const groundGuns = [];
function worldGun(i) {
  NO_ARMS = true; const gun = WEAPONS[i].build(); NO_ARMS = false;
  gun.scale.setScalar(1.9); gun.rotation.z = Math.PI / 2;
  if (gun.userData.warhead) gun.userData.warhead.visible = true;
  const g = new THREE.Group(); g.add(gun);
  const pts = []; for (let k = 0; k <= 32; k++) { const a = k / 32 * 6.283; pts.push(new V3(Math.cos(a) * .9, 0, Math.sin(a) * .9)); }
  const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm(ORANGE, .8)); ring.position.y = -.1; g.add(ring);
  g.userData.ring = ring;
  return g;
}
function dropWeapon(i, thrown) {
  const sl = slotOf(i); if (sl === 'm') return;
  const w = W[i];
  const g = worldGun(i);
  camera.getWorldDirection(_f);
  g.position.copy(camera.position).addScaledVector(_f, .8); g.position.y -= .3; g.rotation.y = Math.random() * 6;
  scene.add(g);
  groundGuns.push({ g, i, mag: w.mag, reserve: w.reserve, v: thrown ? new V3(_f.x * 5, 2.5, _f.z * 5) : new V3(), falling: true, t: Math.random() * 6 });
  inv[sl] = null; noPickT = .9; w.reloadT = 0;
  if (wi === i) { const nx = [inv.p, inv.s, inv.m].find(x => x !== null && x !== i); switchTo(nx, true); }
  buildWList(); SFX.reload();
}
function dropCurrent() { if (cur().melee) return; dropWeapon(wi, true); }
let nearGun = null;
function updateGroundGuns(dt) {
  nearGun = null;
  for (let k = groundGuns.length - 1; k >= 0; k--) {
    const gg = groundGuns[k]; gg.t += dt;
    if (gg.falling) {
      gg.v.y -= 20 * dt; gg.g.position.addScaledVector(gg.v, dt); gg.g.rotation.y += dt * 4;
      const gy = groundAt(gg.g.position.x, gg.g.position.z, gg.g.position.y, .2) + .15;
      if (gg.g.position.y <= gy) { gg.g.position.y = gy; gg.falling = false; gg.gy = gy; }
      continue;
    }
    gg.g.userData.ring.rotation.y += dt;
    gg.g.position.y = gg.gy + Math.sin(gg.t * 2) * .03;
    const d = Math.hypot(gg.g.position.x - P.pos.x, gg.g.position.z - P.pos.z);
    if (d < 1.7 && Math.abs(P.pos.y - gg.gy) < 1.6 && noPickT <= 0) {
      if (inv[slotOf(gg.i)] === null) { takeGround(k); continue; }
      if (!nearGun || d < nearGun.d) nearGun = { k, d };
    }
  }
  const h = $('ghint');
  if (nearGun) { h.textContent = 'F: trocar por ' + W[groundGuns[nearGun.k].i].name; h.style.opacity = 1; } else h.style.opacity = 0;
}
function takeGround(k) {
  const gg = groundGuns[k]; scene.remove(gg.g); groundGuns.splice(k, 1);
  giveWeapon(gg.i, { mag: gg.mag, reserve: gg.reserve }); popup('pegou ' + W[gg.i].name, '#e08a1e'); noPickT = .4;
}
function swapGround() { if (nearGun) takeGround(nearGun.k); }

// ---------- HUD ----------
function buildWList() {
  $('wlist').innerHTML = ['p', 's', 'm'].map((sl, n) => { const i = inv[sl]; return `<div id="wl${sl}"><span><span class="k">${n + 1}</span>${i === null ? '<i>— vazio —</i>' : W[i].name}</span><span class="a" id="wa${sl}"></span></div>`; }).join('');
  updateWList();
}
function updateWList() {
  ['p', 's', 'm'].forEach(sl => { const el = $('wl' + sl); if (el) el.className = inv[sl] === wi ? 'on' : ''; });
  $('wname').textContent = cur().name; $('wdesc').textContent = cur().desc;
  const r = cur().ring, ring = $('ring');
  ring.style.display = r ? 'block' : 'none';
  ring.style.width = ring.style.height = r + 'px'; ring.style.left = ring.style.top = -r / 2 + 'px';
}
let bannerT = 0;
function banner(t, s, dur = 2.6) { $('bT').textContent = t; $('bS').textContent = s || ''; $('banner').style.opacity = 1; bannerT = dur; }
function updateHUD() {
  $('scoreV').textContent = score;
  $('waveV').textContent = 'ONDA ' + Math.max(1, wave);
  const left = enemies.length + toSpawn;
  $('leftV').textContent = left + (left === 1 ? ' inimigo restante' : ' inimigos restantes');
  $('nextV').textContent = inter > 0 ? 'próxima onda em ' + Math.ceil(inter) : '';
  $('hpV').textContent = Math.ceil(P.hp);
  $('hpFill').style.width = Math.max(0, P.hp) + '%';
  $('hpBox').className = P.hp < 30 ? 'low' : '';
  const w = cur();
  if (w.melee) { $('magV').textContent = '∞'; $('resV').textContent = ''; $('relV').textContent = ''; }
  else {
    $('magV').textContent = w.mag; $('resV').textContent = '/' + w.reserve;
    $('relV').textContent = w.reloadT > 0 ? 'recarregando...' : (w.mag === 0 ? (w.reserve ? 'aperte R' : 'sem tinta!') : '');
  }
  ['p', 's', 'm'].forEach(sl => { const el = $('wa' + sl), i = inv[sl]; if (el) el.textContent = i === null ? '' : W[i].melee ? '∞' : W[i].mag + '/' + W[i].reserve; });
  $('moneyV').textContent = '$ ' + money;
  $('armorV').textContent = P.armor > 0 ? 'COLETE ' + Math.ceil(P.armor) : '';
  const cb = canBuy();
  $('buyHint').textContent = cb ? (buyOpen ? '' : 'B comprar' + (inter > 0 ? '' : ' · ' + Math.ceil(20 - waveTime) + 's')) : '';
  if (buyOpen && !cb) closeBuy();
  if (buyOpen) refreshBuy();
}

// ---------- input ----------
addEventListener('keydown', e => {
  if (e.target === $('nome')) return; // digitando o nome: as teclas não são do jogo
  keys[e.code] = true;
  if (state !== 'play') return;
  if (buyOpen) {
    const bm = e.code.match(/^Digit([1-9])$/); if (bm) { buy(+bm[1]); return; }
    if (e.code === 'KeyB') { closeBuy(); return; }
  } else if (e.code === 'KeyB' && canBuy()) { openBuy(); return; }
  if (e.code === 'KeyR') reload();
  const m = e.code.match(/^Digit([1-3])$/); if (m) switchTo(inv[['p', 's', 'm'][+m[1] - 1]]);
  if (e.code === 'KeyQ') switchTo(lastWi);
  if (e.code === 'KeyG') dropCurrent();
  if (e.code === 'KeyF') swapGround();
  if (e.code === 'KeyE' && !e.repeat) startGrapple();
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyE') endGrapple(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseL = mouseR = false; endGrapple(); });
canvas.addEventListener('mousedown', e => {
  if (state !== 'play') return;
  if (!noLock && document.pointerLockElement !== canvas) { lockMouse(); return; }
  if (e.button === 0) mouseL = true; if (e.button === 2) mouseR = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (state !== 'play') return;
  if (!noLock && document.pointerLockElement !== canvas) return;
  const sens = .0022 * (camera.fov / 75);
  const mx = clamp(e.movementX || 0, -200, 200), my = clamp(e.movementY || 0, -200, 200);
  P.yaw -= mx * sens; P.pitch -= my * sens; P.pitch = clamp(P.pitch, -1.5, 1.5);
  swayX = clamp(swayX - mx * .00025, -.04, .04); swayY = clamp(swayY + my * .00025, -.04, .04);
});
addEventListener('wheel', e => {
  if (state !== 'play') return;
  const list = [inv.p, inv.s, inv.m].filter(x => x !== null), k = list.indexOf(wi);
  switchTo(list[(k + (e.deltaY > 0 ? 1 : list.length - 1)) % list.length]);
}, { passive: true });
function lockMouse() {
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => { noLock = true; });
  } catch (err) { noLock = true; }
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && state === 'play' && !noLock) pause();
});
document.addEventListener('pointerlockerror', () => { noLock = true; });

// ---------- placar ----------
// O fetch é o jeito do JavaScript fazer um pedido HTTP sem trocar de página.
// Ele demora (o pedido viaja pela rede), então devolve uma promessa: o await espera a resposta chegar.
const API = '/api/placar';
// O bilhete da partida: o servidor entrega um quando a partida começa, e o placar só aceita
// pontuação que venha com ele. Não é uma senha escrita aqui no jogo: quem assina é o servidor.
let bilhete = null;
async function pegaBilhete() {
  bilhete = null;
  try {
    const resposta = await fetch('/api/partida');
    if (resposta.ok) bilhete = (await resposta.json()).bilhete;
  } catch (erro) { /* sem servidor: a partida não vai pro placar */ }
}

// Desenha a lista no cartão do menu. `minha` é a posição da partida que acabou de ser enviada, se tiver.
function mostraPlacar(melhores, minha) {
  const caixa = $('placar');
  caixa.replaceChildren();
  const titulo = document.createElement('div');
  titulo.className = 't';
  titulo.textContent = melhores.length ? 'OS MELHORES' : 'ninguém no placar ainda';
  caixa.appendChild(titulo);
  const lista = document.createElement('ol');
  melhores.forEach((linha, i) => {
    const li = document.createElement('li');
    if (i + 1 === minha) li.className = 'eu';
    // textContent põe o nome como texto puro. Com innerHTML, um nome como <img onerror=...>
    // viraria código rodando na página de todo mundo que abrisse o placar.
    for (const texto of [i + 1 + '.', linha.nome, linha.pontos + ' pts', 'onda ' + linha.onda]) {
      const span = document.createElement('span');
      span.textContent = texto;
      li.appendChild(span);
    }
    lista.appendChild(li);
  });
  caixa.appendChild(lista);
  if (minha > melhores.length) { // fora dos dez melhores: conta em que lugar a partida ficou
    const fora = document.createElement('div');
    fora.textContent = 'você ficou em ' + minha + 'º';
    caixa.appendChild(fora);
  }
}
// GET: me dá o placar.
async function carregaPlacar() {
  try {
    const resposta = await fetch(API);
    if (!resposta.ok) throw new Error(resposta.status); // 404, 500...
    mostraPlacar(await resposta.json());
  } catch (erro) {
    // Abriu o jogo sem servidor (por exemplo, com dois cliques no index.html): não tem API. O jogo segue sem placar.
    $('placar').textContent = 'placar desligado';
  }
}
// POST: toma, guarda esta pontuação. O corpo do pedido é um JSON, e o cabeçalho avisa o servidor disso.
async function enviaPontuacao() {
  const nome = $('nome').value.trim() || 'anônimo';
  try { localStorage.setItem('rabisco-nome', nome); } catch (erro) { /* navegador com o armazenamento bloqueado */ } // lembra o nome pra próxima visita
  try {
    const resposta = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, pontos: score, onda: wave, bilhete }),
    });
    if (!resposta.ok) throw new Error(resposta.status);
    const dados = await resposta.json();
    mostraPlacar(dados.melhores, dados.posicao);
  } catch (erro) {
    carregaPlacar(); // não deu pra enviar: mostra o placar como estiver
  }
}
try { $('nome').value = localStorage.getItem('rabisco-nome') || ''; } catch (erro) { /* armazenamento bloqueado: começa sem nome */ }
carregaPlacar();

// ---------- telas ----------
const menuBodyStart = $('menuBody').innerHTML;
function showMenu(title, body, btn) {
  $('menu').classList.remove('hidden');
  $('menu').querySelector('h1').innerHTML = title;
  $('menuBody').innerHTML = body; $('play').textContent = btn;
  $('menu').classList.remove('inicio'); // no menu de abertura o placar mostra só os cinco primeiros, pra caber
  $('menu').classList.toggle('semPlacar', state === 'paused'); // na pausa o cartão fica só com as teclas
}
function pause() {
  closeBuy();
  state = 'paused'; mouseL = mouseR = false; endGrapple();
  showMenu('PAUSA<span>.</span>', `<b>onda ${wave}</b> · ${score} pontos · ${kills} rabiscos apagados<br>Respira. A caneta espera.` + menuBodyStart.slice(menuBodyStart.indexOf('<div class="keys">')), 'CONTINUAR');
}
function gameOver() {
  state = 'dead'; mouseL = mouseR = false;
  try { document.exitPointerLock(); } catch (e) { }
  $('vig').style.opacity = .9;
  enviaPontuacao();
  setTimeout(() => showMenu('VOCÊ FOI <span>APAGADO</span>', `Chegou até a <b>onda ${wave}</b> com <b>${score}</b> pontos e <b>${kills}</b> rabiscos apagados.<br>Vira a página e tenta de novo.`, 'DE NOVO'), 700);
}
function clearWorld() {
  for (const e of enemies) { scene.remove(e.g); if (e.pen) scene.remove(e.pen); } enemies.length = 0;
  for (const d of dying) scene.remove(d.o); dying.length = 0;
  for (const e of enemies) if (e.pen) scene.remove(e.pen);
  while (bullets.length) killBullet(0, true);
  for (const r of rockets) scene.remove(r.g); rockets.length = 0;
  for (const c of chunks) scene.remove(c.m); chunks.length = 0;
  for (const c of casings) vmScene.remove(c.m); casings.length = 0;
  for (const q of vmPuffs) vmScene.remove(q.sp); vmPuffs.length = 0;
  G.on = false; G.missT = 0;
  for (const p of projs) scene.remove(p.m); projs.length = 0;
  for (const p of pickups) scene.remove(p.g); pickups.length = 0;
  for (const d of decals) scene.remove(d); decals.length = 0;
  for (const p of parts) scene.remove(p); parts.length = 0;
  for (const f of fx) scene.remove(f.o); fx.length = 0;
  hitDirty = true;
}
function newGame() {
  pegaBilhete();
  Abates.limpa($('abates'));
  clearWorld(); restoreWorld();
  P.pos.set(0, 0, 5); P.vel.set(0, 0, 0); P.vy = 0; G.on = false; G.hit = false; G.missT = 0; P.hp = 100; P.yaw = 0; P.pitch = 0;
  timeTarget = 0; score = 0; wave = 0; toSpawn = 0; inter = 6; kills = 0; money = 800; P.armor = 0; waveTime = 0; closeBuy();
  for (const gg of groundGuns) scene.remove(gg.g); groundGuns.length = 0;
  resetWeapons();
  spawnPickup('hp', 6, -4); spawnPickup('ammo', -5, -3);
  banner('PREPARA A CANETA', 'você tem $800 · aperte B pra comprar', 3);
}
$('play').addEventListener('click', () => {
  initAudio();
  if (state === 'menu' || state === 'dead') newGame();
  state = 'play';
  $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
  $('vig').style.opacity = 0;
  lockMouse();
});

// ---------- update ----------
const FWD = new V3(), RIGHT = new V3();
let hookTilt = 0, adsT = 0, fovKick = 0, flashFxT = 0, muzzleLightT = 0, curFl = .2, hookCheckT = 0;
function update(dt) {
  const w = cur();
  // ondas
  if (inter > 0) {
    inter -= dt;
    if (inter <= 0) {
      wave++; toSpawn = 4 + wave * 3; spawnT = .5; waveTime = 0; timeTarget = timeForWave(wave);
      const tSub = timeTarget >= 1 && timeForWave(wave - 1) < 1 ? 'anoiteceu · a lanterna acende sozinha' : timeTarget === .5 && timeForWave(wave - 1) === 0 ? 'o sol tá se pondo' : timeTarget === .5 ? 'tá amanhecendo' : null;
      banner('ONDA ' + wave, tSub || (wave === 1 ? 'apaga eles antes que te apaguem' : ['eles voltaram com mais tinta', 'cuidado com os cuspidores', 'os grandões chegaram', 'a folha tá ficando cheia'][Math.min(3, wave - 2)]));
      SFX.wave();
      if (wave > 1) { spawnPickup('hp', rand(-8, 8), rand(-8, 8)); spawnPickup('ammo', rand(-8, 8), rand(-8, 8)); }
    }
  } else if (toSpawn > 0) {
    spawnT -= dt;
    if (spawnT <= 0 && enemies.length < 16) { spawnEnemy(); toSpawn--; spawnT = Math.max(.35, 1.3 - wave * .08); }
  } else if (enemies.length === 0 && wave > 0) {
    const bonus = 200 * wave; score += bonus; inter = 9; money = Math.min(16000, money + 1000 + 250 * wave);
    banner('ONDA ' + wave + ' LIMPA', 'respira · +$' + (1000 + 250 * wave) + ' · aperte B pra comprar', 3);
    SFX.pickup();
  }

  waveTime += dt; if (noPickT > 0) noPickT -= dt;
  updateGroundGuns(dt);
  // gancho
  updateGrapple(dt);

  // movimento
  const aiming = zoomT > .5 || adsT > .5;
  const sp = (keys.ShiftLeft || keys.ShiftRight) && !aiming ? 8 : (aiming ? 3.8 : 6);
  FWD.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); RIGHT.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const want = FWD.clone().multiplyScalar(f).addScaledVector(RIGHT, s);
  if (want.lengthSq() > 0) want.normalize().multiplyScalar(sp);
  const hsp = Math.hypot(P.vel.x, P.vel.z);
  if (P.onGround && !G.hit) {
    P.vel.x += (want.x - P.vel.x) * Math.min(1, 14 * dt); P.vel.z += (want.z - P.vel.z) * Math.min(1, 14 * dt);
  } else if (hsp <= sp + .5) {
    const acc = G.hit ? 6 : 3;
    P.vel.x += (want.x - P.vel.x) * Math.min(1, acc * dt); P.vel.z += (want.z - P.vel.z) * Math.min(1, acc * dt);
  } else {
    const ac = G.hit ? 3 : 1.6; P.vel.x += want.x * dt * ac; P.vel.z += want.z * dt * ac;
    const dr = 1 - dt * (G.hit ? .05 : .9); P.vel.x *= dr; P.vel.z *= dr;
  }
  P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
  const bx = P.pos.x, bz = P.pos.z;
  pushOut(P.pos, .4, P.pos.y, 1.75);
  P.pos.x = clamp(P.pos.x, -57.5, 57.5); P.pos.z = clamp(P.pos.z, -57.5, 57.5);
  const pdx = P.pos.x - bx, pdz = P.pos.z - bz, pl = Math.hypot(pdx, pdz);
  if (pl > 1e-6) { const nx = pdx / pl, nz = pdz / pl, vn = P.vel.x * nx + P.vel.z * nz; if (vn < 0) { P.vel.x -= vn * nx; P.vel.z -= vn * nz; } }
  if (keys.Space && P.onGround && !G.on) { P.vy = 7.6; P.onGround = false; }
  const prevY = P.pos.y;
  P.vy -= 22 * dt; P.pos.y += P.vy * dt;
  if (P.vy > 0) for (const b of boxes) {
    if (P.pos.x + .3 > b.minX && P.pos.x - .3 < b.maxX && P.pos.z + .3 > b.minZ && P.pos.z - .3 < b.maxZ && prevY + 1.75 <= b.minY + .01 && P.pos.y + 1.75 > b.minY) { P.pos.y = b.minY - 1.75; P.vy = 0; }
  }
  if (P.pos.y > 90) { P.pos.y = 90; P.vy = Math.min(0, P.vy); }
  const gy = groundAt(P.pos.x, P.pos.z, Math.max(prevY, P.pos.y), .3);
  if (P.pos.y <= gy) {
    if (P.vy < -15) { shake = Math.max(shake, .15); SFX.land(); puff(new V3(P.pos.x, gy + .2, P.pos.z), .8, .6, new V3(0, .2, 0), .4); }
    P.pos.y = gy; P.vy = 0; P.onGround = true;
  } else P.onGround = P.pos.y - gy < .02;

  // armas
  w.timer -= dt;
  if (swapT > 0) swapT -= dt;
  if (w.reloadT > 0) {
    w.reloadT -= dt;
    if (w.reloadT <= 0) { const take = Math.min(w.magSize - w.mag, w.reserve); w.mag += take; w.reserve -= take; w.reloadT = 0; }
  }
  if (mouseL && w.timer <= 0 && w.reloadT <= 0 && swapT <= 0) fire();
  if (w.action && w.timer > 0 && !w.actDone) {
    const k = 1 - w.timer / w.rate;
    if (k > .22 && !w.actSnd) { w.actSnd = true; if (w.action === 'pump') SFX.pump(); }
    if (k > (w.action === 'bolt' ? .4 : .5)) { w.actDone = true; ejectCasing(w); }
  }
  const zoomWant = w.zoom && mouseR && w.reloadT <= 0 && swapT <= 0 ? 1 : 0;
  zoomT += (zoomWant - zoomT) * Math.min(1, dt * 12);
  const adsWant = w.ads && mouseR && w.reloadT <= 0 && swapT <= 0 ? 1 : 0;
  adsT += (adsWant - adsT) * Math.min(1, dt * 14);
  fovKick = Math.max(0, fovKick - dt * 28);
  const spd3 = Math.hypot(P.vel.x, P.vy, P.vel.z);
  camera.fov = 75 - zoomT * 55 - (w.ads ? adsT * (75 - w.ads.fov) : 0) + fovKick + clamp((spd3 - 14) * .4, 0, 10) * (1 - zoomT);
  camera.updateProjectionMatrix();
  $('scope').style.opacity = zoomT > .7 ? 1 : 0;
  $('cross').style.opacity = zoomT > .7 || adsT > .4 ? 0 : 1;
  recoil = Math.max(0, recoil - dt * 7);
  if (flashT > 0) flashT -= dt;
  if (swingT >= 0) { swingT += dt / .32; if (swingT >= 1) swingT = -1; }
  if (flashFxT > 0) { flashFxT = Math.max(0, flashFxT - dt * 3); $('flashFx').style.opacity = flashFxT; }

  // câmera
  if (shake > 0) shake -= dt;
  const sh = shake > 0 ? shake * .25 : 0;
  camera.position.set(P.pos.x + rand(-sh, sh), P.pos.y + 1.65 + rand(-sh, sh), P.pos.z);
  camera.rotation.set(P.pitch, P.yaw, 0);
  camera.updateMatrixWorld();
  updateRope();

  // viewmodel
  const hs = Math.hypot(P.vel.x, P.vel.z);
  if (P.onGround) bobT += hs * dt * 1.6;
  swayX *= Math.pow(.002, dt); swayY *= Math.pow(.002, dt);
  const bob = Math.min(1, hs / 6) * (1 - adsT * .8);
  const rel = w.reloadT > 0 && !RELOADS[w.id] ? Math.sin(Math.PI * (1 - w.reloadT / w.reload)) : 0;
  const sw = swapT > 0 ? swapT / .35 : 0;
  hold.visible = zoomT < .6;
  const hip = new V3(.3 + swayX + Math.sin(bobT) * .014 * bob, -.28 + swayY + Math.abs(Math.cos(bobT)) * .014 * bob - recoil * .025 - rel * .12 - sw * .3, -.6 + recoil * .07);
  if (w.ads && adsT > .001) { const ap = w.ads.pos; hip.lerp(new V3(ap.x + swayX * .2, ap.y + swayY * .2 - recoil * .006 - rel * .12 - sw * .3, ap.z + recoil * .035), adsT); }
  hold.position.copy(hip);
  hookTilt += ((G.on && G.hit ? -.15 : 0) - hookTilt) * Math.min(1, dt * 10);
  hold.rotation.set(recoil * .12 * (1 - adsT * .75) - rel * .5, 0, rel * .4 + hookTilt);
  const md = w.model.userData;
  const [htx, htz, hry, hsx] = animHands(w, dt); hold.rotation.x += htx; hold.rotation.z += htz; hold.position.y += hry; hold.position.x += hsx;
  if (md.slide) md.slide.position.z = -.05 + recoil * .07;
  if (md.warhead) md.warhead.visible = w.mag > 0 && w.reloadT <= 0;
  if (md.bolt || md.pump) {
    let s2 = 0;
    if (w.timer > 0 && w.action) { const k = 1 - w.timer / w.rate; if (k > .2 && k < .8) s2 = Math.sin(Math.PI * (k - .2) / .6); }
    if (md.pump) { md.pump.position.z = -.36 + s2 * .13; hold.rotation.x += s2 * .05; hold.rotation.z -= s2 * .06; }
  }
  if (w.melee && swingT >= 0) {
    const k = Math.sin(Math.PI * swingT);
    hold.rotation.set(-k * .5, k * 1.3, -k * .4);
    hold.position.x -= k * .2;
  }
  flash.visible = flashT > 0 && !w.melee;
  if (flash.visible) {
    hold.updateMatrixWorld(true); flash.position.copy(hold.worldToLocal(w.model.localToWorld(_mz.copy(w.muzzle))));
    const fk = clamp(flashT / .06, 0, 1);
    flash.material.opacity = fk; flash.scale.setScalar((.55 + fk * .6) * w.fl * 1.6 * (1 - adsT * .6));
  }
  updateVmPuffs(dt);
  updateCasings(dt);
  // luz do disparo no chão
  if (muzzleLightT > 0) muzzleLightT -= dt;
  const li = clamp(muzzleLightT / .09, 0, 1);
  lightPool.visible = li > 0 && P.pos.y - groundAt(P.pos.x, P.pos.z, P.pos.y, .1) < 4;
  if (lightPool.visible) {
    lightPool.position.set(P.pos.x + FWD.x * 1.8, groundAt(P.pos.x, P.pos.z, P.pos.y, .1) + .03, P.pos.z + FWD.z * 1.8);
    lightPool.scale.setScalar(2.5 + curFl * 12); lightPool.material.opacity = li * (.5 + curFl);
  }
  // dica do gancho
  hookCheckT -= dt;
  if (hookCheckT <= 0) {
    hookCheckT = .1;
    camera.getWorldDirection(_f); ray.set(camera.position, _f); ray.far = 140;
    $('hook').style.opacity = !G.on && adsT < .4 && zoomT < .4 && ray.intersectObjects(GRAPPLE_LIST, false).length ? 1 : 0;
  }

  // inimigos
  for (const e of enemies.slice()) updateEnemy(e, dt);
  updateDebris(dt);
  updateBullets(dt);
  updateRockets(dt);
  updateFalling(dt);
  // projéteis inimigos
  const eye = P.pos.clone(); eye.y += 1.1;
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i], prev = p.m.position.clone();
    p.v.y -= 3 * dt; p.m.position.addScaledVector(p.v, dt); p.life -= dt; p.m.rotation.x += dt * 5;
    let done = false;
    if (p.m.position.distanceTo(eye) < .75) { damagePlayer(9 + wave * .5, p.de, 'CUSPE'); done = true; }
    else {
      const seg = p.m.position.clone().sub(prev), L = seg.length();
      ray.set(prev, seg.normalize()); ray.far = L;
      const h = ray.intersectObjects(worldMeshes, false)[0];
      if (h && h.face) { _n.copy(h.face.normal).transformDirection(h.object.matrixWorld); addDecal(h.point, _n, RED_SPLATS[Math.floor(Math.random() * 6)], rand(.5, .9)); done = true; }
    }
    if (done || p.life <= 0) { burst(p.m.position, 6, 3); scene.remove(p.m); projs.splice(i, 1); }
  }
  // pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.t += dt;
    p.g.rotation.y += dt * 1.6; p.g.position.y = p.gy + .55 + Math.sin(p.t * 3) * .12;
    const d = Math.hypot(p.g.position.x - P.pos.x, p.g.position.z - P.pos.z);
    if (d < 1.3 && Math.abs(P.pos.y - p.gy) < 1.5) {
      if (p.kind === 'hp') { if (P.hp >= 100) continue; P.hp = Math.min(100, P.hp + 35); popup('+35 HP', '#2e9a4a'); }
      else { W.forEach(x => { if (!x.melee) x.reserve = Math.min(x.reserveMax, x.reserve + x.magSize); }); popup('+tinta', '#e08a1e'); }
      SFX.pickup(); scene.remove(p.g); pickups.splice(i, 1);
    }
  }
  updateParticles(dt);
  if (vigT > 0) { vigT -= dt * 1.6; $('vig').style.opacity = Math.max(0, vigT) * .9; }
  if (P.hp < 30) $('vig').style.opacity = Math.max(+$('vig').style.opacity || 0, .35 + Math.sin(performance.now() / 250) * .1);
  if (hitmT > 0) { hitmT -= dt; if (hitmT <= 0) $('hitm').style.opacity = 0; }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').style.opacity = 0; }
  updateHUD();
}
function updateParticles(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const s = parts[i], v = s.userData.v;
    v.y -= 18 * dt; s.position.addScaledVector(v, dt); s.userData.life -= dt;
    if (s.position.y < .03 || s.userData.life <= 0) {
      if (!s.userData.noSplat && s.position.y < .1 && Math.random() < .25) addDecal(new V3(s.position.x, 0, s.position.z), new V3(0, 1, 0), RED_SPLATS[Math.floor(Math.random() * 6)], rand(.12, .3));
      scene.remove(s); parts.splice(i, 1);
    }
  }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.life -= dt;
    if (f.life <= 0) { scene.remove(f.o); if (f.o.geometry && !f.o.isSprite) f.o.geometry.dispose(); if (f.o.material) f.o.material.dispose(); fx.splice(i, 1); }
    else f.upd(f, f.life / f.max, dt);
  }
}
// navegação pelas ruas (grade de cruzamentos)
const LINES = [-52, -30, -10, 10, 30, 52];
function clear2D(x1, z1, x2, z2, r) {
  const dx = x2 - x1, dz = z2 - z1;
  for (const b of boxes) {
    if (b.minY > 1.8 || b.maxY <= .5) continue;
    let t0 = 0, t1 = 1;
    const ax = [[dx, x1, b.minX - r, b.maxX + r], [dz, z1, b.minZ - r, b.maxZ + r]];
    let hit = true;
    for (const [d, o, mn, mx] of ax) {
      if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) { hit = false; break; } }
      else {
        let ta = (mn - o) / d, tb = (mx - o) / d; if (ta > tb) { const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { hit = false; break; }
      }
    }
    if (hit) return false;
  }
  return true;
}
function nearestNode(x, z) {
  let best = null, bd = 1e9, any = null, ad = 1e9;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    const d = (LINES[i] - x) ** 2 + (LINES[j] - z) ** 2;
    if (d < ad) { ad = d; any = [i, j]; }
    if (d < bd && d < 900 && clear2D(x, z, LINES[i], LINES[j], .35)) { bd = d; best = [i, j]; }
  }
  return best || any;
}
const _prev = new V3(), _sep = new V3();
function updateEnemy(e, dt) {
  const g = e.g, T0 = e.T, sc = T0.scale;
  e.head.getWorldQuaternion(_q); e.face.quaternion.copy(_q.invert().multiply(camera.quaternion));
  if (!e.drawn) { drawEnemy(e, dt); if (e.flash > 0) e.flash -= dt; e.mat.color.copy(e.flash > 0 ? RED_C : e.base); return; }
  const dx = P.pos.x - g.position.x, dz = P.pos.z - g.position.z, dist = Math.hypot(dx, dz) || .001;
  const dirx = dx / dist, dirz = dz / dist;
  const speed = T0.speed * (1 + Math.min(.4, (wave - 1) * .035));
  let wx = 0, wz = 0;
  e.cd -= dt;
  e.navT = (e.navT || 0) - dt;
  if (e.navT <= 0) { e.navT = rand(.2, .35); e.direct = clear2D(g.position.x, g.position.z, P.pos.x, P.pos.z, .42 * sc); if (e.direct) e.node = null; }
  if (!e.direct) {
    if (!e.node) e.node = nearestNode(g.position.x, g.position.z);
    let nx = LINES[e.node[0]], nz = LINES[e.node[1]];
    if (Math.hypot(nx - g.position.x, nz - g.position.z) < 1.4) {
      const pn = nearestNode(P.pos.x, P.pos.z), di = pn[0] - e.node[0], dj = pn[1] - e.node[1];
      if (di || dj) e.node = Math.abs(di) >= Math.abs(dj) ? [e.node[0] + Math.sign(di), e.node[1]] : [e.node[0], e.node[1] + Math.sign(dj)];
      nx = LINES[e.node[0]]; nz = LINES[e.node[1]];
    }
    const gx = nx - g.position.x, gz = nz - g.position.z, gd = Math.hypot(gx, gz);
    if (gd > .6) {
      wx = gx / gd * speed; wz = gz / gd * speed;
      if (e.detour > 0) { e.detour -= dt; wx = -gz / gd * e.dDir * speed; wz = gx / gd * e.dDir * speed; }
    } else { wx = dirx * speed; wz = dirz * speed; }
  } else if (e.type === 'spitter') {
    if (dist > 22) { wx = dirx * speed; wz = dirz * speed; }
    else if (dist < 10) { wx = -dirx * speed * .8; wz = -dirz * speed * .8; }
    else { wx = -dirz * e.strafe * speed * .6; wz = dirx * e.strafe * speed * .6; if (Math.random() < dt * .3) e.strafe *= -1; }
  } else {
    if (dist > T0.reach + .2) { wx = dirx * speed; wz = dirz * speed; }
  }
  if (e.type === 'spitter') {
    if (e.cd <= 0 && dist < 34) {
      e.cd = T0.cd * rand(.8, 1.3);
      const from = g.position.clone(); from.y = (1.6 + e.hr) * sc;
      const to = P.pos.clone(); to.y += 1.3;
      if (los(from, to)) { e.wind = .3; e.spitPending = true; } else e.cd = .5;
    }
  } else if (dist < T0.reach + .5 && e.wind <= 0 && e.cd <= 0 && P.pos.y < 1.2) e.wind = .38;
  if (e.wind > 0) {
    e.wind -= dt;
    if (e.wind <= 0 && e.type === 'spitter') { e.slam = .22; if (e.spitPending) { e.spitPending = false; spit(e); } }
    if (e.wind <= 0 && e.type !== 'spitter') {
      if (dist < T0.reach + .7 && P.pos.y < 1.4) damagePlayer(T0.dmg + wave * .5, e.nome, e.type === 'brute' ? 'PANCADA' : 'SOCO');
      e.cd = T0.cd; e.slam = .22;
    }
  }
  if (e.direct && e.detour > 0) { e.detour -= dt; wx = -dirz * e.dDir * speed; wz = dirx * e.dDir * speed; }
  // separação
  _sep.set(0, 0, 0);
  for (const o of enemies) {
    if (o === e) continue;
    const ox = g.position.x - o.g.position.x, oz = g.position.z - o.g.position.z, od = Math.hypot(ox, oz), min = .5 * (sc + o.T.scale) + .2;
    if (od < min && od > .001) { _sep.x += ox / od * (min - od); _sep.z += oz / od * (min - od); }
  }
  _prev.copy(g.position);
  g.position.x += (wx + e.vel.x) * dt + _sep.x * .5;
  g.position.z += (wz + e.vel.z) * dt + _sep.z * .5;
  e.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
  pushOut(g.position, .42 * sc, -1, 1.8);
  // personagem não entra no jogador
  const pdx = g.position.x - P.pos.x, pdz = g.position.z - P.pos.z, pd = Math.hypot(pdx, pdz), pmin = .42 * sc + .45;
  if (pd < pmin && pd > .001 && P.pos.y < 1.5) { g.position.x = P.pos.x + pdx / pd * pmin; g.position.z = P.pos.z + pdz / pd * pmin; }
  const moved = Math.hypot(g.position.x - _prev.x, g.position.z - _prev.z);
  const wl = Math.hypot(wx, wz);
  if (wl > .5 && moved < wl * dt * .35) { e.stuck += dt; if (e.stuck > .35) { e.detour = rand(.6, 1.5); e.dDir = Math.random() < .5 ? -1 : 1; e.stuck = 0; } }
  else e.stuck = Math.max(0, e.stuck - dt);
  // animação do boneco de palito
  const ty = (e.direct || (!wx && !wz)) ? Math.atan2(dirx, dirz) : Math.atan2(wx, wz);
  let dr = ty - g.rotation.y; while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2;
  g.rotation.y += dr * Math.min(1, dt * 10);
  e.walk += moved * 2.7 / sc;
  e.amp += ((moved / Math.max(dt, 1e-4) > .5 ? 1 : 0) - e.amp) * Math.min(1, dt * 8);
  const a = e.amp, ph = e.walk;
  for (let i = 0; i < 2; i++) {
    const p = ph + i * Math.PI;
    e.legs[i].rotation.x = -Math.sin(p) * .75 * a;
    e.shins[i].rotation.x = (Math.max(0, Math.sin(p + 1.3)) * 1.15 + .06) * a + .04;
  }
  let lean = .2 * a;
  if (e.wind > 0) {
    if (e.type === 'spitter') { lean = -.45; for (let i = 0; i < 2; i++) { e.arms[i].rotation.x = .5; e.fores[i].rotation.x = -1.2; } }
    else { lean = -.18; for (let i = 0; i < 2; i++) { e.arms[i].rotation.x = -2.8; e.fores[i].rotation.x = -.25; } }
  } else if (e.slam > 0) {
    e.slam -= dt; const k = clamp(e.slam / .22, 0, 1);
    lean = .5;
    for (let i = 0; i < 2; i++) { e.arms[i].rotation.x = e.type === 'spitter' ? -.3 : -2.8 * k + .5 * (1 - k); e.fores[i].rotation.x = -.2; }
  } else {
    for (let i = 0; i < 2; i++) { e.arms[i].rotation.x = Math.sin(ph + i * Math.PI) * .85 * a; e.fores[i].rotation.x = -(.45 + .5 * a); }
  }
  if (e.flinch > 0) { e.flinch -= dt; lean -= e.flinch * 4; }
  e.body.rotation.x += (lean - e.body.rotation.x) * Math.min(1, dt * 14);
  e.body.position.y = .95 + Math.abs(Math.sin(ph)) * .05 * a + (a < .3 ? Math.sin(performance.now() / 300 + e.walk) * .012 : 0);
  if (e.flash > 0) e.flash -= dt;
  e.mat.color.copy(e.flash > 0 ? RED_C : inkNow(e.baseHex));
}

// ---------- loop ----------
let last = performance.now(), boilT = 0, boilS = false, menuA = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  boilT += dt;
  if (boilT > .14) { boilT = 0; boilS = !boilS; boilA.forEach(m => m.visible = !boilS); boilB.forEach(m => m.visible = boilS); }
  const tt = now / 1000;
  for (const l of lamps) {
    if (!l.sol.alive) continue;
    let v = 1;
    if (l.flick) { const n = Math.sin(tt * 23 + l.ph) * Math.sin(tt * 7.3 + l.ph * 2); v = n > .55 ? .25 : 1; }
    else v = .9 + Math.sin(tt * 2 + l.ph) * .1;
    l.cone.material.opacity = .13 * v; l.pool.material.opacity = .7 * v; l.halo.material.opacity = v;
  }
  updateTime(dt);
  if (state === 'play') update(dt);
  else if (state === 'menu') {
    menuA += dt * .06;
    camera.position.set(Math.sin(menuA) * 15, 6.5, Math.cos(menuA) * 15);
    camera.lookAt(0, 4, 0); camera.fov = 75; camera.updateProjectionMatrix();
    hold.visible = false;
  } else if (state === 'paused' || state === 'dead') {
    updateParticles(dt); updateDebris(dt);
  }
  renderer.clear();
  renderer.render(scene, camera);
  if (state !== 'menu' && hold.visible) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
}
resetWeapons();
requestAnimationFrame(loop);
})();
