const test = require('node:test');
const assert = require('node:assert');
const Chefes = require('../js/chefes.js');
const Folego = require('../js/folego.js');

test('o colosso vem na onda 10 e de 10 em 10', () => {
  assert.strictEqual(Chefes.daOnda(10), 'colosso');
  assert.strictEqual(Chefes.daOnda(20), 'colosso');
});

test('o Mr. Borracha vem como elite nas ondas 5, 8, 13, 15 e 18', () => {
  for (const o of [5, 8, 13, 15, 18]) assert.strictEqual(Chefes.daOnda(o), 'borracha', 'onda ' + o);
});

test('ondas comuns, a onda 3 e a onda 0 não têm chefe', () => {
  for (const o of [0, 1, 2, 3, 4, 6, 7, 9, 11, 12]) assert.strictEqual(Chefes.daOnda(o), null, 'onda ' + o);
});

test('o colosso tem bem mais vida que a borracha, e os dois crescem com a onda', () => {
  assert.strictEqual(Chefes.vida('colosso', 10), 3000);
  assert.strictEqual(Chefes.vida('borracha', 5), 700);
  assert.ok(Chefes.vida('colosso', 20) > Chefes.vida('colosso', 10));
  assert.ok(Chefes.vida('borracha', 8) > Chefes.vida('borracha', 5));
});

test('com o colosso vêm poucos capangas; com a borracha, menos que numa onda comum', () => {
  assert.strictEqual(Chefes.capangas('colosso', 10), 8);
  assert.ok(Chefes.capangas('borracha', 5) < 4 + 5 * 3);
  assert.ok(Chefes.capangas('borracha', 5) > 0);
});

test('o tremor é cheio em cima do impacto, cai com a distância e some no alcance', () => {
  assert.strictEqual(Chefes.tremor(0, .9), .9);
  assert.ok(Math.abs(Chefes.tremor(45, .9) - .45) < 1e-9);
  assert.strictEqual(Chefes.tremor(90, .9), 0);
  assert.strictEqual(Chefes.tremor(200, .9), 0);
});

test('o bloco arremessado cai onde foi mirado, no tempo pedido', () => {
  const de = { x: 10, y: 30, z: -5 }, para = { x: -20, y: 0, z: 40 }, t = 1.8, g = 20;
  const v = Chefes.arremesso(de, para, t, g);
  const fim = { x: de.x + v.x * t, y: de.y + v.y * t - g * t * t / 2, z: de.z + v.z * t };
  for (const k of ['x', 'y', 'z']) assert.ok(Math.abs(fim[k] - para[k]) < 1e-9, k);
});

test('quebrar a cúpula tira só os segmentos perto do buraco', () => {
  const perto = [0, 0, 0, 2, 0, 0], longe = [100, 0, 0, 102, 0, 0];
  assert.deepStrictEqual(Chefes.semBuraco([...perto, ...longe], { x: 0, y: 0, z: 0 }, 10), longe);
  assert.deepStrictEqual(Chefes.semBuraco([...perto, ...longe], { x: 500, y: 0, z: 0 }, 10), [...perto, ...longe]);
  assert.deepStrictEqual(Chefes.semBuraco([], { x: 0, y: 0, z: 0 }, 10), []);
});

test('cada meia volta do passo bate um pé, alternando; no meio do passo nenhum bate', () => {
  assert.strictEqual(Chefes.pisou(.5, 1), -1);
  assert.strictEqual(Chefes.pisou(3, 3.2), 1);
  assert.strictEqual(Chefes.pisou(6.2, 6.3), 0);
  assert.strictEqual(Chefes.pisou(9.4, 9.5), 1);
});

test('o gancho gasta fôlego enquanto puxa e para em zero', () => {
  assert.ok(Math.abs(Folego.passo(1, true, 1, 0) - (1 - Folego.GASTO)) < 1e-9);
  assert.strictEqual(Folego.passo(.01, true, 1, 0), 0);
});

test('o fôlego dura mais de 4 e menos de 8 segundos puxando sem parar', () => {
  let f = 1, t = 0;
  while (f > 0 && t < 60) { f = Folego.passo(f, true, .1, 0); t += .1; }
  assert.ok(t > 4 && t < 8, 'durou ' + t.toFixed(1) + ' s');
});

test('o fôlego só volta depois da espera, e enche até 1', () => {
  assert.strictEqual(Folego.passo(.4, false, 1, .2), .4);
  assert.ok(Folego.passo(.4, false, 1, 1) > .4);
  assert.strictEqual(Folego.passo(.95, false, 5, 5), 1);
});

test('sem fôlego mínimo o gancho não dispara', () => {
  assert.strictEqual(Folego.pode(.1), false);
  assert.strictEqual(Folego.pode(.15), true);
  assert.strictEqual(Folego.pode(1), true);
});
