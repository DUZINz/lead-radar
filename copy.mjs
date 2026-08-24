// Copy comercial dos ganchos. Separado do motor porque é o que mais muda — e quem edita
// é o vendedor, não o programador. Cada gancho vai inteiro no ?text= do WhatsApp.

export const VENDEDOR = {
  nome: 'Eduardo',
  portfolio: 'https://portfolio-murex-alpha-23.vercel.app/',
};

const { nome: EU, portfolio: PORT } = VENDEDOR;

// blocos repetidos em todas as ofertas: prova (portfólio) e quebra de objeção (preço)
const PROVA = `Deixo meu portfólio aqui — os painéis abrem no navegador e são de verdade, dá pra buscar, filtrar e cadastrar:\n${PORT}`;
const PRECO = 'Se quiser, te mando aqui minha tabela de preços em PDF pra você dar uma olhada sem compromisso — trabalho com preço fechado, código próprio e sem mensalidade de plataforma.';

const monta = (...blocos) => blocos.filter(Boolean).join('\n\n');

export const GANCHOS = {
  erp: (l) => monta(
    `Oi! Tudo bem? Aqui é o ${EU}, desenvolvo sistemas de gestão sob medida.`,
    l.sistemas.length
      ? `Vi que a ${l.nome} toca a operação com ${l.sistemas.join(', ')}.`
      : `Dei uma olhada na ${l.nome} e, pelo que aparece publicamente, vocês ainda não têm um sistema de gestão próprio.`,
    `Na prática isso cobra caro em silêncio: ${l.funcionarios ? `com ${l.funcionarios} pessoas${l.unidades > 1 ? ` e ${l.unidades} unidades` : ''}, ` : ''}são horas por semana redigitando o que já foi feito, e no fechamento do mês ninguém sabe qual número está certo.`,
    'Eu monto um sistema enxuto, só com o que vocês usam de verdade — cadastro, agenda, financeiro e relatório no lugar da planilha. Sem pagar por módulo que ninguém abre.',
    PROVA,
    PRECO,
    `Faz sentido eu te mostrar em 15 minutos como ficaria o fluxo da ${l.nome}?`),

  ia: (l) => monta(
    `Oi! Tudo bem? Aqui é o ${EU}, trabalho com automação e atendimento por IA.`,
    `Vi que a ${l.nome} tem um volume de contato ${l.volume_atendimento} e atende ${l.whatsapp ? 'pelo WhatsApp' : 'por telefone'}.`,
    'O problema não é o atendimento — é o horário. Mensagem que chega fora do expediente ou no meio do corre vira cliente esperando, e cliente esperando fecha com quem responder primeiro.',
    'Eu coloco um atendente de IA respondendo no seu tom 24h por dia: tira dúvida, qualifica, agenda e passa pro humano só o que vale a pena.',
    PROVA,
    PRECO,
    'Quer que eu monte uma demonstração respondendo as perguntas que vocês mais recebem?'),

  mobile: (l) => monta(
    `Oi! Tudo bem? Aqui é o ${EU}, desenvolvo aplicativos e áreas do cliente sob medida.`,
    `A ${l.nome} tem cliente que volta sempre${l.seguidores ? ` e ${l.seguidores.toLocaleString('pt-BR')} seguidores acompanhando` : ''} — e é justamente aí que dá pra ganhar tempo.`,
    'Hoje, pra qualquer coisa (remarcar, 2ª via, ver histórico), o cliente precisa ligar ou mandar mensagem — e alguém da equipe para o que está fazendo pra responder.',
    'Uma área do cliente resolve isso sozinha: agendamento, histórico, pagamento e lembrete automático. Menos telefone tocando e mais recompra, sem contratar ninguém pra isso.',
    PROVA,
    PRECO,
    `Te mando um protótipo rápido com a cara da ${l.nome} pra você ver como ficaria?`),

  api: (l) => monta(
    `Oi! Tudo bem? Aqui é o ${EU}, trabalho com integração entre sistemas.`,
    `Contei ${l.sistemas.length} ferramentas rodando na ${l.nome}: ${l.sistemas.join(', ')}.`,
    'Onde não existe integração, alguém está digitando o mesmo dado duas vezes — e é sempre daí que nasce divergência de estoque, de caixa e de relatório que ninguém consegue explicar.',
    'Eu faço a ponte via API entre o que vocês já usam, sem trocar de sistema, e a migração dos dados sem parar a operação.',
    PROVA,
    PRECO,
    'Vale 15 minutos pra eu mapear onde está o retrabalho hoje?'),

  web: (l) => monta(
    `Oi! Tudo bem? Aqui é o ${EU}, desenvolvo sites e plataformas de alta performance.`,
    l.site
      ? `Testei o site da ${l.nome} agora: ele está ${l.site_status}${l.site_ms ? ` (${(l.site_ms / 1000).toFixed(1)}s pra abrir)` : ''}.`
      : `Procurei o site da ${l.nome} e não achei — vocês estão só ${l.instagram ? 'no Instagram' : 'no telefone e WhatsApp'}.`,
    l.site
      ? 'Site lento perde cliente antes de abrir: cada segundo a mais derruba conversão e ainda faz o Google te mostrar depois do concorrente.'
      : `Quem procura "${String(l.cnae || '').toLowerCase()} em ${l.cidade}" no Google hoje encontra o concorrente. E rede social a gente não é dono — o site é o único canal que é seu.`,
    'Eu entrego uma plataforma rápida, preparada pro Google e com captação de contato integrada. Código próprio, sem mensalidade de construtor de site.',
    PROVA,
    PRECO,
    `Quer que eu te mande o que muda na prática no caso da ${l.nome}?`),
};
