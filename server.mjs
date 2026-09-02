// Lead Radar — servidor + motor de oportunidade. Zero dependencias: so stdlib do Node 24.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { GANCHOS, FOLLOWUPS } from './copy.mjs';

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
  erp:    { tag: '💡 Sistema de Gestão / ERP Enxuto',                  gancho: GANCHOS.erp },
  ia:     { tag: '🤖 Automação & Atendimento IA',                      gancho: GANCHOS.ia },
  mobile: { tag: '📱 Aplicativo Mobile / Área do Cliente',             gancho: GANCHOS.mobile },
  api:    { tag: '🔗 Integração de APIs / Migração de Dados',          gancho: GANCHOS.api },
  web:    { tag: '⚡ Plataforma Web / Redesign de Alta Performance',   gancho: GANCHOS.web },
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
// site que está de pé: 'protegido' é Cloudflare/bot-protection barrando a medição, não site ruim.
// Tratar como problema geraria a afirmação falsa "seu site está defasado" dentro do gancho.
const SITE_OK = new Set(['moderno', 'protegido']);
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
      [!SITE_OK.has(l.site_status) && VITRINE.includes(l.nicho), 10, 'Nicho de vitrine — site é o canal de venda'],
      [!SITE_OK.has(l.site_status) && CONVERSAO.test(l.obs), 10, 'Depende de canal de terceiro / perde conversão'],
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

// Limiares da prioridade Alta — faixa-alvo: 20-25% da base, e nunca a maioria dela.
// Calibrado em 24/08/2026 sobre os 66 leads reais minerados (PR/SC/SP): dá 13/66 = 20%.
// Se o perfil da base mudar (ex.: enriquecimento por CNPJ ligando os eixos erp/api), recalibre
// AQUI — é o único lugar. `test_score.mjs` trava o contrato de "não é a maioria".
const ALTA = { forte: 50, duplo: 40, eixo: 35 };

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
    // Alta = acionável AGORA: WhatsApp válido + sinal forte (um eixo alto, ou dois vetores
    // médios juntos — caso do lead minerado, que não expõe sistemas nem quadro interno).
    // O filtro de canal é o que segura o percentual: sem celular não dá pra disparar, então é
    // pesquisa, não lead quente. Sem ele, 48% da base saía Alta e a cor não significava nada.
    prioridade: (anos === null || anos >= 1) && ehCelular(l.whatsapp, l.pais) &&
      (top.score >= ALTA.forte ||
        (top.score >= ALTA.duplo && ofertas.filter((o) => o.score >= ALTA.eixo).length >= 2))
      ? 'Alta' : top.score >= 35 ? 'Média' : 'Baixa',
    gancho: OFERTAS[top.id].gancho(l),
    followup: FOLLOWUPS[top.id](l),        // 2a mensagem: quando o lead responde "pode mandar"
    status: status ?? 'novo',
  };
}

// ---------------- mineração de leads reais (OpenStreetMap / Overpass) ----------------

const UA = 'LeadRadar/1.0 (prospeccao B2B; contato local)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

