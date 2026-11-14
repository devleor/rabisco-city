# Rabisco City

Tiro em primeira pessoa 3D no navegador, todo desenhado à caneta numa folha de caderno.
Bonecos de palito invadem uma cidade debaixo de uma cúpula — sobreviva às ondas.

Feito com **Three.js (r128)** + JavaScript puro. Sem build, sem dependências locais.

## Rodar localmente

Qualquer servidor estático serve:

```bash
npx serve .
# ou
python3 -m http.server 8000
```

Abra `http://localhost:8000` (ou a porta que aparecer). Precisa de teclado e mouse.

## Deploy na Vercel

1. Importe este repositório em [vercel.com/new](https://vercel.com/new).
2. Framework preset: **Other**. Sem build command, output directory = raiz (`.`).
3. Deploy. A Vercel serve o `index.html` direto.

## Controles

| Tecla | Ação |
| --- | --- |
| WASD | andar |
| Shift | correr |
| Espaço | pular / turbo de gás no gancho |
| Mouse | mirar · clique atira |
| Botão direito | mira (red dot na UZI, massa na AK e pistola, luneta na sniper) |
| E (segurar) | gancho estilo equipamento de manobra |
| 1 a 7 / rodinha / Q | trocar arma |
| R | recarregar |
| Esc | pausa |

## Armas

UZI · AK-47 · Pistola · Escopeta · Sniper (atravessa inimigos) · Bazuca (explosão em área, destrói o cenário, dá pra fazer rocket jump) · Régua (corpo a corpo, mais forte voando no gancho).

## Cenário destrutível

Os prédios são feitos de andares empilhados. A explosão da bazuca destrói andares, caixas, muros e postes; o que fica sem apoio desaba e esmaga os bonecos que estiverem embaixo. O cenário volta ao normal quando a partida recomeça.

## Estrutura

```
index.html      HUD, menu e carregamento do Three.js
css/style.css   visual do HUD e da folha de caderno
js/game.js      o jogo inteiro (mundo, armas, inimigos, gancho, som)
```

Dentro do `js/game.js` as seções estão marcadas com comentários `// ---------- nome ----------`
(renderer, texturas, mundo, cúpula, luz, colisão, som, armas, inimigos, tiro, update, loop).

## Ideias para multiplayer

A Vercel hospeda bem a parte estática, mas funções serverless não mantêm conexões WebSocket abertas.
Para jogar em tempo real dá pra:

- **Servidor de jogo separado**: Node com [Colyseus](https://colyseus.io) ou Socket.IO hospedado em Fly.io, Railway ou Render; o front continua na Vercel.
- **Serviço de tempo real gerenciado**: PartyKit, Ably, Liveblocks ou Supabase Realtime (cliente conecta direto, sem servidor próprio).

Passos sugeridos no código:

1. Separar o estado do jogador (`P`) e enviar posição/rotação/arma ~20x por segundo.
2. Desenhar os outros jogadores como bonecos de palito (reaproveitar `makeEnemy` sem IA).
3. Deixar o servidor ser a autoridade das ondas e do dano dos inimigos.
