// node test_score.mjs — checa o motor de oportunidade. Sem framework.
import assert from 'node:assert/strict';
import { enriquecer, ranquear } from './server.mjs';
import { GANCHOS } from './copy.mjs';

const base = {
  cnpj: '00.000.000/0001-00', razao_social: 'X LTDA', nome: 'X', nicho: 'servicos',
  cnae: '0000-0/00 - teste', cidade: 'Curitiba', uf: 'PR', porte: 'ME', abertura: '2015-01-01',
  telefone: '(41) 3000-0000', whatsapp: '', email: 'x@x.com', site: 'x.com', site_status: 'moderno',
  instagram: '', seguidores: 0, funcionarios: 5, unidades: 1, sistemas: ['ERP moderno'],
  volume_atendimento: 'baixo', recorrencia: false, obs: '',
};
const e = (o) => enriquecer({ ...base, ...o });

// cada sinal dominante puxa a oferta certa
assert.equal(e({ sistemas: ['planilhas'], funcionarios: 40, unidades: 3 }).oferta, 'erp');
assert.equal(e({ volume_atendimento: 'alto', whatsapp: '(41) 90000-0000', nicho: 'varejo', seguidores: 20000 }).oferta, 'ia');
assert.equal(e({ recorrencia: true, nicho: 'educacao', seguidores: 9000, funcionarios: 30, site_status: 'moderno' }).oferta, 'mobile');
assert.equal(e({ sistemas: ['ERP legado', 'TMS', 'portal', 'planilha X'], funcionarios: 2 }).oferta, 'api');
assert.equal(e({ site: '', site_status: 'nenhum', seguidores: 9000 }).oferta, 'web');

// prioridade só é Alta com score forte, empresa consolidada E canal pra acionar hoje
const quente = { sistemas: ['planilhas'], funcionarios: 40, unidades: 3, nicho: 'saude', whatsapp: '(41) 99999-0000' };
assert.equal(e(quente).prioridade, 'Alta');
assert.equal(e({ ...quente, abertura: new Date().toISOString().slice(0, 10) }).prioridade, 'Média', 'empresa recém-aberta não é Alta');
// o gate de canal é o que segurou a Alta em ~20% da base real (antes: 48%, quase tudo vermelho)
assert.equal(e({ ...quente, whatsapp: '' }).prioridade, 'Média', 'sem WhatsApp não dá pra acionar: no máximo Média');
assert.equal(e({ ...quente, whatsapp: '(41) 3000-0000' }).prioridade, 'Média', 'fixo não é WhatsApp válido');
assert.equal(e({}).prioridade, 'Baixa');

// enriquecimento básico
const l = e({ sistemas: ['planilhas'], funcionarios: 40 });
assert.ok(l.gancho.includes('X') && l.gancho.length > 80, 'gancho gerado');
assert.ok(l.followup.includes('X') && l.followup.length > 200, 'follow-up gerado');
assert.ok(l.motivos.length >= 2 && l.ofertas[0].score >= l.ofertas.at(-1).score, 'motivos e ranking');
assert.equal(l.anos, Math.floor((Date.now() - new Date('2015-01-01')) / 31557600000));
assert.equal(l.status, 'novo');

// lead minerado: sem data de abertura, sem sistemas, sem quadro de funcionários
const real = e({ nome: 'Clínica Real', abertura: null, sistemas: [], funcionarios: 0, email: '',
  site: '', site_status: 'nenhum', nicho: 'saude', volume_atendimento: 'alto',
  whatsapp: '(41) 99999-0000', recorrencia: true, origem: 'osm' });
assert.equal(real.anos, null, 'idade desconhecida não vira 56 anos');
assert.equal(real.prioridade, 'Alta', 'dois vetores fortes (web sem presença + IA alto volume) = Alta');
assert.ok(!real.gancho.includes('undefined') && !real.gancho.includes('0 pessoas'), 'gancho sem buraco de dado');
assert.equal(e({ abertura: null, sistemas: [], site_status: 'moderno' }).prioridade, 'Baixa');

