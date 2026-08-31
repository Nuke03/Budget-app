'use client';

import { useState } from 'react';
import type { Category } from '@/lib/types';
import { FieldHint } from '@/app/FieldHint';

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
  onCancel,
}: {
  categories: Category[];
  initial: PivaSettingsFormValues | null;
  submitLabel: string;
  onSubmit: (values: PivaSettingsFormValues) => void;
  onCancel?: () => void;
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
    start.aliquotaSostitutivaOverride === 5 || start.aliquotaSostitutivaOverride === 15
      ? (String(start.aliquotaSostitutivaOverride) as '5' | '15')
      : 'auto'
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

  const categoriaArchiviataSelezionata =
    categoriaFatturatoId !== null &&
    !categorieFatturato.some((c) => c.id === categoriaFatturatoId)
      ? categories.find((c) => c.id === categoriaFatturatoId)
      : undefined;

  const opzioniCategoriaFatturato = categoriaArchiviataSelezionata
    ? [...categorieFatturato, categoriaArchiviataSelezionata]
    : categorieFatturato;

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
      <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        <label htmlFor="piva-data-apertura">Data apertura P.IVA (opzionale)</label>
        <input
          id="piva-data-apertura"
          type="date"
          value={dataApertura}
          onChange={(e) => setDataApertura(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        <label htmlFor="piva-categoria-fatturato">Categoria fatturato</label>
        <select
          id="piva-categoria-fatturato"
          value={categoriaFatturatoId ?? ''}
          onChange={(e) => setCategoriaFatturatoId(e.target.value || null)}
          className={fieldClass}
        >
          <option value="">Seleziona una categoria</option>
          {opzioniCategoriaFatturato.map((c) => (
            <option key={c.id} value={c.id}>
              {c.archiviata ? `${c.nome} (archiviata)` : c.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        <span className="flex items-center gap-1">
          <label htmlFor="piva-coefficiente">Coefficiente di redditività (%)</label>
          <FieldHint testo="Percentuale di legge sul tuo fatturato che diventa reddito imponibile. Per il regime forfettario dipende dal codice ATECO della tua attività (spesso 78%): controlla il tuo, se non lo conosci lascia il valore proposto." />
        </span>
        <input
          id="piva-coefficiente"
          type="number"
          inputMode="decimal"
          value={coefficienteRedditivita}
          onChange={(e) => setCoefficienteRedditivita(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        <span className="flex items-center gap-1">
          <label htmlFor="piva-aliquota-sostitutiva">Aliquota imposta sostitutiva</label>
          <FieldHint testo="La tassa che sostituisce l'IRPEF nel regime forfettario: 5% nei primi 5 anni di attività, poi 15%. 'Automatica' la calcola da sola in base alla data di apertura; scegli un valore fisso solo se sai che il tuo caso è diverso." />
        </span>
        <select
          id="piva-aliquota-sostitutiva"
          value={aliquotaOverride}
          onChange={(e) => setAliquotaOverride(e.target.value as 'auto' | '5' | '15')}
          className={fieldClass}
        >
          <option value="auto">Automatica (in base alla data apertura)</option>
          <option value="5">5% (fissa)</option>
          <option value="15">15% (fissa)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        <span className="flex items-center gap-1">
          <label htmlFor="piva-soggettivo">Aliquota contributo soggettivo (%)</label>
          <FieldHint testo="Il contributo previdenziale principale che versi alla tua cassa (es. ENPAP, ENPAIA), calcolato sul reddito imponibile. La percentuale esatta dipende dalla tua cassa: controlla il tuo tariffario, di solito è intorno al 10%." />
        </span>
        <input
          id="piva-soggettivo"
          type="number"
          inputMode="decimal"
          value={aliquotaSoggettivo}
          onChange={(e) => setAliquotaSoggettivo(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        <span className="flex items-center gap-1">
          <label htmlFor="piva-integrativo">Aliquota contributo integrativo (%)</label>
          <FieldHint testo="Un secondo contributo che alcune casse calcolano sul fatturato lordo (non sul reddito), spesso aggiunto in fattura al cliente. Controlla il tariffario della tua cassa; se non si applica alla tua, metti 0." />
        </span>
        <input
          id="piva-integrativo"
          type="number"
          inputMode="decimal"
          value={aliquotaIntegrativo}
          onChange={(e) => setAliquotaIntegrativo(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        <span className="flex items-center gap-1">
          <label htmlFor="piva-minimale">Minimale contributivo annuo</label>
          <FieldHint testo="L'importo minimo che la tua cassa richiede ogni anno anche se il calcolo percentuale darebbe meno. Lo trovi nel tariffario della tua cassa; se non sai qual è, metti 0 e il calcolo userà solo la percentuale." />
        </span>
        <input
          id="piva-minimale"
          type="number"
          inputMode="decimal"
          value={minimale}
          onChange={(e) => setMinimale(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        <span className="flex items-center gap-1">
          <label htmlFor="piva-contributi-versati">Contributi versati l&apos;anno precedente</label>
          <FieldHint testo="Quanto hai effettivamente pagato di contributi previdenziali l'anno scorso: questo importo si sottrae dal reddito imponibile di quest'anno. Se non l'hai ancora calcolato o è il primo anno, lascia 0." />
        </span>
        <input
          id="piva-contributi-versati"
          type="number"
          inputMode="decimal"
          value={contributiVersati}
          onChange={(e) => setContributiVersati(e.target.value)}
          className={fieldClass}
        />
      </div>

      <button
        type="submit"
        disabled={!isValid}
        className="rounded-[var(--radius-md)] bg-brand py-3 text-sm font-semibold text-brand-foreground disabled:opacity-40"
      >
        {submitLabel}
      </button>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[var(--radius-md)] bg-surface py-3 text-sm font-semibold text-foreground shadow-[var(--shadow-card)]"
        >
          Annulla
        </button>
      )}
    </form>
  );
}
