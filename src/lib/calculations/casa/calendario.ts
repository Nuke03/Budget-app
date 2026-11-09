// Feed calendario privato: funzione pura che dai dati di casa costruisce gli eventi e il testo ICS.
// Tutte le date sono stringhe YYYY-MM-DD (giorno di calendario di Roma, passato da chi chiama).

export type ObiettivoFeed = {
  nome: string;
  scadenza: string;
  importo: number;
  ricorrente: boolean;
  frequenzaMesi: number | null;
};

export type FeedData = {
  nomeCasa: string;
  membro: string;
  giornoVersamento: number | null;
  quotaMensile: number | null;
  obiettivi: ObiettivoFeed[];
  creditoProprio: number;
  creditoAltri: number;
  ultimoControllo: string | null;
  ultimoCheckin: string | null;
};

export type EventoCalendario = {
  uid: string;
  data: string;
  titolo: string;
  descrizione: string | null;
};

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isData = (v: unknown): v is string => typeof v === 'string' && DATA_RE.test(v);

// Legge la risposta di get_calendar_feed. Ritorna null se la forma non e valida; le chiavi extra
// vengono ignorate, quindi nessun campo estraneo puo arrivare nell'ICS.
export function parseFeed(raw: unknown): FeedData | null {
  if (!isObj(raw)) return null;
  const r = raw;
  if (typeof r.nome_casa !== 'string' || typeof r.membro !== 'string') return null;
  if (!(r.giorno_versamento === null || isNum(r.giorno_versamento))) return null;
  if (!(r.quota_mensile === null || isNum(r.quota_mensile))) return null;
  if (!Array.isArray(r.obiettivi)) return null;
  if (!isNum(r.credito_proprio) || !isNum(r.credito_altri)) return null;
  if (!(r.ultimo_controllo === null || isData(r.ultimo_controllo))) return null;
  if (!(r.ultimo_checkin === null || isData(r.ultimo_checkin))) return null;

  const obiettivi: ObiettivoFeed[] = [];
  for (const o of r.obiettivi) {
    if (!isObj(o)) return null;
    if (typeof o.nome !== 'string' || !isData(o.scadenza) || !isNum(o.importo)) return null;
    if (typeof o.ricorrente !== 'boolean') return null;
    if (!(o.frequenza_mesi === null || isNum(o.frequenza_mesi))) return null;
    obiettivi.push({
      nome: o.nome,
      scadenza: o.scadenza,
      importo: o.importo,
      ricorrente: o.ricorrente,
      frequenzaMesi: o.frequenza_mesi,
    });
  }
  return {
    nomeCasa: r.nome_casa,
    membro: r.membro,
    giornoVersamento: r.giorno_versamento,
    quotaMensile: r.quota_mensile,
    obiettivi,
    creditoProprio: r.credito_proprio,
    creditoAltri: r.credito_altri,
    ultimoControllo: r.ultimo_controllo,
    ultimoCheckin: r.ultimo_checkin,
  };
}

// ---- Aritmetica di date in UTC (nessun fuso: sono giorni di calendario) ----

