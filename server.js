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
const { novoBilhete, conferePedido, estadoVazio, estadoDoTexto, melhores, entra, PEDIDO_ERRADO, SO_GET_E_POST, FORA_DO_AR } = require('./lib/placar');

const PORTA = process.env.PORT || 3333;
// 127.0.0.1 quer dizer "só este computador": ninguém na mesma rede Wi-Fi consegue abrir. Pra liberar: HOST=0.0.0.0
const ENDERECO = process.env.HOST || '127.0.0.1';
const RAIZ = __dirname; // a pasta onde este arquivo está
// O "banco de dados" de mentira: um arquivo de texto. Fica fora do git (veja o .gitignore).
const ARQUIVO = path.join(RAIZ, 'dados', 'placar.json');

// O segredo que assina os bilhetes (veja lib/placar.js). Aqui no seu computador ele é sorteado cada vez
// que o servidor liga. Na Vercel é uma variável de ambiente. Em nenhum dos dois ele vai pro navegador.
const SEGREDO = process.env.PLACAR_SEGREDO || require('crypto').randomBytes(32).toString('hex');

// ---------- o placar ----------
// JSON é um jeito de escrever dados como texto, que qualquer linguagem sabe ler:
//   { "linhas": [ { "nome": "Leo", "pontos": 4200, "onda": 5, "quando": "2026-11-14T12:00:00.000Z" } ], "usados": {} }
// Colchetes são uma lista, chaves são um objeto, e cada campo é "nome": valor.

// Lê o arquivo e devolve o que está guardado. Se o arquivo ainda não existe, começa vazio.
// Se ele existe mas estragou, dá erro: melhor parar do que gravar um placar vazio por cima.
function lePlacar() {
  let texto;
  try {
    texto = fs.readFileSync(ARQUIVO, 'utf8');
  } catch (erro) {
    if (erro.code === 'ENOENT') return estadoVazio(); // ENOENT: o arquivo não existe
    throw erro;
  }
  return estadoDoTexto(texto);
}
// Grava no arquivo. Escreve num arquivo temporário e depois troca o nome:
// se o computador desligar no meio, o placar antigo continua inteiro.
function gravaPlacar(estado) {
  fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  const temporario = ARQUIVO + '.tmp';
  fs.writeFileSync(temporario, JSON.stringify(estado, null, 2)); // JSON.stringify: de objeto pra texto
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
    req.on('error', () => { }); // o pedido caiu no meio: não tem o que responder
    req.on('data', pedaco => {
      corpo += pedaco;
      if (corpo.length > 2000) req.destroy(); // grande demais pra ser uma pontuação: desliga na cara
    });
    req.on('end', () => {
      // Este pedaço roda depois, fora do try lá de baixo, então ele tem o seu próprio.
      try {
        let dados = null;
        try { dados = JSON.parse(corpo); } catch (erro) { return respondeJson(res, 400, PEDIDO_ERRADO); } // não era JSON
        const conferido = conferePedido(dados, SEGREDO);
        if (!conferido.linha) return respondeJson(res, conferido.status, conferido.erro);
        const entrou = entra(lePlacar(), conferido.linha, conferido.id);
        if (!entrou.guardar) return respondeJson(res, entrou.status, entrou.erro);
        gravaPlacar(entrou.guardar);
        respondeJson(res, 201, entrou.resposta);
      } catch (erro) {
        console.error(erro);
        respondeJson(res, 503, FORA_DO_AR);
      }
    });
    return;
  }
  // Qualquer outro verbo (PUT, DELETE...) este endereço não aceita.
  respondeJson(res, 405, SO_GET_E_POST);
}

// ---------- os arquivos do jogo ----------
// O navegador precisa saber que tipo de arquivo está recebendo. Isso vai no cabeçalho Content-Type.
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
// Só o index.html e estas pastas são entregues. O resto do disco (e o próprio placar.json) fica de fora.
const PASTAS = ['css', 'js'];

function responde(res, status, texto) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(texto);
}
// Do endereço pedido pro arquivo no disco. Devolve null se o pedido não pode ser atendido.
// Aqui mora um ataque clássico: pedir /css/../server.js pra sair da pasta e ler o que não devia.
// E ele vem disfarçado: %2f é uma barra e %5c é uma barra invertida, escritas em código.
function caminhoDoArquivo(endereco) {
  let caminho = decodeURIComponent(endereco.split('?')[0]); // tira o disfarce ANTES de conferir
  if (caminho === '/') caminho = '/index.html';
  if (caminho.includes('\0') || caminho.includes('\\') || caminho.split('/').includes('..')) return null;
  const inteiro = path.join(RAIZ, caminho);
  // Confere pelo caminho final, já resolvido: tem que ser o index.html ou estar dentro de uma das pastas.
  const partes = path.relative(RAIZ, inteiro).split(path.sep);
  const permitido = (partes.length === 1 && partes[0] === 'index.html') || (partes.length > 1 && PASTAS.includes(partes[0]));
  return permitido ? inteiro : null;
}

function arquivo(req, res) {
  let inteiro;
  try { inteiro = caminhoDoArquivo(req.url); } catch (erro) { return responde(res, 400, '400: endereço estranho'); }
  if (!inteiro) return responde(res, 404, '404: não achei');
  fs.readFile(inteiro, (erro, conteudo) => {
    if (erro) return responde(res, 404, '404: não achei');
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(inteiro)] || 'application/octet-stream' });
    res.end(conteudo);
  });
}

// ---------- liga o servidor ----------
// Cada pedido que chega cai nesta função. O endereço decide quem responde.
// O try segura qualquer erro inesperado: o pedido ruim recebe uma resposta de erro, e o servidor continua de pé.
http.createServer((req, res) => {
  try {
    const endereco = req.url.split('?')[0];
    if (endereco === '/api/placar') return api(req, res);
    // GET /api/partida: começou uma partida, me dá um bilhete.
    if (endereco === '/api/partida') return req.method === 'GET' ? respondeJson(res, 200, { bilhete: novoBilhete(SEGREDO) }) : respondeJson(res, 405, { erro: 'Aqui só GET.' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return responde(res, 405, '405: só GET');
    arquivo(req, res);
  } catch (erro) {
    console.error(erro);
    if (!res.headersSent) respondeJson(res, 503, FORA_DO_AR);
  }
}).listen(PORTA, ENDERECO, () => console.log(`Rabisco City em http://localhost:${PORTA}`));
