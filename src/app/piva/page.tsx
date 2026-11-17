'use client';

import { useEffect, useState } from 'react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';
import { createClient } from '@/lib/supabase/client';
import { getPivaSettings, createPivaSettings, updatePivaSettings } from '@/lib/data/pivaSettings';
import { getCategories } from '@/lib/data/categories';
import { getAccounts } from '@/lib/data/accounts';
import { computeAliquotaSostitutiva, computePercentualeIncasso } from '@/lib/calculations/piva';
import { oggiRomaData } from '@/lib/calculations/casa/oggi';
import { formatNumero } from '@/lib/format';
import { CoverHeader } from '../CoverHeader';
import { CLASSE_SECONDARIO } from '../casa/CampiMovimento';
import { PivaSettingsForm, type PivaSettingsFormValues } from './PivaSettingsForm';
import { ImpostazioneGuidata } from './ImpostazioneGuidata';
import type { PivaSettingsInput } from '@/lib/data/pivaSettings';
import type { Account, Category, PivaSettings } from '@/lib/types';

// I campi della P.IVA guidata, da riscrivere uguali quando si salvano le altre impostazioni.
function campiGuidata(s: PivaSettings | null) {
  return {
    contoTasseId: s?.contoTasseId ?? null,
    preset: s?.preset ?? null,
    guidataDal: s?.guidataDal ?? null,
    stipendioMensile: s?.stipendioMensile ?? null,
    stipendioRivistoIl: s?.stipendioRivistoIl ?? null,
    incassoMeseMagro: s?.incassoMeseMagro ?? null,
  };
}

export default function PivaPage() {
  const fail = useThrowToBoundary();
  const [settings, setSettings] = useState<PivaSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [conti, setConti] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

  async function refresh() {
    const supabase = createClient();
    // getAccounts e getCategories senza scope: sono i conti e le categorie personali.
    const [s, cats, acc] = await Promise.all([
      getPivaSettings(supabase),
      getCategories(supabase),
      getAccounts(supabase),
    ]);
    setSettings(s);
    setCategories(cats);
    setConti(acc);
    setLoaded(true);
  }

  useEffect(() => {
    refresh().catch(fail);
  }, [fail]);

  async function handleSave(values: PivaSettingsFormValues) {
    const supabase = createClient();
    // I campi della P.IVA guidata non sono in questo modulo: restano come sono.
    const input = { ...values, attivo: true, ...campiGuidata(settings) };
    if (settings) {
      await updatePivaSettings(supabase, settings.id, input);
    } else {
      await createPivaSettings(supabase, input);
    }
    setEditing(false);
    await refresh();
  }

  async function handleGuidata(input: PivaSettingsInput) {
    const supabase = createClient();
    if (settings) {
      await updatePivaSettings(supabase, settings.id, input);
    } else {
      await createPivaSettings(supabase, input);
    }
    await refresh();
  }

  async function handleDisattiva() {
    if (!settings) return;
    const supabase = createClient();
    await updatePivaSettings(supabase, settings.id, {
      attivo: false,
      dataApertura: settings.dataApertura,
      categoriaFatturatoId: settings.categoriaFatturatoId,
      coefficienteRedditivita: settings.coefficienteRedditivita,
      aliquotaSostitutivaOverride: settings.aliquotaSostitutivaOverride,
      aliquotaContributoSoggettivo: settings.aliquotaContributoSoggettivo,
      aliquotaContributoIntegrativo: settings.aliquotaContributoIntegrativo,
      minimaleContributivoAnnuo: settings.minimaleContributivoAnnuo,
      contributiVersatiAnnoPrecedente: settings.contributiVersatiAnnoPrecedente,
      ...campiGuidata(settings),
    });
    await refresh();
  }

  if (!loaded) return null;

  const contoTasse = settings?.contoTasseId ? conti.find((c) => c.id === settings.contoTasseId) : undefined;
  const guidaCompleta = !!settings && settings.attivo && !!settings.guidataDal && !!contoTasse;

  if (!guidaCompleta) {
    // Conto tasse salvato ma sparito (eliminato o spostato in casa): si riparte dalla scelta del conto.
    const contoSparito = !!settings?.contoTasseId && !contoTasse;
    return (
      <ImpostazioneGuidata
        iniziale={settings}
        conti={conti}
        categorie={categories}
        passoIniziale={contoSparito ? 3 : 1}
        onFatto={handleGuidata}
      />
    );
  }

  if (editing) {
    return (
      <>
        <CoverHeader titolo="P.IVA" />
        <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-28 pt-3.5">
          <PivaSettingsForm
            categories={categories}
            initial={settings}
            submitLabel="Salva modifiche"
            onSubmit={handleSave}
            onCancel={() => setEditing(false)}
          />
        </main>
      </>
    );
  }

  // Vista provvisoria: l'hub arriva col prossimo passo.
  const percentuale = computePercentualeIncasso(
    settings.coefficienteRedditivita,
    computeAliquotaSostitutiva(settings.dataApertura, oggiRomaData(), settings.aliquotaSostitutivaOverride),
    settings.aliquotaContributoSoggettivo,
    settings.aliquotaContributoIntegrativo
  );

  return (
    <>
      <CoverHeader titolo="P.IVA" />
      <main className="mx-auto flex max-w-md flex-col gap-5 px-3 pb-28 pt-5">
        <p className="num font-serif text-[22px] font-semibold">
          Metti da parte il {formatNumero(percentuale)}% di ogni incasso.
        </p>
        <p className="text-[15px] text-ink-2">Le tasse vanno sul conto: {contoTasse.nome}.</p>
        <button type="button" onClick={() => setEditing(true)} className={CLASSE_SECONDARIO}>
          Modifica i parametri
        </button>
        <button type="button" onClick={handleDisattiva} className={CLASSE_SECONDARIO}>
          Disattiva gestione P.IVA
        </button>
      </main>
    </>
  );
}
