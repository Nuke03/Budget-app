import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/x',
  useSearchParams: () => new URLSearchParams(''),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

import { StoricoVista } from '@/app/history/StoricoVista';
import { ContiVista } from '@/app/accounts/ContiVista';
import { ObiettiviVista } from '@/app/goals/ObiettiviVista';
import { ElencoImpara } from '@/app/impara/ElencoImpara';
import type { Account } from '@/lib/types';
import type { GoalWithQuotaMensile } from '@/app/goals/GoalsList';

const q = (c: HTMLElement, id: string) => c.querySelectorAll(`[data-fumetto="${id}"]`);

describe('ancore dei fumetti', () => {
  it('Storico: il contenitore del filtro periodo', () => {
    const { container } = render(
      <StoricoVista
        transactionsFiltrate={[]}
        transactionsTotali={0}
        righeNeutreFiltrate={[]}
        categories={[]}
        caricato
        periodo="mese"
        rangePersonalizzato={{ da: '', a: '' }}
        onChangePeriodo={() => {}}
        onChangeRange={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    const ancora = q(container, 'storico');
    expect(ancora).toHaveLength(1);
    expect(ancora[0].textContent).toContain('Questo mese');
  });

  const conto = (id: string): Account =>
    ({ id, nome: `Conto ${id}`, saldoAttuale: 10, contaInDisponibile: true, targetSaldo: null }) as unknown as Account;
  const contiVista = (accounts: Account[]) =>
    render(
      <ContiVista
        accounts={accounts}
        nome=""
        onNome={() => {}}
        contaInDisponibile
        onContaInDisponibile={() => {}}
        onUpdateBalance={() => {}}
        onUpdateDetails={() => {}}
        onCreate={() => {}}
      />,
    );

  it('Conti: solo il primo conto', () => {
    const { container } = contiVista([conto('a'), conto('b')]);
    const ancora = q(container, 'conti');
    expect(ancora).toHaveLength(1);
    expect(ancora[0].textContent).toContain('Conto a');
  });

  it('Conti: senza conti non c è l ancora', () => {
    const { container } = contiVista([]);
    expect(q(container, 'conti')).toHaveLength(0);
  });

  const goal = (id: string): GoalWithQuotaMensile =>
    ({
      id,
      nome: `Obiettivo ${id}`,
      importoTarget: 100,
      modalita: 'dilazionato',
      scadenza: null,
      ricorrente: false,
      frequenzaMesi: null,
      categoriaId: null,
      quotaMensile: null,
      accantonato: 0,
    }) as unknown as GoalWithQuotaMensile;
  const obiettivi = (goals: GoalWithQuotaMensile[]) =>
    render(<ObiettiviVista goals={goals} categories={[]} onNuovo={() => {}} onEdit={() => {}} onClose={() => {}} />);

  it('Cassetti: il primo cassetto della lista', () => {
    const { container } = obiettivi([goal('a'), goal('b')]);
    const ancora = q(container, 'cassetti');
    expect(ancora).toHaveLength(1);
    expect(ancora[0].tagName).toBe('LI');
    expect(ancora[0].textContent).toContain('Obiettivo a');
  });

  it('Cassetti: con la lista vuota è sul bottone di creazione', () => {
    const { container } = obiettivi([]);
    const ancora = q(container, 'cassetti');
    expect(ancora).toHaveLength(1);
    expect(ancora[0].tagName).toBe('BUTTON');
  });

  it('Impara: la prima lezione dell elenco', () => {
    const { container } = render(<ElencoImpara primiPassiDaFinire={false} lezioni={{}} />);
    const ancora = q(container, 'impara');
    expect(ancora).toHaveLength(1);
    expect(ancora[0]).toBe(container.querySelector('ol li'));
  });
});
