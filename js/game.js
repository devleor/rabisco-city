// RABISCO CITY, etapa 6: a arma e o tiro.
// Uma pistola desenhada com caixas na frente da câmera, e um tiro que é um raio:
// uma linha reta, do olho pra frente, até a primeira coisa em que ela bate.
(() => {
'use strict';

const V3 = THREE.Vector3; // um apelido curto: um ponto (ou uma direção) com x, y e z

// As cores: o papel e a tinta. A tinta aparece de três jeitos, porque cada lugar pede um formato.
const PAPER = 0xf3eedf, PAPER_CSS = '#f3eedf', INK = 0x2a3fb0, INK_RGB = '42,63,176';
const RED = 0xd42a3a, GREEN = 0x2e9a4a, ORANGE = 0xe08a1e;

// Dois jeitos de sortear. O Math.random dá um número diferente a cada vez que a página abre.
// O rng parte de uma semente: com a mesma semente, a sequência é sempre a mesma.
// A cidade usa o rng, e por isso é a mesma cidade pra todo mundo. Os detalhes (grama, nuvens) usam o rand.
let seed = 20261113;
const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rand = (a, b) => a + Math.random() * (b - a);
// Prende um número entre um mínimo e um máximo.
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
// Um sorteio que cai mais perto do zero que das pontas (entre -1 e 1). É o espalhamento do tiro.
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const $ = id => document.getElementById(id); // atalho pra pegar um elemento da página

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
// A cada foto o renderer vai pintar duas cenas, uma por cima da outra. Então a limpeza da tela fica por nossa conta.
renderer.autoClear = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
// A neblina: de 32 metros em diante as coisas vão sumindo na cor do papel, e a 130 já não aparecem.
// Dá profundidade, e esconde o fim do mundo.
scene.fog = new THREE.Fog(PAPER, 32, 130);
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 500);
// A ordem dos giros: primeiro pros lados (Y), depois pra cima e pra baixo (X).
// Na ordem padrão, olhar pra cima depois de virar entortaria o horizonte.
camera.rotation.order = 'YXZ';
// A arma mora numa cena só dela, com uma câmera só dela, parada. Ela é pintada por último, por cima do mundo.
// Assim a arma nunca atravessa uma parede quando você encosta nela, e o ângulo de visão dela não muda.
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = vmCam.aspect = w / h;
  camera.updateProjectionMatrix();
  vmCam.updateProjectionMatrix();
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

// Desenha quatro janelas por cima da hachura: o vidro limpo, a moldura, a cruz, o peitoril e um reflexo.
function windows(g, s) {
  for (let ix = 0; ix < 2; ix++) for (let iy = 0; iy < 2; iy++) {
    const x = ix * 128 + 30 + Math.random() * 4, y = iy * 128 + 24 + Math.random() * 4, w = 66, h = 82;
    g.fillStyle = PAPER_CSS; g.fillRect(x, y, w, h);
    g.strokeStyle = `rgba(${INK_RGB},.95)`; g.lineWidth = 3; g.strokeRect(x, y, w, h);
    g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h * 0.45); g.lineTo(x + w, y + h * 0.45); g.stroke();
    g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(x - 6, y + h + 5); g.lineTo(x + w + 6, y + h + 5); g.stroke();
    g.strokeStyle = `rgba(${INK_RGB},.25)`; g.lineWidth = 1;
    for (let k = 6; k < w; k += 9) { g.beginPath(); g.moveTo(x + k, y + 2); g.lineTo(x + k - 5, y + 14); g.stroke(); }
  }
}

