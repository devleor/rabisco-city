// O PLACAR NA VERCEL. Este arquivo vira o endereço /api/placar sozinho: é a regra da pasta api/.
// Na Vercel não existe um servidor ligado o dia inteiro. Esta função acorda quando chega um pedido,
// responde e dorme de novo. Por isso ela não tem disco próprio: um arquivo gravado aqui some.
// A lista fica no Vercel Blob, que é um lugar de guardar arquivos. O nosso arquivo é o placar.json.
const { get, put } = require('@vercel/blob');
const { listaDoTexto, melhores, entra, conferePedido, SO_GET_E_POST } = require('../lib/placar');

const CAMINHO = 'placar.json';
const TENTATIVAS = 8;

// Lê o placar.json do Blob. Devolve a lista e a "etiqueta" (ETag) daquela versão do arquivo.
// useCache: false pede o arquivo de verdade, e não uma cópia que pode estar até um minuto atrasada.
async function lePlacar() {
  const achado = await get(CAMINHO, { access: 'private', useCache: false });
  if (!achado || achado.statusCode !== 200) return { lista: [], etiqueta: null }; // ainda não existe
  const texto = await new Response(achado.stream).text();
  return { lista: listaDoTexto(texto), etiqueta: achado.blob.etag };
}

// Grava a lista. Com a etiqueta, o Blob só aceita se o arquivo ainda for aquele que a gente leu.
// Sem etiqueta (primeira gravação), ele só aceita se o arquivo ainda não existir.
function gravaPlacar(lista, etiqueta) {
  const opcoes = { access: 'private', contentType: 'application/json', addRandomSuffix: false };
  if (etiqueta) opcoes.ifMatch = etiqueta;
  return put(CAMINHO, JSON.stringify(lista, null, 2), opcoes);
}

module.exports = async function placar(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    // GET /api/placar: me dá o placar.
    if (req.method === 'GET') {
      const { lista } = await lePlacar();
      return res.status(200).json(melhores(lista));
    }
    // POST /api/placar: toma, guarda esta pontuação nova.
    if (req.method === 'POST') {
      // O segredo que assina os bilhetes é uma variável de ambiente da Vercel. Ele não está no código,
      // não vai pro GitHub e nunca chega no navegador.
      const segredo = process.env.PLACAR_SEGREDO;
      if (!segredo) throw new Error('falta a variável PLACAR_SEGREDO');
      let dados = null;
      try { dados = req.body; } catch (erro) { /* o corpo não era JSON */ }
      // Dois jogadores podem morrer no mesmo segundo. Se o arquivo mudou entre a nossa leitura e a
      // nossa gravação, o Blob recusa, e a gente lê de novo e tenta outra vez. Ninguém apaga ninguém.
      for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
        const { lista, etiqueta } = await lePlacar();
        const conferido = conferePedido(dados, lista, segredo);
        if (!conferido.linha) return res.status(conferido.status).json(conferido.erro);
        const { guardar, resposta } = entra(lista, conferido.linha);
        try {
          await gravaPlacar(guardar, etiqueta);
          return res.status(201).json(resposta);
        } catch (erro) {
          if (tentativa === TENTATIVAS - 1) throw erro;
          await new Promise(pronto => setTimeout(pronto, 60 + Math.random() * 200 * (tentativa + 1))); // espera um tiquinho, cada vez mais
        }
      }
    }
    // Qualquer outro verbo (PUT, DELETE...) este endereço não aceita.
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json(SO_GET_E_POST);
  } catch (erro) {
    console.error(erro);
    return res.status(503).json({ erro: 'O placar está fora do ar agora.' });
  }
};
