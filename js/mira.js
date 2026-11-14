// A MIRA: quatro riscos em cruz, como no CS. O vão no meio abre quando o tiro fica menos preciso.
// Aqui ficam as duas contas dela. Elas só recebem números, então dá pra testar sozinhas (test/mira.test.js).
const Mira = (() => {
  const MIN = 3, MAX = 64; // o vão no meio, em pixels: nunca fecha de vez, nunca passa disso

  // Andando ou parado? Uma conta só, pro tiro e pra mira nunca discordarem.
  function andando(vx, vz) { return Math.hypot(vx, vz) > 1.5; }

  // O quanto os tiros espalham agora. É a mesma conta que o tiro usa de verdade,
  // então a mira nunca mostra uma precisão que a arma não tem.
  function espalhamento(arma, andando, noChao, mirando) {
    return arma * (andando ? 1.7 : 1) * (noChao ? 1 : 2) * (1 - .75 * mirando);
  }

  // O tamanho do vão: cresce com o espalhamento e com o coice do último tiro (de 0 a 1, some em um instante).
  function abertura(espalha, coice) {
    return Math.min(MAX, Math.max(MIN, MIN + espalha * 380 + coice * 14));
  }

  return { andando, espalhamento, abertura, MIN, MAX };
})();

// No navegador, o Mira acima já é uma variável global que o game.js enxerga.
// No Node (os testes), ele é exportado.
if (typeof module !== 'undefined') module.exports = Mira;
