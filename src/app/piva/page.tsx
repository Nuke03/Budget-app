'use client';

import { useEffect, useState } from 'react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';
import { createClient } from '@/lib/supabase/client';
import { getPivaSettings, createPivaSettings, updatePivaSettings } from '@/lib/data/pivaSettings';
import { getCategories } from '@/lib/data/categories';
import { getAccounts } from '@/lib/data/accounts';
import { CoverHeader } from '../CoverHeader';
import { PivaSettingsForm, type PivaSettingsFormValues } from './PivaSettingsForm';
import { ImpostazioneGuidata } from './ImpostazioneGuidata';
import { PivaHub } from './PivaHub';
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

  // Legge senza toccare lo stato: l'effetto lo imposta solo dopo l'attesa.
  async function leggi() {
    const supabase = createClient();
    // getAccounts e getCategories senza scope: sono i conti e le categorie personali.
    const [s, cats, acc] = await Promise.all([
      getPivaSettings(supabase),
      getCategories(supabase),
      getAccounts(supabase),
    ]);
    return { s, cats, acc };
  }

  function applica(d: Awaited<ReturnType<typeof leggi>>) {
    setSettings(d.s);
    setCategories(d.cats);
    setConti(d.acc);
    setLoaded(true);
  }

  async function refresh() {
    applica(await leggi());
  }

  useEffect(() => {
    leggi().then(applica).catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return <PivaHub settings={settings} categories={categories} onModifica={() => setEditing(true)} onDisattiva={handleDisattiva} />;
}
