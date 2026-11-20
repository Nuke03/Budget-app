import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { getAccounts } from '@/lib/data/accounts';
import { getCategories } from '@/lib/data/categories';
import { getOpenGoals } from '@/lib/data/goals';
import { getLastIncomeDate, getTransactions, haMovimentiPersonali } from '@/lib/data/transactions';
import { getSpecoCollegatoPerObiettivi } from '@/lib/data/goalSpending';
import { getConfermePerObiettivi, type ConfermeObiettivo } from '@/lib/data/goalVersamenti';
import { PERSONALE } from '@/lib/data/scope';
import { computeDisponibileLibero, riservatoObiettivi } from '@/lib/calculations/disponibile';
import { computeMargineGiornaliero } from '@/lib/calculations/margine';
import {
  fineMese,
  homeConStipendio,
  propostaStipendio,
  revisioneStipendio,
  speseDelMese,
} from '@/lib/calculations/stipendio';
import { anniScadenzeHome, casaDelMese, finestraIncassi, inizioLetturaIncassi, inizioMesiFa, speseUltimiMesi } from '@/lib/pivaHome';
import { stimaDataTarget } from '@/lib/calculations/stimaDataTarget';
import { accantonatoObiettivo } from '@/lib/calculations/accantonato';
import { leggiPromemoriaUtente, leggiRimandati } from '@/lib/data/notifiche';
import { formatEuro } from '@/lib/format';
import { oggiRomaData, oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { calcolaAndamento, type Andamento } from '@/lib/calculations/supporto/andamento';
import { scegliConsiglio, obiettiviCorti, type Consiglio } from '@/lib/calculations/supporto/consiglio';
import { periodoDaRecuperare } from '@/lib/calculations/supporto/notifiche';
import {
  righeLibretto,
  prossimaCosa,
  promemoriaDaCasa,
  promemoriaPiva,
  promemoriaVersamento,
  type RigaLibretto,
  type Prossimo,
} from '@/lib/calculations/supporto/home';
import { creaCategorieIniziali, leggiListaAttesa, leggiPercorso } from '@/lib/data/percorso';
import { statoPrimiPassi, type PrimiPassi } from '@/lib/calculations/percorso/passi';
import { lezioneDelGiorno } from '@/lib/calculations/percorso/regole';
import type { ArgomentoId, PercorsoUtente, StatiLezioni, VoceAttesa } from '@/lib/percorso/tipi';
import { getMyHousehold } from '@/lib/data/households';
import { getPivaSettings } from '@/lib/data/pivaSettings';
import { getAccantonamenti, getFatture, getQuoteScartate, getScadenze } from '@/lib/data/piva';
import {
  computeAliquotaSostitutiva,
  computePercentualeIncasso,
  quoteInSospeso,
  totaleInSospeso,
  type QuotaInSospeso,
} from '@/lib/calculations/piva';
import { loadCasaAggiunta, type CasaAggiunta } from '@/lib/loadCasaData';
import { loadCasaStato, type CasaStato } from '@/lib/loadCasaStato';
import type { Account, BudgetGoal, Category, PivaAccantonamento, PivaFattura, PivaScadenza, PivaSettings, Transaction } from '@/lib/types';

// Le due parti si leggono a parte: se manca lo stato, la casa esiste ma il disponibile
// personale non tiene conto della quota (la home lo dice).
export interface CasaPerHome {
  aggiunta: CasaAggiunta | null;
  stato: CasaStato | null;
}

// Lo stipendio fisso della P.IVA visto dalla home: quanto ne resta questo mese e quanti mesi copre il cuscinetto.
export interface StipendioHome {
  stipendio: number;
  rimasto: number;
  cuscinetto: number;
  mesiCoperti: number;
  // Se le spese hanno superato lo stipendio: la frase con l'eccedenza (la stessa dell'hub P.IVA).
  frase: string | null;
}

// La P.IVA guidata vista dalla home: dove vanno le tasse, quanto mettere da parte, quali quote
// aspettano ancora di essere spostate.
export interface PivaHome {
  contoTasseId: string;
  categoriaFatturatoId: string;
  percentuale: number;
  inSospeso: QuotaInSospeso[];
  stipendio: StipendioHome | null;
  // Le scadenze dell'anno corrente (e dell'anno dopo, da metà dicembre); vuote se non si leggono (la home si apre lo stesso).
  scadenze: PivaScadenza[];
  // Le fatture dell'utente; vuote se non si leggono (la home si apre lo stesso).
  fatture: PivaFattura[];
}

// La voce in attesa da rivedere più vecchia, già scritta per il "Da fare" della home.
function voceDaRivedere(voci: VoceAttesa[], oggi: string): { testo: string; href: string } | null {
  const scadute = voci.filter((v) => v.stato === 'in_attesa' && v.rivediIl <= oggi);
  scadute.sort((a, b) => a.rivediIl.localeCompare(b.rivediIl));
  const v = scadute[0];
  return v ? { testo: `Ci ripensi? ${v.nome}, ${formatEuro(v.importo)}`, href: '/impara/attesa' } : null;
}

export interface HomeData {
  disponibileLibero: number;
  // Il disponibile prima dell'adattamento allo stipendio, e i quattro riservati che lo compongono.
  disponibileReale: number;
  riservati: { obiettivi: number; casa: number; debiti: number; tasse: number };
  margineGiornaliero: number;
  dataTarget: Date;
  accounts: Account[];
  categories: Category[];
  // `versatoNellaFinestra` e `confermatoMese`: i versamenti confermati con "Ho messo da parte" (null/0 = nessuno).
  goals: (BudgetGoal & { accantonato: number; versatoNellaFinestra: number | null; confermatoMese: number })[];
  casa: CasaPerHome | null;
  // null: P.IVA non attiva o guida non completata.
  piva: PivaHome | null;
  // La P.IVA è attiva (o potrebbe esserlo) ma non si legge: il disponibile non conta le tasse, e la Home lo dice.
  pivaNonLetta: boolean;
  righe: RigaLibretto[];
  // Le transazioni dei 3 mesi già lette per la Home: da qui si indovina la categoria di una nuova spesa.
  storico: Pick<Transaction, 'descrizione' | 'categoriaId' | 'data' | 'tipo'>[];
  andamento: Andamento;
  consiglio: Consiglio;
  prossimo: Prossimo | null;
  // I giorni senza niente di segnato (la pagina "in pari"); null se si è in pari.
  inPari: { dal: string; al: string } | null;
  // null: non ha ancora risposto (o non si legge).
  notificheAttive: boolean | null;
  primiPassi: PrimiPassi;
  // La lezione da proporre oggi sotto il consiglio; null quando i primi passi sono visibili o non c'è nulla.
  lezioneDelGiorno: ArgomentoId | null;
}

// Senza categorie (primo accesso) si creano quelle di partenza, una sola volta, poi si rilegge.
// Chi ha già movimenti personali non è nuovo: le categorie le ha tolte lui, non si ricreano
// (la funzione SQL applica la stessa regola, con un blocco contro le aperture doppie).
// Se la creazione non riesce la home si apre lo stesso, senza categorie.
async function categorieConPartenza(supabase: SupabaseClient): Promise<Category[]> {
  const categorie = await getCategories(supabase);
  if (categorie.length > 0) return categorie;
  try {
    if (await haMovimentiPersonali(supabase)) return categorie;
    await creaCategorieIniziali(supabase);
    return await getCategories(supabase);
  } catch {
    return categorie;
  }
}

// Primo giorno del mese di 3 mesi fa (YYYY-MM-DD), da un giorno YYYY-MM-DD.
function inizioFinestra(oggi: string): string {
  return inizioMesiFa(oggi, 3);
}

// La parte di casa non deve mai rompere la home personale. Se non si legge la casa corrente
// si apre come senza casa; se si legge ma non il suo stato, si tiene il numero personale e
// si segnala che la quota non è inclusa.
async function casaOpzionale(
  supabase: SupabaseClient,
  userId: string | null,
  now: Date
): Promise<CasaPerHome | null> {
  if (!userId) return null;
  let corrente;
  try {
    corrente = await getMyHousehold(supabase, userId);
  } catch {
    return null;
  }
  if (!corrente) return null;
  const [aggiunta, stato] = await Promise.all([
    loadCasaAggiunta(supabase, corrente).catch(() => null),
    loadCasaStato(supabase, corrente, now).catch(() => null),
  ]);
  return { aggiunta, stato };
}

// La P.IVA non deve mai rompere la home: se non si legge, la home si apre come senza P.IVA, e lo dice.
// Le entrate e gli accantonamenti si leggono dal giorno della guida, anche oltre la finestra dei 3 mesi,
// e solo se la guida è completata: per gli altri nessuna lettura in più.
// Con lo stipendio fisso gli incassi si leggono anche per gli ultimi 6 mesi (stessa lettura, solo più indietro).
interface PivaLetta {
  piva: PivaHome;
  settings: PivaSettings;
  incassi: Transaction[];
  accantonamenti: PivaAccantonamento[];
  // Gli incassi per cui si è scelto di non mettere niente da parte (vuoto se non si leggono).
  scartate: Set<string>;
  percentuale: number;
}

async function pivaOpzionale(
  supabase: SupabaseClient,
  settings: Promise<PivaSettings | null>,
  today: Date,
  nonLetta: () => void
): Promise<PivaLetta | null> {
  try {
    const s = await settings;
    if (!s || !s.attivo || !s.guidataDal || !s.contoTasseId || !s.categoriaFatturatoId) return null;
    const daIncassi =
      s.stipendioMensile !== null ? inizioLetturaIncassi(s.guidataDal, oggiRomaISO(today)) : s.guidataDal;
    const [incassi, accantonamenti, scadenze, fatture, scartate] = await Promise.all([
      getTransactions(supabase, PERSONALE, { da: daIncassi, tipo: 'income' }),
      getAccantonamenti(supabase, { da: s.guidataDal }),
      // Una scadenza che non si legge non toglie la P.IVA dalla home: niente promemoria di scadenza.
      // Dopo il 15 dicembre anche quelle dell'anno dopo.
      Promise.all(anniScadenzeHome(oggiRomaISO(today)).map((anno) => getScadenze(supabase, anno)))
        .then((perAnno) => perAnno.flat())
        .catch(() => [] as PivaScadenza[]),
      // Come le scadenze: una fattura che non si legge non toglie la P.IVA dalla home.
      getFatture(supabase).catch(() => [] as PivaFattura[]),
      // Una scelta "Scarta" che non si legge non toglie la P.IVA dalla home: la quota resta da spostare.
      getQuoteScartate(supabase).catch(() => new Set<string>()),
    ]);
    const percentuale = computePercentualeIncasso(
      s.coefficienteRedditivita,
      computeAliquotaSostitutiva(s.dataApertura, oggiRomaData(today), s.aliquotaSostitutivaOverride),
      s.aliquotaContributoSoggettivo,
      s.aliquotaContributoIntegrativo
    );
    return {
      piva: {
        contoTasseId: s.contoTasseId,
        categoriaFatturatoId: s.categoriaFatturatoId,
        percentuale,
        inSospeso: quoteInSospeso(incassi, accantonamenti, percentuale, s.categoriaFatturatoId, s.guidataDal, {
          categoriaDal: s.categoriaDal,
          scartate,
        }),
        stipendio: null,
        scadenze,
        fatture,
      },
      settings: s,
      incassi,
      accantonamenti,
      scartate,
      percentuale,
    };
  } catch {
    // Non è "P.IVA spenta": non si riesce a leggere, e il disponibile non conta le tasse.
    nonLetta();
    return null;
  }
}

// Una sola riga leggera: la creazione più recente fra le righe di cui sono autore (personali e di casa).
async function ultimaCreazioneUtente(supabase: SupabaseClient, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabase
      .from('transactions')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as { created_at: string } | null)?.created_at ?? null;
  } catch {
    return null;
  }
}