// As texturas do jogo, da mais clara pra mais escura, uma de tijolo e três com janelas.
const T = {
  winL: tex((g, s) => { diag(g, s, 16, 0.32); windows(g, s); }),
  winM: tex((g, s) => { diag(g, s, 10, 0.42); windows(g, s); }),
  winD: tex((g, s) => { diag(g, s, 8, 0.48); diag(g, s, 16, 0.3, -1); windows(g, s); }),
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
// Um material simples de cada textura, sem o tom de luz. O lápis gigante da praça usa.
const MAT = {};
for (const k in T) MAT[k] = mkMat(T[k]);

// Uma caixa tem seis faces, nesta ordem: direita, esquerda, cima, baixo, frente, trás.
// Um estilo diz qual textura vai em cada uma. Um lado mais riscado que o outro já parece sombra.
const STYLES = {
  hatch: ['dense', 'light', 'plain', 'plain', 'med', 'light'],
  win: ['winD', 'winL', 'plain', 'plain', 'winM', 'winL'],
  plain: ['light', 'plain', 'plain', 'plain', 'plain', 'plain'],
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
// O material de uma linha. `op` é a opacidade (1 = tinta cheia), e `fog` diz se a neblina apaga ela:
// o que fica no céu, lá longe, desliga a neblina pra continuar aparecendo.
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
// Os colisores do mapa. Cada um guarda só seis números: onde a caixa começa e termina em cada eixo.
// O nome técnico é AABB, uma caixa alinhada com os eixos. É a conta de colisão mais barata que existe.
const boxes = [];
// Os meshes do cenário em que um tiro pode bater. O raio do tiro é testado contra esta lista.
const worldMeshes = [];

// A peça de montar do jogo inteiro: uma caixa com hachura e contorno.
// x e z dizem onde ela fica no chão, w, d e h são a largura, a profundidade e a altura,
// e y0 é a altura da base (0 = no chão). Com `collide` falso ela é só enfeite: dá pra atravessar.
function addBox(x, z, w, d, h, style = 'hatch', y0 = 0, color = INK, collide = true) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, h / 2, 0); // sobe a forma pra a base ficar no zero
  worldUV(geo);
  // Passando uma lista de materiais, cada face da caixa usa o seu.
  const m = new THREE.Mesh(geo, STYLES[style].map((k, i) => litMat(k, FACE_TINT[i])));
  m.position.set(x, y0, z);
  // caixa grande, traço mais solto
  m.add(ink(geo, color, Math.min(0.08, 0.02 + Math.max(w, h, d) * 0.004)));
  scene.add(m);
  worldMeshes.push(m);
  if (collide) boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: y0, maxY: y0 + h });
  return m;
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600),
  new THREE.MeshBasicMaterial({ color: PAPER, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
worldMeshes.push(ground);

// Desenha um monte de linhas soltas de uma vez. `pts` é uma lista corrida de números:
// x, y, z de onde cada linha começa, depois x, y, z de onde ela termina.
function lineSegs(pts, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(g, mat);
  scene.add(l);
  return l;
}

// O mapa é uma grade: a cidade vai de -60 a 60 nos dois eixos, com um quarteirão a cada 20 metros.
// As ruas passam no meio, entre um quarteirão e outro.

// As faixas tracejadas das ruas e uns tufinhos de grama, tudo riscado no chão (y = 0,02: um fio acima dele).
(() => {
  const pts = [];
  for (const s of [-52, -30, -10, 10, 30, 52]) for (let t = -56; t < 56; t += 3.2) {
    const a = t + Math.random() * 0.2, b = t + 1.4 + Math.random() * 0.3;
    pts.push(s, 0.02, a, s + (Math.random() - .5) * .05, 0.02, b); // rua que vai pra frente
    pts.push(a, 0.02, s, b, 0.02, s + (Math.random() - .5) * .05); // rua que cruza
  }
  lineSegs(pts, lm(INK, 0.6));
  const tp = [];
  for (let i = 0; i < 260; i++) {
    const x = rand(-57, 57), z = rand(-57, 57), s = rand(.12, .25);
    // cada tufo é um W: quatro risquinhos
    tp.push(x - s, .02, z, x - s * .4, .02, z - s * 1.4, x - s * .4, .02, z - s * 1.4, x, .02, z,
      x, .02, z, x + s * .4, .02, z - s * 1.6, x + s * .4, .02, z - s * 1.6, x + s, .02, z);
  }
  lineSegs(tp, lm(INK, 0.35));
})();

// Os muros de tijolo que fecham a cidade pelos quatro lados.
addBox(0, -59, 120, 2, 7, 'brick'); addBox(0, 59, 120, 2, 7, 'brick');
addBox(-59, 0, 2, 116, 7, 'brick'); addBox(59, 0, 2, 116, 7, 'brick');

// Um prédio: uma caixa alta, às vezes com um caixote no telhado e um toldo na frente.
function building(x, z, w, d, h) {
  const style = rng() < 0.62 ? 'win' : 'hatch'; // seis em cada dez têm janelas
  addBox(x, z, w, d, h, style);
  if (rng() < 0.5) addBox(x + (rng() - .5) * w * .4, z + (rng() - .5) * d * .4, rand(1.2, 2.5), rand(1.2, 2.5), rand(1, 2.2), 'crate', h);
  if (rng() < 0.4) addBox(x, z + d / 2 + 0.7, w * 0.6, 1.4, 0.15, 'plain', 3.2, INK, false); // o toldo não tem colisor
}
// Um parque: caixotes coloridos espalhados (alguns empilhados) e uma mureta.
function park(bx, bz) {
  for (let i = 0; i < 6; i++) {
    const s = rand(1, 1.8), col = [INK, GREEN, ORANGE][Math.floor(rng() * 3)];
    const x = bx + rand(-5, 5), z = bz + rand(-5, 5);
    addBox(x, z, s, s, s, 'crate', 0, col);
    if (rng() < 0.35) addBox(x, z, s * .7, s * .7, s * .7, 'crate', s, col);
  }
  addBox(bx + rand(-3, 3), bz + rand(-3, 3), 5, 0.6, 1.1, 'brick');
}
// Um andaime: seis postes, três andares de laje, guarda-corpo e uma escada até o primeiro.
function scaffold(bx, bz) {
  const w = 10, d = 8, lh = 3.5; // lh é a altura de cada andar
  for (const px of [-4.85, 0, 4.85]) for (const pz of [-3.85, 3.85]) addBox(bx + px, bz + pz, 0.3, 0.3, lh * 3 + 1.2, 'hatch');
  for (let lv = 1; lv <= 3; lv++) {
    addBox(bx, bz, w, d, 0.3, 'crate', lv * lh);
    // o guarda-corpo é só desenho: o corrimão em volta e as barrinhas de um lado
    const y = lv * lh + 1.2, pts = [];
    const c = [[-5, -4], [5, -4], [5, 4], [-5, 4], [-5, -4]];
    for (let i = 0; i < 4; i++) pts.push(bx + c[i][0], y, bz + c[i][1], bx + c[i + 1][0], y, bz + c[i + 1][1]);
    for (let t = -5; t <= 5; t += 1.25) pts.push(bx + t, y, bz - 4, bx + t, lv * lh + .3, bz - 4);
    lineSegs(pts, lm(INK, 0.8));
  }
  // a escada: sete caixas, cada uma meio metro mais alta que a anterior
  for (let i = 0; i < 7; i++) addBox(bx - 3 + i * 0.8, bz + 5, 0.8, 1.6, (i + 1) * 0.5, 'crate');
}

// Os quarteirões. Alguns são especiais (andaime ou parque); os outros sorteiam um, dois ou três prédios.
seed = 777;
const SPECIAL = { '20,-20': 'scaffold', '-20,20': 'scaffold', '-40,0': 'park', '40,20': 'park', '0,40': 'park', '0,-40': 'park' };
for (const bx of [-40, -20, 0, 20, 40]) for (const bz of [-40, -20, 0, 20, 40]) {
  if (bx === 0 && bz === 0) continue; // o do meio é a praça
  const sp = SPECIAL[bx + ',' + bz];
  if (sp === 'scaffold') { scaffold(bx, bz); continue; }
  if (sp === 'park') { park(bx, bz); continue; }
  const n = 1 + Math.floor(rng() * 3);
  if (n === 1) building(bx, bz, 8 + rng() * 4, 8 + rng() * 4, 6 + rng() * 14);
  else if (n === 2) {
    const d = 8 + rng() * 4;
    building(bx - 3, bz, 5.4, d, 5 + rng() * 15);
    building(bx + 3, bz, 5.4, d - rng() * 3, 5 + rng() * 15);
  } else {
    building(bx, bz - 3.4, 12, 5, 6 + rng() * 12);
    building(bx - 3.2, bz + 3.4, 5.2, 5, 4 + rng() * 10);
    building(bx + 3.2, bz + 3.4, 5.2, 5, 4 + rng() * 14);
  }
}

// A praça central, com um lápis gigante em pé. Nem tudo é caixa: o lápis é feito de cilindros
// de seis lados e cones. A receita é a mesma: geometria, material, contorno.
addBox(0, 0, 2.6, 2.6, 1, 'brick');
(() => {
  const g1 = new THREE.CylinderGeometry(.62, .62, 0.6, 6); g1.translate(0, 1.3, 0); worldUV(g1, 2); // a borracha
  const g2 = new THREE.CylinderGeometry(.6, .6, 4.6, 6); g2.translate(0, 3.9, 0); worldUV(g2, 2);   // o corpo
  const g3 = new THREE.ConeGeometry(.6, 1.4, 6); g3.translate(0, 6.9, 0); worldUV(g3, 2);          // a madeira apontada
  const g4 = new THREE.ConeGeometry(.2, .45, 6); g4.translate(0, 7.43, 0);                          // o grafite
  [[g1, MAT.dense, RED], [g2, MAT.med, INK], [g3, MAT.plain, INK], [g4, MAT.dense, INK]].forEach(([g, m, c]) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.add(ink(g, c, .03));
    scene.add(mesh);
    worldMeshes.push(mesh);
  });
  // O lápis não foi feito com addBox, então o colisor dele é escrito à mão: uma caixa fina e alta.
  boxes.push({ minX: -.6, maxX: .6, minZ: -.6, maxZ: .6, minY: 0, maxY: 8 });
})();
// uns caixotes e muretas em volta da praça
addBox(7, 6, 1.6, 1.6, 1.6, 'crate', 0, GREEN); addBox(7, 6, 1.1, 1.1, 1.1, 'crate', 1.6, GREEN);
addBox(-7, 4, 1.2, 1.2, 1.2, 'crate', 0, ORANGE); addBox(4, -8, 2.4, 1.4, 1.4, 'crate');
addBox(-7, -7, 4, 0.6, 1.1, 'brick'); addBox(9, -3, 0.6, 3.5, 1.1, 'brick');
addBox(-3, 9, 3, 0.6, 1.1, 'brick');

// Os prédios lá de fora do muro, em roda. Ninguém chega lá: são só o horizonte.
seed = 99;
for (let a = 0; a < Math.PI * 2; a += 0.16) {
  const r = 70 + rng() * 17;
  addBox(Math.cos(a) * r, Math.sin(a) * r, 7 + rng() * 8, 7 + rng() * 8, 12 + rng() * 17, rng() < .6 ? 'win' : 'hatch', 0, INK, false);
}
// As nuvens: cada uma são quatro ovais riscadas, viradas pro meio da cidade.
for (let i = 0; i < 9; i++) {
  const a = Math.random() * 6.28, r = rand(90, 180), y = rand(45, 70), cx = Math.cos(a) * r, cz = Math.sin(a) * r;
  for (let k = 0; k < 4; k++) {
    const pts = [], R = rand(4, 8);
    for (let s = 0; s <= 24; s++) { const t = s / 24 * Math.PI * 2; pts.push(new V3(Math.cos(t) * R, Math.sin(t) * R * .55, 0)); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm(INK, .45, false));
    l.position.set(cx + (k - 1.5) * R * 1.1, y + (k % 2) * R * .3, cz);
    l.lookAt(0, y, 0);
    scene.add(l);
  }
}

// ---------- cúpula ----------
// A cidade fica debaixo de uma cúpula de vidro, feita de triângulos. A esfera é enorme (raio 112)
// e o centro dela fica enterrado (y = -26), então só a parte de cima aparece.
const DOME_R = 112, DOME_Y = -26;
(() => {
  // O icosaedro subdividido é uma bola feita só de triângulos quase iguais.
  const ico = new THREE.IcosahedronGeometry(DOME_R, 6);
  const p = ico.attributes.position.array, seen = new Set(), segs = [], panels = [];
  const key = i => Math.round(p[i] * 10) + ',' + Math.round(p[i + 1] * 10) + ',' + Math.round(p[i + 2] * 10);
  for (let t = 0; t < p.length; t += 9) { // 9 números por triângulo: 3 pontos de 3 coordenadas
    const miny = Math.min(p[t + 1], p[t + 4], p[t + 7]);
    if (miny < 8) continue; // os triângulos de baixo ficam de fora
    // Cada lado é dividido por dois triângulos vizinhos. O `seen` evita riscar o mesmo lado duas vezes.
    for (const [a, b] of [[t, t + 3], [t + 3, t + 6], [t + 6, t]]) {
      const ka = key(a), kb = key(b), k = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      if (seen.has(k)) continue;
      seen.add(k);
      segs.push(p[a], p[a + 1] + DOME_Y, p[a + 2], p[b], p[b + 1] + DOME_Y, p[b + 2]);
    }
    // lá no alto, alguns vidros são amarelados
    if (miny > 45 && Math.random() < .16) for (let i = 0; i < 9; i++) panels.push(i % 3 === 1 ? p[t + i] + DOME_Y : p[t + i]);
  }
  lineSegs(segs, lm(INK, .5, false));
  scene.add(new THREE.LineSegments(sketchCopy(segs, .7), lm(INK, .22, false))); // o rascunho por cima
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(panels, 3));
  scene.add(new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0xf6d84a, transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false, fog: false })));
  // As vigas principais: doze arcos que sobem do chão até o topo, cada um com linha dupla.
  const rib = [], e0 = Math.asin(-DOME_Y / DOME_R); // e0 é o ângulo em que a esfera encontra o chão
  for (let k = 0; k < 12; k++) {
    const az = k / 12 * Math.PI * 2;
    for (let i = 0; i < 30; i++) {
      const e1 = e0 + (Math.PI / 2 - e0) * i / 30, e2 = e0 + (Math.PI / 2 - e0) * (i + 1) / 30;
      for (const off of [0, .5]) rib.push(
        Math.cos(e1) * Math.cos(az) * (DOME_R - off), Math.sin(e1) * DOME_R + DOME_Y, Math.cos(e1) * Math.sin(az) * (DOME_R - off),
        Math.cos(e2) * Math.cos(az) * (DOME_R - off), Math.sin(e2) * DOME_R + DOME_Y, Math.cos(e2) * Math.sin(az) * (DOME_R - off));
    }
  }
  lineSegs(rib, lm(INK, .85, false));
})();

