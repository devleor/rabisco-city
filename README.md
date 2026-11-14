# Rabisco City, etapa 3: A cidade

![A etapa 3 rodando](docs/etapa.gif)

**O que entra nesta etapa:** ruas, quarteirões sorteados com semente, parque, andaime, lápis gigante e cúpula.

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

A cidade é sorteada, mas com semente: o sorteio dá sempre o mesmo resultado, então o mapa é igual pra todo mundo. A cúpula é uma esfera de linhas por cima de tudo.

O `js/game.js` é dividido em seções marcadas com `// ---------- nome ----------`.

## O que mudou desde a etapa anterior

```bash
git diff etapa-02-traco-de-caneta etapa-03-a-cidade
```

## Etapas

Anterior: `etapa-02-traco-de-caneta` · Próxima: `etapa-04-andar`

```bash
git checkout etapa-04-andar
```

A lista completa das etapas está no README da branch `etapa-09-placar` e da `main`.
