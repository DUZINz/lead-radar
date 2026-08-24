// Copy comercial dos ganchos. Separado do motor porque é o que mais muda — e quem edita
// é o vendedor, não o programador. Cada gancho vai inteiro no ?text= do WhatsApp.

export const VENDEDOR = {
  nome: 'Eduardo',
  portfolio: 'https://portfolio-murex-alpha-23.vercel.app/',
};

const { nome: EU, portfolio: PORT } = VENDEDOR;

// blocos repetidos em todas as ofertas: prova (portfólio) e quebra de objeção (preço)
const PROVA = `Deixo meu portfólio aqui. São projetos-modelo que construí para demonstração — cada um feito do zero, no mesmo padrão do que entrego para cliente real. E não são imagens: os painéis abrem no navegador e funcionam mesmo, dá pra buscar, filtrar e cadastrar:\n${PORT}`;
const PRECO = 'Se quiser, te mando aqui minha tabela de preços em PDF pra você dar uma olhada sem compromisso — trabalho com preço fechado, código próprio e sem mensalidade de plataforma.';

const monta = (...blocos) => blocos.filter(Boolean).join('\n\n');

// Segunda mensagem: o que mandar quando o lead responde "pode mandar" / "quero ver".
// Entrega o valor em 3 pontos concretos e termina oferecendo a tabela de preços.
const FECHO_PRECO = 'Te mando a tabela de preços em PDF agora?';

export const FOLLOWUPS = {
  erp: (l) => monta(
    `Fechado! Em 3 pontos, o que muda no dia a dia da ${l.nome}:`,
    '*1. Um lugar só, em vez de sete*\nCadastro, agenda, serviço, pagamento e histórico na mesma tela. Acaba a caça ao arquivo certo e o "qual versão da planilha é a boa?".',
    '*2. Você digita uma vez*\nO que entra no atendimento já aparece no financeiro e no relatório. Sem redigitar, sem erro de "faltou lançar".',
    '*3. O número do mês na hora que você quiser*\nQuanto entrou, quanto está em aberto, quem é o cliente que mais volta. Hoje isso só existe depois que alguém senta e soma.',
    'É feito sob medida com as etapas que vocês já usam — ninguém precisa mudar o jeito de trabalhar pra caber num sistema pronto. Roda no celular e no computador, e o treinamento da equipe entra junto.',
    FECHO_PRECO),

  ia: (l) => monta(
    `Fechado! Em 3 pontos, o que muda no atendimento da ${l.nome}:`,
    '*1. Resposta em segundos, 24h*\nMensagem de domingo à noite ou no meio do corre é respondida na hora, no tom de vocês. Quem pergunta preço às 22h não vai dormir esperando — e não fecha com o concorrente.',
    '*2. Chega em você só quem vale*\nA IA tira as dúvidas repetidas (preço, horário, endereço, como funciona), entende o que a pessoa quer e só passa pra equipe quem está pronto pra fechar.',
    '*3. Agendamento e registro automáticos*\nEla agenda, confirma, lembra no dia e deixa tudo registrado. Nada de "mandei mensagem e ninguém respondeu".',
    'Ela é treinada com as suas informações e o seu jeito de falar — não é robô genérico de "digite 1". E você continua podendo assumir a conversa a qualquer momento.',
    FECHO_PRECO),

  mobile: (l) => monta(
    `Fechado! Em 3 pontos, o que muda pra ${l.nome} e pros seus clientes:`,
    '*1. O cliente se resolve sozinho*\nAgendar, remarcar, ver histórico, 2ª via, pagar. Sem ligar, sem esperar alguém abrir o WhatsApp.',
    '*2. Ele volta sem você lembrar*\nAviso automático de retorno, vencimento e promoção direto no celular dele. É recompra que hoje se perde por esquecimento.',
    '*3. Sua equipe para de ser telefonista*\nAs perguntas repetidas somem da rotina e sobra tempo pra atender bem quem está na sua frente.',
    'Começa enxuto, com o que vocês mais usam, e cresce depois. Tudo com a sua marca — o cliente vê a sua empresa, não a de uma plataforma.',
    FECHO_PRECO),

  api: (l) => monta(
    `Fechado! Em 3 pontos, o que muda na operação da ${l.nome}:`,
    '*1. O dado é digitado uma vez só*\nO que entra num sistema aparece nos outros sozinho. Aquela hora diária de copiar de um lado pro outro deixa de existir.',
    '*2. Os números passam a bater*\nEstoque, caixa e relatório saem da mesma fonte. Acaba a divergência que ninguém consegue explicar no fim do mês.',
    '*3. Sem trocar o que já funciona*\nEu ligo as ferramentas que vocês já usam por API. Se algo precisar ser migrado, faço com a operação rodando — ninguém para um dia de trabalho.',
    'Antes de qualquer coisa eu mapeio onde está o retrabalho hoje e te mostro o desenho: o que conversa com o quê e o que vai deixar de ser manual.',
    FECHO_PRECO),

  web: (l) => monta(
    `Fechado! Em 3 pontos, o que muda pra ${l.nome}:`,
    `*1. Ser achado por quem já está procurando*\nQuem pesquisa "${String(l.cnae || 'seu serviço').toLowerCase()} em ${l.cidade}" no Google hoje encontra o concorrente${l.site ? ' — e mesmo com site, um lento entra depois na fila do Google' : ', porque vocês não têm site'}. A página é preparada pros termos que as pessoas realmente digitam.`,
    '*2. A página responde antes de você*\nServiços, valores, horário, fotos e depoimentos: é o que a pessoa quer saber antes de entrar em contato. Chega menos "quanto custa?" e mais gente já decidida.',
    '*3. O contato cai organizado no seu WhatsApp*\nBotão de orçamento/agendamento que puxa nome, telefone e o que a pessoa quer. Você para de perder quem mandou mensagem de madrugada.',
    'Abre em 1 a 2 segundos no celular, que é de onde quase todo mundo acessa. E é código próprio: sem mensalidade de construtor de site e sem ficar refém de plataforma.',
    FECHO_PRECO),
};

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