// ---------- colisão ----------
// O jogador é um cilindro: um círculo no chão (raio r) com uma altura.

// Um degrau de até 55 cm ele sobe sozinho. Mais alto que isso é parede.
const STEP = 0.55;

// A altura do chão embaixo de um ponto: o topo da caixa mais alta em que ele consegue pisar.
// `feet` é a altura dos pés. Uma caixa cujo topo está acima de feet + STEP não é chão, é parede.
function groundAt(x, z, feet, r) {
  let g = 0;
  for (const b of boxes) {
    if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ && b.maxY <= feet + STEP && b.maxY > g) g = b.maxY;
  }
  return g;
}

// Empurra o jogador pra fora das caixas em que ele entrou. Roda depois de andar.
function pushOut(pos, r, feet, height) {
  for (const b of boxes) {
    // Caixas em que ele pisa, e as que passam por cima da cabeça, não atrapalham.
    if (b.maxY <= feet + STEP || b.minY >= feet + height) continue;
    // O ponto da caixa mais perto do centro do jogador. O clamp "encosta" o ponto na caixa.
    const cx = clamp(pos.x, b.minX, b.maxX), cz = clamp(pos.z, b.minZ, b.maxZ);
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue; // mais longe que o raio: não encostou
    if (d2 > 1e-8) {
      // Encostou: desliza pra fora, na direção que vai da caixa pro jogador, até ficar a um raio dela.
      const d = Math.sqrt(d2);
      pos.x = cx + dx / d * r;
      pos.z = cz + dz / d * r;
    } else {
      // O centro está DENTRO da caixa. Sai pelo lado mais perto.
      const l = pos.x - b.minX, rr = b.maxX - pos.x, n = pos.z - b.minZ, f = b.maxZ - pos.z, m = Math.min(l, rr, n, f);
      if (m === l) pos.x = b.minX - r;
      else if (m === rr) pos.x = b.maxX + r;
      else if (m === n) pos.z = b.minZ - r;
      else pos.z = b.maxZ + r;
    }
  }
}

