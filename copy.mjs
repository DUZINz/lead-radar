// Copy comercial dos ganchos. Separado do motor porque é o que mais muda — e quem edita
// é o vendedor, não o programador. Cada gancho vai inteiro no ?text= do WhatsApp.
// Um bloco de textos por idioma: o lead carrega `idioma` (vem do país minerado) e a mensagem
// sai na língua de quem vai ler. Lead sem idioma = base antiga, toda brasileira = pt.

export const VENDEDOR = {
  nome: 'Eduardo Grunitzky',
  portfolio: 'https://portfolio-murex-alpha-23.vercel.app/',
};

const { nome: EU, portfolio: PORT } = VENDEDOR;

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

const seg = (ms, dec = ',') => (ms / 1000).toFixed(1).replace('.', dec);

// ---------------- português (BR / PT) ----------------

// blocos repetidos em todas as ofertas: prova (portfólio) e quebra de objeção (preço)
const PROVA_PT = `Deixo meu portfólio aqui. São projetos-modelo que construí para demonstração — cada um feito do zero, no mesmo padrão do que entrego para cliente real. E não são imagens: os painéis abrem no navegador e funcionam mesmo, dá pra buscar, filtrar e cadastrar:\n${PORT}`;
const PRECO_PT = 'Se quiser, te mando aqui minha tabela de preços em PDF pra você dar uma olhada sem compromisso — trabalho com preço fechado, código próprio e sem mensalidade de plataforma.';
// Segunda mensagem: o que mandar quando o lead responde "pode mandar" / "quero ver".
// Entrega o valor em 3 pontos concretos e SÓ AQUI entram portfólio e preço — link e tabela
// no primeiro contato derrubam a taxa de resposta (e cheiram a disparo em massa).
const FECHO_PT = [PROVA_PT, PRECO_PT];

