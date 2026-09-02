// node test_serverless.mjs — checa o caminho de deploy da Vercel: a function importa o handler,
// nenhum SQLite é aberto e as rotas respondem sem tocar em disco.
import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';

process.env.VERCEL = '1';
const antes = existsSync('leadradar.db');
const { default: handler } = await import('./api/index.mjs');

const chamar = async (method, url, body) => {
  const req = Object.assign(
    // Node entrega o body em Buffer, não string — é assim que o handler recebe de verdade
    body ? { async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body), 'utf8'); } } : {},
    { method, url });
  const res = { writeHead(code, h) { this.code = code; this.h = h; return this; }, end(b) { this.body = b; } };
  await handler(req, res);
  return { code: res.code ?? 200, json: JSON.parse(res.body) };
};

const leads = await chamar('GET', '/api/leads');
assert.equal(leads.json.total, 0, 'base começa vazia no serverless: sem mock, sem banco');
assert.ok(leads.json.facetas.mineracao.length >= 10, 'catálogo de mineração exposto');
const br = leads.json.facetas.paises.find((p) => p.id === 'BR');
assert.equal(leads.json.facetas.paises.length, 5, 'os 5 países ligados chegam na tela');
assert.ok(br.estados.PR === 'Paraná', 'UFs disponíveis para minerar');

// escrita vira no-op: quem persiste no serverless é o localStorage do navegador
assert.deepEqual((await chamar('POST', '/api/status', { cnpj: 'X', status: 'contatado' })).json, { ok: true });
assert.equal((await chamar('GET', '/api/historico')).json.length, 0);
assert.equal((await chamar('POST', '/api/excluir', { cnpjs: ['X'] })).json.excluidos, 0);
assert.equal((await chamar('GET', '/api/leads?status=contatado')).json.total, 0, 'nada persistiu no servidor');

assert.equal(existsSync('leadradar.db'), antes, 'não criou banco em disco (FS read-only na Vercel)');

// acento tem que sobreviver ao body: "Maringá" quebrado é mineração vazia sem erro
const eco = await chamar('POST', '/api/minerar', { nicho: 'inexistente', cidade: 'Maringá', uf: 'PR' });
assert.match(eco.json.erro, /inexistente/, 'body chega parseado');
const viaBody = await chamar('POST', '/api/status', { cnpj: 'São José/Ç', status: 'novo' });
assert.deepEqual(viaBody.json, { ok: true }, 'cnpj com acento não quebra o parse');

// Consulta estourada volta HTTP 200 com elements vazio e o motivo só no `remark` — sem olhar
// ali, "restaurantes nos EUA inteiro" era reportado como "nada encontrado" em vez de área grande.
const realFetch = globalThis.fetch;
let chamadas = 0;
globalThis.fetch = async () => {
  chamadas++;
  return new Response(JSON.stringify({ elements: [], remark: 'runtime error: Query timed out in "query" at line 3 after 91 seconds.' }),
    { status: 200, headers: { 'content-type': 'application/json' } });
};
const estourou = await chamar('POST', '/api/minerar', { nicho: 'restaurantes', pais: 'US', escopo: 'estado', estado: 'CA' });
assert.match(estourou.json.erro, /grande demais/, 'timeout de consulta não pode virar "nada encontrado"');
assert.equal(chamadas, 1, 'área grande demais não se resolve tentando o outro espelho');

// país inteiro é varredura estado a estado: um estado que estoura é pulado, não derruba a busca
chamadas = 0;
const nacional = await chamar('POST', '/api/minerar', { nicho: 'restaurantes', pais: 'US', escopo: 'pais' });
assert.ok(!nacional.json.erro, 'estado que estoura não pode derrubar a varredura nacional');
assert.equal(nacional.json.pulados.length, 51, 'os 51 estados foram tentados e reportados');
assert.equal(chamadas, 51, 'um pedido por estado, sem repetir espelho');
globalThis.fetch = realFetch;

console.log('ok — handler serverless (sem disco, sem SQLite)');