// Países ligados. Não existe admin_level padrão no OSM: no Brasil município é 8, em Portugal
// concelho é 7, na Inglaterra cidade grande tanto pode ser 8 (borough) quanto 6 (unitária).
// Por isso cada nível é uma LISTA de tentativas, na ordem mais provável primeiro — a consulta
// só cai pra próxima quando a área não resolve. `area` é como se acha o país no OSM.
const PAISES = {
  BR: {
    nome: 'Brasil', idioma: 'pt', ddi: '55', rotulo: 'Estado',
    area: '["ISO3166-1"="BR"][admin_level=2]', nivelEstado: ['4'], nivelCidade: ['8'],
    estados: { AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará', DF:'Distrito Federal',
      ES:'Espírito Santo', GO:'Goiás', MA:'Maranhão', MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais',
      PA:'Pará', PB:'Paraíba', PR:'Paraná', PE:'Pernambuco', PI:'Piauí', RJ:'Rio de Janeiro', RN:'Rio Grande do Norte',
      RS:'Rio Grande do Sul', RO:'Rondônia', RR:'Roraima', SC:'Santa Catarina', SP:'São Paulo', SE:'Sergipe', TO:'Tocantins' },
  },
  US: {
    nome: 'Estados Unidos', idioma: 'en', ddi: '1', rotulo: 'Estado',
    area: '["ISO3166-1"="US"][admin_level=2]', nivelEstado: ['4'], nivelCidade: ['8', '6'],
    estados: { AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California', CO:'Colorado',
      CT:'Connecticut', DE:'Delaware', DC:'District of Columbia', FL:'Florida', GA:'Georgia', HI:'Hawaii',
      ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa', KS:'Kansas', KY:'Kentucky', LA:'Louisiana',
      ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi',
      MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire', NJ:'New Jersey',
      NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio', OK:'Oklahoma',
      OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota',
      TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia', WA:'Washington',
      WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming' },
  },
  PT: {
    nome: 'Portugal', idioma: 'pt', ddi: '351', rotulo: 'Distrito',
    // concelho é admin_level 7 (8 é freguesia): pesquisar "Porto" em 8 traria uma freguesia
    area: '["ISO3166-1"="PT"][admin_level=2]', nivelEstado: ['6', '4'], nivelCidade: ['7', '8'],
    estados: { Aveiro:'Aveiro', Beja:'Beja', Braga:'Braga', Bragança:'Bragança',
      'Castelo Branco':'Castelo Branco', Coimbra:'Coimbra', Évora:'Évora', Faro:'Faro', Guarda:'Guarda',
      Leiria:'Leiria', Lisboa:'Lisboa', Portalegre:'Portalegre', Porto:'Porto', Santarém:'Santarém',
      Setúbal:'Setúbal', 'Viana do Castelo':'Viana do Castelo', 'Vila Real':'Vila Real', Viseu:'Viseu',
      Açores:'Região Autónoma dos Açores', Madeira:'Região Autónoma da Madeira' },
  },
  GB: {
    nome: 'Inglaterra', idioma: 'en', ddi: '44', rotulo: 'Região',
    // Inglaterra é admin_level 4 DENTRO do Reino Unido — não dá pra usar ISO3166-1=GB aqui,
    // senão Escócia, País de Gales e Irlanda do Norte entram na busca.
    area: '[admin_level=4]["name"="England"]', nivelEstado: ['5', '6'], nivelCidade: ['8', '6'],
    estados: { 'North East England':'North East England', 'North West England':'North West England',
      'Yorkshire and the Humber':'Yorkshire and the Humber', 'East Midlands':'East Midlands',
      'West Midlands':'West Midlands', 'East of England':'East of England', 'Greater London':'Greater London',
      'South East England':'South East England', 'South West England':'South West England' },
  },
  IT: {
    nome: 'Itália', idioma: 'it', ddi: '39', rotulo: 'Região',
    area: '["ISO3166-1"="IT"][admin_level=2]', nivelEstado: ['4'], nivelCidade: ['8', '6'],
    estados: { Abruzzo:'Abruzzo', Basilicata:'Basilicata', Calabria:'Calabria', Campania:'Campania',
      'Emilia-Romagna':'Emilia-Romagna', 'Friuli-Venezia Giulia':'Friuli-Venezia Giulia', Lazio:'Lazio',
      Liguria:'Liguria', Lombardia:'Lombardia', Marche:'Marche', Molise:'Molise', Piemonte:'Piemonte',
      Puglia:'Puglia', Sardegna:'Sardegna', Sicilia:'Sicilia', Toscana:'Toscana',
      // nome oficial no OSM é bilíngue nessas duas — com o nome curto a área não resolve
      'Trentino-Alto Adige':'Trentino-Alto Adige/Südtirol', Umbria:'Umbria',
      "Valle d'Aosta":"Valle d'Aosta/Vallée d'Aoste", Veneto:'Veneto' },
  },
};

// varrer um país inteiro é ordens de grandeza mais caro que uma cidade: o Overpass precisa
// de mais fôlego, e a Vercel corta em 60s (aí só rodando local).
const TIMEOUT = { cidade: 60, estado: 120, pais: 180 };

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
// nome exato resolve em ~7s; a regex tolerante a acento custa 3-4x mais, então só entra se a exata falhar
const filtrosNome = (c) => /[^\x00-\x7F]/.test(c) ? [`"name"=${JSON.stringify(c)}`] : [
  `"name"=${JSON.stringify(c)}`,
  `"name"~${JSON.stringify('^' + [...c].map((ch) => {
    const v = VOGAIS[ch.toLowerCase()];
    return v ? `[${v}${v.toUpperCase()}]` : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('') + '$')}`,
];

// Cada tentativa é um jeito de resolver a área alvo (->.a): nome exato ou tolerante a acento,
// vezes os admin_level plausíveis daquele país. A primeira que devolver POI ganha.
function areasAlvo(p, { escopo, estado, cidade }) {
  if (escopo === 'pais') return [`area${p.area}->.a;`];
  const pais = `area${p.area}->.p;`;
  const q = [];
  for (const nivel of p.nivelEstado) for (const fe of filtrosNome(p.estados[estado] ?? estado)) {
    const est = (saida) => `${pais}\narea[admin_level=${nivel}][${fe}](area.p)->${saida};`;
    if (escopo === 'estado') { q.push(est('.a')); continue; }
    for (const nc of p.nivelCidade) for (const fc of filtrosNome(cidade))
      q.push(`${est('.e')}\narea[admin_level=${nc}][${fc}](area.e)->.a;`);
  }
  return q;
}

// "restaurantes nos EUA inteiro" não é uma consulta lenta: é uma consulta que a base pública
// não termina nunca. Quando ela desiste, o jeito é diminuir a área — não tentar de novo.
// `fatal`: não adianta tentar o outro espelho nem outro admin_level — a área é que é grande demais
const GRANDE_DEMAIS = (escopo, seg) => Object.assign(new Error(
  `A base pública desistiu da consulta depois de ${seg}s — a área é grande demais para esse segmento. ` +
  (escopo === 'pais' ? 'Busque por estado/região, ou escolha um segmento de volume menor.'
                     : 'Busque por cidade, ou escolha um segmento de volume menor.')), { fatal: true });

async function overpass(cat, regiao, bruto) {
  const p = PAISES[regiao.pais];
  // na Vercel a function morre em 60s: pedir 180s ao Overpass só faria o usuário esperar por nada.
  // `regiao.espera` é a varredura nacional pedindo menos por estado — ela tem vários pra fazer.
  const espera = Math.min(regiao.espera ?? TIMEOUT[regiao.escopo], SERVERLESS ? 50 : 180);

  let erro;
  for (const areas of areasAlvo(p, regiao)) {
    const q = `[out:json][timeout:${espera}];
${areas}
(${cat.osm.map((f) => `nwr(area.a)[${f.split('=')[0]}=${JSON.stringify(f.split('=')[1])}];`).join('\n ')});
out center tags ${bruto};
.a out tags;`;
    for (const url of OVERPASS) {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'text/plain', 'user-agent': UA },
          body: q, signal: AbortSignal.timeout((espera - 5) * 1000) });
        const txt = await r.text();
        let dados;
        // sob carga o Overpass responde XML/HTML de rate limit em vez de JSON
        try { dados = JSON.parse(txt); } catch {
          // 504/500 numa área grande é a consulta estourando, não a base ocupada
          if (r.status >= 500 && regiao.escopo !== 'cidade') throw GRANDE_DEMAIS(regiao.escopo, espera);
          erro = new Error(/rate|too many|slot|load/i.test(txt)
            ? 'Base pública ocupada no momento (limite de requisições) — tente de novo em alguns segundos'
            : `Resposta inválida da base pública (HTTP ${r.status})`);
          continue;
        }
        if (!r.ok) { erro = new Error(`Overpass ${r.status}`); continue; }
        // Consulta estourada volta com HTTP 200, elements vazio e o motivo só no `remark`.
        // Sem olhar aqui, a busca impossível era reportada como "nada encontrado na região".
        if (/timed out|out of memory|runtime error/i.test(dados.remark ?? ''))
          throw GRANDE_DEMAIS(regiao.escopo, espera);
        const els = dados.elements ?? [];
        // a área sempre volta (para pegar o nome canônico do município); só conta POI de verdade
        if (els.some((e) => e.type !== 'area')) return els;
        erro = null;
        break;                      // área resolveu mas veio vazia: tenta o próximo filtro de nome
      } catch (e) { erro = e; if (e.fatal) break; }
    }
    if (erro?.fatal) break;
  }
  if (erro) throw erro;
  return [];
}