const PT = {
  followups: {
    erp: (l) => monta(
      `Fechado! Em 3 pontos, o que muda no dia a dia da ${curto(l.nome)}:`,
      '*1. Um lugar só, em vez de sete*\nCadastro, agenda, serviço, pagamento e histórico na mesma tela. Acaba a caça ao arquivo certo e o "qual versão da planilha é a boa?".',
      '*2. Você digita uma vez*\nO que entra no atendimento já aparece no financeiro e no relatório. Sem redigitar, sem erro de "faltou lançar".',
      '*3. O número do mês na hora que você quiser*\nQuanto entrou, quanto está em aberto, quem é o cliente que mais volta. Hoje isso só existe depois que alguém senta e soma.',
      'É feito sob medida com as etapas que vocês já usam — ninguém precisa mudar o jeito de trabalhar pra caber num sistema pronto. Roda no celular e no computador, e o treinamento da equipe entra junto.',
      ...FECHO_PT),

    ia: (l) => monta(
      `Fechado! Em 3 pontos, o que muda no atendimento da ${curto(l.nome)}:`,
      '*1. Resposta em segundos, 24h*\nMensagem de domingo à noite ou no meio do corre é respondida na hora, no tom de vocês. Quem pergunta preço às 22h não vai dormir esperando — e não fecha com o concorrente.',
      '*2. Chega em você só quem vale*\nA IA tira as dúvidas repetidas (preço, horário, endereço, como funciona), entende o que a pessoa quer e só passa pra equipe quem está pronto pra fechar.',
      '*3. Agendamento e registro automáticos*\nEla agenda, confirma, lembra no dia e deixa tudo registrado. Nada de "mandei mensagem e ninguém respondeu".',
      'Ela é treinada com as suas informações e o seu jeito de falar — não é robô genérico de "digite 1". E você continua podendo assumir a conversa a qualquer momento.',
      ...FECHO_PT),

    mobile: (l) => monta(
      `Fechado! Em 3 pontos, o que muda pra ${curto(l.nome)} e pros seus clientes:`,
      '*1. O cliente se resolve sozinho*\nAgendar, remarcar, ver histórico, 2ª via, pagar. Sem ligar, sem esperar alguém abrir o WhatsApp.',
      '*2. Ele volta sem você lembrar*\nAviso automático de retorno, vencimento e promoção direto no celular dele. É recompra que hoje se perde por esquecimento.',
      '*3. Sua equipe para de ser telefonista*\nAs perguntas repetidas somem da rotina e sobra tempo pra atender bem quem está na sua frente.',
      'Começa enxuto, com o que vocês mais usam, e cresce depois. Tudo com a sua marca — o cliente vê a sua empresa, não a de uma plataforma.',
      ...FECHO_PT),

    api: (l) => monta(
      `Fechado! Em 3 pontos, o que muda na operação da ${curto(l.nome)}:`,
      '*1. O dado é digitado uma vez só*\nO que entra num sistema aparece nos outros sozinho. Aquela hora diária de copiar de um lado pro outro deixa de existir.',
      '*2. Os números passam a bater*\nEstoque, caixa e relatório saem da mesma fonte. Acaba a divergência que ninguém consegue explicar no fim do mês.',
      '*3. Sem trocar o que já funciona*\nEu ligo as ferramentas que vocês já usam por API. Se algo precisar ser migrado, faço com a operação rodando — ninguém para um dia de trabalho.',
      'Antes de qualquer coisa eu mapeio onde está o retrabalho hoje e te mostro o desenho: o que conversa com o quê e o que vai deixar de ser manual.',
      ...FECHO_PT),

    web: (l) => monta(
      `Fechado! Em 3 pontos, o que muda pra ${curto(l.nome)}:`,
      `*1. Ser achado por quem já está procurando*\nQuem pesquisa "${String(l.cnae || 'seu serviço').toLowerCase()} em ${l.cidade || 'sua região'}" no Google hoje encontra o concorrente${l.site ? ' — e mesmo com site, um lento entra depois na fila do Google' : ', porque vocês não têm site'}. A página é preparada pros termos que as pessoas realmente digitam.`,
      '*2. A página responde antes de você*\nServiços, valores, horário, fotos e depoimentos: é o que a pessoa quer saber antes de entrar em contato. Chega menos "quanto custa?" e mais gente já decidida.',
      '*3. O contato cai organizado no seu WhatsApp*\nBotão de orçamento/agendamento que puxa nome, telefone e o que a pessoa quer. Você para de perder quem mandou mensagem de madrugada.',
      'Abre em 1 a 2 segundos no celular, que é de onde quase todo mundo acessa. E é código próprio: sem mensalidade de construtor de site e sem ficar refém de plataforma.',
      ...FECHO_PT),
  },

  // Primeiro contato: 3 blocos e nada mais — apresentação, UMA observação concreta sobre o
  // negócio dele, e uma pergunta aberta de baixo atrito. Sem link, sem preço, sem pitch.
  // Regra dura: abaixo de 250 caracteres (test_score.mjs cobre, nos 3 idiomas). Wall of text
  // no primeiro disparo é bloqueio na certa — o resto da conversa mora em FOLLOWUPS.
  ganchos: {
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
  },
};

// ---------------- english (US / UK) ----------------

const PROVA_EN = `Here is my portfolio. These are demo projects I built from scratch, to the same standard as the work I deliver to paying clients. They are not screenshots: the dashboards open in your browser and actually work — you can search, filter and add records:\n${PORT}`;
const PRECO_EN = 'If it helps, I can send you my price list as a PDF to look through, no strings attached — I work with fixed quotes, my own code and no platform subscription.';
const FECHO_EN = [PROVA_EN, PRECO_EN];

