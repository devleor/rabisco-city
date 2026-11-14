# Rabisco City, etapa 1: A folha

![A etapa 1 rodando](docs/etapa.gif)

**O que entra nesta etapa:** a página, a cena, a câmera, o renderer, o chão e uma caixa.

Esta branch é um passo do jogo [Rabisco City](https://rabisco-city.vercel.app), construído em etapas. Cada etapa roda sozinha.

## Como rodar

Entre na pasta do projeto e suba um servidor de arquivos na porta **3333** (a mesma em todas as etapas):

```bash
npx serve -l 3333 .
# ou, se você tem Python:
python -m http.server 3333
```

Abra **http://localhost:3333**. Precisa de teclado e mouse.

## O que olhar no código

O `index.html` carrega o Three.js por uma tag `script` e depois o `js/game.js`. No `game.js`, procure as três peças de toda cena 3D: a cena, a câmera e o renderer. No fim do arquivo fica o laço que redesenha a tela a cada quadro.

O `js/game.js` é dividido em seções marcadas com `// ---------- nome ----------`.

## Etapas

Anterior: `etapa-00-jogo-da-velha` · Próxima: `etapa-02-traco-de-caneta`

```bash
git checkout etapa-02-traco-de-caneta
```

A lista completa das etapas está no README da branch `etapa-09-placar` e da `main`.
