// Testes do feed de abates (js/abates.js). Rodam com:  node --test
// O feed desenha na página, e no Node não existe página. Então o teste monta uma página de mentira,
// só com o que o feed usa: createElement, appendChild, remove, children, classList.
const test = require('node:test');
const assert = require('node:assert');

function elemento() {
  const el = {
    className: '', textContent: '', children: [], pai: null,
    classList: { add(nome) { el.className += ' ' + nome; } },
    appendChild(filho) { filho.pai = el; el.children.push(filho); return filho; },
    remove() { if (el.pai) el.pai.children.splice(el.pai.children.indexOf(el), 1); el.pai = null; },
  };
  return el;
}
global.document = { createElement: elemento };
const Abates = require('../js/abates.js');
const textos = linha => linha.children.map(pedaco => pedaco.textContent);

test('todo bot tem nome, e vizinhos não repetem', () => {
  const nomes = Array.from({ length: Abates.NOMES.length }, () => Abates.nomeDeBot());
  assert.ok(nomes.every(nome => /^BOT \S+/.test(nome)));
  assert.strictEqual(new Set(nomes).size, Abates.NOMES.length);
});

test('a linha mostra quem, a arma e a vítima, nessa ordem', () => {
  const caixa = elemento();
  const linha = Abates.mostra(caixa, 'Leo', 'AK-47', 'BOT Zé', false, true);
  assert.deepStrictEqual(textos(linha), ['Leo', 'AK-47', 'BOT Zé']);
  assert.strictEqual(linha.className, 'ab meu');
  assert.strictEqual(caixa.children.length, 1);
});

test('tiro na cabeça ganha a marca, entre a arma e a vítima', () => {
  const linha = Abates.mostra(elemento(), 'Leo', 'SNIPER', 'BOT Tico', true, true);
  assert.deepStrictEqual(textos(linha), ['Leo', 'SNIPER', 'na cabeça', 'BOT Tico']);
});

test('quando o bot apaga o jogador a linha não é marcada como do jogador', () => {
  const linha = Abates.mostra(elemento(), 'BOT Borrão', 'SOCO', 'Leo', false, false);
  assert.strictEqual(linha.className, 'ab');
});

test('o nome entra como texto puro, nunca como HTML', () => {
  const linha = Abates.mostra(elemento(), '<img src=x onerror=alert(1)>', 'UZI', 'BOT Zé', false, true);
  assert.strictEqual(linha.children[0].textContent, '<img src=x onerror=alert(1)>');
  assert.ok(!('innerHTML' in linha.children[0]));
});

test('sem arma conhecida aparece uma interrogação', () => {
  assert.deepStrictEqual(textos(Abates.mostra(elemento(), 'Leo', undefined, 'BOT Zé', false, true)), ['Leo', '?', 'BOT Zé']);
});

test('só cabem as linhas mais novas', () => {
  const caixa = elemento();
  for (let i = 0; i < Abates.MAXIMO + 3; i++) Abates.mostra(caixa, 'Leo', 'UZI', 'BOT ' + i, false, true);
  assert.strictEqual(caixa.children.length, Abates.MAXIMO);
  assert.strictEqual(textos(caixa.children[0])[2], 'BOT 3');
  assert.strictEqual(textos(caixa.children[Abates.MAXIMO - 1])[2], 'BOT ' + (Abates.MAXIMO + 2));
});

test('a linha some sozinha depois de um tempo', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const caixa = elemento();
  const linha = Abates.mostra(caixa, 'Leo', 'UZI', 'BOT Zé', false, true);
  t.mock.timers.tick(Abates.DURACAO);
  assert.ok(linha.className.includes('some'));
  assert.strictEqual(caixa.children.length, 1);
  t.mock.timers.tick(600);
  assert.strictEqual(caixa.children.length, 0);
});

test('limpa tira tudo', () => {
  const caixa = elemento();
  Abates.mostra(caixa, 'Leo', 'UZI', 'BOT Zé', false, true); Abates.mostra(caixa, 'Leo', 'UZI', 'BOT Tico', false, true);
  Abates.limpa(caixa);
  assert.strictEqual(caixa.children.length, 0);
});

// O feed só serve se o jogo chamar ele. Estes testes leem o game.js e conferem as ligações.
const jogo = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'game.js'), 'utf8');

test('o jogo dá nome aos bots e mostra o abate quando um deles é apagado', () => {
  assert.match(jogo, /nome: Abates\.nomeDeBot\(\)/);
  assert.match(jogo, /function killEnemy[\s\S]{0,600}Abates\.mostra\(\$\('abates'\), nomeJogador\(\), e\.por, e\.nome, head, true\)/);
});

test('todo golpe num inimigo diz qual foi a arma', () => {
  const chamadas = jogo.split('
').filter(l => l.includes('hurtEnemy(') && !l.includes('function hurtEnemy'));
  assert.strictEqual(chamadas.length, 4);
  for (const l of chamadas) assert.match(l, /hurtEnemy\(.*, (w\.name|'BAZUCA'|'CENÁRIO')\)/, l.trim().slice(0, 80));
});

test('a morte do jogador também entra no feed, e partida nova começa com ele vazio', () => {
  assert.match(jogo, /P\.hp = 0; Abates\.mostra\(/);
  assert.match(jogo, /function newGame\(\) \{[\s\S]{0,120}Abates\.limpa\(/);
});
