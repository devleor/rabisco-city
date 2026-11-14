# Rabisco City

Tiro em primeira pessoa 3D no navegador, todo desenhado à caneta numa folha de caderno.
Bonecos de palito invadem uma cidade debaixo de uma cúpula — sobreviva às ondas.

Feito com **Three.js (r128)** + JavaScript puro. Sem build. O jogo e o servidor local não têm dependências; só a API na Vercel usa o pacote `@vercel/blob`.

## Rodar localmente

```bash
node server.js
```

Abra `http://localhost:3333`. Precisa de teclado e mouse. O `server.js` não tem dependências: ele entrega os arquivos do jogo e responde a API do placar, guardando os dados em `dados/placar.json`.

Qualquer servidor estático (`npx serve .`, `python3 -m http.server`) também abre o jogo, só que sem placar.

## Placar

No ar em **https://rabisco-city.vercel.app**.

| Pedido | O que faz |
| --- | --- |
| `GET /api/placar` | devolve os 10 melhores, em JSON |
| `GET /api/partida` | começou uma partida: devolve um bilhete assinado |
| `POST /api/placar` | guarda `{ "nome", "pontos", "onda", "bilhete" }` |

O jogo roda no navegador, então nada escrito no `game.js` é segredo. Por isso não existe uma chave de API dentro do jogo. O segredo fica só no servidor: quando a partida começa ele sorteia um UUID pra ela e devolve um bilhete (o UUID, a hora e uma assinatura HMAC). O `POST` só é aceito com um bilhete verdadeiro e com menos de duas horas (`401` sem ele), que ainda não foi usado (`409`) e com uma pontuação que cabe no tempo que a partida durou (`422`).

O que isso barra e o que não barra:

- Barra o `POST` feito na mão sem bilhete, o bilhete inventado ou alterado, o mesmo bilhete enviado duas vezes e o número absurdo.
- Uma partida que fica aberta (ou pausada) por mais de duas horas perde o bilhete, e a pontuação dela não entra.
- Não barra quem pede um bilhete, espera um tempo e envia uma pontuação que caberia nesse tempo, nem quem altera o jogo no próprio navegador. A conta do tempo é folgada (uns 150 pontos por segundo). Pra barrar isso o servidor teria que simular a partida, e o `GET /api/partida` teria que ter limite de pedidos.

As regras ficam em `lib/placar.js` e valem nos dois lugares:

- `server.js`: no seu computador, os dados ficam num arquivo do disco. Ele só atende o próprio computador (`127.0.0.1`); pra liberar na rede, `HOST=0.0.0.0 node server.js`.
- `api/placar.js` e `api/partida.js`: na Vercel, onde o código não tem disco próprio, os dados ficam no Vercel Blob.

O que fica guardado é um JSON com as 100 melhores linhas e os bilhetes já usados: `{ "linhas": [...], "usados": {...} }`.

## Deploy na Vercel

1. `vercel link` na pasta do projeto (o `vercel.json` já diz que é um site estático com a pasta `api/`).
2. `vercel blob create-store rabisco-placar --access private --yes` cria o lugar do `placar.json` e liga ao projeto.
3. Crie a variável de ambiente `PLACAR_SEGREDO` com um texto longo e aleatório: `vercel env add PLACAR_SEGREDO production --sensitive`.
4. `vercel deploy --prod`.

## Controles

| Tecla | Ação |
| --- | --- |
| WASD | andar |
| Shift | correr |
| Espaço | pular / turbo de gás no gancho |
| Mouse | mirar · clique atira |
| Botão direito | mira (red dot na UZI, massa na AK e pistola, luneta na sniper) |
| E (segurar) | gancho estilo equipamento de manobra |
| 1 / 2 / 3 | arma principal · pistola · régua (rodinha / Q também) |
| B | loja (entre as ondas e nos primeiros 20s de cada onda) |
| G | larga a arma no chão |
| F | pega/troca pela arma do chão |
| R | recarregar |
| Esc | pausa |

## Feed de abates

Cada boneco nasce com um nome (`BOT Zé`, `BOT Borrão`...). Quando alguém é apagado, aparece uma linha no canto de cima, como no CS: quem apagou, a arma, e quem foi apagado. Tiro na cabeça ganha uma marca, e a linha dos seus abates tem a borda vermelha. Quando é um bot que apaga você, a linha mostra o nome dele e o golpe (`SOCO`, `PANCADA`, `CUSPE`).

## Mira

Quatro riscos em cruz, como no CS. O vão no meio mostra o quanto o tiro vai espalhar: abre quando você anda, pula ou atira, e fecha quando você para ou mira com o botão direito. A conta é a mesma que o tiro usa.

## Bonecos que escalam

Subir num prédio não salva mais ninguém. Quando você está em cima de um prédio, os bonecos que chegam na parede dele sobem com pés e mãos, pulam pra cima do teto e continuam atrás de você. Se você desce, eles param de escalar e voltam a desviar dos prédios como sempre. Quem cospe não escala: fica no chão, cuspindo pra cima.

## Armas

UZI · AK-47 · Pistola · Escopeta · Sniper (atravessa inimigos) · Bazuca (explosão em área, destrói o cenário, dá pra fazer rocket jump) · Régua (corpo a corpo, mais forte voando no gancho).

## Loja (estilo CS)

Você começa com pistola, régua e $800. Cada boneco apagado dá dinheiro (grandão dá mais, tiro na cabeça dá bônus) e cada onda limpa dá $1000 + $250 por onda.
Com **B** abre a loja: UZI, escopeta, AK-47, sniper, bazuca, munição, kit de vida, colete e pistola.
Só cabe uma arma principal: ao comprar outra, a atual cai no chão (dá pra pegar de volta com **F**).

## Dia e noite

A hora avança com as ondas: dia → pôr do sol → noite → noite → amanhecer.
À noite a folha vira azul-marinho com traço claro (tipo planta baixa), aparecem lua e estrelas, os postes iluminam mais e uma lanterna marca onde você mira.

## Cenário destrutível

Os prédios são feitos de andares empilhados. A explosão da bazuca destrói andares, caixas, muros e postes; o que fica sem apoio desaba e esmaga os bonecos que estiverem embaixo. O cenário volta ao normal quando a partida recomeça.

## Estrutura

```
index.html      HUD, menu e carregamento do Three.js
css/style.css   visual do HUD e da folha de caderno
js/game.js      o jogo inteiro (mundo, armas, inimigos, gancho, som, placar)
js/abates.js    o feed de abates no canto: quem apagou quem, e com qual arma
js/mira.js      o tamanho do vão da mira e o espalhamento do tiro
js/escalada.js  em cima de qual prédio o jogador está (é o que faz os bonecos escalarem)
lib/placar.js   as regras do placar (conferir, ordenar, bilhete assinado)
server.js       servidor local: arquivos do jogo + API do placar num arquivo JSON
api/            a mesma API na Vercel, guardando o JSON no Blob
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
