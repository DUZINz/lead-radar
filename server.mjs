// Lead Radar — servidor + motor de oportunidade. Zero dependencias: so stdlib do Node 24.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;

const db = new DatabaseSync(join(DIR, 'leadradar.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS status (
    cnpj TEXT PRIMARY KEY, status TEXT NOT NULL, nota TEXT DEFAULT '', atualizado_em TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS buscas (
    id INTEGER PRIMARY KEY AUTOINCREMENT, filtros TEXT, resultados INTEGER, criado_em TEXT);
`);

const LEADS = JSON.parse(await readFile(join(DIR, 'leads.json'), 'utf8'));

// ---------------- motor de oportunidade ----------------

const OFERTAS = {
  erp:    { tag: '💡 Sistema de Gestão / ERP Enxuto',
            gancho: (l) => `Vi que a ${l.nome} opera com ${l.sistemas.join(', ')}. Em operação de ${l.funcionarios} pessoas${l.unidades > 1 ? ` e ${l.unidades} unidades` : ''} isso costuma custar horas de retrabalho por semana. Montamos um sistema de gestão enxuto, só com o que vocês usam de verdade — sem pagar por módulo que ninguém abre. Faz sentido eu te mostrar em 15 min como ficaria o fluxo de vocês?` },
  ia:     { tag: '🤖 Automação & Atendimento IA',
            gancho: (l) => `A ${l.nome} tem volume de contato ${l.volume_atendimento} e atende ${l.whatsapp ? 'pelo WhatsApp' : 'por telefone e e-mail'}. ${l.obs} Dá pra colocar um agente de IA respondendo, qualificando e agendando 24h — e passando pro humano só o que vale. Te mostro rodando com o cenário de vocês?` },
  mobile: { tag: '📱 Aplicativo Mobile / Área do Cliente',
            gancho: (l) => `A ${l.nome} tem base recorrente${l.seguidores ? ` e ${l.seguidores.toLocaleString('pt-BR')} seguidores no Instagram` : ''}. Hoje o cliente precisa ligar ou mandar mensagem pra qualquer coisa. Uma área do cliente / app resolve 2ª via, agendamento e histórico sozinho. Posso te mandar um protótipo com a marca de vocês?` },
  api:    { tag: '🔗 Integração de APIs / Migração de Dados',
            gancho: (l) => `Contei ${l.sistemas.length} sistemas na ${l.nome}: ${l.sistemas.join(', ')}. Onde não tem integração, alguém está digitando o mesmo dado duas vezes. Fazemos a ponte via API e a migração sem parar a operação. Vale uma conversa de 15 min pra mapear onde está o retrabalho?` },
  web:    { tag: '⚡ Plataforma Web / Redesign de Alta Performance',
            gancho: (l) => `${l.site ? `O site da ${l.nome} está ${l.site_status} — e site lento/antigo derruba conversão e ranqueamento.` : `A ${l.nome} não tem site próprio, só ${l.instagram || 'telefone e WhatsApp'}.`} Entregamos uma plataforma rápida, indexável e com captação de lead integrada. Te mando um comparativo de velocidade do site atual?` },
};

const OP_NICHO = {
  erp:    ['saude', 'juridico', 'logistica', 'industria', 'construcao', 'servicos', 'educacao'],
  ia:     ['varejo', 'imobiliario', 'financeiro', 'turismo', 'alimentacao', 'saude'],
  mobile: ['saude', 'educacao', 'servicos', 'alimentacao', 'financeiro'],
};
const MANUAL = /planilha|papel|caderno|ficha|bloquinho|manual|à mão|a mão/i;
const LEGADO = /legado|antigo|própri[oa] antig/i;
const DUPLO = /digitad|duas vezes|entre canais|conferid[oa] manualmente|sem integração/i;
const BASE = /assinante|mensalista|aluno|apólice|contrato|cliente[s]? (ativo|fixo|recorrente)|carteira|2ª via/i;
const VITRINE = ['imobiliario', 'varejo', 'turismo', 'alimentacao', 'construcao'];
const CONVERSAO = /conversão|SEO|OTA|marketplace|catálogo|e-commerce|comissão|iFood|Booking|direct/i;

function pontuar(l) {
  const texto = [...l.sistemas, l.obs].join(' ');
  const s = {
    erp: [
      [MANUAL.test(texto), 25, 'Controla operação em planilha/papel'],
      [l.funcionarios >= 20, 15, `${l.funcionarios} funcionários — operação já pesada pra planilha`],
      [OP_NICHO.erp.includes(l.nicho), 10, 'Nicho de processo operacional complexo'],
      [l.unidades > 1, 10, `${l.unidades} unidades para consolidar`],
    ],
    ia: [
      [l.volume_atendimento === 'alto', 30, 'Alto volume de contato comercial/suporte'],
      [!!l.whatsapp, 10, 'Atende por WhatsApp (canal automatizável)'],
      [l.seguidores >= 10000, 10, `${l.seguidores.toLocaleString('pt-BR')} seguidores gerando demanda no direct`],
      [OP_NICHO.ia.includes(l.nicho), 10, 'Nicho com pré-venda intensiva'],
    ],
    mobile: [
      [l.recorrencia, 25, 'Base de clientes recorrente'],
      [BASE.test(texto), 15, 'Base nomeada (assinantes/alunos/contratos) para pôr num app'],
      [l.seguidores >= 5000, 15, 'Audiência própria já engajada'],
      [OP_NICHO.mobile.includes(l.nicho), 10, 'Nicho de relacionamento contínuo'],
      [l.funcionarios >= 10, 5, 'Porte suporta app próprio'],
    ],
    api: [
      [l.sistemas.length >= 3, 25, `${l.sistemas.length} sistemas sem integração aparente`],
      [l.sistemas.length >= 4, 15, 'Stack fragmentada (4+ ferramentas)'],
      [LEGADO.test(texto), 15, 'Sistema legado a integrar/migrar'],
      [DUPLO.test(texto), 15, 'Mesmo dado digitado em mais de um sistema'],
    ],
    web: [
      [l.site_status === 'nenhum', 35, 'Sem site próprio'],
      [l.site_status === 'defasado', 30, 'Site defasado'],
      [l.site_status === 'lento', 25, 'Site lento (perde conversão e SEO)'],
      [!l.site && l.seguidores >= 5000, 15, 'Audiência grande sem casa própria'],
      [l.site_status !== 'moderno' && VITRINE.includes(l.nicho), 10, 'Nicho de vitrine — site é o canal de venda'],
      [l.site_status !== 'moderno' && CONVERSAO.test(l.obs), 10, 'Depende de canal de terceiro / perde conversão'],
    ],
  };
  return Object.entries(s).map(([id, regras]) => {
    const hits = regras.filter(([ok]) => ok);
    return { id, tag: OFERTAS[id].tag, score: hits.reduce((a, [, p]) => a + p, 0), motivos: hits.map(([, , m]) => m) };
  }).filter((o) => o.score > 0).sort((a, b) => b.score - a.score);
}

const anosAtivo = (abertura) => (Date.now() - new Date(abertura)) / 31557600000;

export function enriquecer(l, status) {
  const ofertas = pontuar(l);
  const top = ofertas[0] ?? { id: 'web', tag: OFERTAS.web.tag, score: 0, motivos: [] };
  const anos = anosAtivo(l.abertura);
  const total = ofertas.reduce((a, o) => a + o.score, 0);
  return {
    ...l,
    anos: Math.floor(anos),
    oferta: top.id,
    oferta_tag: top.tag,
    score: top.score,
    score_total: total,
    motivos: top.motivos,
    ofertas,
    prioridade: top.score >= 55 && anos >= 1 ? 'Alta' : top.score >= 35 ? 'Média' : 'Baixa',
    gancho: OFERTAS[top.id].gancho(l),
    status: status ?? 'novo',
  };
}

// ---------------- consulta ----------------

function buscar(q) {
  const st = new Map(db.prepare('SELECT cnpj, status FROM status').all().map((r) => [r.cnpj, r.status]));
  const txt = (q.get('q') || '').toLowerCase().trim();
  return LEADS.map((l) => enriquecer(l, st.get(l.cnpj)))
    .filter((l) =>
      (!q.get('nicho') || l.nicho === q.get('nicho')) &&
      (!q.get('uf') || l.uf === q.get('uf')) &&
      (!q.get('cidade') || l.cidade === q.get('cidade')) &&
      (!q.get('porte') || l.porte === q.get('porte')) &&
      (!q.get('oferta') || l.oferta === q.get('oferta')) &&
      (!q.get('prioridade') || l.prioridade === q.get('prioridade')) &&
      (!q.get('status') || l.status === q.get('status')) &&
      l.anos >= Number(q.get('anos') || 0) &&
      (!txt || [l.nome, l.razao_social, l.cidade, l.cnae, l.obs].join(' ').toLowerCase().includes(txt)))
    .sort((a, b) => b.score - a.score || b.score_total - a.score_total);
}

const CSV_COLS = ['nome', 'razao_social', 'cnpj', 'nicho', 'cnae', 'cidade', 'uf', 'porte', 'anos',
  'telefone', 'whatsapp', 'email', 'site', 'site_status', 'instagram', 'funcionarios',
  'oferta_tag', 'score', 'prioridade', 'status', 'gancho'];

const csv = (rows) => '﻿' + [CSV_COLS.join(';'), ...rows.map((r) =>
  CSV_COLS.map((c) => `"${String(r[c] ?? '').replaceAll('"', '""')}"`).join(';'))].join('\r\n');

// ---------------- http ----------------

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const json = (res, data, code = 200) =>
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(data));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  try {
    if (req.method === 'GET' && p === '/api/leads') {
      const leads = buscar(url.searchParams);
      if ([...url.searchParams].length)
        db.prepare('INSERT INTO buscas (filtros, resultados, criado_em) VALUES (?, ?, ?)')
          .run(url.search.slice(1), leads.length, new Date().toISOString());
      return json(res, {
        total: leads.length,
        leads,
        facetas: {
          nichos: [...new Set(LEADS.map((l) => l.nicho))].sort(),
          ufs: [...new Set(LEADS.map((l) => l.uf))].sort(),
          cidades: [...new Set(LEADS.map((l) => l.cidade))].sort(),
        },
      });
    }
    if (req.method === 'POST' && p === '/api/status') {
      let raw = '';
      for await (const c of req) raw += c;
      const body = JSON.parse(raw || '{}');
      if (!body.cnpj || !['novo', 'contatado', 'reuniao', 'proposta', 'ganho', 'perdido'].includes(body.status))
        return json(res, { erro: 'cnpj e status válidos são obrigatórios' }, 400);
      db.prepare(`INSERT INTO status (cnpj, status, nota, atualizado_em) VALUES (?, ?, ?, ?)
                  ON CONFLICT(cnpj) DO UPDATE SET status=excluded.status, nota=excluded.nota, atualizado_em=excluded.atualizado_em`)
        .run(body.cnpj, body.status, body.nota ?? '', new Date().toISOString());
      return json(res, { ok: true });
    }
    if (req.method === 'GET' && p === '/api/historico')
      return json(res, db.prepare('SELECT * FROM buscas ORDER BY id DESC LIMIT 20').all());

    if (req.method === 'GET' && p === '/api/export.csv') {
      res.writeHead(200, {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="lead-radar-${new Date().toISOString().slice(0, 10)}.csv"`,
      });
      return res.end(csv(buscar(url.searchParams)));
    }

    const file = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
    if (file.includes('..')) return json(res, { erro: 'nope' }, 400);
    const body = await readFile(join(DIR, 'public', file));
    res.writeHead(200, { 'content-type': `${MIME[extname(file)] ?? 'application/octet-stream'}; charset=utf-8` }).end(body);
  } catch (e) {
    if (e.code === 'ENOENT') return json(res, { erro: 'não encontrado' }, 404);
    console.error(e);
    json(res, { erro: e.message }, 500);
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url))
  server.listen(PORT, () => console.log(`\n  Lead Radar rodando em http://localhost:${PORT}\n`));
