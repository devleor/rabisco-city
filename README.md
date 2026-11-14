# Rabisco City, etapa 4: Andar

![A etapa 4 rodando](docs/etapa.gif)

**O que entra nesta etapa:** menu, mouse preso, olhar em volta, WASD, correr e pular.

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

Aparecem o estado do jogador (posição, velocidade, pra onde olha), a leitura do teclado e do mouse, e a função `update`, que move o jogador um pouquinho a cada quadro. Ainda dá pra atravessar parede.

O `js/game.js` é dividido em seções marcadas com `// ---------- nome ----------`.

## O que mudou desde a etapa anterior

```bash
git diff etapa-03-a-cidade etapa-04-andar
```

## Etapas

Anterior: `etapa-03-a-cidade` · Próxima: `etapa-05-colisao`

```bash
git checkout etapa-05-colisao
```

A lista completa das etapas está no README da branch `etapa-09-placar` e da `main`.
