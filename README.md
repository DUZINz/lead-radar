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
| `GET /api/export.csv?<mesmos filtros>` | CSV com BOM e `;` — abre direto no Excel PT-BR |
| `GET /api/historico` | últimas 20 buscas |

## Motor de oportunidade

Cada empresa é pontuada em 5 ofertas; a de maior score vira a tag sugerida e gera o gancho de abordagem.

| Oferta | Sinais |
|---|---|
| 💡 Sistema de Gestão / ERP Enxuto | planilha/papel na operação, 20+ funcionários, nicho operacional, multi-unidade |
| 🤖 Automação & Atendimento IA | volume de atendimento alto, WhatsApp, audiência grande, nicho de pré-venda intensiva |
| 📱 App / Área do Cliente | base recorrente, audiência engajada, nicho de relacionamento contínuo |
| 🔗 Integração de APIs / Migração | 3+ sistemas desconectados, stack fragmentada, legado |
| ⚡ Plataforma Web / Redesign | sem site, site defasado ou lento, audiência sem casa própria |

Prioridade: **Alta** = score ≥ 55 e 1+ ano de mercado · **Média** = score ≥ 35 · **Baixa** = resto.

## Trocar o mock por dados reais

`leads.json` é a única fonte. Para minerar de verdade, escreva um script que gere esse mesmo
formato a partir de: ReceitaWS / BrasilAPI (`/api/cnpj/v1/{cnpj}`) ou o dump público de CNPJ da
Receita Federal para cadastro/CNAE/porte/abertura, Google Places para telefone e site, e um
`fetch` no site para medir `site_status`. O motor de scoring e a UI não mudam.