// ---------- manchas de tinta ----------
// Onde o tiro bate fica um pingo de tinta. É um quadradinho plano com um desenho transparente,
// colado na superfície. O nome disso em jogo é decal.
function splatTex(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color; g.strokeStyle = color;
  // três bolas no meio e uns respingos em volta, alguns ligados ao meio por um risco
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(64 + rand(-14, 14), 64 + rand(-14, 14), rand(7, 15), 0, 7); g.fill(); }
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * 6.28, r = rand(22, 58), x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
    g.beginPath(); g.arc(x, y, rand(1.5, 5.5), 0, 7); g.fill();
    if (Math.random() < .5) { g.lineWidth = rand(2, 5); g.beginPath(); g.moveTo(64 + Math.cos(a) * 18, 64 + Math.sin(a) * 18); g.lineTo(x, y); g.stroke(); }
  }
  return new THREE.CanvasTexture(c);
}
// polygonOffset negativo: puxa o pingo um fio pra frente da parede, pra ele não brigar com ela.
const decalMat = t => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
const INK_DOTS = [0, 1, 2].map(() => decalMat(splatTex('#2a3fb0'))); // três desenhos diferentes
const decalGeo = new THREE.PlaneGeometry(1, 1);
const decals = [];
// Cola um pingo no ponto p de uma superfície. n é a normal: a direção pra onde a superfície olha.
function addDecal(p, n, mat, s) {
  const m = new THREE.Mesh(decalGeo, mat);
  m.position.copy(p).addScaledVector(n, 0.015 + Math.random() * 0.01);
  m.lookAt(m.position.clone().add(n)); // deita o quadradinho na superfície
  m.rotateZ(Math.random() * 6.28);     // e gira ele um tanto qualquer, pra dois pingos não ficarem iguais
  m.scale.setScalar(s);
  scene.add(m);
  decals.push(m);
  if (decals.length > 260) scene.remove(decals.shift()); // passou de 260, o mais antigo some
}

