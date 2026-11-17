export const PRESET_ENPAP = {
  coefficienteRedditivita: 78,
  aliquotaContributoSoggettivo: 10,
  aliquotaContributoIntegrativo: 2,
  minimaleContributivoAnnuo: 856,
} as const;

// Dove trovare ogni dato. I valori ENPAP vengono da guide non ufficiali.
export const DOVE_TROVARLO: Record<
  'coefficiente' | 'aliquota' | 'soggettivo' | 'integrativo' | 'minimale',
  string
> = {
  coefficiente:
    "Il coefficiente di redditività è la quota del fatturato su cui paghi le tasse: lo trovi nella dichiarazione dei redditi dell'anno scorso, oppure chiedilo al commercialista (il 78% viene da guide non ufficiali, da confermare).",
  aliquota:
    "L'aliquota è la percentuale di imposta: 5% per i primi 5 anni di attività, poi 15%; la trovi nella dichiarazione dei redditi dell'anno scorso o chiedila al commercialista.",
  soggettivo:
    'Il contributo soggettivo è la parte di contributi che versi alla tua cassa in base al reddito: guarda nell\'area riservata ENPAP o chiedi al commercialista (il 10% viene da guide non ufficiali, da confermare).',
  integrativo:
    "Il contributo integrativo è una piccola percentuale che si aggiunge a ogni fattura: lo trovi nell'area riservata ENPAP o chiedi al commercialista (il 2% viene da guide non ufficiali, da confermare).",
  minimale:
    "Il minimale è la cifra minima di contributi che la cassa chiede ogni anno anche se guadagni poco: guarda nell'area riservata ENPAP o chiedi al commercialista (856 € viene da guide non ufficiali, da confermare).",
};
