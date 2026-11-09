import { describe, it, expect } from 'vitest';
import { costruisciIcs, eventiCalendario, parseFeed, type FeedData } from '@/lib/calculations/casa/calendario';
import { PAROLE_VIETATE } from '../../helpers/paroleVietate';

const feed: FeedData = {
  nomeCasa: 'Casa Rossi',
  membro: 'Fabio',
  giornoVersamento: 5,
  quotaMensile: 777,
  obiettivi: [{ nome: 'TARI', scadenza: '2027-03-31', importo: 300, ricorrente: true, frequenzaMesi: 12 }],
  creditoProprio: 45,
  creditoAltri: 0,
  ultimoControllo: '2026-11-01',
  ultimoCheckin: '2026-10-01',
};
const oggi = '2026-11-08';
const per = (titolo: string | RegExp) =>
  eventiCalendario(feed, oggi).filter((e) => (typeof titolo === 'string' ? e.titolo === titolo : titolo.test(e.titolo)));

describe('eventiCalendario', () => {
  it('versamento: 12 eventi, il primo 2026-12-05 (quello del 5 novembre è passato)', () => {
    const v = per(/^Versamento alla casa: 777 €$/);
    expect(v).toHaveLength(12);
    expect(v[0].data).toBe('2026-12-05');
    expect(v[0].uid).toBe('versamento-2026-12-05@budget-app');
  });

  it('check-in: 12 eventi, dal 2026-12-01', () => {
    const c = per('Controllo del mese in casa');
    expect(c).toHaveLength(12);
    expect(c[0].data).toBe('2026-12-01');
  });

  it('controllo del saldo: 26 eventi ogni 14 giorni, il primo 2026-11-15', () => {
    const s = per('Controllo del saldo del conto comune');
    expect(s).toHaveLength(26);
    expect(s[0].data).toBe('2026-11-15');
    expect(s[1].data).toBe('2026-11-29');
  });

  it('TARI: 1 evento il 2027-03-31 e la ricorrenza successiva è fuori orizzonte', () => {
    expect(per('TARI: 300 €').map((e) => e.data)).toEqual(['2027-03-31']);
  });

  it('credito proprio: 1 evento "In attesa del rimborso: 45 €" il 2026-12-01, nessun "Rimborso da fare"', () => {
    expect(per('In attesa del rimborso: 45 €').map((e) => e.data)).toEqual(['2026-12-01']);
    expect(per(/^Rimborso da fare/)).toHaveLength(0);
  });

  it('totale 52 eventi', () => {
    expect(eventiCalendario(feed, oggi)).toHaveLength(52);
  });

  it('UID stabili: due chiamate danno gli stessi UID', () => {
    const a = eventiCalendario(feed, oggi).map((e) => e.uid);
    expect(eventiCalendario(feed, oggi).map((e) => e.uid)).toEqual(a);
    expect(new Set(a).size).toBe(a.length);
  });

  it('senza piano (giornoVersamento e quotaMensile nulli) nessun evento di versamento e ICS valido', () => {
    const senza = { ...feed, giornoVersamento: null, quotaMensile: null };
    expect(eventiCalendario(senza, oggi).filter((e) => e.titolo.startsWith('Versamento'))).toHaveLength(0);
    const ics = costruisciIcs(senza, oggi);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('senza ultimo controllo il primo controllo è oggi', () => {
    const s = eventiCalendario({ ...feed, ultimoControllo: null }, oggi).filter((e) =>
      e.titolo.startsWith('Controllo del saldo')
    );
    expect(s[0].data).toBe(oggi);
  });

  it('obiettivo ricorrente già scaduto: prossima ricorrenza in orizzonte; giorno 31 ridotto a fine mese', () => {
    const f = {
      ...feed,
      obiettivi: [{ nome: 'Assicurazione', scadenza: '2026-05-31', importo: 100, ricorrente: true, frequenzaMesi: 3 }],
    };
    const dati = eventiCalendario(f, oggi)
      .filter((e) => e.titolo.startsWith('Assicurazione'))
      .map((e) => e.data);
    expect(dati).toEqual(['2026-11-30', '2027-02-28', '2027-05-31', '2027-08-31']);
  });

  it('il testo non usa parole tecniche vietate', () => {
    const testo = eventiCalendario({ ...feed, creditoAltri: 10 }, oggi)
      .map((e) => e.titolo)
      .join(' ')
      .toLowerCase();
    for (const p of PAROLE_VIETATE) expect(testo).not.toContain(p);
  });
});

describe('costruisciIcs', () => {
  it('inizia con BEGIN:VCALENDAR\\r\\nVERSION:2.0 e finisce con END:VCALENDAR\\r\\n', () => {
    const ics = costruisciIcs(feed, oggi);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTAMP:20261108T000000Z');
    expect(ics).toContain('X-WR-CALNAME:Casa Rossi');
  });

  it('ogni riga termina con CRLF', () => {
    expect(/(^|[^\r])\n/.test(costruisciIcs(feed, oggi))).toBe(false);
  });

  it('data di giornata intera: DTSTART;VALUE=DATE:20261205 e DTEND;VALUE=DATE:20261206', () => {
    const ics = costruisciIcs(feed, oggi);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261205\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20261206\r\n');
  });

  it('escape: "Casa; Rossi, e figli" diventa "Casa\\; Rossi\\, e figli"', () => {
    const ics = costruisciIcs({ ...feed, nomeCasa: 'Casa; Rossi, e figli' }, oggi);
    expect(ics).toContain('X-WR-CALNAME:Casa\\; Rossi\\, e figli\r\n');
  });

  it('una riga lunga è piegata a 75 ottetti', () => {
    const ics = costruisciIcs({ ...feed, nomeCasa: 'è'.repeat(100) }, oggi);
    const righe = ics.split('\r\n').slice(0, -1);
    for (const r of righe) expect(new TextEncoder().encode(r).length).toBeLessThanOrEqual(75);
    const i = righe.findIndex((r) => r.startsWith('X-WR-CALNAME:'));
    expect(righe[i + 1].startsWith(' ')).toBe(true);
    const testo = righe
      .slice(i, i + 4)
      .map((r, k) => (k ? r.slice(1) : r))
      .join('');
    expect(testo.startsWith('X-WR-CALNAME:' + 'è'.repeat(100))).toBe(true);
  });
});

describe('parseFeed', () => {
  const raw = {
    nome_casa: 'Casa Rossi',
    membro: 'Fabio',
    giorno_versamento: 5,
    quota_mensile: 777,
    obiettivi: [{ nome: 'TARI', scadenza: '2027-03-31', importo: 300, ricorrente: true, frequenza_mesi: 12 }],
    credito_proprio: 45,
    credito_altri: 0,
    ultimo_controllo: '2026-11-01',
    ultimo_checkin: '2026-10-01',
  };

  it('legge la forma del database', () => {
    expect(parseFeed(raw)).toEqual(feed);
  });

  it('parseFeed scarta una chiave personale extra: nessun campo estraneo finisce nell ICS', () => {
    const f = parseFeed({ ...raw, conti_personali: 'segreto' });
    expect(f).not.toBeNull();
    expect(costruisciIcs(f!, oggi)).not.toContain('segreto');
    expect(JSON.stringify(f)).not.toContain('segreto');
  });

  it('parseFeed ritorna null con una forma non valida', () => {
    expect(parseFeed(null)).toBeNull();
    expect(parseFeed('x')).toBeNull();
    expect(parseFeed({})).toBeNull();
    expect(parseFeed({ ...raw, obiettivi: 'no' })).toBeNull();
    expect(parseFeed({ ...raw, credito_proprio: '45' })).toBeNull();
    expect(parseFeed({ ...raw, ultimo_controllo: 'ieri' })).toBeNull();
  });
});