const EN = {
  followups: {
    erp: (l) => monta(
      `Great! In three points, what changes day to day at ${curto(l.nome)}:`,
      '*1. One place instead of seven*\nRecords, scheduling, jobs, payments and history on the same screen. No more hunting for the right file or asking "which version of the spreadsheet is the good one?".',
      '*2. You type it in once*\nWhatever goes in at the front desk shows up in the accounts and in the reports. No re-typing, no "someone forgot to log it".',
      "*3. This month's numbers whenever you want them*\nWhat came in, what is still outstanding, which customer comes back the most. Today that only exists after someone sits down and adds it up.",
      'It is built around the steps you already use — nobody has to change how they work to fit an off-the-shelf system. It runs on phone and desktop, and training your team is included.',
      ...FECHO_EN),

    ia: (l) => monta(
      `Great! In three points, what changes in how ${curto(l.nome)} handles enquiries:`,
      '*1. Answers in seconds, around the clock*\nA message on Sunday night gets answered right away, in your tone of voice. Someone asking about prices at 10pm does not go to bed waiting — and does not buy from a competitor instead.',
      '*2. Only the ones worth your time reach you*\nThe AI clears the repeat questions (price, hours, address, how it works), works out what the person actually wants and only hands over the ones ready to buy.',
      '*3. Booking and record-keeping on autopilot*\nIt books, confirms, reminds them on the day and logs everything. No more "I messaged and nobody replied".',
      'It is trained on your information and your way of speaking — not a generic "press 1" bot. And you can take over the conversation at any point.',
      ...FECHO_EN),

    mobile: (l) => monta(
      `Great! In three points, what changes for ${curto(l.nome)} and for your customers:`,
      '*1. Customers sort themselves out*\nBook, reschedule, check their history, get a copy of an invoice, pay. No phone call, no waiting for someone to open WhatsApp.',
      '*2. They come back without you chasing them*\nAutomatic reminders for follow-ups, renewals and offers, straight to their phone. That is repeat business you lose today purely to forgetfulness.',
      '*3. Your team stops being a switchboard*\nThe repeat questions drop out of the day, leaving time for the people actually standing in front of them.',
      'It starts small, with what you use most, and grows from there. All under your brand — the customer sees your business, not a platform.',
      ...FECHO_EN),

    api: (l) => monta(
      `Great! In three points, what changes in how ${curto(l.nome)} runs:`,
      '*1. Data gets typed in once*\nWhat goes into one system shows up in the others on its own. That daily hour of copying from one place to another stops existing.',
      '*2. The numbers start matching*\nStock, cash and reporting all come from the same source. No more month-end discrepancy that nobody can explain.',
      '*3. Without replacing what already works*\nI connect the tools you already use over their APIs. If something has to be migrated, I do it with the business still running — nobody loses a day of work.',
      'The first thing I do is map where the double work is today and show you the picture: what talks to what, and what stops being manual.',
      ...FECHO_EN),

    web: (l) => monta(
      `Great! In three points, what changes for ${curto(l.nome)}:`,
      `*1. Getting found by people already looking*\nSomeone searching for what you do in ${l.cidade || 'your area'} today finds a competitor${l.site ? ' — and even with a site, a slow one lands further down Google' : ', because you do not have a website'}. The page is built around the words people actually type.`,
      '*2. The page answers before you do*\nServices, prices, opening hours, photos and reviews: what people want to know before they get in touch. Fewer "how much is it?" messages, more people who have already decided.',
      '*3. Enquiries arrive tidy*\nA quote/booking button that captures name, phone and what they need. You stop losing the person who messaged at midnight.',
      'It opens in one to two seconds on a phone, which is where nearly everyone visits from. And it is custom code: no website-builder subscription and no being locked into a platform.',
      ...FECHO_EN),
  },

  ganchos: {
    erp: (l) => monta(
      `Hi! My name is ${EU}, I build custom management systems.`,
      l.sistemas.length
        ? `I saw that ${curto(l.nome)} runs on ${l.sistemas.join(' and ')}.`
        : `I had a look at ${curto(l.nome)} and found no sign of a management system of your own.`,
      'Is anyone looking after that for you today?'),

    ia: (l) => monta(
      `Hi! My name is ${EU}, I work with customer service automation.`,
      `I saw ${curto(l.nome)} takes enquiries ${l.whatsapp ? 'over WhatsApp' : 'by phone'} and gets plenty of them.`,
      'Would it help if I sent you a preview of how to automate that?'),

    mobile: (l) => monta(
      `Hi! My name is ${EU}, I build apps and customer portals.`,
      `${curto(l.nome)} has customers who keep coming back — do they still ring up to reschedule?`,
      'Do you already have anything like that running?'),

    api: (l) => monta(
      `Hi! My name is ${EU}, I work with integration between systems.`,
      `I counted ${l.sistemas.length} tools running at ${curto(l.nome)} — does the same data go into more than one?`,
      'Is anyone handling that integration today?'),

    web: (l) => monta(
      `Hi! My name is ${EU}, I build fast, custom-made websites.`,
      !l.site
        ? `I looked for a website for ${curto(l.nome)} and found none — you are only on ${l.instagram ? 'Instagram' : 'WhatsApp'} today, right?`
        : l.site_status === 'protegido'
          ? `I saw ${curto(l.nome)} has a website, but I could not open it from here to take a look.`
          : l.site_ms
            ? `I just tested the ${curto(l.nome)} website: it took ${seg(l.site_ms, '.')}s to load.`
            : `I tried to open the ${curto(l.nome)} website just now and it did not respond.`,
      'Is anyone looking after that for you today?'),
  },
};

