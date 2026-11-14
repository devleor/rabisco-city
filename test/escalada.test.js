// Testes da escalada (js/escalada.js). Rodam com:  node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Escalada = require('../js/escalada.js');

const predio = { minX: 0, maxX: 10, minZ: 0, maxZ: 10, minY: 0, maxY: 8 };
const caixa = { minX: 20, maxX: 21, minZ: 0, maxZ: 1, minY: 0, maxY: 1 };
const blocos = [caixa, predio];
const em = (x, y, z, noChao) => ({ x, y, z, noChao });

test('jogador no chão: ninguém escala', () => {
  assert.strictEqual(Escalada.predio(blocos, em(-5, 0, 5, true), null), null);
});

test('jogador em cima de uma caixa baixa não conta como prédio', () => {
  assert.strictEqual(Escalada.predio(blocos, em(20.5, 1, .5, true), null), null);
});

test('jogador em pé no teto: o alvo é aquele prédio', () => {
  assert.strictEqual(Escalada.predio(blocos, em(5, 8, 5, true), null), predio);
});

test('na beirada do teto ainda conta', () => {
  assert.strictEqual(Escalada.predio(blocos, em(10.2, 8, 5, true), null), predio);
});

test('pulando em cima do teto, o alvo continua o mesmo', () => {
  assert.strictEqual(Escalada.predio(blocos, em(5, 9.2, 5, false), predio), predio);
});

test('no ar, sem ter pisado em prédio nenhum, não há alvo', () => {
  assert.strictEqual(Escalada.predio(blocos, em(5, 9.2, 5, false), null), null);
});

test('voou pra longe do prédio: os bonecos desistem', () => {
  assert.strictEqual(Escalada.predio(blocos, em(30, 12, 5, false), predio), null);
});

test('caiu abaixo da altura mínima: os bonecos desistem', () => {
  assert.strictEqual(Escalada.predio(blocos, em(11, 1.2, 5, false), predio), null);
});

test('o prédio foi destruído no meio do pulo: não há mais alvo', () => {
  assert.strictEqual(Escalada.predio([caixa], em(5, 9, 5, false), predio), null);
});

test('distância até a parede, e o ponto mais perto dela', () => {
  assert.deepStrictEqual(Escalada.distancia(predio, -3, 5), { x: 0, z: 5, d: 3 });
  assert.deepStrictEqual(Escalada.distancia(predio, 13, 14), { x: 10, z: 10, d: 5 });
  assert.strictEqual(Escalada.distancia(predio, 4, 4).d, 0);
});

// A ligação com o jogo: confere, pelo texto do game.js, as regras que não podem se perder.
const jogo = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
const pagina = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('a página carrega o escalada.js antes do game.js', () => {
  assert.ok(pagina.indexOf('js/escalada.js') > 0 && pagina.indexOf('js/escalada.js') < pagina.indexOf('js/game.js'));
});

test('o jogo pergunta a cada quadro em qual prédio o jogador está', () => {
  assert.match(jogo, /alto = Escalada\.predio\(boxes, \{[^}]*noChao: P\.onGround[^}]*\}, alto\)/);
});

test('sem jogador no alto não existe alvo, e quem cospe nunca escala', () => {
  assert.match(jogo, /const alvo = alto && e\.type !== 'spitter' && g\.position\.y < alto\.maxY - \.1 \? alto : null;/);
  assert.match(jogo, /if \(!alvo\) e\.sobe = false;/);
});

test('quem é arrancado da parede só pula pra dentro se tiver teto pra pisar', () => {
  assert.match(jogo, /if \(groundAt\(hx, hz, g\.position\.y, \.25 \* sc\) > g\.position\.y - STEP\) \{ g\.position\.x = hx; g\.position\.z = hz; \}/);
});

test('o golpe só acerta quem está na mesma altura, e não começa no meio da escalada', () => {
  assert.match(jogo, /!e\.sobe && Math\.abs\(P\.pos\.y - g\.position\.y\) < 1\.2\) e\.wind/);
  assert.match(jogo, /Math\.abs\(P\.pos\.y - g\.position\.y\) < 1\.4\) damagePlayer/);
});
