import { formatEuro, nomeMese } from '@/lib/format';
import { ComeSiCalcola } from '../casa/ComeSiCalcola';
import { descriviOrigineDebito } from '@/lib/calculations/casa/debitiMembri';
import { spiegaRiserva } from '@/lib/calculations/casa/spiegazioni';
import type { CasaPerHome } from '@/lib/loadHomeData';
import type { Account, BudgetGoal } from '@/lib/types';

type Obiettivo = BudgetGoal & { accantonato: number };

const euroInFrase = (n: number): string => formatEuro(n).replace(',00', '');

function elencoMesi(mesi: string[]): string {
  const nomi = mesi.map(nomeMese);
  return nomi.length <= 1 ? (nomi[0] ?? '') : `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`;
}

function Gruppo({ titolo, subtotale, children }: { titolo: string; subtotale: number; children: React.ReactNode }) {
  return (
    <section aria-label={titolo} className="flex flex-col gap-1">
      <h3 className="flex justify-between border-b border-rule pb-1 text-sm font-semibold">
        <span>{titolo}</span>
        <span className="num">{formatEuro(subtotale)}</span>
      </h3>
      {children}
    </section>
  );
}

const Riga = ({ nome, valore, nota }: { nome: string; valore: string; nota?: string }) => (
  <div className="flex justify-between gap-3 py-1 text-sm">
    <span>
      {nome}
      {nota ? <span className="block text-xs text-ink-2">{nota}</span> : null}
    </span>
    <span className="num">{valore}</span>
  </div>
);

export function DettaglioDisponibile({
  accounts,
  goals,
  casa,
}: {
  accounts: Account[];
  goals: Obiettivo[];
  casa: CasaPerHome | null;
}) {
  const conti = accounts.filter((a) => a.contaInDisponibile);
  const esclusi = accounts.filter((a) => !a.contaInDisponibile);
  const stato = casa?.stato ?? null;
  const nomeDi = (userId: string): string =>
    stato?.membri.find((m) => m.userId === userId)?.displayName ?? 'un altro membro';
  const righeDaVersare = stato ? stato.righe.filter((r) => r.mancano > 0) : [];
  const debitiMiei = stato ? stato.debiti.filter((d) => d.debitoreId === stato.me.userId) : [];
  const debitiVersoDiMe = stato ? stato.debiti.filter((d) => d.creditoreId === stato.me.userId) : [];
  const creditoMio = stato ? (stato.crediti[stato.me.userId] ?? 0) : 0;
  const statoNonLetto = !!casa && !casa.stato;
  const haRiserva = righeDaVersare.length > 0 || debitiMiei.length > 0;
  const haInfoCasa = creditoMio > 0 || debitiVersoDiMe.length > 0 || !!stato?.avvisoArretrati;

  const totaleConti = conti.reduce((t, a) => t + a.saldoAttuale, 0);
  const totaleObiettivi = goals.reduce((t, g) => t + g.accantonato, 0);
  // Stesse due cifre che il disponibile sottrae: così i tre subtotali tornano con la cifra grande.
  const totaleCasa = stato ? stato.riservaVersamento + stato.debitoDaRestituire : 0;

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-sm)] bg-surface-muted p-4">
      <Gruppo titolo="Soldi tuoi" subtotale={totaleConti}>
        {conti.map((a) => (
          <Riga key={a.id} nome={a.nome} valore={formatEuro(a.saldoAttuale)} />
        ))}
        {esclusi.map((a) => (
          <div key={a.id} className="flex justify-between py-1 text-xs text-ink-2">
            <span>{a.nome} (non conta nel disponibile)</span>
            <span className="num">{formatEuro(a.saldoAttuale)}</span>
          </div>
        ))}
      </Gruppo>

      {goals.length > 0 ? (
        <Gruppo titolo="Già messi da parte" subtotale={-totaleObiettivi}>
          {goals.map((g) => (
            <Riga
              key={g.id}
              nome={g.nome}
              nota={g.modalita === 'bloccato' ? 'tutto messo da parte' : 'messo da parte finora'}
              valore={`-${formatEuro(g.accantonato)}`}
            />
          ))}
        </Gruppo>
      ) : null}

      {haRiserva || haInfoCasa || statoNonLetto ? (
        <Gruppo titolo="Casa" subtotale={-totaleCasa}>
          {righeDaVersare.map((r) => (
            <Riga
              key={`versamento-${r.mese}`}
              nome={`Versamento alla casa, ${nomeMese(r.mese)}`}
              valore={`-${formatEuro(r.mancano)}`}
            />
          ))}
          {debitiMiei.map((d) => (
            <Riga
              key={`debito-${d.creditoreId}`}
              nome={`Da restituire a ${nomeDi(d.creditoreId)}`}
              valore={`-${formatEuro(d.importo)}`}
            />
          ))}
          {statoNonLetto ? (
            <p className="text-xs text-ink-2">Non riesco a leggere la casa: il disponibile non tiene conto della quota.</p>
          ) : null}
          {haRiserva && stato ? (
            <ComeSiCalcola etichetta="Come si calcola la parte di casa" spiegazione={spiegaRiserva({ righe: stato.righe, debitoDaRestituire: stato.debitoDaRestituire })} />
          ) : null}
          {haInfoCasa ? (
            <div className="flex flex-col gap-1 text-xs text-ink-2">
              {creditoMio > 0 && <p>Dalla casa ti spettano {euroInFrase(creditoMio)}</p>}
              {debitiVersoDiMe.map((d) => (
                <p key={`credito-${d.debitoreId}`}>
                  {nomeDi(d.debitoreId)} deve a te {euroInFrase(d.importo)}, {descriviOrigineDebito(d.mesi, elencoMesi)}
                </p>
              ))}
              {stato?.avvisoArretrati && (
                <p>
                  Sono più di due mesi di versamenti da registrare. Se li hai già fatti, registrali con &quot;Già riflesso nei
                  saldi&quot;.
                </p>
              )}
            </div>
          ) : null}
        </Gruppo>
      ) : null}
    </div>
  );
}
