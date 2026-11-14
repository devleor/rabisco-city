// Os testes das regras do placar. Rodam com:  node --test
// Não precisam de nada instalado: node:test e node:assert já vêm com o Node.
const test = require('node:test');
const assert = require('node:assert');
const p = require('../lib/placar');

// Cada ok() vira um teste com nome.
const ok = (certo, nome) => test(nome, () => assert.ok(certo));
const s = 'x'.repeat(40), b = p.novoBilhete(s);
const joga = f => { try { f(); return false; } catch (e) { return true; } };
ok(p.confereBilhete(b, s) && p.confereBilhete(b, s).segundos < 1, 'bilhete bom');
ok(!p.confereBilhete(b, 'outro'), 'segredo errado');
const [id, hora, sig] = b.split('.');
ok(/^[0-9a-f-]{36}$/.test(id), 'id e um UUID');
ok(!p.confereBilhete([id, String(+hora - 600000), sig].join('.'), s), 'hora alterada');
ok(!p.confereBilhete('', s) && !p.confereBilhete(undefined, s) && !p.confereBilhete({}, s) && !p.confereBilhete('a.b.c', s) && !p.confereBilhete(['x'], s), 'lixo');
ok(p.conferePedido({ nome: 'a', pontos: 5, onda: 1 }, s).status === 401, 'sem bilhete 401');
ok(p.conferePedido(null, s).status === 400 && p.conferePedido('texto', s).status === 400 && p.conferePedido([], s).status === 400, 'corpo ruim 400');
ok(p.conferePedido({ nome: 'a', pontos: 999999, onda: 1, bilhete: b }, s).status === 422, 'absurdo 422');
const r = p.conferePedido({ nome: 'a', pontos: 500, onda: 1, bilhete: b }, s);
ok(r.linha && r.id === id, 'bom');
const e1 = p.entra(p.estadoVazio(), r.linha, r.id);
ok(e1.guardar && e1.resposta.posicao === 1 && e1.guardar.usados[id], 'entra e risca o bilhete');
ok(p.entra(e1.guardar, r.linha, r.id).status === 409, 'repetido 409');
ok(!('id' in p.melhores(e1.guardar)[0]) && !('id' in e1.resposta.melhores[0]) && !('id' in e1.guardar.linhas[0]), 'id nao sai');
// lista cheia: pontuacao baixa nao e guardada, mas o bilhete fica riscado
const cheio = { linhas: Array.from({ length: 100 }, (_, i) => ({ nome: 'n' + i, pontos: 5000 + i, onda: 3, quando: 'x' })), usados: {} };
const e2 = p.entra(cheio, r.linha, r.id);
ok(e2.guardar.linhas.length === 100 && !e2.guardar.linhas.includes(r.linha) && e2.resposta.posicao === 101, 'fora das 100 nao guarda');
ok(p.entra(e2.guardar, r.linha, r.id).status === 409, 'fora das 100 tambem risca o bilhete');
// usados velhos saem
const velho = { linhas: [], usados: { antigo: Date.now() - 4 * 3600 * 1000, novo: Date.now() - 1000 } };
const e3 = p.entra(velho, r.linha, r.id);
ok(!('antigo' in e3.guardar.usados) && 'novo' in e3.guardar.usados, 'limpa usados vencidos');
ok(p.entra({ linhas: [], usados: {} }, r.linha, 'toString').guardar, 'id com nome de metodo nao confunde');
const muitos = { linhas: [], usados: Object.fromEntries(Array.from({ length: 6000 }, (_, i) => ['u' + i, Date.now() - 6000 + i])) };
const e4 = p.entra(muitos, r.linha, r.id);
ok(Object.keys(e4.guardar.usados).length === 5000 && e4.guardar.usados[id] && !('u0' in e4.guardar.usados) && 'u5999' in e4.guardar.usados, 'teto de usados tira os mais antigos');
// estado guardado
ok(joga(() => p.estadoDoTexto('{quebrado')) && joga(() => p.estadoDoTexto('5')) && joga(() => p.estadoDoTexto('null')) && joga(() => p.estadoDoTexto('{}')), 'texto estragado da erro');
ok(p.estadoDoTexto('[{"nome":"a","pontos":3,"onda":1},null,7]').linhas.length === 1, 'formato antigo (lista) e linhas ruins filtradas');
ok(p.estadoDoTexto(JSON.stringify(e1.guardar)).usados[id] > 0, 'vai e volta');
ok(Array.from(p.linhaValida({ nome: '\u{1D400}'.repeat(20), pontos: 1, onda: 1 }).nome).length === 12, 'nome nao parte letra');
