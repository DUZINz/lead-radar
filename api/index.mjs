// Serverless Function da Vercel — todas as rotas /api/* caem aqui (ver rewrite no vercel.json).
// A lógica é a mesma do servidor local; o que muda é a persistência: ver SERVERLESS em server.mjs.
export { default } from '../server.mjs';
