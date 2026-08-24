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
assert.ok(leads.json.total > 0, 'a function serve a base sem banco');
assert.ok(leads.json.facetas.mineracao.length >= 10, 'catálogo de mineração exposto');
assert.equal(leads.json.leads[0].gancho.length > 80, true, 'scoring roda na function');

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

console.log('ok — handler serverless (sem disco, sem SQLite)');
