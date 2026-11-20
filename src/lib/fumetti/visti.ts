// I fumetti (le bolle di aiuto alla prima visita) si mostrano una volta sola per utente.
// Alzando la versione di un fumetto, torna a mostrarsi solo quello.
// Se localStorage non funziona (modalità privata), i visti restano in memoria per la sessione.
export type FumettoId = 'giro' | 'storico' | 'casa' | 'casa-semplice' | 'cassetti' | 'conti' | 'attesa' | 'impara' | 'piva';

export const VERSIONI_FUMETTI: Record<FumettoId, number> = {
  giro: 1,
  storico: 1,
  casa: 1,
  'casa-semplice': 1,
  cassetti: 1,
  conti: 1,
  attesa: 1,
  impara: 1,
  piva: 1,
};

// Visti ricordati in memoria, usati solo se localStorage non è disponibile.
const memoria = new Set<string>();

const prefisso = (userId: string) => `fumetti:${userId}:`;
const chiave = (userId: string, id: FumettoId, versione: number) => `${prefisso(userId)}${id}:v${versione}`;

export function eVisto(
  userId: string,
  id: FumettoId,
  versioni: Record<FumettoId, number> = VERSIONI_FUMETTI,
): boolean {
  const k = chiave(userId, id, versioni[id]);
  if (memoria.has(k)) return true;
  try {
    return window.localStorage.getItem(k) === 'si';
  } catch {
    return false;
  }
}

export function segnaVisto(
  userId: string,
  id: FumettoId,
  versioni: Record<FumettoId, number> = VERSIONI_FUMETTI,
): void {
  const k = chiave(userId, id, versioni[id]);
  try {
    window.localStorage.setItem(k, 'si');
  } catch {
    // Modalità privata: il visto resta in memoria fino alla chiusura della pagina.
    memoria.add(k);
  }
}

export function azzeraFumetti(userId: string): void {
  const p = prefisso(userId);
  for (const k of [...memoria]) {
    if (k.startsWith(p)) memoria.delete(k);
  }
  try {
    const daTogliere: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(p)) daTogliere.push(k);
    }
    for (const k of daTogliere) window.localStorage.removeItem(k);
  } catch {
    // niente da azzerare
  }
}

// Il giro di benvenuto si mostra una volta per apertura dell'app (sessionStorage).
const CHIAVE_GIRO_ORA = 'fumetti:giro-ora';
let giroInMemoria = false;

export function segnaGiroInQuestaApertura(): void {
  giroInMemoria = true;
  try {
    window.sessionStorage.setItem(CHIAVE_GIRO_ORA, 'si');
  } catch {
    // resta il valore di modulo
  }
}

export function giroInQuestaApertura(): boolean {
  if (giroInMemoria) return true;
  try {
    return window.sessionStorage.getItem(CHIAVE_GIRO_ORA) === 'si';
  } catch {
    return false;
  }
}

// Solo per i test: svuota la memoria di modulo tra un test e l'altro.
export function _azzeraMemoriaPerTest(): void {
  memoria.clear();
  giroInMemoria = false;
}
