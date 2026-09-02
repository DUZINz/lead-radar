# Lead Radar

Plataforma de inteligência e mineração de leads B2B — **base 100% real** (OpenStreetMap), sem dados fictícios.
Encontra e qualifica empresas
para venda de software sob medida, ERP enxuto, automação com IA, apps, APIs e plataformas web.

**Zero dependências.** Só stdlib do Node (`node:http`, `node:sqlite`) + HTML/CSS/JS puro.

## Rodar

```bash
npm start          # ou: node server.mjs
# http://localhost:5173   (PORT=8080 node server.mjs para trocar a porta)
npm test           # self-check do motor de oportunidade
```

## Deploy na Vercel

```bash
npx vercel          # preview
npx vercel --prod   # produção
```

Ou conecte o repositório no painel da Vercel — não há build step, é zero-config:

- `public/` é servido como estático (é o output directory padrão quando existe).
- `api/index.mjs` é a Serverless Function; o `rewrite` do `vercel.json` manda todo `/api/*` para ela,
  que apenas reexporta o handler de `server.mjs` — mesmo código do local, sem duplicação.
- `includeFiles: leads.json` mantém a semente (vazia) dentro do bundle da function.
- `maxDuration: 60` porque a mineração leva de 7s a 30s (Overpass + teste de sites).

**Persistência lá é outra:** o filesystem é read-only e cada invocação pode cair numa instância nova,
então `server.mjs` detecta `process.env.VERCEL` e troca o SQLite por um store vazio — nenhum
`import` de `node:sqlite` acontece. Quem guarda o estado é o navegador:

| Dado | Local | Vercel |
|---|---|---|
| Status de prospecção | SQLite + localStorage | localStorage |
| Leads minerados | SQLite + localStorage | localStorage |
| Leads descartados | SQLite + localStorage | localStorage |
| Scoring e mineração | stateless | stateless |

Por isso o filtro, o CSV e os KPIs são calculados no cliente: o servidor não enxerga o que está no
navegador. O botão **🧹 Limpar dados locais** zera esse estado.

`npm test` cobre os dois caminhos: `test_score.mjs` (motor) e `test_serverless.mjs` (a function
importa, responde e não toca em disco).

## Arquivos

| Arquivo | O quê |
|---|---|
| `server.mjs` | handler HTTP + motor de scoring + mineração; servidor local ou function na Vercel |
| `copy.mjs` | Copy comercial: gancho curto (<250 chars) + follow-up com portfólio e preço — edite aqui, não no motor |
| `api/index.mjs` | Serverless Function da Vercel — reexporta o handler |
| `vercel.json` | rewrite `/api/*` → function, `maxDuration`, `includeFiles` |
| `leads.json` | Semente vazia (`[]`) — a base é 100% real, vinda da mineração |
| `public/index.html` | UI dark-tech completa (dashboard, tabela, filtros, Raio-X, exportação); vira cards no mobile |
| `leadradar.db` | SQLite criado no primeiro run: status de prospecção + histórico de buscas |

## API

| Rota | O quê |
|---|---|
| `GET /api/leads?nicho=&pais=&uf=&cidade=&porte=&anos=&oferta=&prioridade=&status=&q=` | leads enriquecidos + facetas; grava a busca no histórico |
| `POST /api/status` `{cnpj,status,nota}` | marca status (`novo\|contatado\|reuniao\|proposta\|ganho\|perdido`) |
| `POST /api/excluir` `{cnpjs:[...]}` | descarta leads (1 ou em lote) — some da tabela, dos KPIs e do CSV |
| `POST /api/restaurar` `{cnpjs:[...]}` | desfaz a exclusão |
| `GET /api/lixeira` | o que foi descartado, com data |
| `GET /api/export.csv?<mesmos filtros>` | CSV com BOM e `;` — abre direto no Excel PT-BR |
| `POST /api/minerar` `{nicho,pais,escopo,estado,cidade,quantidade,apenas_whatsapp,offset}` | **mineração real** — `pais` ∈ BR/US/PT/GB/IT, `escopo` ∈ cidade/estado/pais. Devolve `analisados` (funil), `proximo_offset`, `esgotado` e `disponiveis` (paginação) |
| `GET /api/historico` | últimas 20 buscas |

## Mineração de leads reais

