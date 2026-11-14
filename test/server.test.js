// Testes do server.js: liga o servidor numa porta de teste e faz pedidos de verdade.
// Só pedidos que não gravam nada, pra não mexer no placar de quem está rodando o jogo.
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PORTA = 3397;
let servidor;

// http.request manda o caminho do jeito que está escrito, sem "consertar" os ../ antes.
function pede(caminho, metodo = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORTA, path: caminho, method: metodo }, res => {
      let corpo = '';
      res.on('data', pedaco => { corpo += pedaco; });
      res.on('end', () => resolve({ status: res.statusCode, corpo }));
    });
    req.on('error', reject);
    req.end();
  });
}

test.before(async () => {
  servidor = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORTA), HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    servidor.stdout.once('data', resolve);
    servidor.once('exit', codigo => reject(new Error('o servidor fechou com código ' + codigo)));
  });
});
test.after(() => servidor.kill());

test('entrega a página, o css e o js', async () => {
  for (const caminho of ['/', '/index.html', '/css/style.css', '/js/game.js']) assert.strictEqual((await pede(caminho)).status, 200, caminho);
});

test('não entrega nada fora das pastas públicas', async () => {
  for (const caminho of ['/server.js', '/lib/placar.js', '/package.json', '/README.md', '/dados/placar.json', '/css', '/css/']) {
    assert.strictEqual((await pede(caminho)).status, 404, caminho);
  }
});

test('pedido disfarçado pra sair da pasta leva 404', async () => {
  for (const caminho of ['/css/../server.js', '/css/..%2fserver.js', '/css/..%2Fserver.js', '/css/..%5cserver.js', '/js/..%2f.git/HEAD', '/css/%2e%2e/server.js', '/index.html/..%2fserver.js']) {
    const resposta = await pede(caminho);
    assert.strictEqual(resposta.status, 404, caminho);
    assert.ok(!resposta.corpo.includes('require('), caminho);
  }
});

test('endereço malformado leva 400 e o servidor continua de pé', async () => {
  assert.strictEqual((await pede('/%E0%A4%A')).status, 400);
  assert.strictEqual((await pede('/')).status, 200);
});

test('a API responde os verbos certos', async () => {
  assert.strictEqual((await pede('/api/placar', 'DELETE')).status, 405);
  assert.strictEqual((await pede('/api/partida', 'POST')).status, 405);
  assert.strictEqual((await pede('/index.html', 'POST')).status, 405);
  const partida = await pede('/api/partida');
  assert.strictEqual(partida.status, 200);
  assert.match(JSON.parse(partida.corpo).bilhete, /^[0-9a-f-]{36}\.\d{13}\.[0-9a-f]{64}$/);
});

test('POST sem bilhete leva 401 e não grava', async () => {
  const resposta = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORTA, path: '/api/placar', method: 'POST' }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.end(JSON.stringify({ nome: 'hacker', pontos: 1000000, onda: 50 }));
  });
  assert.strictEqual(resposta, 401);
});
