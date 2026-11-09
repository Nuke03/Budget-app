'use client';

import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { formatNumero } from '@/lib/format';
import type { DebitoMembro } from '@/lib/calculations/casa/debitiMembri';
import type { RigaMese } from '@/lib/calculations/casa/versamenti';
import { useCasaAzioni } from './CasaAzioni';

const etichettaMese = (mese: string): string => format(parseISO(mese), 'LLLL yyyy', { locale: it });
const SEZIONE = 'flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]';
const AZIONE = 'text-sm font-semibold text-brand-dark';

// Cosa c'è da versare, cosa è stato anticipato per conto di altri e cosa spetta a chi ha speso di tasca sua.
export function PannelliVersamenti({
  meUserId,
  membri,
  righe,
  debiti,
  crediti,
  meseCorrente,
}: {
  meUserId: string;
  membri: { userId: string; nome: string }[];
  righe: Record<string, RigaMese[]>;
  debiti: DebitoMembro[];
  crediti: Record<string, number>;
  meseCorrente: string;
}) {
  const { apri } = useCasaAzioni();
  const nome = (id: string) => membri.find((m) => m.userId === id)?.nome ?? 'Un membro';

  const arretrati = membri.flatMap((m) =>
    (righe[m.userId] ?? []).filter((r) => r.mese < meseCorrente && r.mancano > 0).map((r) => ({ nome: m.nome, riga: r }))
  );
  const conCredito = membri.filter((m) => (crediti[m.userId] ?? 0) > 0);

  return (
    <>
      <section className={SEZIONE}>
        <h2 className="text-base font-bold">Versamenti di {etichettaMese(meseCorrente)}</h2>
        <ul className="flex flex-col gap-1.5">
          {membri.map((m) => {
            const riga = (righe[m.userId] ?? []).find((r) => r.mese === meseCorrente);
            if (!riga || riga.atteso === 0) {
              return (
                <li key={m.userId} className="text-sm">
                  {`${m.nome}: Nessun versamento in questo periodo`}
                </li>
              );
            }
            const stato = riga.mancano > 0 ? `mancano ${formatNumero(riga.mancano)} €` : 'fatto';
            return (
              <li key={m.userId} className="text-sm">
                {`${m.nome} ${formatNumero(riga.versato)} di ${formatNumero(riga.atteso)} € ${stato}`}
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => apri({ tipo: 'versamento' })} className={AZIONE + ' self-start'}>
          Registra un versamento
        </button>
      </section>

      {arretrati.length > 0 || debiti.length > 0 ? (
        <section className={SEZIONE}>
          <h2 className="text-base font-bold">Arretrati e quote coperte</h2>
          <ul className="flex flex-col gap-2">
            {arretrati.map(({ nome: n, riga }) => (
              <li key={`${n}-${riga.mese}`} className="text-sm">
                {`${etichettaMese(riga.mese)}: ${n} ${formatNumero(riga.mancano)} €, ancora da versare`}
              </li>
            ))}
            {debiti.map((d) => (
              <li key={`${d.creditoreId}-${d.debitoreId}`} className="flex flex-col gap-1 text-sm">
                {d.mesi.map((m) => (
                  <span key={m.mese}>
                    {`${etichettaMese(m.mese)}: ${nome(d.creditoreId)} ha versato ${formatNumero(m.importo)} € per ${nome(d.debitoreId)}. ${nome(d.debitoreId)} deve a ${nome(d.creditoreId)} ${formatNumero(m.importo)} € (quota di ${etichettaMese(m.mese)}).`}
                  </span>
                ))}
                {d.debitoreId === meUserId ? (
                  <button
                    type="button"
                    onClick={() => apri({ tipo: 'restituisci', debito: d, nomeCreditore: nome(d.creditoreId) })}
                    className={AZIONE + ' self-start'}
                  >
                    Restituisci
                  </button>
                ) : null}
                {d.creditoreId === meUserId ? (
                  <button
                    type="button"
                    onClick={() => apri({ tipo: 'rinuncia_debito', debito: d, nomeDebitore: nome(d.debitoreId) })}
                    className={AZIONE + ' self-start'}
                  >
                    Rinuncia
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {conCredito.length > 0 ? (
        <section className={SEZIONE}>
          <h2 className="text-base font-bold">Crediti</h2>
          <ul className="flex flex-col gap-2">
            {conCredito.map((m) => {
              const importo = crediti[m.userId];
              return (
                <li key={m.userId} className="flex flex-col gap-1 text-sm">
                  {m.userId === meUserId ? (
                    <>
                      <span>{`In attesa del rimborso: ${formatNumero(importo)} €`}</span>
                      <button
                        type="button"
                        onClick={() => apri({ tipo: 'rinuncia_credito', importo })}
                        className={AZIONE + ' self-start'}
                      >
                        Rinuncia
                      </button>
                    </>
                  ) : (
                    <>
                      <span>{`A ${m.nome} spettano ${formatNumero(importo)} € per spese anticipate.`}</span>
                      <button
                        type="button"
                        onClick={() =>
                          apri({ tipo: 'rimborso', creditore: { userId: m.userId, nome: m.nome }, importo })
                        }
                        className={AZIONE + ' self-start'}
                      >
                        Rimborsa
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