// Efeitos que duram um instante. Cada um tem uma vida em segundos e uma função que muda ele enquanto some.
const fx = [];
// O risco do tiro: uma linha da ponta da arma até onde bateu, que some em 8 centésimos de segundo.
function tracer(a, b, color = INK) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .9 }));
  scene.add(l);
  fx.push({ o: l, life: .08, max: .08, upd: (f, k) => { f.o.material.opacity = k * .9; } });
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.life -= dt;
    if (f.life <= 0) { scene.remove(f.o); f.o.geometry.dispose(); fx.splice(i, 1); }
    else f.upd(f, f.life / f.max); // k vai de 1 (acabou de nascer) até 0 (sumiu)
  }
}

// ---------- armas (viewmodel) ----------
// Viewmodel é o nome do modelo da arma que aparece na frente da câmera em jogo de tiro.
const hold = new THREE.Group(); // a "mão": tudo que está nela balança e dá coice junto
vmScene.add(hold);
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// Uma peça da arma: mesma receita das caixas do cenário, só que pequena.
function vpart(grp, geo, x, y, z, mk = 'light', color = INK) {
  worldUV(geo, .35);
  const m = new THREE.Mesh(geo, MAT[mk]);
  m.position.set(x, y, z);
  m.add(ink(geo, color, .004));
  grp.add(m);
  return m;
}
// A pistola: quatro caixas. Os números são metros, e o -z é pra frente.
const pistola = new THREE.Group();
vpart(pistola, B(.05, .07, .3), 0, 0, -.12, 'med');             // o ferrolho, a parte de cima
vpart(pistola, B(.044, .05, .22), 0, -.055, -.1, 'dense');      // o corpo
vpart(pistola, B(.042, .15, .07), 0, -.13, .0, 'dense');        // o cabo
vpart(pistola, B(.012, .02, .012), 0, .044, -.25, 'plain', RED); // a massa de mira, vermelha
hold.add(pistola);
// O clarão do tiro: uma estrela amarela na ponta do cano, que aparece por um instante.
const flash = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  g.fillStyle = 'rgba(255,214,90,.95)'; g.strokeStyle = '#e08a1e'; g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, r = i % 2 ? 22 : 58; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fill(); g.stroke();
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.position.set(0, 0, -.31);
  sp.scale.setScalar(.16);
  sp.visible = false;
  pistola.add(sp);
  return sp;
})();
// Os números da arma. rate é o tempo mínimo entre dois tiros, kick é o coice, spread é o espalhamento.
const ARMA = { rate: .26, kick: .05, spread: .008, timer: 0 };

