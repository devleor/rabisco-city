// RABISCO CITY, etapa 2: o traço de caneta.
// Nenhuma imagem é carregada: as texturas são desenhadas com código, na hora, num canvas escondido.
(() => {
'use strict';

// As cores: o papel e a tinta. A tinta aparece de três jeitos, porque cada lugar pede um formato.
const PAPER = 0xf3eedf, PAPER_CSS = '#f3eedf', INK = 0x2a3fb0, INK_RGB = '42,63,176';
const RED = 0xd42a3a, GREEN = 0x2e9a4a, ORANGE = 0xe08a1e;

// ---------- renderer ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 500);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
// Deixa a textura nítida mesmo vista de lado, quase deitada. Cada placa de vídeo tem o seu máximo.
const ANISO = renderer.capabilities.getMaxAnisotropy();

// ---------- texturas de hachura ----------
// Hachura é o sombreado de quem desenha à caneta: em vez de pintar de escuro, risca linhas juntinhas.
// Quanto mais linhas, mais escuro parece.

// Cria uma textura a partir de um desenho. `draw` recebe a caneta do canvas (g) e o tamanho (s).
function tex(draw, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = PAPER_CSS;
  g.fillRect(0, 0, size, size);
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; // repete lado a lado, feito azulejo
  t.anisotropy = ANISO;
  return t;
}

// Risca linhas na diagonal, de `step` em `step` pixels. Cada linha sai com uma força um pouco
// diferente (o Math.random), porque mão nenhuma aperta a caneta igual duas vezes.
function diag(g, s, step, alpha, dir = 1, w = 1.3) {
  g.lineWidth = w;
  g.lineCap = 'round';
  for (let i = -s; i <= s; i += step) {
    g.strokeStyle = `rgba(${INK_RGB},${alpha * (0.65 + Math.random() * 0.5)})`;
    g.beginPath();
    if (dir > 0) { g.moveTo(i, 0); g.lineTo(i + s, s); }
    else { g.moveTo(i + s, 0); g.lineTo(i, s); }
    g.stroke();
  }
}

// As texturas do jogo, da mais clara pra mais escura, e uma de tijolo.
const T = {
  // papel quase limpo: só uns pontinhos
  plain: tex((g, s) => {
    g.fillStyle = `rgba(${INK_RGB},.18)`;
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5);
  }),
  light: tex((g, s) => diag(g, s, 16, 0.36)),
  med: tex((g, s) => diag(g, s, 10, 0.45)),
  // hachura cruzada: riscos nos dois sentidos
  dense: tex((g, s) => { diag(g, s, 8, 0.5); diag(g, s, 16, 0.35, -1); }),
  brick: tex((g, s) => {
    diag(g, s, 16, 0.2);
    g.strokeStyle = `rgba(${INK_RGB},.6)`;
    g.lineWidth = 1.4;
    for (let y = 0; y < s; y += 16) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke();
      const off = (y / 16) % 2 ? 16 : 0; // fileira sim, fileira não, o tijolo começa deslocado
      for (let x = off; x < s; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
    }
  }),
};

// O material usa a textura como pele. O polygonOffset empurra a face um fio pra trás,
// pra a linha do contorno, que fica exatamente em cima dela, não ficar piscando.
const mkMat = t => new THREE.MeshBasicMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

// Uma caixa tem seis faces, nesta ordem: direita, esquerda, cima, baixo, frente, trás.
// Um estilo diz qual textura vai em cada uma. Um lado mais riscado que o outro já parece sombra.
const STYLES = {
  hatch: ['dense', 'light', 'plain', 'plain', 'med', 'light'],
  brick: ['brick', 'brick', 'plain', 'plain', 'brick', 'brick'],
  crate: ['med', 'light', 'plain', 'plain', 'light', 'med'],
};

// A "iluminação" é de mentira: as faces viradas pro sol ganham um amarelado, e as de trás um azulado.
// A cor do material multiplica a textura, então o papel dela é que muda de tom.
const FACE_TINT = ['shade', 'lit', 'top', 'none', 'shade', 'lit'];
const TINTS = { shade: 0xdfe3f5, lit: 0xfff0c2, top: 0xfff8e6, none: 0xffffff };
const litCache = {}; // um material pra cada par textura + tom, criado uma vez só
function litMat(k, tint) {
  const key = k + tint;
  if (!litCache[key]) {
    litCache[key] = mkMat(T[k]);
    litCache[key].color.setHex(TINTS[tint]);
  }
  return litCache[key];
}

// Por padrão a textura estica pra caber na face: numa parede comprida os riscos ficariam largos.
// Aqui a posição de cada ponto no mundo vira a coordenada da textura (o UV), e a hachura
// fica do mesmo tamanho em qualquer caixa. `scale` é quantos metros cabem numa repetição.
function worldUV(geo, scale = 4) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    // A normal diz pra que lado a face olha, e daí quais dois eixos sobram pra desenhar nela.
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    let u, v;
    if (nx > 0.5) { u = p.getZ(i); v = p.getY(i); }      // face de lado
    else if (ny > 0.5) { u = p.getX(i); v = p.getZ(i); } // tampa
    else { u = p.getX(i); v = p.getY(i); }               // face da frente
    uv.setXY(i, u / scale, v / scale);
  }
  uv.needsUpdate = true;
}

