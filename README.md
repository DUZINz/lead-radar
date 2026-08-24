# Lead Radar

Plataforma de inteligência e mineração de leads B2B — encontra e qualifica empresas
para venda de software sob medida, ERP enxuto, automação com IA, apps, APIs e plataformas web.

**Zero dependências.** Só stdlib do Node (`node:http`, `node:sqlite`) + HTML/CSS/JS puro.

## Rodar

```bash
npm start          # ou: node server.mjs
# http://localhost:5173   (PORT=8080 node server.mjs para trocar a porta)
npm test           # self-check do motor de oportunidade
```

## Arquivos

| Arquivo | O quê |
|---|---|
| `server.mjs` | HTTP + motor de oportunidade (scoring) + persistência SQLite |
| `leads.json` | Base minerada (33 empresas mock, 12 nichos, dados de CNPJ/CNAE/presença digital) |
| `public/index.html` | UI dark-tech completa (dashboard, tabela, filtros, Raio-X, exportação) |
| `leadradar.db` | SQLite criado no primeiro run: status de prospecção + histórico de buscas |

## API

| Rota | O quê |
|---|---|
| `GET /api/leads?nicho=&uf=&cidade=&porte=&anos=&oferta=&prioridade=&status=&q=` | leads enriquecidos + facetas; grava a busca no histórico |
| `POST /api/status` `{cnpj,status,nota}` | marca status (`novo\|contatado\|reuniao\|proposta\|ganho\|perdido`) |
| `POST /api/excluir` `{cnpjs:[...]}` | descarta leads (1 ou em lote) — some da tabela, dos KPIs e do CSV |
| `POST /api/restaurar` `{cnpjs:[...]}` | desfaz a exclusão |
| `GET /api/lixeira` | o que foi descartado, com data |
| `GET /api/export.csv?<mesmos filtros>` | CSV com BOM e `;` — abre direto no Excel PT-BR |
| `POST /api/minerar` `{nicho,cidade,uf,quantidade}` | **mineração real** — ver abaixo |
| `GET /api/historico` | últimas 20 buscas |

## Mineração de leads reais

Botão **🚀 Minerar Leads Reais** no topo da tela. Sem API paga, sem chave:

1. **Overpass / OpenStreetMap** — busca estabelecimentos ativos por segmento dentro do município
   (`area[admin_level=8]` dentro de `area[admin_level=4]`, então cidade homônima em outro estado não entra).
   Traz nome, telefone, site, endereço, bairro e horário reais do cadastro público.
2. **Ranking de contato** — quem tem telefone/site/endereço vem primeiro; busca 6× o pedido e corta no topo.
3. **Verificador de site ao vivo** — `fetch` com timeout de 3s: `< 1s` = moderno, `< 2,5s` = lento,
   erro/HTTP ruim/timeout = defasado, DNS morto ou sem site = nenhum. Perfil de rede social **não** conta como site.
4. **Scoring** — o mesmo `enriquecer()` dos mocks define oferta, prioridade e gancho.
5. **Persistência** — tabela `minerados` (chave = telefone, ou nome+cidade), sem duplicar, e os leads voltam
   para a memória no próximo boot.

20 segmentos disponíveis (clínicas, odontologia, imobiliárias, advocacia, contabilidade, restaurantes,
auto peças, oficinas, varejo, academias, escolas, hotéis, seguros…) × 27 UFs.

Lead minerado não tem CNPJ/porte/abertura no cadastro público: `anos` fica `null`, `porte` = `N/D`
e o filtro "1+ ano" o exclui. A prioridade Alta é alcançada por dois vetores fortes simultâneos,
já que ele não expõe sistemas nem quadro interno.

## Motor de oportunidade

Cada empresa é pontuada em 5 ofertas; a de maior score vira a tag sugerida e gera o gancho de abordagem.

| Oferta | Sinais |
|---|---|
| 💡 Sistema de Gestão / ERP Enxuto | planilha/papel na operação, 20+ funcionários, nicho operacional, multi-unidade |
| 🤖 Automação & Atendimento IA | volume de atendimento alto, WhatsApp, audiência grande, nicho de pré-venda intensiva |
| 📱 App / Área do Cliente | base recorrente, audiência engajada, nicho de relacionamento contínuo |
| 🔗 Integração de APIs / Migração | 3+ sistemas desconectados, stack fragmentada, legado |
| ⚡ Plataforma Web / Redesign | sem site, site defasado ou lento, audiência sem casa própria |

Prioridade: **Alta** = score ≥ 55, ou ≥ 45 com duas ofertas ≥ 40 (e empresa com 1+ ano, quando a idade é
conhecida) · **Média** = score ≥ 35 · **Baixa** = resto.

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
