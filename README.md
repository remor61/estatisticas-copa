# ⚽ Estatísticas da Copa 2026

Site de apoio para o bolão de palpites da Copa do Mundo 2026. Mostra, para cada
jogo, as estatísticas que importam na hora do palpite:

- **Todos os 104 jogos** da Copa, com horário local, fase/grupo e **odds decimais 1X2**
  nos jogos ainda não disputados
- **Últimos 10 jogos** de cada seleção: resultado, gols feitos/sofridos e **posse de bola**,
  com médias
- **Confrontos diretos** entre as duas seleções
- **Jogos contra times de nível parecido**: partidas desde jan/2024 ou na Copa de 2022
  contra seleções próximas do adversário no ranking FIFA (janela ajustável ±N)
- Todo jogo listado tem **link direto para a página dele no Sofascore**

## Como funciona

Site 100% estático (React + Vite). Os dados vêm da API pública do Sofascore,
chamada direto do navegador — sem backend, sem chave de API, sem custo.
As respostas ficam em cache no `localStorage` (estatísticas de jogos encerrados
ficam guardadas por 30 dias; odds, 30 minutos).

O ranking FIFA masculino também vem do Sofascore (`rankings/type/2`), já com os
ids de time compatíveis.

## Rodando localmente

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
```

Compila o site e publica a pasta `dist` na branch `gh-pages`, servida pelo
GitHub Pages. Só é preciso rodar quando o **código** mudar — os dados vêm do
Sofascore em tempo real, direto do navegador de quem acessa.
O `base` do Vite está fixo em `/estatisticas-copa/` — se o repositório mudar de
nome, ajuste em [vite.config.ts](vite.config.ts).

## Aviso

A API do Sofascore é pública porém não documentada — se algum endpoint mudar,
o ajuste fica concentrado em [src/api/sofascore.ts](src/api/sofascore.ts).