// mede o site de verdade: rapido = moderno, arrastado = lento, quebrado/timeout = defasado,
// DNS morto = nenhum, bloqueio de bot = protegido (existe e responde, só não deixa medir).
// Duas tentativas: cold start de hospedagem compartilhada e blip de rede davam "defasado"
// falso — e esse veredito vai escrito no gancho que o dono do site vai ler.
const BLOQUEIO = new Set([401, 403, 405, 406, 429, 503]);

async function checarSite(raw) {
  if (!raw) return { site: '', site_status: 'nenhum', site_ms: null };
  let u;
  try { u = new URL(/^https?:\/\//.test(raw) ? raw : 'https://' + raw); } catch { return { site: '', site_status: 'nenhum', site_ms: null }; }
  const host = u.hostname.replace(/^www\./, '');
  // perfil de rede social não é site próprio — é justamente a dor que a oferta Web resolve
  if (/facebook|instagram|linktr|linkedin|wa\.me|beacons\.|bio\.link/.test(host))
    return { site: '', site_status: 'nenhum', site_ms: null, rede: u.href };

  let ultimo = 'nenhum';
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const t = Date.now();
    try {
      const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(3000), headers: { 'user-agent': UA } });
      const ms = Date.now() - t;
      // Cloudflare & cia: o site está de pé, só barrou o robô. Não dá pra chamar de defasado.
      if (BLOQUEIO.has(r.status)) return { site: host, site_ms: null, site_status: 'protegido' };
      if (r.ok) return { site: host, site_ms: ms, site_status: ms < 1000 ? 'moderno' : ms < 2500 ? 'lento' : 'defasado' };
      ultimo = 'defasado';                 // 5xx/404: pode ser blip, tenta de novo antes de sentenciar
    } catch (e) {
      ultimo = e.name === 'TimeoutError' ? 'defasado' : 'nenhum';
    }
  }
  return { site: host, site_ms: null, site_status: ultimo };
}

