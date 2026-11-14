# Rabisco City, passo a passo

![A etapa 9 rodando](docs/etapa.gif)

Um jogo de tiro em primeira pessoa no navegador, desenhado à caneta numa folha de caderno.
Feito com **Three.js (r128)** e JavaScript puro: sem instalar biblioteca, sem etapa de build.

Este repositório guarda o jogo construído em etapas. Cada etapa é uma branch, e cada uma roda sozinha:

| Branch | O que entra |
| --- | --- |
| `etapa-00-jogo-da-velha` | antes de tudo: um jogo da velha em HTML, JavaScript e CSS |
| `etapa-01-a-folha` | a página, a cena, a câmera, o renderer, o chão e uma caixa |
| `etapa-02-traco-de-caneta` | texturas de hachura desenhadas em canvas e o contorno que "ferve" |
| `etapa-03-a-cidade` | ruas, quarteirões sorteados com semente, parque, andaime, lápis gigante e cúpula |
| `etapa-04-andar` | menu, mouse preso, olhar em volta, WASD, correr e pular |
| `etapa-05-colisao` | um colisor de caixa pra cada peça do mapa: parar na parede e subir em caixote |
| `etapa-06-arma-e-tiro` | a pistola numa cena própria, o tiro como um raio, pingos de tinta e coice |
| `etapa-07-som` | sons fabricados na hora com a Web Audio: tiro, impacto, passo e queda |
| `etapa-08-inimigos-e-ondas` | bonecos de palito, caixas de acerto, ondas, vida, pontos e fim de jogo |
| `etapa-09-placar` | uma API em Node que guarda o placar num arquivo JSON, e o jogo conversando com ela |
| `main` | o jogo completo: mais armas, gancho, loja, dia e noite, cenário destrutível |

Pra ir de uma etapa pra outra:

```bash
git checkout etapa-04-andar
```

Pra ver só o que mudou entre duas etapas:

```bash
git diff etapa-04-andar etapa-05-colisao
```

## Rodar

A porta é sempre a **3333**, em todas as etapas.

Até a etapa 8 o jogo é só arquivo parado: qualquer servidor de arquivos serve.

```bash
npx serve -l 3333 .
# ou
python -m http.server 3333
```

Da etapa 9 em diante o jogo tem um servidor próprio, que entrega os arquivos e responde o placar:

```bash
node server.js
```

Abra `http://localhost:3333`. Precisa de teclado e mouse.

## O placar (etapa 9)

O `server.js` não usa nenhuma dependência, só o que vem com o Node. Ele responde um endereço:

| Pedido | O que faz |
| --- | --- |
| `GET /api/placar` | devolve os 10 melhores, em JSON |
| `POST /api/placar` | recebe `{ "nome": "Leo", "pontos": 4200, "onda": 5 }` e guarda |

As pontuações ficam em `dados/placar.json`, um arquivo de texto fazendo o papel de banco de dados.
O arquivo fica fora do git: cada computador tem o seu placar.

## Estrutura

```
index.html      a página: o canvas, o HUD e o menu
css/style.css   a folha de caderno, o HUD e o cartão do menu
js/game.js      o jogo inteiro, em seções marcadas com  // ---------- nome ----------
server.js       o servidor: arquivos do jogo e a API do placar
```