// ---------- estado ----------
// O jogador (P, de player). `pos` é onde estão os pés dele. `yaw` é pra que lado ele está virado
// e `pitch` o quanto olha pra cima ou pra baixo, os dois em radianos.
const P = { pos: new V3(0, 0, 5), vel: new V3(), vy: 0, onGround: true, yaw: 0, pitch: 0 };
// 'menu' antes de começar, 'play' jogando, 'paused' com o mouse solto.
let state = 'menu';
// Se o navegador não deixar prender o mouse, o jogo funciona mesmo assim, com o mouse solto.
let noLock = false;
// As teclas apertadas agora. keys.KeyW é true enquanto o W estiver apertado.
const keys = {};
// O botão esquerdo do mouse está apertado? E dois números que vão de 1 a 0 depois de cada tiro:
// o coice da arma e o tempo do clarão.
let mouseL = false, recoil = 0, flashT = 0;

// ---------- input ----------
// O teclado avisa duas vezes: quando a tecla desce e quando sobe. A gente só anota.
// e.code é o nome da tecla pelo lugar dela no teclado (KeyW, Space...), igual em qualquer idioma.
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (state === 'play' && ['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); // não rola a página
});
addEventListener('keyup', e => { keys[e.code] = false; });
// Se a janela perde o foco com uma tecla apertada, o "soltou" nunca chega. Então solta tudo.
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseL = false; });