// órgão público não é lead B2B: unidade de saúde municipal, escola estadual, CRAS, prefeitura…
const PUBLICO = /(unidade|posto|centro)\s+(b[áa]sica\s+)?de\s+sa[úu]de|^ubs\b|^upa\b|^cras\b|^caps\b|prefeitura|secretaria\s+(municipal|de\s+estado|de\s+sa[úu]de)|minist[ée]rio|governo\s+do\s+estado|hospital\s+(municipal|estadual|universit[áa]rio)|col[ée]gio\s+estadual|escola\s+(municipal|estadual)|c[âa]mara\s+municipal|junta\s+de\s+freguesia|city\s+hall|town\s+(hall|council)|county\s+council|borough\s+of\s|public\s+(school|library)|department\s+of\s|nhs\b|comune\s+di\s|scuola\s+(statale|primaria|media|dell)|azienda\s+sanitaria|ospedale\s+(civile|pubblico)/i;
const ehPublico = (t) => PUBLICO.test(t.name || '') || PUBLICO.test(t.operator || '') ||
  t['operator:type'] === 'government' ||
  /\.gov\b|\.nhs\.uk\b|comune\.[^.\s]+\.it\b/i.test(t.website || t['contact:website'] || '');

const soDigitos = (s) => String(s || '').replace(/\D/g, '');

