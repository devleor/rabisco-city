# Rabisco City, etapa 7: Som

**O que entra nesta etapa:** sons fabricados na hora com a Web Audio: tiro, impacto, passo e queda.

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

Não existe arquivo de áudio. Cada som é montado na hora com a Web Audio: um oscilador ou um ruído, com o volume caindo rápido. Som não aparece em GIF: rode a etapa pra ouvir.

O `js/game.js` é dividido em seções marcadas com `// ---------- nome ----------`.

## O que mudou desde a etapa anterior

```bash
git diff etapa-06-arma-e-tiro etapa-07-som
```

## Etapas

Anterior: `etapa-06-arma-e-tiro` · Próxima: `etapa-08-inimigos-e-ondas`

```bash
git checkout etapa-08-inimigos-e-ondas
```

A lista completa das etapas está no README da branch `etapa-09-placar` e da `main`.
