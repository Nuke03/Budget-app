'use client';

import { useState } from 'react';
import type { Category } from '@/lib/types';

export interface PivaSettingsFormValues {
  dataApertura: string | null;
  categoriaFatturatoId: string | null;
  coefficienteRedditivita: number;
  aliquotaSostitutivaOverride: number | null;
  aliquotaContributoSoggettivo: number;
  aliquotaContributoIntegrativo: number;
  minimaleContributivoAnnuo: number;
  contributiVersatiAnnoPrecedente: number;
}

const DEFAULTS: PivaSettingsFormValues = {
  dataApertura: null,
  categoriaFatturatoId: null,
  coefficienteRedditivita: 78,
  aliquotaSostitutivaOverride: null,
  aliquotaContributoSoggettivo: 10,
  aliquotaContributoIntegrativo: 4,
  minimaleContributivoAnnuo: 0,
  contributiVersatiAnnoPrecedente: 0,
};

const fieldClass =
  'rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand';

export function PivaSettingsForm({
  categories,
  initial,
  submitLabel,
  onSubmit,
}: {
  categories: Category[];
  initial: PivaSettingsFormValues | null;
  submitLabel: string;
  onSubmit: (values: PivaSettingsFormValues) => void;
}) {
  const start = initial ?? DEFAULTS;

  const [dataApertura, setDataApertura] = useState(start.dataApertura ?? '');
  const [categoriaFatturatoId, setCategoriaFatturatoId] = useState<string | null>(
    start.categoriaFatturatoId
  );
  const [coefficienteRedditivita, setCoefficienteRedditivita] = useState(
    String(start.coefficienteRedditivita)
  );
  const [aliquotaOverride, setAliquotaOverride] = useState<'auto' | '5' | '15'>(
    start.aliquotaSostitutivaOverride === null
      ? 'auto'
      : (String(start.aliquotaSostitutivaOverride) as '5' | '15')
  );
  const [aliquotaSoggettivo, setAliquotaSoggettivo] = useState(
    String(start.aliquotaContributoSoggettivo)
  );
  const [aliquotaIntegrativo, setAliquotaIntegrativo] = useState(
    String(start.aliquotaContributoIntegrativo)
  );
  const [minimale, setMinimale] = useState(String(start.minimaleContributivoAnnuo));
  const [contributiVersati, setContributiVersati] = useState(
    String(start.contributiVersatiAnnoPrecedente)
  );

  const categorieFatturato = categories.filter((c) => !c.archiviata && c.tipo === 'income');

  const numeriValidi = [
    coefficienteRedditivita,
    aliquotaSoggettivo,
    aliquotaIntegrativo,
    minimale,
    contributiVersati,
  ].every((v) => v.trim() !== '' && !Number.isNaN(Number(v)));

  const isValid = categoriaFatturatoId !== null && numeriValidi;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    onSubmit({
      dataApertura: dataApertura.trim() === '' ? null : dataApertura,
      categoriaFatturatoId,
      coefficienteRedditivita: Number(coefficienteRedditivita),
      aliquotaSostitutivaOverride: aliquotaOverride === 'auto' ? null : Number(aliquotaOverride),
      aliquotaContributoSoggettivo: Number(aliquotaSoggettivo),
      aliquotaContributoIntegrativo: Number(aliquotaIntegrativo),
      minimaleContributivoAnnuo: Number(minimale),
      contributiVersatiAnnoPrecedente: Number(contributiVersati),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Data apertura P.IVA (opzionale)
        <input
          aria-label="Data apertura"
          type="date"
          value={dataApertura}
          onChange={(e) => setDataApertura(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Categoria fatturato
        <select
          aria-label="Categoria fatturato"
          value={categoriaFatturatoId ?? ''}
          onChange={(e) => setCategoriaFatturatoId(e.target.value || null)}
          className={fieldClass}
        >
          <option value="">Seleziona una categoria</option>
          {categorieFatturato.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Coefficiente di redditività (%)
        <input
          aria-label="Coefficiente di redditività"
          type="number"
          inputMode="decimal"
          value={coefficienteRedditivita}
          onChange={(e) => setCoefficienteRedditivita(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Aliquota imposta sostitutiva
        <select
          aria-label="Aliquota imposta sostitutiva"
          value={aliquotaOverride}
          onChange={(e) => setAliquotaOverride(e.target.value as 'auto' | '5' | '15')}
          className={fieldClass}
        >
          <option value="auto">Automatica (in base alla data apertura)</option>
          <option value="5">5% (fissa)</option>
          <option value="15">15% (fissa)</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Aliquota contributo soggettivo (%)
        <input
          aria-label="Aliquota contributo soggettivo"
          type="number"
          inputMode="decimal"
          value={aliquotaSoggettivo}
          onChange={(e) => setAliquotaSoggettivo(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Aliquota contributo integrativo (%)
        <input
          aria-label="Aliquota contributo integrativo"
          type="number"
          inputMode="decimal"
          value={aliquotaIntegrativo}
          onChange={(e) => setAliquotaIntegrativo(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Minimale contributivo annuo
        <input
          aria-label="Minimale contributivo annuo"
          type="number"
          inputMode="decimal"
          value={minimale}
          onChange={(e) => setMinimale(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Contributi versati l&apos;anno precedente
        <input
          aria-label="Contributi versati l'anno precedente"
          type="number"
          inputMode="decimal"
          value={contributiVersati}
          onChange={(e) => setContributiVersati(e.target.value)}
          className={fieldClass}
        />
      </label>

      <button
        type="submit"
        disabled={!isValid}
        className="rounded-[var(--radius-md)] bg-brand py-3 text-sm font-semibold text-brand-foreground disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </form>
  );
}
