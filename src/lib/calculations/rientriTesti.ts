import { euroInFrase, nomeMese } from '../format';
import { maturatoRientro, rataRientro, ultimoMeseRientro, type MesiRientro, type Rientro } from './rientri';

// "da novembre a gennaio" ("ad" davanti ad "aprile", "agosto"). Con l'anno quando il rientro attraversa
// un capodanno: "da novembre 2026 a gennaio 2027".
export function fraseRata(importo: number, mesi: MesiRientro, creatoIl: string): string {
  const rata = rataRientro({ importo, mesi });
  const fine = `${ultimoMeseRientro({ creatoIl, mesi })}-01`;
  const annoInizio = creatoIl.slice(0, 4);
  const annoFine = fine.slice(0, 4);
  const conAnno = annoInizio !== annoFine;
  const da = conAnno ? `${nomeMese(creatoIl)} ${annoInizio}` : nomeMese(creatoIl);
  const a = conAnno ? `${nomeMese(fine)} ${annoFine}` : nomeMese(fine);
  return `${euroInFrase(rata)} al mese, da ${da} ${a.startsWith('a') ? 'ad' : 'a'} ${a}.`;
}

// Per la riga sulla card.
export function fraseRientro(r: Rientro): string {
  if (r.stato !== 'aperto') {
    const rimessi = maturatoRientro(r, r.fermatoIl ?? r.creatoIl);
    return `Rientro fermato: ${euroInFrase(rimessi)} rimessi su ${euroInFrase(r.importo)}`;
  }
  const fine = `${ultimoMeseRientro(r)}-01`;
  return `Rientro: ${euroInFrase(rataRientro(r))} al mese fino a ${nomeMese(fine)}`;
}
