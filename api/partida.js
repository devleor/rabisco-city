// GET /api/partida: começou uma partida, me dá um bilhete.
// O bilhete é assinado com um segredo que só existe aqui no servidor (veja lib/placar.js).
const { novoBilhete } = require('../lib/placar');

module.exports = function partida(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erro: 'Aqui só GET.' });
  }
  const segredo = process.env.PLACAR_SEGREDO;
  if (!segredo) return res.status(503).json({ erro: 'O placar está fora do ar agora.' });
  return res.status(200).json({ bilhete: novoBilhete(segredo) });
};