// ---------- traço de caneta (contorno + rascunho que "ferve") ----------
// Cada forma ganha três contornos: um firme, e dois rascunhos tremidos que se revezam
// algumas vezes por segundo. É isso que faz o desenho parecer vivo, feito à mão.
const lineMats = {};
const boilA = [], boilB = []; // os materiais dos dois rascunhos: o loop liga um e desliga o outro
function lm(color) {
  if (!lineMats[color]) lineMats[color] = new THREE.LineBasicMaterial({ color });
  return lineMats[color];
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
// Uma cópia das linhas, só que malfeita de propósito. Cada linha são 6 números: x, y, z do começo e do fim.
function sketchCopy(src, j) {
  const a = Float32Array.from(src);
  for (let i = 0; i < a.length; i += 6) {
    const dx = a[i + 3] - a[i], dy = a[i + 4] - a[i + 1], dz = a[i + 5] - a[i + 2];
    const L = Math.hypot(dx, dy, dz) || 1;
    // passa um pouco do ponto nas duas pontas, como quem risca rápido
    const o1 = Math.random() * j * 3 / L, o2 = Math.random() * j * 3 / L;
    a[i] -= dx * o1; a[i + 1] -= dy * o1; a[i + 2] -= dz * o1;
    a[i + 3] += dx * o2; a[i + 4] += dy * o2; a[i + 5] += dz * o2;
    // e treme tudo um tiquinho
    for (let k = 0; k < 6; k++) a[i + k] += (Math.random() - 0.5) * j;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  return g;
}
// O contorno completo de uma geometria. `j` é o tamanho do tremor.
function ink(geo, color = INK, j = 0.03) {
  const e = new THREE.EdgesGeometry(geo, 25); // só as quinas de mais de 25 graus viram linha
  const grp = new THREE.Group();
  grp.add(new THREE.LineSegments(e, lm(color)));
  const src = e.attributes.position.array;
  grp.add(new THREE.LineSegments(sketchCopy(src, j), boilMat(color, 0)));
  grp.add(new THREE.LineSegments(sketchCopy(src, j), boilMat(color, 1)));
  return grp;
}

// ---------- mundo ----------
// A peça de montar do jogo inteiro: uma caixa com hachura e contorno.
// x e z dizem onde ela fica no chão, w, d e h são a largura, a profundidade e a altura,
// e y0 é a altura da base (0 = no chão).
function addBox(x, z, w, d, h, style = 'hatch', y0 = 0, color = INK) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, h / 2, 0); // sobe a forma pra a base ficar no zero
  worldUV(geo);
  // Passando uma lista de materiais, cada face da caixa usa o seu.
  const m = new THREE.Mesh(geo, STYLES[style].map((k, i) => litMat(k, FACE_TINT[i])));
  m.position.set(x, y0, z);
  // caixa grande, traço mais solto
  m.add(ink(geo, color, Math.min(0.08, 0.02 + Math.max(w, h, d) * 0.004)));
  scene.add(m);
  return m;
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600),
  new THREE.MeshBasicMaterial({ color: PAPER, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Uma mesinha de amostras: um prédio, um muro de tijolo e caixotes de três cores.
addBox(0, 0, 4, 4, 6, 'hatch');
addBox(5, 1, 5, 0.6, 1.1, 'brick');
addBox(-4, 2, 1.6, 1.6, 1.6, 'crate', 0, GREEN);
addBox(-4, 2, 1.1, 1.1, 1.1, 'crate', 1.6, GREEN); // y0 = 1,6: em cima do outro
addBox(-6, -1, 1.2, 1.2, 1.2, 'crate', 0, ORANGE);
addBox(3, 4, 1.4, 1.4, 1.4, 'crate', 0, RED);

// ---------- loop ----------
let last = performance.now(), boilT = 0, boilS = false, menuA = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;

  // A cada 0,14 s troca o rascunho que aparece. É o desenho "fervendo".
  boilT += dt;
  if (boilT > .14) {
    boilT = 0;
    boilS = !boilS;
    boilA.forEach(m => m.visible = !boilS);
    boilB.forEach(m => m.visible = boilS);
  }

  // A câmera dá a volta devagar, sempre olhando pro meio.
  menuA += dt * .25;
  camera.position.set(Math.sin(menuA) * 12, 5, Math.cos(menuA) * 12);
  camera.lookAt(0, 2, 0);

  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
})();
