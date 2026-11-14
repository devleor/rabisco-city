// A ESCALADA: os bonecos só sobem num prédio quando o jogador está em cima dele.
// Aqui ficam as duas contas que decidem isso. Elas não dependem de nada do jogo (só recebem números),
// então dá pra testar sozinhas (test/escalada.test.js). O movimento e a animação ficam no game.js.
const Escalada = (() => {
  const ALTO = 1.5;  // pés do jogador acima disso: ele está em cima de alguma coisa
  const LONGE = 6;   // no ar, a mais que isso do prédio: ele foi embora, os bonecos desistem
  const FOLGA = .3;  // o quanto o pé do jogador pode passar da beirada

  // O ponto do bloco mais perto de (x, z), olhando de cima, e a distância até ele (0 se estiver dentro).
  function distancia(b, x, z) {
    const px = Math.min(Math.max(x, b.minX), b.maxX), pz = Math.min(Math.max(z, b.minZ), b.maxZ);
    return { x: px, z: pz, d: Math.hypot(x - px, z - pz) };
  }

  // Em cima de qual bloco o jogador está? Devolve o bloco, ou null se ele está no chão.
  // "antes" é a resposta do quadro anterior: no meio de um pulo o jogador não pisa em nada,
  // e mesmo assim continua "em cima do prédio" enquanto não cair nem se afastar.
  function predio(blocos, jogador, antes) {
    if (jogador.y < ALTO) return null;
    if (jogador.noChao) {
      for (const b of blocos) {
        if (Math.abs(b.maxY - jogador.y) < .06 && jogador.x + FOLGA > b.minX && jogador.x - FOLGA < b.maxX &&
            jogador.z + FOLGA > b.minZ && jogador.z - FOLGA < b.maxZ) return b;
      }
      return null;
    }
    if (antes && blocos.indexOf(antes) >= 0 && distancia(antes, jogador.x, jogador.z).d < LONGE) return antes;
    return null;
  }

  return { predio, distancia, ALTO, LONGE };
})();

// No navegador, o Escalada acima já é uma variável global que o game.js enxerga.
// No Node (os testes), ele é exportado.
if (typeof module !== 'undefined') module.exports = Escalada;
