'use client';

import {
  IstruzioniInstallazione,
  PULSANTE_PRIMARIO,
  PULSANTE_SECONDARIO,
  useIscrizione,
} from '@/app/home/SchedaNotifiche';

export function Notifiche({
  chiavePubblica,
  notificheAttive,
}: {
  chiavePubblica: string | null;
  notificheAttive: boolean | null;
}) {
  const { ambiente, stato, attiva, spegni } = useIscrizione(chiavePubblica);
  const attive = stato === 'attive' || (notificheAttive === true && stato !== 'negate' && stato !== 'spente');
  const puoAttivare = (ambiente === 'installata' || ambiente === 'browser') && chiavePubblica !== null;

  return (
    <section id="notifiche" className="mt-8 scroll-mt-4">
      <h2 className="font-serif text-lg font-semibold text-foreground">Promemoria</h2>
      <div className="mt-3 rounded-[var(--radius-lg)] border border-rule bg-page p-4 shadow-[var(--shadow-card)]">
        {attive ? (
          <p role="status" className="text-[15px]">
            Promemoria attivi. Ti avviso se resti indietro con le spese, al massimo una volta ogni tre giorni e mai di
            notte.
          </p>
        ) : (
          <p className="text-[15px]">
            Promemoria spenti.
            {stato === 'negate' ? ' Il telefono non ha dato il permesso: puoi darlo dalle impostazioni, poi riprova.' : ''}
            {stato === 'rimandata' ? ' Non hai ancora risposto: puoi attivarli quando vuoi.' : ''}
          </p>
        )}
        {ambiente === 'ios_da_installare' ? (
          <div className="mt-2">
            <IstruzioniInstallazione />
          </div>
        ) : null}
        {ambiente === 'non_supportate' ? (
          <p className="mt-2 text-[15px] text-ink-2">Questo browser non supporta i promemoria.</p>
        ) : null}
        {stato === 'errore' ? (
          <p role="alert" className="mt-2 text-sm text-foreground">
            Non sono riuscito ad attivare i promemoria. Riprova tra un attimo.
          </p>
        ) : null}
        {attive ? (
          <button type="button" disabled={stato === 'in_corso'} onClick={spegni} className={`${PULSANTE_SECONDARIO} -mx-4 mt-1`}>
            Spegni i promemoria
          </button>
        ) : null}
        {!attive && puoAttivare ? (
          <button type="button" disabled={stato === 'in_corso'} onClick={attiva} className={`${PULSANTE_PRIMARIO} mt-3`}>
            Attiva i promemoria
          </button>
        ) : null}
      </div>
    </section>
  );
}