Botão **🚀 Minerar Leads Reais** no topo da tela. Sem API paga, sem chave:

1. **Overpass / OpenStreetMap** — busca estabelecimentos ativos por segmento dentro da área escolhida:
   **uma cidade**, **um estado/região inteiro** ou **o país inteiro** (`escopo`). A área é sempre
   resolvida de fora pra dentro (país → estado → cidade), então cidade homônima em outro estado não entra.
   Não existe `admin_level` padrão no OSM — município é 8 no Brasil, concelho é 7 em Portugal, cidade
   inglesa pode ser 8 ou 6 —, por isso `PAISES` guarda uma *lista* de níveis por país e a consulta cai
   pro próximo quando a área não resolve. Traz nome, telefone, site, endereço, bairro e horário reais.
2. **Ranking de contato** — quem tem telefone/site/endereço vem primeiro, desempate por id do OSM.
   O teto de candidatos é fixo (400, ou 800 com WhatsApp) justamente para a fila ser idêntica entre
   duas execuções da mesma busca — é o que faz o offset significar alguma coisa.
   Com **📱 Apenas empresas com WhatsApp** (ligado por padrão) mantém só celular válido — e a regra
   é a do país (BR: DDD + 9 dígitos começando em 9; PT: 9xxxxxxxx; GB: 07xxx; IT: 3xx; US: qualquer
   número de 10 dígitos, porque lá não existe faixa de celular separada do fixo).
   Celular é tag rara no OSM: espere de 0 a 5 leads a cada 30-100
   estabelecimentos analisados — a maioria publica só fixo. O modal mostra esse funil e sugere
   desmarcar a opção quando o resultado vem vazio.
3. **Paginação (offset)** — minerar a mesma cidade+segmento de novo continua da página seguinte em vez
   de devolver sempre o mesmo topo do ranking. O cursor é do navegador (`lr.offsets`, por
   `pais|escopo|nicho|cidade|estado|apenas_whatsapp`): o servidor recebe `offset` e devolve `proximo_offset`,
   `esgotado` e `disponiveis`. Quando a varredura fecha, o cursor zera e a próxima recomeça do
   início — a deduplicação segura o que já está na base.
4. **Verificador de site ao vivo** — `fetch` com timeout de 3s, **duas tentativas** antes de sentenciar:
   `< 1s` = moderno, `< 2,5s` = lento, erro/timeout nas duas = defasado, DNS morto ou sem site = nenhum.
   HTTP 401/403/405/406/429/503 = **protegido** (Cloudflare/anti-bot: o site está de pé, só não deixa medir)
   — nunca vira "seu site está defasado" no gancho, e não pontua como site problemático.
   Perfil de rede social **não** conta como site.
5. **Scoring** — `enriquecer()` define oferta, prioridade, motivos e gancho.
6. **Persistência** — tabela `minerados` (chave = telefone, ou nome+cidade), sem duplicar, e os leads voltam
   para a memória no próximo boot.

20 segmentos disponíveis (clínicas, odontologia, imobiliárias, advocacia, contabilidade, restaurantes,
auto peças, oficinas, varejo, academias, escolas, hotéis, seguros…) × 5 países:
**Brasil** (27 UFs), **Estados Unidos** (51), **Portugal** (20 distritos), **Inglaterra** (9 regiões)
e **Itália** (20 regiões) — cada um em cidade, estado/região ou país inteiro.

**A mensagem sai no idioma do país minerado**: gancho e follow-up têm versão em português, inglês e
italiano (`copy.mjs`), escolhidas pelo campo `idioma` do lead. Lead antigo, sem o campo, continua em pt.
O link do WhatsApp vem pronto do servidor em E.164 (`whatsapp_e164`), com o DDI do país.

**País inteiro é varredura estado a estado**, não uma consulta nacional: a base pública não termina
uma varredura de país para segmento pesado (academias nos EUA = 50k+ POIs, a consulta estoura).
O servidor percorre a lista de estados do país na ordem, para quando a página enche, e o cursor
guarda em que estado continuar — cada mineração segue de onde a anterior parou até fechar o país.
Estado grande demais para o segmento (restaurantes na Califórnia) é pulado e reportado, não derruba
a busca. Orçamento de tempo: 25s na Vercel (a function morre em 60s), 90s local.

