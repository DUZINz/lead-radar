// Lead Radar — servidor + motor de oportunidade. Zero dependencias: so stdlib do Node 24.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const SERVERLESS = !!process.env.VERCEL;   // Vercel: disco read-only e instância efêmera

// Local: SQLite de verdade. Serverless: store vazio — quem guarda status, minerados e
// descartados é o localStorage do navegador (o servidor lá é stateless por definição).
const db = SERVERLESS
  ? { exec: () => {}, prepare: () => ({ run: () => ({ changes: 0 }), all: () => [] }) }
  : new (await import('node:sqlite')).DatabaseSync(join(DIR, 'leadradar.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS status (
    cnpj TEXT PRIMARY KEY, status TEXT NOT NULL, nota TEXT DEFAULT '', atualizado_em TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS buscas (
    id INTEGER PRIMARY KEY AUTOINCREMENT, filtros TEXT, resultados INTEGER, criado_em TEXT);
  CREATE TABLE IF NOT EXISTS minerados (
    chave TEXT PRIMARY KEY, dados TEXT NOT NULL, criado_em TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS descartados (
    cnpj TEXT PRIMARY KEY, nome TEXT, descartado_em TEXT NOT NULL);
`);

// Base 100% real: sem mock. `leads.json` fica como semente opcional (vazia) e o que vale
// são os leads minerados persistidos no SQLite — que voltam pra memória no boot.
const LEADS = JSON.parse(await readFile(join(DIR, 'leads.json'), 'utf8').catch(() => '[]'));
LEADS.unshift(...db.prepare('SELECT dados FROM minerados ORDER BY criado_em DESC').all().map((r) => JSON.parse(r.dados)));
console.log(`base: ${LEADS.length} leads reais${SERVERLESS ? ' (serverless: estado vive no navegador)' : ''}`);

// ---------------- motor de oportunidade ----------------

const OFERTAS = {
  erp:    { tag: '💡 Sistema de Gestão / ERP Enxuto',
            gancho: (l) => `${l.sistemas.length ? `Vi que a ${l.nome} opera com ${l.sistemas.join(', ')}` : `Pelo que dá pra ver publicamente, a ${l.nome} não tem um sistema de gestão próprio`}. ${l.funcionarios ? `Em operação de ${l.funcionarios} pessoas${l.unidades > 1 ? ` e ${l.unidades} unidades` : ''} isso` : 'Isso'} costuma custar horas de retrabalho por semana. Montamos um sistema de gestão enxuto, só com o que vocês usam de verdade — sem pagar por módulo que ninguém abre. Faz sentido eu te mostrar em 15 min como ficaria o fluxo de vocês?` },
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
const EVIDENCIA = { web: 4, api: 3, erp: 2, ia: 1, mobile: 0 };
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
      [!l.site && !l.instagram && !l.email, 15, 'Presença digital nula — só telefone'],
      [l.site_status !== 'moderno' && VITRINE.includes(l.nicho), 10, 'Nicho de vitrine — site é o canal de venda'],
      [l.site_status !== 'moderno' && CONVERSAO.test(l.obs), 10, 'Depende de canal de terceiro / perde conversão'],
    ],
  };
  return Object.entries(s).map(([id, regras]) => {
    const hits = regras.filter(([ok]) => ok);
    return { id, tag: OFERTAS[id].tag, score: hits.reduce((a, [, p]) => a + p, 0), motivos: hits.map(([, , m]) => m) };
  // em empate vence a oferta sustentada por dado medido (site testado, nº de sistemas)
  // e não por inferência de nicho (recorrência, volume de atendimento)
  }).filter((o) => o.score > 0).sort((a, b) => b.score - a.score || EVIDENCIA[b.id] - EVIDENCIA[a.id]);
}

const anosAtivo = (abertura) => (Date.now() - new Date(abertura)) / 31557600000;

export function enriquecer(l, status) {
  const ofertas = pontuar(l);
  const top = ofertas[0] ?? { id: 'web', tag: OFERTAS.web.tag, score: 0, motivos: [] };
  const anos = l.abertura ? anosAtivo(l.abertura) : null;   // lead minerado não tem data de abertura
  const total = ofertas.reduce((a, o) => a + o.score, 0);
  return {
    ...l,
    anos: anos === null ? null : Math.floor(anos),
    oferta: top.id,
    oferta_tag: top.tag,
    score: top.score,
    score_total: total,
    motivos: top.motivos,
    ofertas,
    // Alta = um sinal muito forte, ou dois vetores fortes ao mesmo tempo (caso comum em lead minerado,
    // que não expõe sistemas/quadro interno e por isso nunca somaria 55 num único eixo)
    prioridade: (anos === null || anos >= 1) &&
      (top.score >= 55 || (top.score >= 45 && ofertas.filter((o) => o.score >= 40).length >= 2))
      ? 'Alta' : top.score >= 35 ? 'Média' : 'Baixa',
    gancho: OFERTAS[top.id].gancho(l),
    status: status ?? 'novo',
  };
}

// ---------------- mineração de leads reais (OpenStreetMap / Overpass) ----------------

const UA = 'LeadRadar/1.0 (prospeccao B2B; contato local)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const UF_NOME = { AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará', DF:'Distrito Federal',
  ES:'Espírito Santo', GO:'Goiás', MA:'Maranhão', MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais',
  PA:'Pará', PB:'Paraíba', PR:'Paraná', PE:'Pernambuco', PI:'Piauí', RJ:'Rio de Janeiro', RN:'Rio Grande do Norte',
  RS:'Rio Grande do Sul', RO:'Rondônia', RR:'Roraima', SC:'Santa Catarina', SP:'São Paulo', SE:'Sergipe', TO:'Tocantins' };

// catalogo de mineração: rotulo comercial -> filtros OSM + nicho/perfil do Lead Radar
const CATALOGO = {
  clinicas:      { label: 'Clínicas e Consultórios Médicos', nicho: 'saude',       osm: ['amenity=clinic', 'amenity=doctors', 'healthcare=centre'], volume: 'alto', recorrencia: true },
  odontologia:   { label: 'Odontologia / Consultórios',      nicho: 'saude',       osm: ['amenity=dentist'],                                       volume: 'alto', recorrencia: true },
  fisio_estetica:{ label: 'Fisioterapia e Estética',         nicho: 'saude',       osm: ['healthcare=physiotherapist', 'shop=beauty'],             volume: 'alto', recorrencia: true },
  veterinaria:   { label: 'Clínicas Veterinárias e Pet',     nicho: 'servicos',    osm: ['amenity=veterinary', 'shop=pet', 'shop=pet_grooming'],   volume: 'alto', recorrencia: true },
  academias:     { label: 'Academias e Studios',             nicho: 'servicos',    osm: ['leisure=fitness_centre', 'leisure=sports_centre'],       volume: 'alto', recorrencia: true },
  imobiliarias:  { label: 'Imobiliárias',                    nicho: 'imobiliario', osm: ['office=estate_agent'],                                   volume: 'alto', recorrencia: false },
  advocacia:     { label: 'Escritórios de Advocacia',        nicho: 'juridico',    osm: ['office=lawyer'],                                         volume: 'medio', recorrencia: true },
  contabilidade: { label: 'Contabilidade e Assessoria',      nicho: 'juridico',    osm: ['office=accountant', 'office=tax_advisor'],               volume: 'alto', recorrencia: true },
  restaurantes:  { label: 'Restaurantes',                    nicho: 'alimentacao', osm: ['amenity=restaurant'],                                    volume: 'alto', recorrencia: true },
  lanchonetes:   { label: 'Lanchonetes, Cafés e Padarias',   nicho: 'alimentacao', osm: ['amenity=fast_food', 'amenity=cafe', 'shop=bakery'],      volume: 'alto', recorrencia: true },
  autopecas:     { label: 'Auto Peças',                      nicho: 'varejo',      osm: ['shop=car_parts'],                                        volume: 'alto', recorrencia: true },
  oficinas:      { label: 'Oficinas e Centros Automotivos',  nicho: 'servicos',    osm: ['shop=car_repair', 'shop=tyres'],                         volume: 'medio', recorrencia: true },
  varejo:        { label: 'Varejo (moda, móveis, eletro)',   nicho: 'varejo',      osm: ['shop=clothes', 'shop=furniture', 'shop=electronics', 'shop=shoes'], volume: 'alto', recorrencia: false },
  construcao:    { label: 'Materiais de Construção',         nicho: 'construcao',  osm: ['shop=doityourself', 'shop=hardware', 'shop=trade'],      volume: 'medio', recorrencia: false },
  escolas:       { label: 'Escolas e Cursos',                nicho: 'educacao',    osm: ['amenity=school', 'amenity=language_school', 'amenity=driving_school'], volume: 'alto', recorrencia: true },
  hoteis:        { label: 'Hotéis e Pousadas',               nicho: 'turismo',     osm: ['tourism=hotel', 'tourism=guest_house'],                  volume: 'alto', recorrencia: false },
  agencias:      { label: 'Agências de Viagem',              nicho: 'turismo',     osm: ['shop=travel_agency'],                                    volume: 'alto', recorrencia: false },
  seguros:       { label: 'Seguros e Crédito',               nicho: 'financeiro',  osm: ['office=insurance', 'office=financial'],                  volume: 'alto', recorrencia: true },
  salao:         { label: 'Salões de Beleza e Barbearias',   nicho: 'servicos',    osm: ['shop=hairdresser'],                                      volume: 'alto', recorrencia: true },
  logistica:     { label: 'Transporte e Logística',          nicho: 'logistica',   osm: ['office=logistics', 'industrial=depot'],                  volume: 'medio', recorrencia: true },
};

// "Florianopolis" tem que achar "Florianópolis": se o usuário digitou sem acento, casa por regex tolerante
const VOGAIS = { a: 'aáàâã', e: 'eéê', i: 'ií', o: 'oóôõ', u: 'uúü', c: 'cç' };
const nomeCidade = (c) => /[^\x00-\x7F]/.test(c)
  ? `"name"=${JSON.stringify(c)}`
  : `"name"~${JSON.stringify('^' + [...c].map((ch) => {
      const v = VOGAIS[ch.toLowerCase()];
      return v ? `[${v}${v.toUpperCase()}]` : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('') + '$')}`;

async function overpass(cat, cidade, uf, limite) {
  // nome exato resolve em ~7s; a regex tolerante a acento custa 3-4x mais, então só entra se a exata falhar
  const tentativas = [`"name"=${JSON.stringify(cidade)}`];
  if (!/[^\x00-\x7F]/.test(cidade)) tentativas.push(nomeCidade(cidade));

  let erro;
  for (const filtro of tentativas) {
    const q = `[out:json][timeout:60];
area[admin_level=4]["name"=${JSON.stringify(UF_NOME[uf] ?? uf)}]->.uf;
area[admin_level=8][${filtro}](area.uf)->.a;
(${cat.osm.map((f) => `nwr(area.a)[${f.split('=')[0]}=${JSON.stringify(f.split('=')[1])}];`).join('\n ')});
out center tags ${Math.min(limite * 6, 400)};
.a out tags;`;
    for (const url of OVERPASS) {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'text/plain', 'user-agent': UA },
          body: q, signal: AbortSignal.timeout(45000) });
        const txt = await r.text();
        let dados;
        // sob carga o Overpass responde XML/HTML de rate limit em vez de JSON
        try { dados = JSON.parse(txt); } catch {
          erro = new Error(/rate|too many|slot|load/i.test(txt)
            ? 'Base pública ocupada no momento (limite de requisições) — tente de novo em alguns segundos'
            : `Resposta inválida da base pública (HTTP ${r.status})`);
          continue;
        }
        if (!r.ok) { erro = new Error(`Overpass ${r.status}`); continue; }
        const els = dados.elements ?? [];
        // a área sempre volta (para pegar o nome canônico do município); só conta POI de verdade
        if (els.some((e) => e.type !== 'area')) return els;
        erro = null;
        break;                      // área resolveu mas veio vazia: tenta o próximo filtro de nome
      } catch (e) { erro = e; }
    }
  }
  if (erro) throw erro;
  return [];
}

// mede o site de verdade: rapido = moderno, arrastado = lento, quebrado/timeout = defasado, DNS morto = nenhum
async function checarSite(raw) {
  if (!raw) return { site: '', site_status: 'nenhum', site_ms: null };
  let u;
  try { u = new URL(/^https?:\/\//.test(raw) ? raw : 'https://' + raw); } catch { return { site: '', site_status: 'nenhum', site_ms: null }; }
  const host = u.hostname.replace(/^www\./, '');
  // perfil de rede social não é site próprio — é justamente a dor que a oferta Web resolve
  if (/facebook|instagram|linktr|linkedin|wa\.me|beacons\.|bio\.link/.test(host))
    return { site: '', site_status: 'nenhum', site_ms: null, rede: u.href };
  const t = Date.now();
  try {
    const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(3000), headers: { 'user-agent': UA } });
    const ms = Date.now() - t;
    return { site: host, site_ms: ms, site_status: !r.ok ? 'defasado' : ms < 1000 ? 'moderno' : ms < 2500 ? 'lento' : 'defasado' };
  } catch (e) {
    return { site: host, site_ms: null, site_status: e.name === 'TimeoutError' ? 'defasado' : 'nenhum' };
  }
}

// órgão público não é lead B2B: unidade de saúde municipal, escola estadual, CRAS, prefeitura…
const PUBLICO = /(unidade|posto|centro)\s+(b[áa]sica\s+)?de\s+sa[úu]de|^ubs\b|^upa\b|^cras\b|^caps\b|prefeitura|secretaria\s+(municipal|de\s+estado|de\s+sa[úu]de)|minist[ée]rio|governo\s+do\s+estado|hospital\s+(municipal|estadual|universit[áa]rio)|col[ée]gio\s+estadual|escola\s+(municipal|estadual)/i;
const ehPublico = (t) => PUBLICO.test(t.name || '') || PUBLICO.test(t.operator || '') ||
  t['operator:type'] === 'government' || /\.gov\.br/.test(t.website || t['contact:website'] || '');

const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const ehCelular = (tel) => { const d = soDigitos(tel).replace(/^55/, ''); return d.length === 11 && d[2] === '9'; };
const formatarTel = (tel) => {
  const d = soDigitos(tel).replace(/^55/, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : tel;
};
const chaveLead = (l) => soDigitos(l.telefone) || soDigitos(l.whatsapp) || `${l.nome}|${l.cidade}`.toLowerCase();

async function minerar({ nicho, cidade, uf, quantidade = 25 }) {
  const cat = CATALOGO[nicho];
  if (!cat) throw new Error(`nicho inválido: ${nicho}`);
  if (!cidade || !uf) throw new Error('cidade e uf são obrigatórios');
  const limite = Math.min(Math.max(Number(quantidade) || 25, 1), 50);

  const brutos = await overpass(cat, cidade.trim(), uf.trim().toUpperCase(), limite);
  // nome canônico do município direto do OSM: digitar "Florianopolis" não pode criar
  // uma cidade separada de "Florianópolis" na base
  const municipio = brutos.find((e) => e.type === 'area')?.tags?.name || cidade.trim();

  const elementos = brutos
    .filter((e) => e.type !== 'area' && e.tags?.name && !ehPublico(e.tags))
    // contato real primeiro: telefone > site > endereço
    .sort((a, b) => pesoContato(b.tags) - pesoContato(a.tags))
    .slice(0, limite);

  // Serverless: a memória da instância não é a base do usuário — deduplicar aqui esconderia
  // leads que o navegador dele nunca recebeu. Lá quem deduplica é o cliente (localStorage).
  const existentes = SERVERLESS ? new Set() : new Set(LEADS.map(chaveLead));
  const novos = [];
  const leads = await Promise.all(elementos.map(async (e) => {
    const t = e.tags;
    const tel = t.phone || t['contact:phone'] || t['contact:mobile'] || t.mobile || '';
    const site = await checarSite(t.website || t['contact:website'] || t.url || '');
    const endereco = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ');
    const bairro = t['addr:suburb'] || t['addr:neighbourhood'] || '';
    return {
      cnpj: `OSM-${e.type}-${e.id}`,           // sem CNPJ público: id do OSM serve de chave estável
      razao_social: t.operator || t.brand || t.name,
      nome: t.name,
      nicho: cat.nicho,
      cnae: cat.label,
      cidade: t['addr:city'] || municipio,
      uf: uf.trim().toUpperCase(),
      porte: 'N/D',
      abertura: null,
      telefone: tel ? formatarTel(tel) : '',
      whatsapp: ehCelular(tel) ? formatarTel(tel) : '',
      email: t.email || t['contact:email'] || '',
      ...site,
      instagram: (t['contact:instagram'] || '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, ''),
      seguidores: 0,
      funcionarios: 0,
      unidades: 1,
      sistemas: [],
      volume_atendimento: cat.volume,
      recorrencia: cat.recorrencia,
      endereco: [endereco, bairro].filter(Boolean).join(' — '),
      horario: t.opening_hours || '',
      origem: 'osm',
      minerado_em: new Date().toISOString(),
      obs: [
        `Empresa real minerada do cadastro público OpenStreetMap (${cat.label}).`,
        endereco && `Endereço: ${endereco}${bairro ? ` — ${bairro}` : ''}.`,
        !site.site && (site.rede ? `Sem site próprio — só perfil em rede social (${site.rede}).`
          : 'Sem site próprio localizado — só telefone/redes.'),
        site.site && site.site_ms && `Site ${site.site} respondeu em ${site.site_ms}ms.`,
        site.site && !site.site_ms && `Site ${site.site} não respondeu (fora do ar ou timeout).`,
        !tel && 'Sem telefone público no cadastro.',
      ].filter(Boolean).join(' '),
    };
  }));

  const ins = db.prepare('INSERT OR IGNORE INTO minerados (chave, dados, criado_em) VALUES (?, ?, ?)');
  for (const l of leads) {
    const k = chaveLead(l);
    if (existentes.has(k)) continue;
    existentes.add(k);
    ins.run(k, JSON.stringify(l), l.minerado_em);
    LEADS.unshift(l);
    novos.push(l);
  }
  return { sucesso: true, encontrados: leads.length, novos: novos.length, leads: novos.map((l) => enriquecer(l)) };
}

const pesoContato = (t = {}) =>
  (t.phone || t['contact:phone'] || t.mobile ? 4 : 0) + (t.website || t['contact:website'] ? 2 : 0) +
  (t['addr:street'] ? 1 : 0);

// ---------------- consulta ----------------

function buscar(q) {
  const st = new Map(db.prepare('SELECT cnpj, status FROM status').all().map((r) => [r.cnpj, r.status]));
  const fora = new Set(db.prepare('SELECT cnpj FROM descartados').all().map((r) => r.cnpj));
  const txt = (q.get('q') || '').toLowerCase().trim();
  return LEADS.filter((l) => !fora.has(l.cnpj)).map((l) => enriquecer(l, st.get(l.cnpj)))
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

const CSV_COLS = ['nome', 'razao_social', 'cnpj', 'nicho', 'cnae', 'cidade', 'uf', 'endereco', 'porte', 'anos',
  'telefone', 'whatsapp', 'email', 'site', 'site_status', 'instagram', 'funcionarios',
  'oferta_tag', 'score', 'prioridade', 'status', 'origem', 'gancho'];

const csv = (rows) => '﻿' + [CSV_COLS.join(';'), ...rows.map((r) =>
  CSV_COLS.map((c) => `"${String(r[c] ?? '').replaceAll('"', '""')}"`).join(';'))].join('\r\n');

// ---------------- http ----------------

// Body: a Vercel já entrega req.body parseado; local vem stream. Concatenar Buffer e decodificar
// uma vez só — decodificar chunk a chunk quebra caractere multibyte ("Maringá" virava lixo).
async function corpo(req) {
  if (req.body != null) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const partes = [];
  for await (const c of req) partes.push(c);
  return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}');
}

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const json = (res, data, code = 200) =>
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(data));

export default async function handler(req, res) {
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
          mineracao: Object.entries(CATALOGO).map(([id, c]) => ({ id, label: c.label })),
          estados: Object.keys(UF_NOME),
        },
      });
    }
    if (req.method === 'POST' && p === '/api/status') {
      const body = await corpo(req);
      if (!body.cnpj || !['novo', 'contatado', 'reuniao', 'proposta', 'ganho', 'perdido'].includes(body.status))
        return json(res, { erro: 'cnpj e status válidos são obrigatórios' }, 400);
      db.prepare(`INSERT INTO status (cnpj, status, nota, atualizado_em) VALUES (?, ?, ?, ?)
                  ON CONFLICT(cnpj) DO UPDATE SET status=excluded.status, nota=excluded.nota, atualizado_em=excluded.atualizado_em`)
        .run(body.cnpj, body.status, body.nota ?? '', new Date().toISOString());
      return json(res, { ok: true });
    }
    if (req.method === 'POST' && p === '/api/minerar') {
      const t = Date.now();
      const r = await minerar(await corpo(req));
      console.log(`minerado: ${r.novos} novos de ${r.encontrados} em ${((Date.now() - t) / 1000).toFixed(1)}s`);
      return json(res, r);
    }

    if (req.method === 'POST' && (p === '/api/excluir' || p === '/api/restaurar')) {
      const { cnpjs = [] } = await corpo(req);
      if (!Array.isArray(cnpjs) || !cnpjs.length) return json(res, { erro: 'informe cnpjs: [...]' }, 400);
      if (p === '/api/restaurar') {
        const del = db.prepare('DELETE FROM descartados WHERE cnpj = ?');
        return json(res, { restaurados: cnpjs.filter((c) => del.run(c).changes).length });
      }
      const ins = db.prepare('INSERT OR IGNORE INTO descartados (cnpj, nome, descartado_em) VALUES (?, ?, ?)');
      const agora = new Date().toISOString();
      const n = cnpjs.filter((c) => ins.run(c, LEADS.find((l) => l.cnpj === c)?.nome ?? '', agora).changes).length;
      return json(res, { excluidos: n, restantes: buscar(new URLSearchParams()).length });
    }

    if (req.method === 'GET' && p === '/api/lixeira')
      return json(res, db.prepare('SELECT * FROM descartados ORDER BY descartado_em DESC').all());

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
}

// servidor local; na Vercel quem invoca o handler é a Serverless Function (api/index.mjs)
if (process.argv[1] === fileURLToPath(import.meta.url))
  createServer(handler).listen(PORT, () => console.log(`\n  Lead Radar rodando em http://localhost:${PORT}\n`));
