// node test_score.mjs — checa o motor de oportunidade. Sem framework.
import assert from 'node:assert/strict';
import { enriquecer } from './server.mjs';

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

// prioridade só é Alta com score forte E empresa consolidada
assert.equal(e({ sistemas: ['planilhas'], funcionarios: 40, unidades: 3, nicho: 'saude' }).prioridade, 'Alta');
assert.equal(e({ sistemas: ['planilhas'], funcionarios: 40, unidades: 3, nicho: 'saude', abertura: new Date().toISOString().slice(0, 10) }).prioridade, 'Média');
assert.equal(e({}).prioridade, 'Baixa');

// enriquecimento básico
const l = e({ sistemas: ['planilhas'], funcionarios: 40 });
assert.ok(l.gancho.includes('X') && l.gancho.length > 80, 'gancho gerado');
assert.ok(l.followup.includes('X') && l.followup.length > 200, 'follow-up gerado');
assert.ok(l.gancho.includes('portfolio-murex-alpha-23.vercel.app'), 'portfólio na abordagem');
assert.ok(/tabela de preços em PDF/.test(l.gancho) && /tabela de preços em PDF/.test(l.followup), 'oferta da tabela de preços');
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

console.log('ok — motor de oportunidade (mock + lead minerado)');
