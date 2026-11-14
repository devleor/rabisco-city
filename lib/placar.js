// AS REGRAS DO PLACAR. Este arquivo não sabe onde a lista fica guardada: ele só confere e ordena.
// Quem guarda é outro arquivo, e são dois:
//   server.js      no seu computador, a lista fica num arquivo do disco (dados/placar.json)
//   api/placar.js  na Vercel, a lista fica no Blob
// Os dois usam estas mesmas funções, então o placar se comporta igual nos dois lugares.

const crypto = require('crypto');

const NO_MENU = 10;   // quantas linhas a API devolve
const GUARDADAS = 100; // quantas ficam guardadas, pra lista não crescer pra sempre

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

// ---------- o bilhete ----------
// O jogo roda no navegador de quem joga, e lá qualquer um abre o game.js e lê tudo. Então uma senha
// escrita no jogo não é segredo nenhum. O segredo de verdade fica SÓ no servidor, e o jogo nunca vê.
// Quando a partida começa, o servidor entrega um bilhete: um número sorteado, a hora, e uma assinatura
// feita com o segredo. Sem o segredo ninguém fabrica nem altera um bilhete, e o POST só vale com um.
function assina(texto, segredo) {
  return crypto.createHmac('sha256', segredo).update(texto).digest('hex');
}
function novoBilhete(segredo) {
  const corpo = crypto.randomBytes(8).toString('hex') + '.' + Date.now();
  return corpo + '.' + assina(corpo, segredo);
}
// Devolve { id, segundos } (há quanto tempo a partida começou), ou null se o bilhete não é nosso.
function confereBilhete(bilhete, segredo) {
  const partes = String(bilhete || '').split('.');
  if (partes.length !== 3 || !/^[0-9a-f]{16}$/.test(partes[0]) || !/^\d{13}$/.test(partes[1])) return null;
  const certa = Buffer.from(assina(partes[0] + '.' + partes[1], segredo)), veio = Buffer.from(partes[2]);
  // timingSafeEqual compara sem dar pista de quantas letras acertou.
  if (certa.length !== veio.length || !crypto.timingSafeEqual(certa, veio)) return null;
  const segundos = (Date.now() - Number(partes[1])) / 1000;
  if (segundos < 0 || segundos > 6 * 3600) return null; // bilhete do futuro, ou velho demais
  return { id: partes[0], segundos };
}
// O bilhete diz quanto tempo a partida durou. Ninguém faz um milhão de pontos em dez segundos.
// Isso não pega quem trapaceia devagar, mas barra o POST feito na mão com um número absurdo.
function plausivel(linha, segundos) {
  return linha.pontos <= 1000 + 200 * segundos && linha.onda <= 2 + segundos / 8;
}

// De texto pra lista. Se o texto estragou (ou não é uma lista), o placar começa vazio.
function listaDoTexto(texto) {
  try {
    const lista = JSON.parse(texto);
    return Array.isArray(lista) ? lista : [];
  } catch (erro) {
    return [];
  }
}

// O que sai pra fora: o número do bilhete fica guardado, mas não é mostrado.
const publica = ({ nome, pontos, onda, quando }) => ({ nome, pontos, onda, quando });

// Os melhores, do maior pro menor.
function melhores(lista) {
  return [...lista].sort((a, b) => b.pontos - a.pontos).slice(0, NO_MENU).map(publica);
}

// Põe uma linha nova na lista. Devolve a lista que deve ser guardada e a resposta pro jogo.
function entra(lista, linha) {
  const nova = [...lista, linha].sort((a, b) => b.pontos - a.pontos);
  return {
    guardar: nova.slice(0, GUARDADAS),
    resposta: { posicao: nova.indexOf(linha) + 1, melhores: nova.slice(0, NO_MENU).map(publica) },
  };
}

// Confere um POST inteiro. Devolve { linha } pra guardar, ou { status, erro } pra recusar.
function conferePedido(dados, lista, segredo) {
  const linha = linhaValida(dados);
  if (!linha) return { status: 400, erro: PEDIDO_ERRADO };
  const bilhete = confereBilhete(dados.bilhete, segredo);
  if (!bilhete) return { status: 401, erro: { erro: 'Sem bilhete válido. Comece uma partida.' } }; // 401: não sei quem é você
  if (!plausivel(linha, bilhete.segundos)) return { status: 422, erro: { erro: 'Essa pontuação não cabe no tempo da partida.' } };
  if (lista.some(l => l.id === bilhete.id)) return { status: 409, erro: { erro: 'Esse bilhete já foi usado.' } }; // 409: conflito
  linha.id = bilhete.id;
  return { linha };
}

const PEDIDO_ERRADO = { erro: 'Mande { "nome": texto, "pontos": número, "onda": número }.' };
const SO_GET_E_POST = { erro: 'Aqui só GET e POST.' };

module.exports = { linhaValida, listaDoTexto, melhores, entra, novoBilhete, confereBilhete, plausivel, conferePedido, PEDIDO_ERRADO, SO_GET_E_POST };