// Le letture grezze della Home, per chi deve decidere sopra gli stessi dati (il percorso) senza
// rileggerli. Restano sul server: non fanno parte di HomeData, che va al client.
export interface GrezziHome {
  percorso: { utente: PercorsoUtente | null; lezioni: StatiLezioni };
  // Personali, ultimi 3 mesi.
  transazioni: Transaction[];
  ultimaEntrata: Date | null;
  pivaSettings: PivaSettings | null;
}

// Tutto ciò che la home mostra: solo dati personali (scope di default).
export async function loadHomeData(
  supabase: SupabaseClient,
  today: Date = new Date(),
  userId: string | null = null
): Promise<HomeData> {
  return (await loadHomeBase(supabase, today, userId)).home;
}

export async function loadHomeBase(
  supabase: SupabaseClient,
  today: Date = new Date(),
  userId: string | null = null
): Promise<{ home: HomeData; grezzi: GrezziHome }> {
  // Tutto parte insieme; lo speso collegato agli obiettivi segue subito la lettura degli obiettivi
  // (una sola query per tutti), senza aspettare la parte di casa.
  const obiettivi = getOpenGoals(supabase);
  const oggi = oggiRomaISO(today);
  // Le impostazioni P.IVA partono insieme al resto; chi non ha la P.IVA guidata non legge altro.
  let pivaNonLetta = false;
  const pivaSettings = getPivaSettings(supabase).catch(() => {
    pivaNonLetta = true;
    return null;
  });
  const [contiLetti, categories, goals, speso, conferme, ultimaEntrata, casa, transazioni, scelte, ultimaMia, pivaLetta, rimandati, percorso, listaAttesa, pivaImpostazioni] = await Promise.all([
    getAccounts(supabase),
    categorieConPartenza(supabase),
    obiettivi,
    // Quanto di ogni obiettivo è già stato speso (transazioni esplicitamente
    // collegate): va sottratto da quanto resta riservato, altrimenti quei soldi
    // verrebbero contati sia come spesi dal conto sia come ancora bloccati.
    obiettivi.then((g) => getSpecoCollegatoPerObiettivi(supabase, g, today, PERSONALE)),
    // I versamenti confermati dall'utente, nella stessa finestra dello speso. Se non si leggono la Home si
    // apre con i numeri di sempre (riservato a tempo): è lo stesso risultato di chi non ha mai confermato.
    obiettivi
      .then((g) => getConfermePerObiettivi(supabase, g, today))
      .catch(() => ({}) as Record<string, ConfermeObiettivo>),
    getLastIncomeDate(supabase),
    casaOpzionale(supabase, userId, today),
    // Una sola lettura: righe, andamento, stime e ultimo giorno segnato.
    getTransactions(supabase, PERSONALE, { da: inizioFinestra(oggi) }),
    // Le scelte sui promemoria non devono rompere la home.
    leggiPromemoriaUtente(supabase).catch(() => ({ notificheAttive: null, nessunaSpesaFinoAl: null })),
    // L'ultima riga scritta da te in qualunque spazio (anche Casa): conta per "in pari".
    ultimaCreazioneUtente(supabase, userId),
    pivaOpzionale(supabase, pivaSettings, today, () => {
      pivaNonLetta = true;
    }),
    // I "Più tardi" della Casa valgono anche qui; se non si leggono, niente è rimandato.
    leggiRimandati(supabase).catch(() => ({} as Record<string, string>)),
    // Il percorso non deve rompere la home: se non si legge, i primi passi partono da zero.
    leggiPercorso(supabase).catch(() => ({ utente: null, lezioni: {} as StatiLezioni })),
    // Anche la lista d'attesa non deve rompere la home.
    leggiListaAttesa(supabase).catch(() => [] as VoceAttesa[]),
    pivaSettings,
  ]);
  const piva = pivaLetta?.piva ?? null;
  // Con la P.IVA guidata il conto tasse non conta mai nel disponibile, qualunque sia il suo interruttore:
  // sono soldi delle tasse, e contarli due volte (nel saldo e nelle quote) gonfierebbe il numero.
  const accounts = piva
    ? contiLetti.map((a) => (a.id === piva.contoTasseId ? { ...a, contaInDisponibile: false } : a))
    : contiLetti;
  if (pivaLetta && piva) {
    // Un incasso su un conto che non conta nel disponibile non chiede la quota: ora che i conti sono noti si rifà il conto.
    const contiChePesano = new Set(accounts.filter((a) => a.contaInDisponibile).map((a) => a.id));
    piva.inSospeso = quoteInSospeso(
      pivaLetta.incassi,
      pivaLetta.accantonamenti,
      pivaLetta.percentuale,
      piva.categoriaFatturatoId,
      pivaLetta.settings.guidataDal,
      { categoriaDal: pivaLetta.settings.categoriaDal, contiChePesano, scartate: pivaLetta.scartate }
    );
  }
  const goalsConSpeso = goals.map((g) => ({
    ...g,
    specoCollegato: speso[g.id] ?? 0,
    versatoNellaFinestra: conferme[g.id]?.versato ?? null,
    confermatoMese: conferme[g.id]?.mese ?? 0,
  }));

  const riservati = {
    obiettivi: riservatoObiettivi(goalsConSpeso, today),
    casa: casa?.stato?.riservaVersamento ?? 0,
    debiti: casa?.stato?.debitoDaRestituire ?? 0,
    tasse: piva ? totaleInSospeso(piva.inSospeso) : 0,
  };
  const disponibileReale = computeDisponibileLibero(
    accounts,
    goalsConSpeso,
    today,
    riservati.casa,
    riservati.debiti,
    riservati.tasse
  );

  // Con lo stipendio fisso la home mostra il minore fra quello che c'è e quello che resta dello stipendio,
  // e il margine arriva a fine mese. Senza stipendio nulla cambia.
  let disponibileLibero = disponibileReale;
  let dataTarget = stimaDataTarget(ultimaEntrata, today);
  let revisione: string | null = null;
  if (pivaLetta && piva && pivaLetta.settings.stipendioMensile !== null) {
    const { settings } = pivaLetta;
    const stipendio = settings.stipendioMensile as number;
    // Il conto tasse non entra mai fra i conti delle spese, anche se risultasse nel disponibile.
    const contiDisponibile = new Set(
      accounts.filter((a) => a.contaInDisponibile && a.id !== piva.contoTasseId).map((a) => a.id)
    );
    const { quotaCasaMensile, versatoCasaMese } = casaDelMese(casa?.stato?.righe ?? null, oggi);
    const home = homeConStipendio({
      disponibileLibero: disponibileReale,
      stipendio,
      speseMese: speseDelMese(transazioni, contiDisponibile, oggi.slice(0, 7)),
      versatoCasaMese,
      riservaVersamento: casa?.stato?.riservaVersamento ?? 0,
    });
    disponibileLibero = home.mostrato;
    dataTarget = fineMese(oggi);
    piva.stipendio = {
      stipendio,
      rimasto: home.rimasto,
      cuscinetto: home.cuscinetto,
      mesiCoperti: home.mesiCoperti,
      frase: home.frase,
    };
    const { incassiMensili, mesiConIncassi } = finestraIncassi(pivaLetta.incassi, piva.categoriaFatturatoId, oggi);
    const { proposta } = propostaStipendio({
      incassiMensili,
      mesiConIncassi,
      percentuale: pivaLetta.percentuale,
      speseMensili: speseUltimiMesi(transazioni, contiDisponibile, oggi),
      quotaCasaMensile,
      incassoMeseMagro: settings.incassoMeseMagro,
    });
    revisione = revisioneStipendio(stipendio, proposta, settings.stipendioRivistoIl, oggi);
  }
  const margineGiornaliero = computeMargineGiornaliero(disponibileLibero, dataTarget, today);

  // Il breakdown mostrato in HomeDashboard deve riconciliarsi con `disponibileLibero`:
  // per gli obiettivi dilazionati questo significa mostrare quanto è stato effettivamente
  // accantonato finora (non l'intero importoTarget), esattamente come fa computeDisponibileLibero.
  const goalsWithAccantonato = goalsConSpeso.map((g) => ({
    ...g,
    accantonato: accantonatoObiettivo(g, today),
  }));

  const andamento = calcolaAndamento(transazioni, oggi);
  const spesoStime = transazioni
    .filter((t) => t.tipo === 'expense' && t.stima && t.data.slice(0, 7) === oggi.slice(0, 7) && t.data <= oggi)
    .reduce((tot, t) => tot + t.importo, 0);
  const consiglio = scegliConsiglio({
    andamento,
    spesoStime,
    nomiCategorie: Object.fromEntries(categories.map((c) => [c.id, c.nome])),
    obiettiviCorti: obiettiviCorti(goalsConSpeso, disponibileLibero, today),
    oggi,
  });
  const ultimaCreazione = transazioni.reduce<string | null>(
    (max, t) => (max === null || t.createdAt > max ? t.createdAt : max),
    ultimaMia
  );
  const inPari = periodoDaRecuperare(
    ultimaCreazione ? oggiRomaISO(new Date(ultimaCreazione)) : null,
    scelte.nessunaSpesaFinoAl,
    oggi
  );
  const prossimo = prossimaCosa({
    inPari,
    promemoriaCasa: promemoriaDaCasa(casa, oggi)
      .filter((p) => !((rimandati[p.id] ?? '') > oggi))
      .map((p) => ({ testo: p.testo, href: p.azione?.href })),
    promemoriaPiva: piva
      ? promemoriaPiva(
          { scadenze: piva.scadenze, fatture: piva.fatture, inSospeso: totaleInSospeso(piva.inSospeso), revisioneStipendio: revisione },
          oggi
        )
      : [],
    attesa: voceDaRivedere(listaAttesa, oggi),
    versamento: promemoriaVersamento(goalsConSpeso, today),
  });

  const primiPassi = statoPrimiPassi({
    conti: accounts,
    goals: goalsWithAccantonato,
    percorso: percorso.utente,
    pivaGuidata: !!pivaImpostazioni?.guidataDal,
    oggi,
  });
  const lezioneOggi = lezioneDelGiorno({
    oggi,
    transazioni,
    categorie: categories,
    goals: goalsWithAccantonato,
    lezioni: percorso.lezioni,
    percorso: percorso.utente,
    disponibileReale,
    disponibileLibero,
    ultimaEntrataIl: ultimaEntrata ? format(ultimaEntrata, 'yyyy-MM-dd') : null,
    primiPassiVisibili: primiPassi.visibile,
  });

  const home: HomeData = {
    disponibileLibero,
    disponibileReale,
    riservati,
    margineGiornaliero,
    dataTarget,
    accounts,
    categories,
    goals: goalsWithAccantonato,
    casa,
    piva,
    pivaNonLetta,
    righe: righeLibretto(transazioni, oggi, 4, categories),
    storico: transazioni.map((t) => ({
      descrizione: t.descrizione,
      categoriaId: t.categoriaId,
      data: t.data,
      tipo: t.tipo,
    })),
    andamento,
    consiglio,
    prossimo,
    inPari,
    notificheAttive: scelte.notificheAttive,
    primiPassi,
    lezioneDelGiorno: lezioneOggi,
  };
  return {
    home,
    grezzi: { percorso, transazioni, ultimaEntrata, pivaSettings: pivaImpostazioni },
  };
}
