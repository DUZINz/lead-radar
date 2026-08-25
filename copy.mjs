// Copy comercial dos ganchos. Separado do motor porque é o que mais muda — e quem edita
// é o vendedor, não o programador. Cada gancho vai inteiro no ?text= do WhatsApp.

export const VENDEDOR = {
  nome: 'Eduardo Grunitzky',
  portfolio: 'https://portfolio-murex-alpha-23.vercel.app/',
};

const { nome: EU, portfolio: PORT } = VENDEDOR;

// blocos repetidos em todas as ofertas: prova (portfólio) e quebra de objeção (preço)
const PROVA = `Deixo meu portfólio aqui. São projetos-modelo que construí para demonstração — cada um feito do zero, no mesmo padrão do que entrego para cliente real. E não são imagens: os painéis abrem no navegador e funcionam mesmo, dá pra buscar, filtrar e cadastrar:\n${PORT}`;
const PRECO = 'Se quiser, te mando aqui minha tabela de preços em PDF pra você dar uma olhada sem compromisso — trabalho com preço fechado, código próprio e sem mensalidade de plataforma.';

const monta = (...blocos) => blocos.filter(Boolean).join('\n\n');

// O campo `name` do OSM vem com emoji e keyword stuffing de SEO local:
// "👨‍⚕️ Dr Carlos Dalmaso | Telemedicina - Check up | Clínico Geral em Curitiba" (90 chars).
// Escrever isso numa mensagem denuncia disparo automático — e estoura o limite de 250.
const curto = (nome) => {
  const n = String(nome ?? '')
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')   // emoji do cadastro
    .split(/\s*[|·–—]\s*|\s+-\s+/)[0]                            // corta no 1º separador de keyword
    .replace(/\s*\([^)]*\)/g, '')                                // "IBIO (Instituto Brasileiro…)"
    .replace(/\s+/g, ' ').trim();
  if (!n) return String(nome ?? '').trim().slice(0, 40);
  if (n.length <= 40) return n;
  const corte = n.slice(0, 40);                                  // guarda-chuva: corta em palavra
  const esp = corte.lastIndexOf(' ');
  return esp > 15 ? corte.slice(0, esp) : corte;
};

// Segunda mensagem: o que mandar quando o lead responde "pode mandar" / "quero ver".
// Entrega o valor em 3 pontos concretos e SÓ AQUI entram portfólio e preço — link e tabela
// no primeiro contato derrubam a taxa de resposta (e cheiram a disparo em massa).
const FECHO = [PROVA, PRECO];

export const FOLLOWUPS = {
  erp: (l) => monta(
    `Fechado! Em 3 pontos, o que muda no dia a dia da ${curto(l.nome)}:`,
    '*1. Um lugar só, em vez de sete*\nCadastro, agenda, serviço, pagamento e histórico na mesma tela. Acaba a caça ao arquivo certo e o "qual versão da planilha é a boa?".',
    '*2. Você digita uma vez*\nO que entra no atendimento já aparece no financeiro e no relatório. Sem redigitar, sem erro de "faltou lançar".',
    '*3. O número do mês na hora que você quiser*\nQuanto entrou, quanto está em aberto, quem é o cliente que mais volta. Hoje isso só existe depois que alguém senta e soma.',
    'É feito sob medida com as etapas que vocês já usam — ninguém precisa mudar o jeito de trabalhar pra caber num sistema pronto. Roda no celular e no computador, e o treinamento da equipe entra junto.',
    ...FECHO),

  ia: (l) => monta(
    `Fechado! Em 3 pontos, o que muda no atendimento da ${curto(l.nome)}:`,
    '*1. Resposta em segundos, 24h*\nMensagem de domingo à noite ou no meio do corre é respondida na hora, no tom de vocês. Quem pergunta preço às 22h não vai dormir esperando — e não fecha com o concorrente.',
    '*2. Chega em você só quem vale*\nA IA tira as dúvidas repetidas (preço, horário, endereço, como funciona), entende o que a pessoa quer e só passa pra equipe quem está pronto pra fechar.',
    '*3. Agendamento e registro automáticos*\nEla agenda, confirma, lembra no dia e deixa tudo registrado. Nada de "mandei mensagem e ninguém respondeu".',
    'Ela é treinada com as suas informações e o seu jeito de falar — não é robô genérico de "digite 1". E você continua podendo assumir a conversa a qualquer momento.',
    ...FECHO),

  mobile: (l) => monta(
    `Fechado! Em 3 pontos, o que muda pra ${curto(l.nome)} e pros seus clientes:`,
    '*1. O cliente se resolve sozinho*\nAgendar, remarcar, ver histórico, 2ª via, pagar. Sem ligar, sem esperar alguém abrir o WhatsApp.',
    '*2. Ele volta sem você lembrar*\nAviso automático de retorno, vencimento e promoção direto no celular dele. É recompra que hoje se perde por esquecimento.',
    '*3. Sua equipe para de ser telefonista*\nAs perguntas repetidas somem da rotina e sobra tempo pra atender bem quem está na sua frente.',
    'Começa enxuto, com o que vocês mais usam, e cresce depois. Tudo com a sua marca — o cliente vê a sua empresa, não a de uma plataforma.',
    ...FECHO),

  api: (l) => monta(
    `Fechado! Em 3 pontos, o que muda na operação da ${curto(l.nome)}:`,
    '*1. O dado é digitado uma vez só*\nO que entra num sistema aparece nos outros sozinho. Aquela hora diária de copiar de um lado pro outro deixa de existir.',
    '*2. Os números passam a bater*\nEstoque, caixa e relatório saem da mesma fonte. Acaba a divergência que ninguém consegue explicar no fim do mês.',
    '*3. Sem trocar o que já funciona*\nEu ligo as ferramentas que vocês já usam por API. Se algo precisar ser migrado, faço com a operação rodando — ninguém para um dia de trabalho.',
    'Antes de qualquer coisa eu mapeio onde está o retrabalho hoje e te mostro o desenho: o que conversa com o quê e o que vai deixar de ser manual.',
    ...FECHO),

  web: (l) => monta(
    `Fechado! Em 3 pontos, o que muda pra ${curto(l.nome)}:`,
    `*1. Ser achado por quem já está procurando*\nQuem pesquisa "${String(l.cnae || 'seu serviço').toLowerCase()} em ${l.cidade}" no Google hoje encontra o concorrente${l.site ? ' — e mesmo com site, um lento entra depois na fila do Google' : ', porque vocês não têm site'}. A página é preparada pros termos que as pessoas realmente digitam.`,
    '*2. A página responde antes de você*\nServiços, valores, horário, fotos e depoimentos: é o que a pessoa quer saber antes de entrar em contato. Chega menos "quanto custa?" e mais gente já decidida.',
    '*3. O contato cai organizado no seu WhatsApp*\nBotão de orçamento/agendamento que puxa nome, telefone e o que a pessoa quer. Você para de perder quem mandou mensagem de madrugada.',
    'Abre em 1 a 2 segundos no celular, que é de onde quase todo mundo acessa. E é código próprio: sem mensalidade de construtor de site e sem ficar refém de plataforma.',
    ...FECHO),
};