// Número nacional: sem DDI e sem o 0 de tronco. Sem o "+" explícito o DDI só sai se o que
// sobra ainda tiver cara de telefone — "3931234567" é celular italiano inteiro, não +39 + resto.
const nacional = (tel, pais = 'BR') => {
  const raw = String(tel || '').trim(), ddi = (PAISES[pais] ?? PAISES.BR).ddi;
  const d = soDigitos(raw);
  const nu = d.startsWith(ddi) && (/^(\+|00)/.test(raw) || d.length > ddi.length + 9) ? d.slice(ddi.length) : d;
  return nu.replace(/^0/, '');
};

// Celular = canal que dá pra acionar hoje (WhatsApp). A regra é do país, não universal.
// ponytail: nos EUA não existe faixa de celular separada do fixo — qualquer número de 10
// dígitos entra como acionável. Se não tiver WhatsApp, o link só não abre conversa.
const MOVEL = {
  BR: (d) => d.length === 11 && d[2] === '9',
  US: (d) => d.length === 10,
  PT: (d) => d.length === 9 && d[0] === '9',
  GB: (d) => d.length === 10 && d[0] === '7',
  IT: (d) => d.length >= 9 && d.length <= 10 && d[0] === '3',
};
export const ehCelular = (tel, pais = 'BR') => (MOVEL[pais] ?? MOVEL.BR)(nacional(tel, pais));
export const e164 = (tel, pais = 'BR') => (tel ? `+${(PAISES[pais] ?? PAISES.BR).ddi}${nacional(tel, pais)}` : '');

const formatarTel = (tel, pais = 'BR') => {
  const d = nacional(tel, pais);
  if (pais === 'US') return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : tel;
  if (pais !== 'BR') return String(tel).trim();   // fora do BR o OSM já traz "+351 912 345 678"
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : tel;
};
// o OSM às vezes empilha dois números no mesmo tag ("+39 02 111; +39 02 222"): fica o primeiro,
// senão os dígitos se colam e viram um telefone que não existe
const telDe = (t) => (t.phone || t['contact:phone'] || t['contact:mobile'] || t.mobile || '').split(/[;,/]/)[0].trim();
const chaveLead = (l) => soDigitos(l.telefone) || soDigitos(l.whatsapp) || `${l.nome}|${l.cidade}`.toLowerCase();

