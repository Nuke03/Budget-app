import type { Transaction } from '@/lib/types';

export interface GiornoStorico {
  data: string;
  righe: Transaction[];
  // Entrate meno uscite del giorno: solo per mostrarlo, nessun altro calcolo lo legge.
  totale: number;
}

// Raggruppa le righe già ordinate per giorno, nell'ordine in cui compaiono.
export function raggruppaPerGiorno(righe: Transaction[]): GiornoStorico[] {
  const giorni = new Map<string, GiornoStorico>();
  for (const t of righe) {
    let g = giorni.get(t.data);
    if (!g) {
      g = { data: t.data, righe: [], totale: 0 };
      giorni.set(t.data, g);
    }
    g.righe.push(t);
    g.totale += t.tipo === 'income' ? t.importo : -t.importo;
  }
  return Array.from(giorni.values());
}