// O mouse. Com ele preso, o cursor some e o navegador passa só o quanto ele andou (movementX e movementY).
addEventListener('mousemove', e => {
  if (state !== 'play') return;
  if (!noLock && document.pointerLockElement !== canvas) return;
  const sens = .0022; // a sensibilidade: radianos por pixel
  const mx = clamp(e.movementX || 0, -200, 200), my = clamp(e.movementY || 0, -200, 200);
  P.yaw -= mx * sens;
  P.pitch -= my * sens;
  P.pitch = clamp(P.pitch, -1.5, 1.5); // quase 90 graus: não dá pra virar a cabeça de ponta-cabeça
});
function lockMouse() {
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => { noLock = true; });
  } catch (err) { noLock = true; }
}
// O Esc solta o mouse. O navegador avisa aqui, e o jogo pausa.
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && state === 'play' && !noLock) pause();
});
document.addEventListener('pointerlockerror', () => { noLock = true; });
// Clicar no jogo com o mouse solto prende ele de novo. Com ele preso, o botão esquerdo atira.
canvas.addEventListener('mousedown', e => {
  if (state !== 'play') return;
  if (!noLock && document.pointerLockElement !== canvas) { lockMouse(); return; }
  if (e.button === 0) mouseL = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; });

// ---------- telas ----------
function pause() {
  state = 'paused';
  mouseL = false;
  $('menu').classList.remove('hidden');
  $('play').textContent = 'CONTINUAR';
}
// O navegador só deixa prender o mouse em resposta a um clique. Por isso o jogo começa num botão.
$('play').addEventListener('click', () => {
  state = 'play';
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  lockMouse();
});

// ---------- tiro ----------
// O Raycaster é a régua do Three.js: dá um ponto e uma direção, e ele diz em que meshes essa linha bate,
// do mais perto pro mais longe. Não existe bala voando: o tiro acerta na hora. O nome disso é hitscan.
const ray = new THREE.Raycaster();
const _f = new V3(), _r = new V3(), _u = new V3(); // frente, direita e cima da câmera
function fire() {
  ARMA.timer = ARMA.rate;
  recoil = 1;
  flashT = .06;
  flash.material.rotation = Math.random() * 6; // cada clarão num ângulo
  P.pitch += ARMA.kick * rand(.6, 1.1);        // o coice levanta a mira um pouquinho
  P.yaw += rand(-1, 1) * ARMA.kick * .3;

  // A direção do tiro: pra frente, com um desvio pequeno pros lados e pra cima. Andando, o desvio é maior.
  camera.updateMatrixWorld();
  camera.getWorldDirection(_f);
  _r.setFromMatrixColumn(camera.matrixWorld, 0);
  _u.setFromMatrixColumn(camera.matrixWorld, 1);
  const moving = Math.hypot(P.vel.x, P.vel.z) > 1.5;
  const spread = ARMA.spread * (moving ? 1.7 : 1) * (P.onGround ? 1 : 2);
  const d = _f.clone().addScaledVector(_r, gauss() * spread).addScaledVector(_u, gauss() * spread).normalize();

  ray.set(camera.position, d);
  ray.far = 300;
  const h = ray.intersectObjects(worldMeshes, false)[0]; // a primeira coisa no caminho
  const end = h ? h.point : camera.position.clone().addScaledVector(d, 150);
  // O risco sai de um ponto abaixo e à direita do olho, mais ou menos onde a arma está.
  const muzzle = camera.position.clone().addScaledVector(_f, .7).addScaledVector(_r, .16).addScaledVector(_u, -.12);
  tracer(muzzle, end);
  if (h && h.face) {
    // A normal da face vem no espaço do objeto. O transformDirection passa ela pro espaço do mundo.
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    addDecal(h.point, n, INK_DOTS[Math.floor(Math.random() * 3)], rand(.14, .26));
  }
}

