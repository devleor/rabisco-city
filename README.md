# Rabisco City, etapa 8: Inimigos e ondas

![A etapa 8 rodando](docs/etapa.gif)

**O que entra nesta etapa:** bonecos de palito, caixas de acerto, ondas, vida, pontos e fim de jogo.

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

Os bonecos são feitos de cilindros e bolinhas, e têm caixas invisíveis de acerto (corpo e cabeça) que o raio do tiro encontra. As ondas, a vida e os pontos entram no HUD.

O `js/game.js` é dividido em seções marcadas com `// ---------- nome ----------`.

## O que mudou desde a etapa anterior

```bash
git diff etapa-07-som etapa-08-inimigos-e-ondas
```

## Etapas

Anterior: `etapa-07-som` · Próxima: `etapa-09-placar`

```bash
git checkout etapa-09-placar
```

A lista completa das etapas está no README da branch `etapa-09-placar` e da `main`.
