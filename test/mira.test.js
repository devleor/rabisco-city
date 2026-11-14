// Testes da mira (js/mira.js). Rodam com:  node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Mira = require('../js/mira.js');

const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' não é ' + b);

test('parado, no chão e sem mirar: o espalhamento é o da arma', () => {
  perto(Mira.espalhamento(.018, false, true, 0), .018);
});

test('andando espalha mais, e no ar mais ainda', () => {
  perto(Mira.espalhamento(.02, true, true, 0), .034);
  perto(Mira.espalhamento(.02, false, false, 0), .04);
  perto(Mira.espalhamento(.02, true, false, 0), .068);
});

test('mirando no botão direito o espalhamento cai pra um quarto', () => {
  perto(Mira.espalhamento(.02, false, true, 1), .005);
});

test('a conta é igual, número por número, à fórmula que o tiro usava antes', () => {
  for (const arma of [.004, .008, .018, .022, .03, .075]) for (const anda of [false, true]) for (const chao of [false, true]) for (const ads of [0, .3, 1]) {
    assert.strictEqual(Mira.espalhamento(arma, anda, chao, ads), arma * (anda ? 1.7 : 1) * (chao ? 1 : 2) * (1 - .75 * ads));
  }
});

test('andando é acima de 1,5 de velocidade, em qualquer direção', () => {
  assert.strictEqual(Mira.andando(1.5, 0), false);
  assert.strictEqual(Mira.andando(0, -1.6), true);
  assert.strictEqual(Mira.andando(1.2, 1.2), true);
});

test('o vão cresce com o espalhamento', () => {
  const pistola = Mira.abertura(.008, 0), ak = Mira.abertura(.018, 0), escopeta = Mira.abertura(.075, 0);
  assert.ok(pistola < ak && ak < escopeta);
  perto(ak, 3 + .018 * 380);
});

test('o coice do tiro abre a mira, e ela fecha quando o coice passa', () => {
  assert.ok(Mira.abertura(.018, 1) > Mira.abertura(.018, .5) && Mira.abertura(.018, .5) > Mira.abertura(.018, 0));
  perto(Mira.abertura(.018, 1) - Mira.abertura(.018, 0), 14);
});

test('arma sem espalhamento (a régua) não quebra a conta: fica no vão mínimo', () => {
  assert.strictEqual(Mira.abertura(Mira.espalhamento(0, true, false, 0), 0), Mira.MIN);
});

test('o vão nunca fecha de vez e nunca passa do máximo', () => {
  assert.strictEqual(Mira.abertura(0, 0), Mira.MIN);
  assert.strictEqual(Mira.abertura(5, 5), Mira.MAX);
});

// A ligação com o jogo, conferida pelo texto dos arquivos.
const raiz = path.join(__dirname, '..');
const jogo = fs.readFileSync(path.join(raiz, 'js', 'game.js'), 'utf8');
const pagina = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const estilo = fs.readFileSync(path.join(raiz, 'css', 'style.css'), 'utf8');

test('a página carrega o mira.js antes do game.js e a mira tem os quatro riscos', () => {
  assert.ok(pagina.indexOf('js/mira.js') > 0 && pagina.indexOf('js/mira.js') < pagina.indexOf('js/game.js'));
  assert.match(pagina, /<div id="cross"><i class="t"><\/i><i class="b"><\/i><i class="l"><\/i><i class="r"><\/i><\/div>/);
  for (const lado of ['t', 'b', 'l', 'r']) assert.match(estilo, new RegExp('#cross \\.' + lado + '\\{'));
});

test('o tiro e a mira usam a mesma conta de espalhamento', () => {
  assert.match(jogo, /const moving = Mira\.andando\(P\.vel\.x, P\.vel\.z\);/);
  assert.match(jogo, /let spread = Mira\.espalhamento\(w\.spread, moving, P\.onGround, adsT\);/);
  assert.match(jogo, /Mira\.abertura\(Mira\.espalhamento\(cur\(\)\.spread \|\| 0, Mira\.andando\(P\.vel\.x, P\.vel\.z\), P\.onGround, adsT\), recoil\)/);
});
