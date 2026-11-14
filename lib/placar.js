// AS REGRAS DO PLACAR. Este arquivo não sabe onde os dados ficam guardados: ele só confere e ordena.
// Quem guarda é outro arquivo, e são dois:
//   server.js      no seu computador, os dados ficam num arquivo do disco (dados/placar.json)
//   api/placar.js  na Vercel, os dados ficam no Blob
// Os dois usam estas mesmas funções, então o placar se comporta igual nos dois lugares.
//
// O que fica guardado (o "estado") é um objeto assim:
//   { "linhas": [ { "nome": "Leo", "pontos": 4200, "onda": 5, "quando": "..." } ],
//     "usados": { "o-uuid-de-uma-partida": 1763000000000 } }

const crypto = require('crypto');

const NO_MENU = 10;    // quantas linhas a API devolve
const GUARDADAS = 100; // quantas ficam guardadas, pra lista não crescer pra sempre
const VALIDADE = 2 * 3600; // um bilhete vale por duas horas, em segundos

// Nunca confie no que chega de fora: qualquer um pode mandar um POST com qualquer coisa.
// Esta função confere o pedido e devolve uma linha limpa pro placar, ou null se ele não serve.
function linhaValida(dados) {
  if (typeof dados !== 'object' || dados === null) return null;
  // Array.from conta letras de verdade: assim o corte em 12 nunca parte uma letra no meio.
  const nome = Array.from(String(dados.nome || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim()).slice(0, 12).join('').trim();
  const pontos = Number(dados.pontos), onda = Number(dados.onda);
  if (!nome) return null;
  if (!Number.isInteger(pontos) || pontos < 0 || pontos > 10000000) return null;
  if (!Number.isInteger(onda) || onda < 0 || onda > 1000) return null;
  return { nome, pontos, onda, quando: new Date().toISOString() };
}

// ---------- o bilhete ----------
// O jogo roda no navegador de quem joga, e lá qualquer um abre o game.js e lê tudo. Então uma senha
// escrita no jogo (uma chave de API) não é segredo nenhum. O segredo de verdade fica SÓ no servidor.
// Quando a partida começa, o servidor sorteia um UUID pra ela e entrega um bilhete: o UUID, a hora,
// e uma assinatura feita com o segredo. Sem o segredo ninguém fabrica nem altera um bilhete.
function assina(texto, segredo) {
  return crypto.createHmac('sha256', segredo).update(texto).digest('hex');
}
function novoBilhete(segredo) {
  const corpo = crypto.randomUUID() + '.' + Date.now();
  return corpo + '.' + assina(corpo, segredo);
}
// Devolve { id, segundos } (há quanto tempo a partida começou), ou null se o bilhete não é nosso.
function confereBilhete(bilhete, segredo) {
  const partes = (typeof bilhete === 'string' ? bilhete : '').split('.');
  if (partes.length !== 3 || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(partes[0]) || !/^\d{13}$/.test(partes[1])) return null;
  const certa = Buffer.from(assina(partes[0] + '.' + partes[1], segredo)), veio = Buffer.from(partes[2]);
  // timingSafeEqual compara sem dar pista de quantas letras acertou.
  if (certa.length !== veio.length || !crypto.timingSafeEqual(certa, veio)) return null;
  const segundos = (Date.now() - Number(partes[1])) / 1000;
  if (segundos < 0 || segundos > VALIDADE) return null; // bilhete do futuro, ou velho demais
  return { id: partes[0], segundos };
}
// O bilhete diz quanto tempo a partida durou. Ninguém faz um milhão de pontos em dez segundos.
// A conta é folgada (uns 150 pontos por segundo, mais que um jogador muito bom faz), então quem pega
// um bilhete e fica esperando ainda consegue mentir um número grande. Isso barra o POST absurdo
// feito na mão. Pra barrar tudo, o servidor teria que jogar a partida junto.
function plausivel(linha, segundos) {
  return linha.pontos <= 1000 + 150 * segundos && linha.onda <= 2 + segundos / 8;
}

// Confere um POST sem olhar o que está guardado. Devolve { linha, id } ou { status, erro }.
function conferePedido(dados, segredo) {
  const linha = linhaValida(dados);
  if (!linha) return { status: 400, erro: PEDIDO_ERRADO };
  const bilhete = confereBilhete(dados.bilhete, segredo);
  if (!bilhete) return { status: 401, erro: { erro: 'Sem bilhete válido. Comece uma partida.' } }; // 401: não sei quem é você
  if (!plausivel(linha, bilhete.segundos)) return { status: 422, erro: { erro: 'Essa pontuação não cabe no tempo da partida.' } };
  return { linha, id: bilhete.id };
}

// ---------- o estado ----------
const estadoVazio = () => ({ linhas: [], usados: {} });

// De texto pra estado. Texto estragado dá erro de propósito: é melhor o placar ficar fora do ar
// do que gravar uma lista vazia por cima da lista de verdade.
function estadoDoTexto(texto) {
  const dados = JSON.parse(texto); // JSON.parse: de texto pra objeto
  if (typeof dados !== 'object' || dados === null) throw new Error('o placar guardado não é um objeto');
  const linhas = Array.isArray(dados) ? dados : dados.linhas; // uma lista pura também vale (formato antigo)
  if (!Array.isArray(linhas)) throw new Error('o placar guardado não tem a lista de linhas');
  const usados = !Array.isArray(dados) && typeof dados.usados === 'object' && dados.usados !== null ? dados.usados : {};
  return {
    linhas: linhas.filter(l => typeof l === 'object' && l !== null && typeof l.nome === 'string' && Number.isFinite(l.pontos)),
    usados: Object.fromEntries(Object.entries(usados).filter(([, quando]) => Number.isFinite(quando))),
  };
}

// O que sai pra fora: só estes campos.
const publica = ({ nome, pontos, onda, quando }) => ({ nome, pontos, onda, quando });

// Os melhores, do maior pro menor.
function melhores(estado) {
  return [...estado.linhas].sort((a, b) => b.pontos - a.pontos).slice(0, NO_MENU).map(publica);
}

// Põe uma linha nova. Devolve { guardar, resposta }, ou { status, erro } se o bilhete já foi usado.
// O bilhete é riscado mesmo quando a pontuação não entra nas guardadas: cada partida envia uma vez só.
function entra(estado, linha, id) {
  if (Object.hasOwn(estado.usados, id)) return { status: 409, erro: { erro: 'Esse bilhete já foi usado.' } }; // 409: conflito
  const agora = Date.now(), nova = [...estado.linhas, linha].sort((a, b) => b.pontos - a.pontos);
  // Bilhete vencido não precisa mais ficar na lista de usados: ele já é recusado pela hora.
  const usados = Object.fromEntries(Object.entries(estado.usados).filter(([, quando]) => agora - quando < (VALIDADE + 600) * 1000));
  usados[id] = agora;
  return {
    guardar: { linhas: nova.slice(0, GUARDADAS), usados },
    resposta: { posicao: nova.indexOf(linha) + 1, melhores: nova.slice(0, NO_MENU).map(publica) },
  };
}

const PEDIDO_ERRADO = { erro: 'Mande { "nome": texto, "pontos": número, "onda": número, "bilhete": texto }.' };
const SO_GET_E_POST = { erro: 'Aqui só GET e POST.' };
const FORA_DO_AR = { erro: 'O placar está fora do ar agora.' };

module.exports = { linhaValida, novoBilhete, confereBilhete, plausivel, conferePedido, estadoVazio, estadoDoTexto, melhores, entra, PEDIDO_ERRADO, SO_GET_E_POST, FORA_DO_AR };
