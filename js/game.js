// RABISCO CITY, etapa 1: a folha em branco.
// Tudo fica dentro de uma função que roda na hora, pra os nomes daqui não vazarem pra o resto da página.
(() => {
'use strict';

// As duas cores do jogo: o papel e a tinta da caneta. 0x... é um número escrito em hexadecimal.
const PAPER = 0xf3eedf, INK = 0x2a3fb0;

// ---------- renderer ----------
// Pra ter qualquer coisa na tela são três peças: a cena, a câmera e o renderer.
// Pensa num set de filmagem.

// O renderer revela a foto: olha a cena pela câmera e pinta o resultado no canvas.
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

// A cena é o set: o mundo onde as coisas existem. O fundo dela é da cor do papel.
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);

// A câmera decide o que aparece. Os números: o ângulo de visão em graus (75),
// a proporção da tela (acertada no resize) e de quão perto até quão longe ela enxerga.
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 500);
camera.position.set(0, 1.7, 5); // 1,7 de altura: os olhos de uma pessoa em pé
camera.lookAt(0, 1, 0);

// Quando a janela muda de tamanho, o renderer e a câmera precisam saber.
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- mundo ----------
// Todo objeto 3D é feito de duas coisas: a geometria (a forma, ou seja, os triângulos)
// e o material (a pele: que cor tem). Juntando as duas num Mesh, ele pode entrar na cena.

// O chão: um plano enorme da cor do papel. O plano nasce em pé, então a gente deita ele.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600),
  new THREE.MeshBasicMaterial({ color: PAPER })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Uma caixa de 2 por 2 por 2. Por enquanto, da cor da tinta.
const geo = new THREE.BoxGeometry(2, 2, 2);
const caixa = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: INK }));
caixa.position.set(0, 1, 0); // o centro a 1 de altura: a base encosta no chão
scene.add(caixa);

// Sem luz e com uma cor só, a caixa vira uma mancha: não dá pra ver onde acaba um lado e começa o outro.
// O contorno resolve: EdgesGeometry acha as quinas da forma, e LineSegments desenha uma linha em cada uma.
const contorno = new THREE.LineSegments(
  new THREE.EdgesGeometry(geo),
  new THREE.LineBasicMaterial({ color: PAPER })
);
caixa.add(contorno); // filho da caixa: gira junto com ela

// ---------- loop ----------
// O navegador chama esta função toda vez que vai pintar a tela, umas 60 vezes por segundo.
// Mexe um pouquinho, tira a foto. Mexe um pouquinho, tira a foto.
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop); // pede pra ser chamada de novo na próxima pintura

  // dt é o tempo, em segundos, desde a última foto. Multiplicar por ele faz a caixa
  // girar na mesma velocidade num computador rápido e num lento.
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;

  caixa.rotation.y += dt * 0.8;

  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
})();