// ---------------- italiano ----------------

const PROVA_IT = `Le lascio il mio portfolio. Sono progetti dimostrativi costruiti da zero, con lo stesso standard di quello che consegno ai clienti. Non sono immagini: i pannelli si aprono nel browser e funzionano davvero, si può cercare, filtrare e inserire dati:\n${PORT}`;
const PRECO_IT = 'Se le fa comodo le mando il mio listino in PDF, da guardare con calma e senza impegno — lavoro a prezzo chiuso, con codice mio e senza canone di piattaforma.';
const FECHO_IT = [PROVA_IT, PRECO_IT];

const IT = {
  followups: {
    erp: (l) => monta(
      `Perfetto! In 3 punti, cosa cambia nella giornata di ${curto(l.nome)}:`,
      '*1. Un posto solo, invece di sette*\nAnagrafica, agenda, lavori, pagamenti e storico nella stessa schermata. Finisce la caccia al file giusto e il "qual è la versione buona del foglio Excel?".',
      '*2. Si inserisce una volta sola*\nQuello che entra in accettazione arriva già in amministrazione e nei report. Senza reinserire nulla e senza "mi sono dimenticato di registrarlo".',
      '*3. I numeri del mese quando vuole*\nQuanto è entrato, quanto è ancora aperto, quale cliente torna di più. Oggi esiste solo dopo che qualcuno si siede e fa i conti.',
      'È costruito sui passaggi che usate già — nessuno deve cambiare modo di lavorare per stare dentro un gestionale preconfezionato. Funziona da telefono e da computer, e la formazione del personale è inclusa.',
      ...FECHO_IT),

    ia: (l) => monta(
      `Perfetto! In 3 punti, cosa cambia nell'assistenza di ${curto(l.nome)}:`,
      '*1. Risposta in pochi secondi, 24 ore su 24*\nUn messaggio di domenica sera riceve risposta subito, con il vostro tono. Chi chiede il prezzo alle 22 non va a dormire aspettando — e non compra dal concorrente.',
      "*2. Arriva a voi solo chi vale*\nL'AI risolve le domande ripetitive (prezzi, orari, indirizzo, come funziona), capisce cosa vuole la persona e passa al vostro team solo chi è pronto a chiudere.",
      '*3. Prenotazioni e registrazioni in automatico*\nPrenota, conferma, ricorda il giorno stesso e lascia tutto tracciato. Niente più "ho scritto e non mi ha risposto nessuno".',
      'È addestrata sulle vostre informazioni e sul vostro modo di parlare — non è il solito bot "digiti 1". E potete riprendere la conversazione in qualsiasi momento.',
      ...FECHO_IT),

    mobile: (l) => monta(
      `Perfetto! In 3 punti, cosa cambia per ${curto(l.nome)} e per i vostri clienti:`,
      "*1. Il cliente fa da solo*\nPrenota, sposta l'appuntamento, vede lo storico, scarica una copia della fattura, paga. Senza telefonare e senza aspettare che qualcuno apra WhatsApp.",
      '*2. Torna senza che glielo ricordiate*\nAvvisi automatici di richiamo, scadenza e promozioni direttamente sul suo telefono. Sono acquisti ripetuti che oggi si perdono per dimenticanza.',
      '*3. Il vostro team smette di fare da centralino*\nLe domande ripetitive spariscono dalla giornata e resta tempo per chi avete davvero davanti.',
      'Si parte essenziale, con quello che usate di più, e cresce dopo. Tutto con il vostro marchio — il cliente vede la vostra azienda, non quella di una piattaforma.',
      ...FECHO_IT),

    api: (l) => monta(
      `Perfetto! In 3 punti, cosa cambia nell'operatività di ${curto(l.nome)}:`,
      "*1. Il dato si inserisce una volta sola*\nQuello che entra in un sistema compare negli altri da solo. Quell'ora al giorno passata a copiare da una parte all'altra smette di esistere.",
      '*2. I numeri iniziano a tornare*\nMagazzino, cassa e report escono dalla stessa fonte. Finisce la differenza di fine mese che nessuno riesce a spiegare.',
      "*3. Senza sostituire quello che già funziona*\nCollego via API gli strumenti che usate già. Se qualcosa va migrato, lo faccio con l'attività in funzione — nessuno perde una giornata di lavoro.",
      "La prima cosa che faccio è mappare dov'è il lavoro doppio oggi e mostrarle lo schema: cosa parla con cosa e cosa smette di essere manuale.",
      ...FECHO_IT),

    web: (l) => monta(
      `Perfetto! In 3 punti, cosa cambia per ${curto(l.nome)}:`,
      `*1. Farsi trovare da chi sta già cercando*\nChi cerca su Google quello che fate a ${l.cidade || 'zona vostra'} oggi trova il concorrente${l.site ? ' — e anche con un sito, uno lento finisce più in basso' : ', perché non avete un sito'}. La pagina è costruita sulle parole che le persone digitano davvero.`,
      '*2. La pagina risponde prima di voi*\nServizi, prezzi, orari, foto e recensioni: è quello che la persona vuole sapere prima di contattarvi. Arrivano meno "quanto costa?" e più persone già decise.',
      '*3. I contatti arrivano ordinati*\nUn pulsante preventivo/prenotazione che raccoglie nome, telefono e cosa serve. Smettete di perdere chi ha scritto a mezzanotte.',
      'Si apre in 1 o 2 secondi da telefono, da dove arriva quasi tutto il traffico. Ed è codice mio: senza canone del costruttore di siti e senza restare legati a una piattaforma.',
      ...FECHO_IT),
  },

  ganchos: {
    erp: (l) => monta(
      `Buongiorno! Sono ${EU}, sviluppo gestionali su misura.`,
      l.sistemas.length
        ? `Ho visto che ${curto(l.nome)} lavora con ${l.sistemas.join(' e ')}.`
        : `Ho dato un'occhiata a ${curto(l.nome)} e non ho trovato traccia di un gestionale vostro.`,
      'Se ne occupa già qualcuno da voi oggi?'),

    ia: (l) => monta(
      `Buongiorno! Sono ${EU}, mi occupo di automazione dell'assistenza clienti.`,
      `Ho visto che ${curto(l.nome)} risponde ${l.whatsapp ? 'su WhatsApp' : 'al telefono'} e riceve parecchi contatti.`,
      "Le mando un'anteprima di come si può automatizzare?"),

    mobile: (l) => monta(
      `Buongiorno! Sono ${EU}, sviluppo app e aree clienti.`,
      `${curto(l.nome)} ha clienti che tornano spesso — oggi devono telefonare per spostare un appuntamento?`,
      'Avete già qualcosa del genere attivo?'),

    api: (l) => monta(
      `Buongiorno! Sono ${EU}, mi occupo di integrazione tra sistemi.`,
      `Ho contato ${l.sistemas.length} strumenti in uso da ${curto(l.nome)} — lo stesso dato finisce in più di uno?`,
      'Se ne occupa già qualcuno oggi?'),

    web: (l) => monta(
      `Buongiorno! Sono ${EU}, sviluppo siti veloci e su misura.`,
      !l.site
        ? `Ho cercato il sito di ${curto(l.nome)} e non l'ho trovato — oggi siete solo su ${l.instagram ? 'Instagram' : 'WhatsApp'}, giusto?`
        : l.site_status === 'protegido'
          ? `Ho visto che ${curto(l.nome)} ha un sito, ma da qui non sono riuscito ad aprirlo.`
          : l.site_ms
            ? `Ho appena testato il sito di ${curto(l.nome)}: ci ha messo ${seg(l.site_ms)}s ad aprirsi.`
            : `Ho provato ad aprire il sito di ${curto(l.nome)} adesso e non ha risposto.`,
      'Se ne occupa già qualcuno oggi?'),
  },
};

// ---------------- seleção por idioma ----------------

export const IDIOMAS = { pt: PT, en: EN, it: IT };
const lang = (l) => IDIOMAS[l?.idioma] ?? PT;      // sem idioma = lead antigo, todos BR

const OFERTAS = ['erp', 'ia', 'mobile', 'api', 'web'];
export const GANCHOS = Object.fromEntries(OFERTAS.map((id) => [id, (l) => lang(l).ganchos[id](l)]));
export const FOLLOWUPS = Object.fromEntries(OFERTAS.map((id) => [id, (l) => lang(l).followups[id](l)]));
