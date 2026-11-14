// O PLACAR NA VERCEL. Este arquivo vira o endereço /api/placar sozinho: é a regra da pasta api/.
// Na Vercel não existe um servidor ligado o dia inteiro. Esta função acorda quando chega um pedido,
// responde e dorme de novo. Por isso ela não tem disco próprio: um arquivo gravado aqui some.
// Os dados ficam no Vercel Blob, que é um lugar de guardar arquivos. O nosso arquivo é o placar.json.
const { get, put, BlobPreconditionFailedError } = require('@vercel/blob');
const { conferePedido, estadoVazio, estadoDoTexto, melhores, entra, SO_GET_E_POST, FORA_DO_AR } = require('../lib/placar');

const CAMINHO = 'placar.json';
const TENTATIVAS = 6;

// Lê o placar.json do Blob. Devolve o estado e a "etiqueta" (ETag) daquela versão do arquivo.
// useCache: false pede o arquivo de verdade, e não uma cópia que pode estar até um minuto atrasada.
async function lePlacar() {
  const achado = await get(CAMINHO, { access: 'private', useCache: false });
  if (!achado) return { estado: estadoVazio(), etiqueta: null }; // o arquivo ainda não existe
  if (achado.statusCode !== 200) throw new Error('o Blob respondeu ' + achado.statusCode);
  const texto = await new Response(achado.stream).text();
  return { estado: estadoDoTexto(texto), etiqueta: achado.blob.etag };
}

// Grava o estado. Com a etiqueta, o Blob só aceita se o arquivo ainda for aquele que a gente leu.
// Sem etiqueta (primeira gravação), ele só aceita se o arquivo ainda não existir.
function gravaPlacar(estado, etiqueta) {
  const opcoes = { access: 'private', contentType: 'application/json', addRandomSuffix: false };
  if (etiqueta) opcoes.ifMatch = etiqueta;
  return put(CAMINHO, JSON.stringify(estado, null, 2), opcoes);
}

module.exports = async function placar(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    // GET /api/placar: me dá o placar.
    if (req.method === 'GET') {
      const { estado } = await lePlacar();
      return res.status(200).json(melhores(estado));
    }
    // POST /api/placar: toma, guarda esta pontuação nova.
    if (req.method === 'POST') {
      // O segredo que assina os bilhetes é uma variável de ambiente da Vercel. Ele não está no código,
      // não vai pro GitHub e nunca chega no navegador.
      const segredo = process.env.PLACAR_SEGREDO;
      if (!segredo) throw new Error('falta a variável PLACAR_SEGREDO');
      let dados = null;
      try { dados = req.body; } catch (erro) { /* o corpo não era JSON */ }
      // Primeiro confere o pedido, sem gastar uma leitura do Blob com quem veio sem bilhete.
      const conferido = conferePedido(dados, segredo);
      if (!conferido.linha) return res.status(conferido.status).json(conferido.erro);
      // Dois jogadores podem morrer no mesmo segundo. Se o arquivo mudou entre a nossa leitura e a
      // nossa gravação, o Blob recusa, e a gente lê de novo e tenta outra vez. Ninguém apaga ninguém.
      for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
        const { estado, etiqueta } = await lePlacar();
        const entrou = entra(estado, conferido.linha, conferido.id);
        if (!entrou.guardar) return res.status(entrou.status).json(entrou.erro);
        try {
          await gravaPlacar(entrou.guardar, etiqueta);
          return res.status(201).json(entrou.resposta);
        } catch (erro) {
          // Só vale tentar de novo quando o motivo foi "o arquivo mudou" (ou, na primeira gravação,
          // "o arquivo já existe"). Qualquer outro erro (sem permissão, Blob fora do ar) sobe na hora.
          const mudou = erro instanceof BlobPreconditionFailedError || etiqueta === null;
          if (!mudou || tentativa === TENTATIVAS - 1) throw erro;
          await new Promise(pronto => setTimeout(pronto, 40 + Math.random() * 120 * (tentativa + 1))); // espera um tiquinho
        }
      }
    }
    // Qualquer outro verbo (PUT, DELETE...) este endereço não aceita.
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json(SO_GET_E_POST);
  } catch (erro) {
    console.error(erro);
    return res.status(503).json(FORA_DO_AR);
  }
};