// ---- primeiro contato: curto, sem link, sem preço ----
// O gancho vai inteiro no ?text= do WhatsApp. Mil caracteres com link na 1ª mensagem para um
// estranho = bloqueio. Portfólio e tabela de preços só na 2ª (quando ele já respondeu).
const LONGO = '👨‍⚕️ Dr Carlos Dalmaso | Telemedicina - Check up - Domiciliar | Clínico Geral em Curitiba';
for (const [oferta, gancho] of Object.entries(GANCHOS)) {
  for (const caso of [
    { nome: LONGO, sistemas: ['planilha', 'agenda em papel', 'caderno'], site: '', site_status: 'nenhum' },
    { nome: LONGO, sistemas: [], site: 'x.com.br', site_status: 'lento', site_ms: 1840 },
    { nome: 'X', sistemas: [], site: 'x.com.br', site_status: 'protegido', site_ms: null },
  ]) {
    const msg = gancho({ ...base, ...caso });
    assert.ok(msg.length < 250, `gancho ${oferta} tem ${msg.length} chars (limite 250): ${msg}`);
    assert.ok(!/https?:\/\//.test(msg), `gancho ${oferta} não pode levar link no 1º contato`);
    assert.ok(!/tabela de preços/.test(msg), `gancho ${oferta} não pode falar de preço no 1º contato`);
    assert.ok(msg.split('\n\n').length <= 4, `gancho ${oferta} passou de 4 blocos`);
    assert.ok(!msg.includes('|') && !/[\p{Extended_Pictographic}]/u.test(msg),
      `gancho ${oferta} carregou keyword stuffing/emoji do cadastro OSM: ${msg}`);
  }
}
// site 'protegido' é Cloudflare barrando o robô, não site ruim: não pode virar acusação
const prot = e({ site: 'x.com.br', site_status: 'protegido', site_ms: null, nicho: 'varejo' });
assert.ok(!/defasado|lento|não respondeu/.test(prot.gancho), 'não afirmar defeito de site não medido');
assert.ok(!prot.ofertas.some((o) => o.motivos.some((m) => /vitrine|conversão/i.test(m))),
  'site protegido não pontua como site problemático');

// portfólio e preço migraram para o follow-up
assert.ok(l.followup.includes('portfolio-murex-alpha-23.vercel.app'), 'portfólio no follow-up');
assert.ok(/tabela de preços em PDF/.test(l.followup), 'tabela de preços no follow-up');

// ---- offset da mineração: a fila tem que ser idêntica entre execuções ----
const poi = (id, tags) => ({ type: 'node', id, tags });
const amostra = [
  poi(30, { name: 'C', 'addr:street': 'R 1' }),
  poi(10, { name: 'A', phone: '(41) 99999-0001', website: 'a.com' }),
  poi(20, { name: 'B', phone: '(41) 3000-0000' }),
  poi(11, { name: 'D', phone: '(41) 99999-0002', website: 'd.com' }),
];
const fila = ranquear(amostra).map((e) => e.id);
assert.deepEqual(fila, ranquear([...amostra].reverse()).map((e) => e.id), 'ordem estável (offset depende disso)');
assert.deepEqual(fila, [10, 11, 20, 30], 'contato real primeiro, desempate por id');
// duas "páginas" da mesma busca não podem se sobrepor nem pular ninguém
const p1 = fila.slice(0, 2), p2 = fila.slice(2, 4);
assert.deepEqual([...p1, ...p2], fila, 'páginas 1 e 2 cobrem a fila inteira sem repetir');
assert.deepEqual(ranquear(amostra, true).map((e) => e.id), [10, 11], 'apenas_whatsapp filtra fixo antes de paginar');

console.log('ok — motor, copy curta (<250) e paginação da mineração');