Órgão público (UBS, prefeitura, city hall, comune, NHS, site `.gov`) é descartado — não é lead B2B.
O município é gravado com o nome canônico do OSM, então digitar "Florianopolis" não cria uma cidade
separada de "Florianópolis". Em busca por estado/país a cidade vem do endereço do próprio lead
(`addr:city`) e pode vir vazia — o OSM nem sempre traz.

Lead minerado não tem CNPJ/porte/abertura no cadastro público: `anos` fica `null` e `porte` = `N/D`.
Filtro de idade nunca o esconde. A prioridade Alta exige WhatsApp válido mais dois vetores fortes
simultâneos, já que ele não expõe sistemas nem quadro interno.

## Motor de oportunidade

Cada empresa é pontuada em 5 ofertas; a de maior score vira a tag sugerida e gera o gancho de abordagem.

| Oferta | Sinais |
|---|---|
| 💡 Sistema de Gestão / ERP Enxuto | planilha/papel na operação, 20+ funcionários, nicho operacional, multi-unidade |
| 🤖 Automação & Atendimento IA | volume de atendimento alto, WhatsApp, audiência grande, nicho de pré-venda intensiva |
| 📱 App / Área do Cliente | base recorrente, audiência engajada, nicho de relacionamento contínuo |
| 🔗 Integração de APIs / Migração | 3+ sistemas desconectados, stack fragmentada, legado |
| ⚡ Plataforma Web / Redesign | sem site, site defasado ou lento, audiência sem casa própria |

Prioridade: **Alta** = **WhatsApp válido** (celular, não fixo) **+** empresa com 1+ ano (quando a idade é
conhecida) **+** score ≥ 50, ou ≥ 40 com duas ofertas ≥ 35 · **Média** = score ≥ 35 · **Baixa** = resto.

O gate de canal é o que segura a faixa: Alta significa *acionável agora*, não "interessante". Sem celular
não dá pra disparar, então é pesquisa. Os limiares vivem em `const ALTA` no `server.mjs` — **um lugar só**.
Calibrados sobre a base real minerada para ficar em **~20%** (antes eram 48%, metade da lista vermelha).
Recalibre ali se o perfil da base mudar; `test_score.mjs` trava o contrato "sem WhatsApp não é Alta".

## Abordagem: 1ª mensagem curta, prova na 2ª

O **gancho** (`GANCHOS` em `copy.mjs`) é o que vai no `?text=` do WhatsApp e tem 3 blocos, **< 250
caracteres**: apresentação, uma observação concreta sobre o negócio dele, e uma pergunta aberta.
Sem link, sem tabela de preços, sem pitch — mil caracteres com link na primeira mensagem para um
estranho é bloqueio (e risco de ban do número).

Portfólio e tabela de preços vivem no **follow-up** (`FOLLOWUPS`), a segunda mensagem, enviada quando
o lead responde. O limite de 250 e a ausência de link/preço são testados em `test_score.mjs`.

O `name` do OSM vem com emoji e keyword stuffing de SEO local
(`👨‍⚕️ Dr Carlos Dalmaso | Telemedicina - Check up | Clínico Geral em Curitiba`, 90 chars). A função
`curto()` limpa isso antes de escrever qualquer mensagem — copiar o cadastro cru denuncia disparo automático.

## Exclusão de leads

Ícone 🗑 na linha, botão **Excluir lead** no Raio-X, ou **🗑 Excluir selecionados** para o lote.
Nada é apagado de verdade: o CNPJ vai para a tabela `descartados` e o lead some da tabela, dos KPIs
e do CSV. Aparece um **desfazer** por 20s logo depois. Para limpar a lixeira inteira de uma vez:
`DELETE FROM descartados` no `leadradar.db` (ou `POST /api/restaurar` com os CNPJs).

Lead minerado descartado não volta numa nova mineração do mesmo segmento — ele continua na memória
como já conhecido, então a deduplicação não o traz de novo.

## Próximo passo: dados cadastrais

A mineração real já roda em `/api/minerar` (OpenStreetMap). O que falta no cadastro público de POIs é
CNPJ, porte, data de abertura e CNAE oficial — dá para cruzar nome/endereço com a BrasilAPI
(`/api/cnpj/v1/{cnpj}`) ou o dump público de CNPJ da Receita Federal e preencher esses campos.
O motor de scoring e a UI não mudam: é só completar o objeto do lead.
