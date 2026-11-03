// node test_serverless.mjs — checa o caminho de deploy da Vercel: server.mjs vira função sozinho
// ("root entrypoint" — a Vercel não builda mais api/index.mjs em separado), nenhum SQLite é
// aberto e as rotas respondem sem tocar em disco.
import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';

process.env.VERCEL = '1';
const antes = existsSync('leadradar.db');
const { default: handler } = await import('./server.mjs');

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
const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url) => {
  if (String(url).includes('nominatim')) return json([]);   // área não resolvida aqui: cai no Overpass por nome
  chamadas++;
  return new Response(JSON.stringify({ elements: [], remark: 'runtime error: Query timed out in "query" at line 3 after 91 seconds.' }),
    { status: 200, headers: { 'content-type': 'application/json' } });
};
const estourou = await chamar('POST', '/api/minerar', { nicho: 'restaurantes', pais: 'US', escopo: 'estado', estado: 'CA' });
assert.match(estourou.json.erro, /grande demais/, 'timeout de consulta não pode virar "nada encontrado"');
assert.equal(chamadas, 4, 'cada espelho tenta uma vez — e para no 1º filtro de nome: área grande demais é fatal');

// país inteiro é varredura estado a estado: um estado que estoura é pulado, não derruba a busca
chamadas = 0;
const nacional = await chamar('POST', '/api/minerar', { nicho: 'restaurantes', pais: 'US', escopo: 'pais' });
assert.ok(!nacional.json.erro, 'estado que estoura não pode derrubar a varredura nacional');
assert.equal(nacional.json.pulados.length, 51, 'os 51 estados foram tentados e reportados');
assert.equal(chamadas, 51 * 4, 'um pedido por espelho em cada estado, sem repetir');

// Espelho engasgado não pode segurar a busca: o próximo entra depois de ESCALA ms e quem
// responder primeiro ganha. Antes era um depois do outro, até 45s cada — a Vercel matava a
// function no meio e o celular só mostrava "Load failed".
const { corrida, areaNominatim } = await import('./server.mjs');
let abortados = 0;
globalThis.fetch = async (url, { signal }) => {
  if (String(url).includes('lento')) return new Promise((_, nao) =>
    signal.addEventListener('abort', () => { abortados++; nao(signal.reason); }));
  return json({ elements: [{ type: 'area', id: 3600000001, tags: { name: 'A' } }, { type: 'node', id: 1, tags: { name: 'X' } }] });
};
const t0 = Date.now();
const venceu = await corrida('q', 20000, ['https://lento/api', 'https://rapido/api']);
assert.equal(venceu.elements.length, 2, 'o espelho que respondeu é o que vale');
assert.ok(Date.now() - t0 < 6000, 'espelho travado não segura a busca até o timeout');
assert.equal(abortados, 1, 'o espelho perdedor é abortado, não fica pendurado');

// todos travados: estoura no prazo pedido, como TimeoutError — e não depois
const t1 = Date.now();
await assert.rejects(corrida('q', 800, ['https://lento/a', 'https://lento/b']), { name: 'TimeoutError' });
assert.ok(Date.now() - t1 < 2000, 'respeita o prazo da resposta');

// rate limit em todos: a mensagem diz que está ocupada, não "resposta inválida"
globalThis.fetch = async () => new Response('<html>429 Too Many Requests</html>', { status: 429 });
await assert.rejects(corrida('q', 5000, ['https://a/x', 'https://b/x']), /ocupada/);

// Espelho que responde rápido e errado não pode ganhar: instância quebrada devolve HTTP 200 com
// o erro só no remark, e espelho sem as áreas geradas devolve vazio na hora. Os dois perdiam a
// corrida pro espelho bom — foi o que derrubou TODA busca com "base lenta" no deploy anterior.
const bom = { elements: [{ type: 'area', id: 3600000009, tags: { name: 'Curitiba' } }, { type: 'node', id: 5, tags: { name: 'Bar' } }] };
const atraso = (ms, v) => new Promise((ok) => setTimeout(() => ok(v), ms));
globalThis.fetch = async (url) => String(url).includes('quebrado')
  ? json({ elements: [], remark: 'runtime error: open64: 2 No such file or directory /osm3s_v0.7.62_areas Dispatcher_Client::1' })
  : String(url).includes('semarea') ? json({ elements: [] }) : atraso(300, json(bom));
