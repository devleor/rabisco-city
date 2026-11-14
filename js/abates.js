// O FEED DE ABATES: a lista no canto de cima que conta quem apagou quem, e com o quê.
// Fica num arquivo separado do game.js porque não depende de nada do jogo: recebe textos e desenha linhas.
// Por isso dá pra testar ele sozinho (test/abates.test.js).
const Abates = (() => {
  const NOMES = ['Zé', 'Tico', 'Rabisco', 'Borrão', 'Garrancho', 'Palito', 'Nanquim', 'Grafite', 'Traço', 'Risco',
    'Tinta', 'Canetão', 'Lápis', 'Borracha', 'Esboço', 'Rascunho', 'Margem', 'Pauta', 'Clipe', 'Rasura'];
  const MAXIMO = 5;     // quantas linhas aparecem ao mesmo tempo
  const DURACAO = 5000; // quanto tempo uma linha fica na tela, em milissegundos
  let proximo = Math.floor(Math.random() * NOMES.length);

  // Cada inimigo que nasce ganha um nome da lista, em ordem, pra dois vizinhos não repetirem.
  function nomeDeBot() {
    return 'BOT ' + NOMES[proximo++ % NOMES.length];
  }

  // Põe uma linha no feed: QUEM  [arma]  VÍTIMA.
  //   caixa   o elemento da página onde as linhas entram
  //   cabeca  true se foi tiro na cabeça
  //   meu     true quando o abate foi do jogador: a linha ganha a borda vermelha
  // textContent põe os nomes como texto puro: o nome do jogador vem de um campo que ele digita,
  // e com innerHTML um nome como <img onerror=...> viraria código.
  function mostra(caixa, quem, arma, vitima, cabeca, meu) {
    const linha = document.createElement('div');
    linha.className = meu ? 'ab meu' : 'ab';
    const partes = [['q', quem], ['w', arma || '?']];
    if (cabeca) partes.push(['h', 'na cabeça']);
    partes.push(['v', vitima]);
    for (const [classe, texto] of partes) {
      const pedaco = document.createElement('span');
      pedaco.className = classe;
      pedaco.textContent = texto;
      linha.appendChild(pedaco);
    }
    caixa.appendChild(linha);
    while (caixa.children.length > MAXIMO) caixa.children[0].remove(); // a mais antiga sai
    setTimeout(() => linha.classList.add('some'), DURACAO);            // começa a sumir
    setTimeout(() => linha.remove(), DURACAO + 600);                   // e sai da página
    return linha;
  }

  function limpa(caixa) {
    while (caixa.children.length) caixa.children[0].remove();
  }

  return { nomeDeBot, mostra, limpa, NOMES, MAXIMO, DURACAO };
})();

// No navegador, o Abates acima já é uma variável global que o game.js enxerga.
// No Node (os testes), ele é exportado.
if (typeof module !== 'undefined') module.exports = Abates;
