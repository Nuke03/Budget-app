import { createClient } from '@/lib/supabase/server';
import { utenteECasa } from '@/lib/utenteOLogin';
import { getAccounts } from '@/lib/data/accounts';
import { getPlanForMonth } from '@/lib/data/householdPlans';
import { loadCasaData } from '@/lib/loadCasaData';
import { meseRomaISO } from '@/lib/calculations/casa/oggi';
import { pianoDelMese, pianoInVigore } from '@/lib/calculations/casa/versamenti';
import { speseNonRegistrate } from '@/lib/calculations/casa/controlloSaldo';
import { statoVociDaParte } from '@/lib/calculations/casa/fondi';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { casaHomeDati } from '@/lib/calculations/supporto/casaHome';
import { CasaHome } from './CasaHome';
import { CasaSenzaCasa } from './CasaSenzaCasa';

export default async function CasaPage() {
  const supabase = await createClient();
  // I conti personali servono solo a "Io, con carta": se non si leggono, la casa si apre lo stesso.
  // Partono subito, insieme alla verifica dell'utente e alla lettura della casa.
  const contiInCorso = getAccounts(supabase).catch(() => []);
  const { casa } = await utenteECasa(supabase);
  if (!casa) return <CasaSenzaCasa />;

  const meseCorrente = meseRomaISO();
  const [dati, contiPersonali] = await Promise.all([loadCasaData(supabase, casa).catch(() => null), contiInCorso]);
  // I piani arrivano già con i dati della casa: si legge una volta sola.
  const piano = dati
    ? pianoDelMese(dati.piani, meseCorrente)
    : await getPlanForMonth(supabase, casa.household.id, meseCorrente);
  // Se i conti e le spese non si leggono, la quota e le impostazioni restano raggiungibili.
  const finanze = dati
    ? {
        disponibile: dati.disponibile,
        cuscinetto: dati.cuscinetto,
        conti: dati.aggiunta.conti,
        ultimeSpese: dati.transazioni.filter((t) => t.tipo === 'expense').slice(0, 5),
        nomi: Object.fromEntries(dati.aggiunta.nomi.map((n) => [n.userId, n.nome])),
        aggiunta: dati.aggiunta,
        contiPersonali,
        righe: dati.righe,
        debiti: dati.debiti,
        crediti: dati.crediti,
        fondiBollette: dati.obiettiviConAccantonato
          .filter((g) => g.ricorrente)
          .map((g) => ({ id: g.id, nome: g.nome, accantonato: g.accantonato, importoTarget: g.importoTarget })),
        ultimoControllo: dati.controlli.ultimoControllo,
        ultimoCheckinMese: dati.controlli.ultimoCheckinMese,
        speseNonRegistrate: speseNonRegistrate(dati.transazioni, meseCorrente),
        bolletteDaMettere: pianoInVigore(dati.piani, meseCorrente)
          ? statoVociDaParte(pianoInVigore(dati.piani, meseCorrente)!.items, dati.obiettiviConAccantonato).filter((v) => v.stato === 'da_mettere').length
          : 0,
      }
    : undefined;
  return <CasaHome casa={casa} piano={piano} meseCorrente={meseCorrente} finanze={finanze} />;
}
