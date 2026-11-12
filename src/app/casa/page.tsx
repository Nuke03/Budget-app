import { createClient } from '@/lib/supabase/server';
import { utenteECasa } from '@/lib/utenteOLogin';
import { getAccounts } from '@/lib/data/accounts';
import { loadCasaData } from '@/lib/loadCasaData';
import { meseRomaISO, oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { pianoInVigore } from '@/lib/calculations/casa/versamenti';
import { statoVociDaParte } from '@/lib/calculations/casa/fondi';
import { casaHomeDati } from '@/lib/calculations/supporto/casaHome';
import { CasaHome } from './CasaHome';
import { VistaSemplice } from './VistaSemplice';
import { CasaSenzaCasa } from './CasaSenzaCasa';

export default async function CasaPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
} = {}) {
  const vistaCompleta = (await searchParams)?.vista === 'completa';
  const supabase = await createClient();
  // I conti personali servono solo a "Io, con carta": se non si leggono, la casa si apre lo stesso.
  // Partono subito, insieme alla verifica dell'utente e alla lettura della casa.
  const contiInCorso = getAccounts(supabase).catch(() => []);
  const { casa } = await utenteECasa(supabase);
  if (!casa) return <CasaSenzaCasa />;

  const meseCorrente = meseRomaISO();
  const [dati, contiPersonali] = await Promise.all([loadCasaData(supabase, casa).catch(() => null), contiInCorso]);
  // Se i conti e le spese non si leggono, la quota e le impostazioni restano raggiungibili.
  const pianoOra = dati ? pianoInVigore(dati.piani, meseCorrente) : null;
  const oggi = oggiRomaISO();
  const libretto = dati ? casaHomeDati(dati, casa.me.userId, oggi) : undefined;
  const mesiArretrati = (dati?.righe[casa.me.userId] ?? []).filter((r) => r.mancano > 0).map((r) => r.mese);
  if (libretto && !libretto.gestisce && !vistaCompleta) {
    return (
      <VistaSemplice
        casa={casa}
        vista={libretto.vistaSemplice}
        aggiunta={dati?.aggiunta}
        contiPersonali={contiPersonali}
        debiti={dati?.debiti}
        mesiArretrati={mesiArretrati}
        oggi={oggi}
      />
    );
  }
  return (
    <CasaHome
      casa={casa}
      libretto={libretto}
      spiegazione={dati?.disponibile.spiegazione}
      vociDaParte={
        dati && pianoOra
          ? statoVociDaParte(pianoOra.items, dati.obiettiviConAccantonato).filter((v) => v.stato === 'da_mettere')
          : []
      }
      aggiunta={dati?.aggiunta}
      contiPersonali={contiPersonali}
      debiti={dati?.debiti}
      mesiArretrati={mesiArretrati}
      oggi={oggi}
    />
  );
}
