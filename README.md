# Etapa 0: jogo da velha

![O jogo da velha rodando](docs/etapa.gif)

Antes do Rabisco City, um jogo pequeno pra ver os três tipos de arquivo de uma página trabalhando juntos.

| Arquivo | Papel | O que tem dentro |
| --- | --- | --- |
| `index.html` | o esqueleto | o título, o aviso de quem é a vez, o tabuleiro (três linhas de três botões) e o botão de jogar de novo |
| `jogo.js` | o cérebro | a lista das nove casas, de quem é a vez, as oito linhas que ganham e o que acontece em cada clique |
| `estilo.css` | a roupa | papel, linhas de caderno, letra de mão e os riscos do tabuleiro |

## Como rodar

Não precisa instalar nada.

1. Baixe esta branch (botão **Code > Download ZIP** no GitHub, ou `git checkout etapa-00-jogo-da-velha`).
2. Dê dois cliques no `index.html`. Ele abre no navegador.

## Fazer junto com o vídeo

No vídeo o jogo é montado em três passos, e dá pra parar em cada um:

1. **Só o `index.html`**, sem a linha do `<link>` e sem a do `<script>`: aparecem o título e nove botões minúsculos que não fazem nada.
2. **Com o `jogo.js`** (a linha do `<script>` no fim do `body`): o jogo funciona, ainda sem estilo.
3. **Com o `estilo.css`** (a linha do `<link>` no `head`): o mesmo jogo com cara de caderno.

As etapas seguintes (`etapa-01-a-folha` em diante) são o Rabisco City. Elas rodam com um servidor de arquivos, sempre na porta 3333: `npx serve -l 3333 .` e abra http://localhost:3333.
