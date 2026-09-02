// node test_score.mjs — checa o motor de oportunidade. Sem framework.
import assert from 'node:assert/strict';
import { enriquecer, ranquear, ehCelular, e164 } from './server.mjs';
import { GANCHOS, IDIOMAS } from './copy.mjs';

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
// as mesmas regras valem nos 3 idiomas — tradução longa demais estoura o ?text= igual
for (const idioma of Object.keys(IDIOMAS)) {
  for (const [oferta, gancho] of Object.entries(GANCHOS)) {
    for (const caso of [
      { nome: LONGO, sistemas: ['planilha', 'agenda em papel', 'caderno'], site: '', site_status: 'nenhum' },
      { nome: LONGO, sistemas: [], site: 'x.com.br', site_status: 'lento', site_ms: 1840 },
      { nome: 'X', sistemas: [], site: 'x.com.br', site_status: 'protegido', site_ms: null },
    ]) {
      const msg = gancho({ ...base, ...caso, idioma });
      assert.ok(msg.length < 250, `gancho ${oferta}/${idioma} tem ${msg.length} chars (limite 250): ${msg}`);
      assert.ok(!/https?:\/\//.test(msg), `gancho ${oferta}/${idioma} não pode levar link no 1º contato`);
      assert.ok(!/tabela de preços|price list|listino/.test(msg), `gancho ${oferta}/${idioma} não pode falar de preço`);
      assert.ok(msg.split('\n\n').length <= 4, `gancho ${oferta}/${idioma} passou de 4 blocos`);
      assert.ok(!msg.includes('|') && !/[\p{Extended_Pictographic}]/u.test(msg),
        `gancho ${oferta}/${idioma} carregou keyword stuffing/emoji do cadastro OSM: ${msg}`);
    }
  }
}
// idioma vem do país minerado: mesmo lead, mensagem na língua de quem vai ler
const it = e({ nome: 'Studio Rossi', pais: 'IT', idioma: 'it', site: '', site_status: 'nenhum' });
assert.match(it.gancho, /^Buongiorno! Sono Eduardo/, 'lead italiano recebe gancho em italiano');
assert.match(it.followup, /Le lascio il mio portfolio/, 'follow-up também traduzido');
assert.match(e({ pais: 'US', idioma: 'en' }).gancho, /^Hi! My name is/, 'lead americano recebe gancho em inglês');
assert.match(e({}).gancho, /^Olá!/, 'lead sem idioma (base antiga) continua em português');
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

// ---- telefone por país: é o número que vai virar link do WhatsApp ----
// o DDI só pode sair quando o resto ainda é um número nacional plausível
assert.equal(ehCelular('(41) 99999-0000', 'BR'), true);
assert.equal(ehCelular('+55 41 99999-0000', 'BR'), true, 'com DDI explícito é o mesmo celular');
assert.equal(ehCelular('(41) 3000-0000', 'BR'), false, 'fixo BR não é celular');
assert.equal(ehCelular('(55) 99999-0000', 'BR'), true, 'DDD 55 não pode ser confundido com o DDI 55');
assert.equal(ehCelular('+39 320 1234567', 'IT'), true);
assert.equal(ehCelular('3931234567', 'IT'), true, 'celular italiano começando em 39 não perde os 2 primeiros dígitos');
assert.equal(ehCelular('+39 02 12345678', 'IT'), false, 'fixo de Milão não é celular');
assert.equal(ehCelular('+351 912 345 678', 'PT'), true);
assert.equal(ehCelular('+351 21 123 4567', 'PT'), false, 'fixo de Lisboa não é celular');
assert.equal(ehCelular('07123 456789', 'GB'), true, 'o 0 de tronco britânico sai antes de testar');
assert.equal(ehCelular('+44 20 7123 4567', 'GB'), false, 'fixo de Londres não é celular');
assert.equal(ehCelular('(415) 555-1234', 'US'), true, 'nos EUA não dá pra separar fixo de móvel: entra');
assert.equal(e164('07123 456789', 'GB'), '+447123456789', 'link do WhatsApp sai em E.164');
assert.equal(e164('+55 41 99999-0000', 'BR'), '+5541999990000');
assert.equal(e164('', 'BR'), '', 'sem telefone não inventa link');

// a prioridade Alta depende do canal — e a regra de canal é a do país do lead
const semPresenca = { abertura: null, sistemas: [], funcionarios: 0, email: '', site: '', site_status: 'nenhum',
  nicho: 'saude', volume_atendimento: 'alto', recorrencia: true, origem: 'osm' };
assert.equal(e({ ...semPresenca, pais: 'IT', idioma: 'it', whatsapp: '+39 320 1234567' }).prioridade, 'Alta',
  'celular italiano é canal acionável');
assert.equal(e({ ...semPresenca, pais: 'IT', idioma: 'it', whatsapp: '+39 02 12345678' }).prioridade, 'Média',
  'fixo italiano não vira Alta');

console.log('ok — motor, copy curta (<250) nos 3 idiomas, telefone por país e paginação');
