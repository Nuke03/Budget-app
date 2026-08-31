'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getPivaSettings, createPivaSettings, updatePivaSettings } from '@/lib/data/pivaSettings';
import { getCategories } from '@/lib/data/categories';
import { getTransactions } from '@/lib/data/transactions';
import {
  computeFatturatoAnnuo,
  computeAliquotaSostitutiva,
  computeRedditoImponibile,
  computeImpostaSostitutiva,
  computeContributoSoggettivo,
  computeContributoIntegrativo,
  computeTotaleDaAccantonare,
  computeQuotaMensileSuggerita,
} from '@/lib/calculations/piva';
import { PivaSettingsForm, type PivaSettingsFormValues } from './PivaSettingsForm';
import { PivaDashboard } from './PivaDashboard';
import type { Category, PivaSettings, Transaction } from '@/lib/types';

export default function PivaPage() {
  const [settings, setSettings] = useState<PivaSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

  async function refresh() {
    const supabase = createClient();
    const [s, cats, txs] = await Promise.all([
      getPivaSettings(supabase),
      getCategories(supabase),
      getTransactions(supabase),
    ]);
    setSettings(s);
    setCategories(cats);
    setTransactions(txs);
    setLoaded(true);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSave(values: PivaSettingsFormValues) {
    const supabase = createClient();
    const input = { ...values, attivo: true };
    if (settings) {
      await updatePivaSettings(supabase, settings.id, input);
    } else {
      await createPivaSettings(supabase, input);
    }
    setEditing(false);
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
    });
    await refresh();
  }

  if (!loaded) return null;

  if (!settings || !settings.attivo || editing) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
        <h1 className="text-2xl font-bold">P.IVA</h1>
        <PivaSettingsForm
          categories={categories}
          initial={settings}
          submitLabel={settings ? 'Salva modifiche' : 'Attiva gestione P.IVA'}
          onSubmit={handleSave}
        />
      </main>
    );
  }

  const oggi = new Date();
  const anno = oggi.getFullYear();
  const fatturatoAnnuo = settings.categoriaFatturatoId
    ? computeFatturatoAnnuo(transactions, settings.categoriaFatturatoId, anno)
    : 0;
  const redditoImponibile = computeRedditoImponibile(
    fatturatoAnnuo,
    settings.coefficienteRedditivita,
    settings.contributiVersatiAnnoPrecedente
  );
  const aliquotaSostitutiva = computeAliquotaSostitutiva(
    settings.dataApertura,
    oggi,
    settings.aliquotaSostitutivaOverride
  );
  const impostaSostitutiva = computeImpostaSostitutiva(redditoImponibile, aliquotaSostitutiva);
  const contributoSoggettivo = computeContributoSoggettivo(
    redditoImponibile,
    settings.aliquotaContributoSoggettivo,
    settings.minimaleContributivoAnnuo
  );
  const contributoIntegrativo = computeContributoIntegrativo(
    fatturatoAnnuo,
    settings.aliquotaContributoIntegrativo
  );
  const totaleDaAccantonare = computeTotaleDaAccantonare(
    impostaSostitutiva,
    contributoSoggettivo,
    contributoIntegrativo
  );
  const quotaMensileSuggerita = computeQuotaMensileSuggerita(totaleDaAccantonare, oggi);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">P.IVA</h1>
      <PivaDashboard
        fatturatoAnnuo={fatturatoAnnuo}
        impostaSostitutiva={impostaSostitutiva}
        contributoSoggettivo={contributoSoggettivo}
        contributoIntegrativo={contributoIntegrativo}
        totaleDaAccantonare={totaleDaAccantonare}
        quotaMensileSuggerita={quotaMensileSuggerita}
        onModifica={() => setEditing(true)}
        onDisattiva={handleDisattiva}
      />
    </main>
  );
}
