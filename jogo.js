// O que o jogo precisa lembrar.
let casas = ['', '', '', '', '', '', '', '', '']; // as nove casas, vazias
let vez = 'X';                                    // de quem é a vez
let acabou = false;                               // o jogo já terminou?

// As peças da página que o jogo vai usar.
const botoes = document.querySelectorAll('#tabuleiro button');
const aviso = document.getElementById('aviso');

// As oito linhas que ganham: três deitadas, três em pé, duas na diagonal.
const LINHAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8],
                [0, 3, 6], [1, 4, 7], [2, 5, 8],
                [0, 4, 8], [2, 4, 6]];

// Alguma linha tem as três casas iguais, e não vazias?
function ganhou() {
  return LINHAS.some(([a, b, c]) =>
    casas[a] !== '' && casas[a] === casas[b] && casas[b] === casas[c]);
}

// Alguém clicou na casa de número i.
function joga(i) {
  if (acabou || casas[i] !== '') return; // acabou, ou a casa já tem dono
  casas[i] = vez;
  botoes[i].textContent = vez;
  botoes[i].className = vez;             // o CSS usa isso pra pintar o X e o O
  if (ganhou()) {
    aviso.textContent = vez + ' ganhou!';
    acabou = true;
  } else if (!casas.includes('')) {
    aviso.textContent = 'Deu velha!';
    acabou = true;
  } else {
    vez = vez === 'X' ? 'O' : 'X';       // passa a vez
    aviso.textContent = 'Vez do ' + vez;
  }
}

// Quando clicarem num botão, chama a função joga com o número dele.
botoes.forEach((botao, i) => botao.addEventListener('click', () => joga(i)));

// O botão de jogar de novo volta tudo pro começo.
document.getElementById('de-novo').addEventListener('click', () => {
  casas.fill('');
  vez = 'X';
  acabou = false;
  botoes.forEach(botao => { botao.textContent = ''; botao.className = ''; });
  aviso.textContent = 'Vez do X';
});