assert.deepEqual(await corrida('q', 10000, ['https://quebrado/a', 'https://bom/a']), bom, 'remark de erro é falha daquele espelho');
assert.deepEqual(await corrida('q', 10000, ['https://semarea/a', 'https://bom/a']), bom, 'resposta sem a área não ganha');
// dois espelhos concordando que a área não existe é "não existe" — não espera o resto até o prazo
const t2 = Date.now();
const nada = await corrida('q', 20000, ['https://semarea/a', 'https://semarea/b', 'https://lento/c']);
assert.equal(nada.elements.length, 0);
assert.ok(Date.now() - t2 < 2000, 'consenso de 2 resolve sem esperar o espelho travado');
// todos com defeito: erro de instabilidade, não "lenta"
await assert.rejects(corrida('q', 5000, ['https://quebrado/a', 'https://quebrado/b']), (e) => e.tipo === 'espelho');

// Nominatim: só vale fronteira com o mesmo nome (sem acento), e o id vira área do Overpass
globalThis.fetch = async () => json([
  { osm_type: 'node', osm_id: 9, class: 'place', name: 'Curitiba', addresstype: 'city' },
  { osm_type: 'relation', osm_id: 297514, class: 'boundary', name: 'Curitiba', addresstype: 'city' }]);
assert.equal(await areaNominatim('BR', { escopo: 'cidade', estado: 'PR', cidade: 'curitiba' }), 3600297514);
globalThis.fetch = async () => json([{ osm_type: 'relation', osm_id: 1, class: 'boundary', name: 'Região Metropolitana', addresstype: 'state' }]);
assert.equal(await areaNominatim('BR', { escopo: 'cidade', estado: 'SC', cidade: 'Lages' }), null, 'nome diferente não é aceito');
globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
assert.equal(await areaNominatim('BR', { escopo: 'cidade', estado: 'SC', cidade: 'Joinville' }), null, 'Nominatim fora do ar não derruba a busca');

// mineração por cidade com Nominatim resolvendo: a consulta usa o id direto, sem a cascata por nome
const queries = [];
globalThis.fetch = async (url, op = {}) => {
  if (String(url).includes('nominatim')) return json([{ osm_type: 'relation', osm_id: 42, class: 'boundary', name: 'Maringá', addresstype: 'city' }]);
  if (op.method === 'POST') { queries.push(op.body);
    return json({ elements: [{ type: 'area', id: 3600000042, tags: { name: 'Maringá' } },
      { type: 'node', id: 7, tags: { name: 'Pizzaria Boa', phone: '+55 44 99999-0000' } }] }); }
  throw new TypeError('sem rede pro site');
};
const rapida = await chamar('POST', '/api/minerar', { nicho: 'restaurantes', pais: 'BR', escopo: 'cidade', estado: 'PR', cidade: 'Maringa' });
assert.equal(rapida.json.encontrados, 1, rapida.json.erro);
assert.equal(queries.length, 1, 'uma consulta só ao Overpass');
assert.match(queries[0], /area\(id:3600000042\)/, 'área pelo id do Nominatim');
assert.equal(rapida.json.leads[0].cidade, 'Maringá', 'nome canônico continua vindo da área');


// /api/diag responde JSON nos dois modos (é o que dá pra abrir de fora pra ver a Vercel por dentro)
const dEsp = await chamar('GET', '/api/diag?cidade=Maringa&estado=PR');
assert.equal(dEsp.json.espelhos.length, 4, 'um relatório por espelho');
assert.ok(dEsp.json.espelhos.every((e) => e.pois === 1 && e.area), JSON.stringify(dEsp.json.espelhos));
const dMin = await chamar('GET', '/api/diag?modo=minerar&cidade=Maringa&estado=PR');
assert.equal(dMin.json.encontrados, 1, JSON.stringify(dMin.json));

globalThis.fetch = realFetch;

console.log('ok — handler serverless (sem disco, sem SQLite)');
