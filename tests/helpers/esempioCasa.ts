// Esempio condiviso della ricerca: dieci voci tipiche, affitto 750, assicurazione 96 l'anno.
// Il sottotot mensile è 1321, il cuscinetto 59, il totale arrotondato a 10 è 1380.
import { VOCI_CASA_TIPICHE } from '@/lib/calculations/casa/vociTipiche';
import type { PersonaQuotaInput } from '@/lib/calculations/casa/quota';

export const ESEMPIO_VOCI: {
  chiave: string;
  nome: string;
  importoRicorrenza: number;
  frequenzaMesi: number;
}[] = VOCI_CASA_TIPICHE.map((v) => ({
  chiave: v.chiave,
  nome: v.nome,
  frequenzaMesi: v.frequenzaMesi,
  importoRicorrenza:
    v.chiave === 'affitto' ? 750 : v.chiave === 'assicurazione' ? 96 : (v.stimaRicorrenza as number),
}));

export const ESEMPIO_PERSONE: PersonaQuotaInput[] = [
  { slot: 1, nome: 'Fabio', redditoNetto: 1800 },
  { slot: 2, nome: 'Giulia', redditoNetto: 1400 },
];

export const ESEMPIO_CUSCINETTO_QUOTA = 59;
