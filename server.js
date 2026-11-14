// O SERVIDOR do Rabisco City. Roda com:  node server.js
// Ele faz duas coisas:
//   1. entrega os arquivos do jogo (index.html, css, js) pra quem abrir http://localhost:3333
//   2. responde uma API: o placar, guardado num arquivo JSON
// Não precisa instalar nada: só usa o que já vem com o Node.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = process.env.PORT || 3333;
const RAIZ = __dirname; // a pasta onde este arquivo está
// O "banco de dados" de mentira: um arquivo de texto. Fica fora do git (veja o .gitignore).
const ARQUIVO = path.join(RAIZ, 'dados', 'placar.json');

// ---------- o placar ----------
// JSON é um jeito de escrever dados como texto, que qualquer linguagem sabe ler:
//   [ { "nome": "Leo", "pontos": 4200, "onda": 5, "quando": "2026-11-14T12:00:00.000Z" } ]
// Colchetes são uma lista, chaves são um objeto, e cada campo é "nome": valor.

// Lê o arquivo e devolve a lista. Se o arquivo não existe (ou estragou), a lista começa vazia.
function lePlacar() {
  try {
    const lista = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')); // JSON.parse: de texto pra objeto
    return Array.isArray(lista) ? lista.filter(l => typeof l === 'object' && l !== null && Number.isFinite(l.pontos)) : [];
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
// Nunca confie no que chega de fora: qualquer um pode mandar um POST com qualquer coisa.
// Esta função confere o pedido e devolve uma linha limpa pro placar, ou null se ele não serve.
function linhaValida(dados) {
  if (typeof dados !== 'object' || dados === null) return null;
  const nome = String(dados.nome || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 12);
  const pontos = Number(dados.pontos), onda = Number(dados.onda);
  if (!nome) return null;
  if (!Number.isInteger(pontos) || pontos < 0 || pontos > 10000000) return null;
  if (!Number.isInteger(onda) || onda < 0 || onda > 1000) return null;
  return { nome, pontos, onda, quando: new Date().toISOString() };
}
// Responde com JSON e um código de status: 200 deu certo, 201 criei, 400 você pediu errado...
function respondeJson(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corpo));
}

function api(req, res) {
  // GET /api/placar: me dá o placar. Devolve os 10 melhores, do maior pro menor.
  if (req.method === 'GET') {
    const melhores = lePlacar().sort((a, b) => b.pontos - a.pontos).slice(0, 10);
    return respondeJson(res, 200, melhores);
  }
  // POST /api/placar: toma, guarda esta pontuação nova. O corpo do pedido chega em pedaços.
  if (req.method === 'POST') {
    let corpo = '';
    req.on('data', pedaco => {
      corpo += pedaco;
      if (corpo.length > 2000) req.destroy(); // grande demais pra ser uma pontuação: desliga na cara
    });
    req.on('end', () => {
      let linha = null;
      try { linha = linhaValida(JSON.parse(corpo)); } catch (erro) { /* não era JSON */ }
      if (!linha) return respondeJson(res, 400, { erro: 'Mande { "nome": texto, "pontos": número, "onda": número }.' });
      // Guarda só as 100 melhores, pra o arquivo não crescer pra sempre.
      const lista = lePlacar();
      lista.push(linha);
      lista.sort((a, b) => b.pontos - a.pontos);
      try {
        gravaPlacar(lista.slice(0, 100));
      } catch (erro) { // disco cheio, arquivo travado... o servidor avisa e continua de pé
        console.error(erro);
        return respondeJson(res, 500, { erro: 'Não consegui gravar o placar.' });
      }
      respondeJson(res, 201, { posicao: lista.indexOf(linha) + 1, melhores: lista.slice(0, 10) });
    });
    return;
  }
  // Qualquer outro verbo (PUT, DELETE...) este endereço não aceita.
  respondeJson(res, 405, { erro: 'Aqui só GET e POST.' });
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
// 127.0.0.1 quer dizer "só este computador": ninguém na mesma rede Wi-Fi consegue abrir o seu servidor.
http.createServer((req, res) => {
  try {
    if (req.url.split('?')[0] === '/api/placar') return api(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') return responde(res, 405, '405: só GET');
    arquivo(req, res);
  } catch (erro) {
    console.error(erro);
    if (!res.headersSent) responde(res, 500, '500: deu erro aqui no servidor');
  }
}).listen(PORTA, '127.0.0.1', () => console.log(`Rabisco City em http://localhost:${PORTA}`));
