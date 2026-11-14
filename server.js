// O SERVIDOR do Rabisco City. Roda com:  node server.js
// Ele faz duas coisas:
//   1. entrega os arquivos do jogo (index.html, css, js) pra quem abrir http://localhost:3333
//   2. responde uma API: o placar, guardado num arquivo JSON
// Não precisa instalar nada: só usa o que já vem com o Node.
// Na Vercel este arquivo não roda: lá quem responde o placar é o api/placar.js.
const http = require('http');
const fs = require('fs');
const path = require('path');
// As regras do placar (conferir, ordenar) moram em lib/placar.js. A versão da Vercel usa as mesmas.
const { listaDoTexto, melhores, entra, novoBilhete, conferePedido, PEDIDO_ERRADO, SO_GET_E_POST } = require('./lib/placar');

const PORTA = process.env.PORT || 3333;
const RAIZ = __dirname; // a pasta onde este arquivo está
// O "banco de dados" de mentira: um arquivo de texto. Fica fora do git (veja o .gitignore).
const ARQUIVO = path.join(RAIZ, 'dados', 'placar.json');

// O segredo que assina os bilhetes (veja lib/placar.js). Aqui no seu computador ele é sorteado cada vez
// que o servidor liga. Na Vercel é uma variável de ambiente. Em nenhum dos dois ele vai pro navegador.
const SEGREDO = process.env.PLACAR_SEGREDO || require('crypto').randomBytes(32).toString('hex');

// ---------- o placar ----------
// JSON é um jeito de escrever dados como texto, que qualquer linguagem sabe ler:
//   [ { "nome": "Leo", "pontos": 4200, "onda": 5, "quando": "2026-11-14T12:00:00.000Z" } ]
// Colchetes são uma lista, chaves são um objeto, e cada campo é "nome": valor.

// Lê o arquivo e devolve a lista. Se o arquivo não existe, a lista começa vazia.
function lePlacar() {
  try {
    return listaDoTexto(fs.readFileSync(ARQUIVO, 'utf8'));
  } catch (erro) {
    return [];
  }
}
// Grava a lista no arquivo. Escreve num arquivo temporário e depois troca o nome:
// se o computador desligar no meio, o placar antigo continua inteiro.
function gravaPlacar(lista) {
  fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  const temporario = ARQUIVO + '.tmp';
  fs.writeFileSync(temporario, JSON.stringify(lista, null, 2)); // JSON.stringify: de objeto pra texto
  fs.renameSync(temporario, ARQUIVO);
}
// Responde com JSON e um código de status: 200 deu certo, 201 criei, 400 você pediu errado...
function respondeJson(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corpo));
}

function api(req, res) {
  // GET /api/placar: me dá o placar. Devolve os 10 melhores, do maior pro menor.
  if (req.method === 'GET') return respondeJson(res, 200, melhores(lePlacar()));
  // POST /api/placar: toma, guarda esta pontuação nova. O corpo do pedido chega em pedaços.
  if (req.method === 'POST') {
    let corpo = '';
    req.on('data', pedaco => {
      corpo += pedaco;
      if (corpo.length > 2000) req.destroy(); // grande demais pra ser uma pontuação: desliga na cara
    });
    req.on('end', () => {
      let dados = null;
      try { dados = JSON.parse(corpo); } catch (erro) { return respondeJson(res, 400, PEDIDO_ERRADO); } // não era JSON
      const lista = lePlacar();
      const conferido = conferePedido(dados, lista, SEGREDO);
      if (!conferido.linha) return respondeJson(res, conferido.status, conferido.erro);
      const { guardar, resposta } = entra(lista, conferido.linha);
      gravaPlacar(guardar);
      respondeJson(res, 201, resposta);
    });
    return;
  }
  // Qualquer outro verbo (PUT, DELETE...) este endereço não aceita.
  respondeJson(res, 405, SO_GET_E_POST);
}

// ---------- os arquivos do jogo ----------
// O navegador precisa saber que tipo de arquivo está recebendo. Isso vai no cabeçalho Content-Type.
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
// Só estas pastas e arquivos são entregues. O resto do disco (e o próprio placar.json) fica de fora.
const PUBLICOS = ['/index.html', '/css/', '/js/'];

function arquivo(req, res) {
  let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (caminho === '/') caminho = '/index.html';
  const inteiro = path.normalize(path.join(RAIZ, caminho));
  const permitido = PUBLICOS.some(p => caminho === p || (p.endsWith('/') && caminho.startsWith(p)));
  // O startsWith barra pedidos espertinhos como /css/../../segredo.txt
  if (!permitido || !inteiro.startsWith(RAIZ + path.sep)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404: não achei');
  }
  fs.readFile(inteiro, (erro, conteudo) => {
    if (erro) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404: não achei');
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(inteiro)] || 'application/octet-stream' });
    res.end(conteudo);
  });
}

// ---------- liga o servidor ----------
// Cada pedido que chega cai nesta função. O endereço decide quem responde.
http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/api/placar') return api(req, res);
  // GET /api/partida: começou uma partida, me dá um bilhete.
  if (req.url.split('?')[0] === '/api/partida') return req.method === 'GET' ? respondeJson(res, 200, { bilhete: novoBilhete(SEGREDO) }) : respondeJson(res, 405, { erro: 'Aqui só GET.' });
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('405: só GET');
  }
  arquivo(req, res);
}).listen(PORTA, () => console.log(`Rabisco City em http://localhost:${PORTA}`));