async function minerar({ nicho, pais = 'BR', escopo = 'cidade', estado, uf, cidade,
                         quantidade = 25, apenas_whatsapp = false, offset = 0 }) {
  const cat = CATALOGO[nicho];
  const p = PAISES[pais];
  estado = (estado ?? uf ?? '').trim();          // `uf` é o nome antigo do campo
  cidade = (cidade ?? '').trim();
  if (!cat) throw new Error(`nicho inválido: ${nicho}`);
  if (!p) throw new Error(`país inválido: ${pais}`);
  if (!TIMEOUT[escopo]) throw new Error(`escopo inválido: ${escopo} (use cidade, estado ou pais)`);
  if (escopo !== 'pais' && !p.estados[estado]) throw new Error(`${p.rotulo.toLowerCase()} inválido para ${p.nome}: ${estado || '(vazio)'}`);
  if (escopo === 'cidade' && !cidade) throw new Error('cidade é obrigatória no escopo cidade');
  const regiao = { pais, escopo, estado, cidade };
  const limite = Math.min(Math.max(Number(quantidade) || 25, 1), 50);
  // De onde continuar a varredura desta (nicho, cidade, uf, apenas_whatsapp). Sem isso, minerar
  // a mesma busca de novo devolvia sempre o mesmo topo do ranking = "0 leads novos" pra sempre.
  const inicio = Math.max(Number(offset) || 0, 0);
  const alvo = inicio + limite;
  // O teto de candidatos é FIXO, não proporcional à quantidade pedida: a fila precisa ser a mesma
  // em todas as páginas, senão candidato novo entra na frente do cursor e o offset pula gente.
  // Pedir mais no `out` do Overpass custa pouco — o caro é resolver a área e testar os sites,
  // e o teste de site continua limitado a `limite`. (celular é tag rara: com WhatsApp varre o dobro)
  const bruto = apenas_whatsapp ? 800 : 400;
  const util = (e) => e.type !== 'area' && e.tags?.name && !ehPublico(e.tags);

  let municipio = '', candidatos, ranqueados, elementos, esgotado, proximo;
  const varridos = [], pulados = [];

  if (escopo === 'pais') {
    // País inteiro NÃO cabe numa consulta só: academias nos EUA são 50k+ POIs e a base pública
    // desiste antes de responder. Então a varredura nacional é estado a estado, na ordem da
    // lista, parando quando a página encheu — e o cursor guarda em que estado continuar.
    const lista = Object.keys(p.estados);
    const ateQuando = Date.now() + (SERVERLESS ? 25000 : 90000);
    let i = inicio < lista.length ? inicio : 0;
    const achados = [];
    while (i < lista.length) {
      try {
        const brutos = await overpass(cat, { pais, escopo: 'estado', estado: lista[i], espera: 45 }, bruto);
        // o estado varrido é a UF do lead: melhor que addr:state, que quase nunca vem preenchido
        achados.push(...brutos.filter(util).map((e) => ({ ...e, estado: lista[i] })));
        varridos.push(lista[i]);
      } catch (e) {
        if (!e.fatal) throw e;      // rate limit e afins continuam sendo erro de verdade
        pulados.push(lista[i]);     // estado grande demais pro segmento: segue pro próximo
      }
      i++;
      if (ranquear(achados, apenas_whatsapp, pais).length >= limite || Date.now() > ateQuando) break;
    }
    candidatos = achados;
    ranqueados = ranquear(candidatos, apenas_whatsapp, pais);
    elementos = ranqueados.slice(0, limite);
    esgotado = i >= lista.length;
    proximo = esgotado ? 0 : i;     // próxima mineração continua no estado seguinte
  } else {
    const brutos = await overpass(cat, regiao, bruto);
    // nome canônico do município direto do OSM: digitar "Florianopolis" não pode criar
    // uma cidade separada de "Florianópolis" na base. Em busca por estado a área resolvida
    // é o estado — aí a cidade de cada lead só pode vir do endereço dele.
    municipio = escopo === 'cidade' ? (brutos.find((e) => e.type === 'area')?.tags?.name || cidade) : '';
    candidatos = brutos.filter(util);
    ranqueados = ranquear(candidatos, apenas_whatsapp, pais);
    elementos = ranqueados.slice(inicio, alvo);     // a "página" pedida desta varredura
    // ponytail: `bruto` limita o `out` do Overpass, então esgotado pode ser falso positivo quando
    // a página bate exatamente no teto de 800. Só importa em cidade gigante — paginar no Overpass
    // (por bbox) se um dia virar problema de verdade.
    esgotado = inicio + elementos.length >= ranqueados.length;
    proximo = esgotado ? 0 : inicio + elementos.length;
  }

  // Serverless: a memória da instância não é a base do usuário — deduplicar aqui esconderia
  // leads que o navegador dele nunca recebeu. Lá quem deduplica é o cliente (localStorage).
  const existentes = SERVERLESS ? new Set() : new Set(LEADS.map(chaveLead));
  const novos = [];
  const leads = await Promise.all(elementos.map(async (e) => {
    const t = e.tags;
    const tel = telDe(t);
    const site = await checarSite(t.website || t['contact:website'] || t.url || '');
    const endereco = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ');
    const bairro = t['addr:suburb'] || t['addr:neighbourhood'] || '';
    return {
      cnpj: `OSM-${e.type}-${e.id}`,           // sem CNPJ público: id do OSM serve de chave estável
      razao_social: t.operator || t.brand || t.name,
      nome: t.name,
      nicho: cat.nicho,
      cnae: cat.label,
      cidade: t['addr:city'] || t['addr:town'] || t['addr:village'] || municipio,
      uf: e.estado ?? estado,                  // na varredura nacional, o estado que a produziu
      pais,
      idioma: p.idioma,                        // define em que língua sai o gancho (copy.mjs)
      porte: 'N/D',
      abertura: null,
      telefone: tel ? formatarTel(tel, pais) : '',
      whatsapp: ehCelular(tel, pais) ? formatarTel(tel, pais) : '',
      // link do WhatsApp já resolvido: o DDI é do país minerado, o navegador não precisa saber
      whatsapp_e164: ehCelular(tel, pais) ? e164(tel, pais) : '',
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
        site.site_status === 'protegido' && `Site ${site.site} está de pé, mas bloqueia leitura automática (Cloudflare/anti-bot) — velocidade não medida.`,
        site.site && !site.site_ms && site.site_status !== 'protegido' && `Site ${site.site} não respondeu em 2 tentativas (fora do ar ou timeout).`,
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
  // proximo_offset volta pro cliente, que o guarda por busca e devolve na próxima mineração.
  // Quando esgotou, zera: o OSM ganha POI novo com o tempo e a dedupe segura o repetido.
  return { sucesso: true, encontrados: leads.length, novos: novos.length, analisados: candidatos.length,
    apenas_whatsapp, offset: inicio, proximo_offset: proximo, escopo,
    // varredura nacional: por quais estados passou e quais teve que pular (grandes demais)
    varridos: varridos.map((e) => p.estados[e]), pulados: pulados.map((e) => p.estados[e]),
    esgotado, disponiveis: ranqueados.length, leads: novos.map((l) => enriquecer(l)) };
}

// Ordem estável da varredura: contato real primeiro (telefone > site > endereço), desempate por
// id. O desempate não é cosmético — o offset só significa alguma coisa se duas execuções da mesma
// busca produzirem exatamente a mesma fila. Exportado porque é o que o teste consegue checar
// sem rede (o resto de `minerar` depende do Overpass).
export const ranquear = (candidatos, apenas_whatsapp = false, pais = 'BR') => candidatos
  .filter((e) => !apenas_whatsapp || ehCelular(telDe(e.tags), pais))
  .sort((a, b) => pesoContato(b.tags) - pesoContato(a.tags) || a.id - b.id);

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
      (!q.get('pais') || (l.pais ?? 'BR') === q.get('pais')) &&
      (!q.get('uf') || l.uf === q.get('uf')) &&
      (!q.get('cidade') || l.cidade === q.get('cidade')) &&
      (!q.get('porte') || l.porte === q.get('porte')) &&
      (!q.get('oferta') || l.oferta === q.get('oferta')) &&
      (!q.get('prioridade') || l.prioridade === q.get('prioridade')) &&
      (!q.get('status') || l.status === q.get('status')) &&
      (!q.get('anos') || q.get('anos') === '0' || l.anos === null || l.anos >= Number(q.get('anos'))) &&
      (!txt || [l.nome, l.razao_social, l.cidade, l.cnae, l.obs].join(' ').toLowerCase().includes(txt)))
    .sort((a, b) => b.score - a.score || b.score_total - a.score_total);
}

const CSV_COLS = ['nome', 'razao_social', 'cnpj', 'nicho', 'cnae', 'cidade', 'uf', 'pais', 'endereco', 'porte', 'anos',
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
          // `volume` é o que a tela usa pra avisar antes de mandar uma busca nacional impossível
          mineracao: Object.entries(CATALOGO).map(([id, c]) => ({ id, label: c.label, volume: c.volume })),
          // o que a tela precisa saber de cada país: como chamar a divisão e quais existem
          paises: Object.entries(PAISES).map(([id, p]) =>
            ({ id, nome: p.nome, rotulo: p.rotulo, estados: p.estados })),
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
