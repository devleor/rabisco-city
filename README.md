# Rabisco City, etapa 5: Colisão

![A etapa 5 rodando](docs/etapa.gif)

**O que entra nesta etapa:** um colisor de caixa pra cada peça do mapa: parar na parede e subir em caixote.

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

Cada peça do mapa ganha uma caixa invisível (a lista `boxes`). A função `pushOut` empurra o jogador pra fora de qualquer caixa em que ele entrou, e a `groundAt` responde qual é o chão embaixo dele, o que deixa subir em degrau e caixote.

O `js/game.js` é dividido em seções marcadas com `// ---------- nome ----------`.

## O que mudou desde a etapa anterior

```bash
git diff etapa-04-andar etapa-05-colisao
```

## Etapas

Anterior: `etapa-04-andar` · Próxima: `etapa-06-arma-e-tiro`

```bash
git checkout etapa-06-arma-e-tiro
```

A lista completa das etapas está no README da branch `etapa-09-placar` e da `main`.