function parti(iso: string): { y: number; m: number; d: number } {
  return { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)), d: Number(iso.slice(8, 10)) };
}
function fmt(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function giorniDelMese(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function aggiungiGiorni(iso: string, n: number): string {
  const { y, m, d } = parti(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
// Somma mesi mantenendo il giorno richiesto (ridotto all'ultimo giorno del mese se non esiste).
function aggiungiMesi(iso: string, n: number, giorno?: number): string {
  const p = parti(iso);
  const idx = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return fmt(y, m, Math.min(giorno ?? p.d, giorniDelMese(y, m)));
}
function giorniTra(da: string, a: string): number {
  const x = parti(da);
  const y = parti(a);
  return Math.round((Date.UTC(y.y, y.m - 1, y.d) - Date.UTC(x.y, x.m - 1, x.d)) / 86400000);
}

function euro(n: number): string {
  const r = Math.round(n * 100) / 100;
  return `${Number.isInteger(r) ? String(r) : r.toFixed(2).replace('.', ',')} €`;
}

function slug(s: string): string {
  const out = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return out.replace(/^-+|-+$/g, '') || 'obiettivo';
}

export function eventiCalendario(feed: FeedData, oggi: string): EventoCalendario[] {
  const fine = aggiungiMesi(oggi, 12);
  const dentro = (d: string) => d >= oggi && d <= fine;
  const eventi: EventoCalendario[] = [];
  const primoDelMese = (iso: string) => `${iso.slice(0, 7)}-01`;

  // Versamento: il giorno scelto di ogni mese dell'orizzonte.
  if (feed.giornoVersamento !== null && feed.quotaMensile !== null && feed.quotaMensile > 0) {
    for (let i = 0; i <= 12; i++) {
      const data = aggiungiMesi(primoDelMese(oggi), i, feed.giornoVersamento);
      if (dentro(data)) {
        eventi.push({
          uid: `versamento-${data}@budget-app`,
          data,
          titolo: `Versamento alla casa: ${euro(feed.quotaMensile)}`,
          descrizione: null,
        });
      }
    }
  }

  // Controllo del mese: il primo di ogni mese.
  for (let i = 0; i <= 12; i++) {
    const data = aggiungiMesi(primoDelMese(oggi), i, 1);
    if (dentro(data)) {
      eventi.push({ uid: `checkin-${data}@budget-app`, data, titolo: 'Controllo del mese in casa', descrizione: null });
    }
  }

  // Controllo del saldo: ogni 14 giorni dall'ultimo controllo (o da oggi).
  let saldo = feed.ultimoControllo ?? oggi;
  if (saldo < oggi) saldo = aggiungiGiorni(saldo, Math.ceil(giorniTra(saldo, oggi) / 14) * 14);
  for (; saldo <= fine; saldo = aggiungiGiorni(saldo, 14)) {
    eventi.push({
      uid: `saldo-${saldo}@budget-app`,
      data: saldo,
      titolo: 'Controllo del saldo del conto comune',
      descrizione: null,
    });
  }

  // Scadenze degli obiettivi di casa.
  const usati = new Map<string, number>();
  for (const o of feed.obiettivi) {
    const base = slug(o.nome);
    const n = (usati.get(base) ?? 0) + 1;
    usati.set(base, n);
    const chiave = n === 1 ? base : `${base}-${n}`;
    const date: string[] = [];
    if (o.ricorrente && o.frequenzaMesi !== null && o.frequenzaMesi > 0) {
      const giorno = parti(o.scadenza).d;
      for (let k = 0; k < 1000; k++) {
        const d = aggiungiMesi(o.scadenza, k * o.frequenzaMesi, giorno);
        if (d > fine) break;
        if (d >= oggi) date.push(d);
      }
    } else if (dentro(o.scadenza)) {
      date.push(o.scadenza);
    }
    for (const data of date) {
      eventi.push({
        uid: `obiettivo-${chiave}-${data}@budget-app`,
        data,
        titolo: `${o.nome}: ${euro(o.importo)}`,
        descrizione: null,
      });
    }
  }

  // Crediti aperti: al prossimo controllo del mese.
  const prossimo = aggiungiMesi(primoDelMese(oggi), 1, 1);
  if (feed.creditoProprio > 0) {
    eventi.push({
      uid: `credito-proprio-${prossimo}@budget-app`,
      data: prossimo,
      titolo: `In attesa del rimborso: ${euro(feed.creditoProprio)}`,
      descrizione: null,
    });
  }
  if (feed.creditoAltri > 0) {
    eventi.push({
      uid: `credito-altri-${prossimo}@budget-app`,
      data: prossimo,
      titolo: `Rimborso da fare: ${euro(feed.creditoAltri)}`,
      descrizione: null,
    });
  }

  return eventi.sort((a, b) => (a.data === b.data ? a.uid.localeCompare(b.uid) : a.data < b.data ? -1 : 1));
}

// ---- Testo ICS ----

function escapeTesto(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

// Piega una riga a 75 ottetti (UTF-8) senza spezzare un carattere; le continuazioni iniziano con uno spazio.
function piega(riga: string): string[] {
  const enc = new TextEncoder();
  const out: string[] = [];
  let corrente = '';
  let ottetti = 0;
  for (const ch of riga) {
    const b = enc.encode(ch).length;
    if (ottetti + b > 75) {
      out.push(corrente);
      corrente = ' ';
      ottetti = 1;
    }
    corrente += ch;
    ottetti += b;
  }
  out.push(corrente);
  return out;
}

const senzaTrattini = (iso: string) => iso.replace(/-/g, '');

export function costruisciIcs(feed: FeedData, oggi: string): string {
  const righe: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Budget App//Casa//IT',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeTesto(feed.nomeCasa)}`,
  ];
  const stamp = `${senzaTrattini(oggi)}T000000Z`;
  for (const e of eventiCalendario(feed, oggi)) {
    righe.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${senzaTrattini(e.data)}`,
      `DTEND;VALUE=DATE:${senzaTrattini(aggiungiGiorni(e.data, 1))}`,
      `SUMMARY:${escapeTesto(e.titolo)}`
    );
    if (e.descrizione) righe.push(`DESCRIPTION:${escapeTesto(e.descrizione)}`);
    righe.push('END:VEVENT');
  }
  righe.push('END:VCALENDAR');
  return righe.flatMap(piega).map((r) => `${r}\r\n`).join('');
}