// ---------- update ----------
// Um passo do jogo. Roda a cada foto, enquanto o estado for 'play'.
const FWD = new V3(), RIGHT = new V3();
let bobT = 0; // o relógio do balanço da arma: só anda quando o jogador anda
function update(dt) {
  // Pra onde é "frente" e "direita" depende de pra onde o jogador está virado.
  // O seno e o cosseno do yaw dão essas duas direções, deitadas no chão.
  FWD.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  RIGHT.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  // f vale 1 andando pra frente, -1 pra trás, 0 parado. s é o mesmo pros lados.
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const sp = keys.ShiftLeft || keys.ShiftRight ? 8 : 6; // metros por segundo: correndo e andando
  // A velocidade que ele QUER ter. O normalize deixa a diagonal do mesmo tamanho que a reta:
  // sem ele, andar pra frente e pro lado ao mesmo tempo seria mais rápido.
  const want = FWD.clone().multiplyScalar(f).addScaledVector(RIGHT, s);
  if (want.lengthSq() > 0) want.normalize().multiplyScalar(sp);
  // A velocidade de verdade vai chegando na desejada aos poucos. No chão, rápido (14).
  // No ar, devagar (3): no meio do pulo quase não dá pra mudar de direção.
  const acc = P.onGround ? 14 : 3;
  P.vel.x += (want.x - P.vel.x) * Math.min(1, acc * dt);
  P.vel.z += (want.z - P.vel.z) * Math.min(1, acc * dt);
  // posição = posição + velocidade × tempo
  P.pos.x += P.vel.x * dt;
  P.pos.z += P.vel.z * dt;
  // Andou. Agora os colisores corrigem: se entrou numa parede, é empurrado pra fora.
  const bx = P.pos.x, bz = P.pos.z;
  pushOut(P.pos, .4, P.pos.y, 1.75); // raio 0,4 e altura 1,75
  P.pos.x = clamp(P.pos.x, -57.5, 57.5);
  P.pos.z = clamp(P.pos.z, -57.5, 57.5);
  // Se foi empurrado, a parte da velocidade que ia contra a parede é zerada.
  // Sobra a parte ao longo dela: é por isso que ele desliza na parede em vez de grudar.
  const pdx = P.pos.x - bx, pdz = P.pos.z - bz, pl = Math.hypot(pdx, pdz);
  if (pl > 1e-6) {
    const nx = pdx / pl, nz = pdz / pl, vn = P.vel.x * nx + P.vel.z * nz;
    if (vn < 0) { P.vel.x -= vn * nx; P.vel.z -= vn * nz; }
  }

  // O pulo: um empurrão pra cima. Daí a gravidade puxa a velocidade pra baixo o tempo todo.
  if (keys.Space && P.onGround) { P.vy = 7.6; P.onGround = false; }
  const prevY = P.pos.y;
  P.vy -= 22 * dt;
  P.pos.y += P.vy * dt;
  // Subindo, a cabeça pode bater por baixo de uma caixa (uma laje do andaime, por exemplo).
  if (P.vy > 0) for (const b of boxes) {
    if (P.pos.x + .3 > b.minX && P.pos.x - .3 < b.maxX && P.pos.z + .3 > b.minZ && P.pos.z - .3 < b.maxZ
      && prevY + 1.75 <= b.minY + .01 && P.pos.y + 1.75 > b.minY) { P.pos.y = b.minY - 1.75; P.vy = 0; }
  }
  // O chão já não é sempre o zero: é o topo do que estiver embaixo dos pés.
  const gy = groundAt(P.pos.x, P.pos.z, Math.max(prevY, P.pos.y), .3);
  if (P.pos.y <= gy) { P.pos.y = gy; P.vy = 0; P.onGround = true; }
  else P.onGround = P.pos.y - gy < .02; // saiu da beirada de um caixote: está no ar

  // A câmera fica na altura dos olhos, 1,62 acima dos pés.
  camera.position.set(P.pos.x, P.pos.y + 1.62, P.pos.z);
  camera.rotation.set(P.pitch, P.yaw, 0);

  // A pistola é semiautomática: um tiro por clique, e só se o tempo entre dois tiros já passou.
  // Depois do tiro o clique é "gasto" (mouseL volta a ser falso): pra atirar de novo, tem que clicar de novo.
  ARMA.timer -= dt;
  if (mouseL && ARMA.timer <= 0) { fire(); mouseL = false; }
  updateFx(dt);
  // O coice e o clarão vão sumindo sozinhos.
  recoil = Math.max(0, recoil - dt * 9);
  flashT -= dt;
  flash.visible = flashT > 0;
  // Onde a arma fica na tela: embaixo, à direita. Andando ela balança (o seno e o cosseno fazem um oito),
  // e no coice ela vem pra trás e levanta o cano.
  const hsp = Math.hypot(P.vel.x, P.vel.z);
  if (P.onGround && hsp > .5) bobT += dt * hsp * 1.6;
  hold.position.set(.17 + Math.cos(bobT) * .006, -.17 - Math.abs(Math.sin(bobT)) * .008, -.42 + recoil * .05);
  hold.rotation.set(recoil * .16, 0, 0);
}

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

  if (state === 'play') update(dt);
  else if (state === 'menu') {
    // No menu a câmera dá a volta na praça devagar, olhando pro lápis.
    menuA += dt * .06;
    camera.position.set(Math.sin(menuA) * 15, 6.5, Math.cos(menuA) * 15);
    camera.lookAt(0, 4, 0);
  }

  // Duas fotos por pintura. Primeiro limpa tudo e pinta o mundo.
  renderer.clear();
  renderer.render(scene, camera);
  // Depois limpa só a profundidade (quem está na frente de quem) e pinta a arma por cima.
  if (state !== 'menu') { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
}
requestAnimationFrame(loop);
})();
