# Rabisco City, etapa 6: Arma e tiro

![A etapa 6 rodando](docs/etapa.gif)

**O que entra nesta etapa:** a pistola numa cena própria, o tiro como um raio, pingos de tinta e coice.

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

A arma é desenhada numa cena separada, por cima do mundo, pra nunca entrar na parede. O tiro não é um objeto voando: é um raio traçado da câmera pra frente, e o jogo pergunta no que ele bateu.

O `js/game.js` é dividido em seções marcadas com `// ---------- nome ----------`.

## O que mudou desde a etapa anterior

```bash
git diff etapa-05-colisao etapa-06-arma-e-tiro
```

## Etapas

Anterior: `etapa-05-colisao` · Próxima: `etapa-07-som`

```bash
git checkout etapa-07-som
```

A lista completa das etapas está no README da branch `etapa-09-placar` e da `main`.