// Primeiro contato: 3 blocos e nada mais — apresentação, UMA observação concreta sobre o
// negócio dele, e uma pergunta aberta de baixo atrito. Sem link, sem preço, sem pitch.
// Regra dura: abaixo de 250 caracteres (test_score.mjs cobre). Wall of text no primeiro
// disparo é bloqueio na certa — o resto da conversa mora em FOLLOWUPS.
const seg = (ms) => (ms / 1000).toFixed(1).replace('.', ',');

export const GANCHOS = {
  erp: (l) => monta(
    `Olá! Tudo bem? Me chamo ${EU}, desenvolvo sistemas de gestão sob medida.`,
    l.sistemas.length
      ? `Vi que a ${curto(l.nome)} toca a operação com ${l.sistemas.join(' e ')}.`
      : `Dei uma olhada na ${curto(l.nome)} e não achei sinal de um sistema de gestão próprio.`,
    'Vocês já têm alguém cuidando disso por aí hoje?'),

  ia: (l) => monta(
    `Olá! Tudo bem? Me chamo ${EU}, trabalho com automação de atendimento.`,
    `Vi que a ${curto(l.nome)} atende ${l.whatsapp ? 'pelo WhatsApp' : 'por telefone'} e recebe bastante contato.`,
    'Faz sentido eu te mandar uma prévia de como automatizar isso?'),

  mobile: (l) => monta(
    `Olá! Tudo bem? Me chamo ${EU}, desenvolvo apps e áreas do cliente.`,
    `A ${curto(l.nome)} tem cliente que volta sempre — hoje ele liga pra remarcar?`,
    'Vocês já têm alguma coisa nesse sentido rodando?'),

  api: (l) => monta(
    `Olá! Tudo bem? Me chamo ${EU}, trabalho com integração entre sistemas.`,
    `Contei ${l.sistemas.length} ferramentas rodando na ${curto(l.nome)} — o mesmo dado entra em mais de uma?`,
    'Vocês já têm alguém cuidando dessa integração hoje?'),

  web: (l) => monta(
    `Olá! Tudo bem? Me chamo ${EU}, desenvolvo sites rápidos e sob medida.`,
    // nunca afirmar o que não foi medido: 'protegido' é site que existe e responde,
    // só não deixa medir (Cloudflare). Dizer "está defasado" nesse caso queima o lead.
    !l.site
      ? `Procurei o site da ${curto(l.nome)} e não achei — vocês estão só ${l.instagram ? 'no Instagram' : 'no WhatsApp'} hoje, né?`
      : l.site_status === 'protegido'
        ? `Vi que a ${curto(l.nome)} tem site, mas não consegui abrir daqui pra dar uma olhada.`
        : l.site_ms
          ? `Testei o site da ${curto(l.nome)} agora: levou ${seg(l.site_ms)}s pra abrir.`
          : `Tentei abrir o site da ${curto(l.nome)} agora e ele não respondeu.`,
    'Vocês já têm alguém cuidando disso por aí hoje?'),
};
