import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/history', useRouter: () => ({ push: () => {} }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

import { StoricoVista } from '@/app/history/StoricoVista';
import type { Transaction } from '@/lib/types';

const tx = (id: string, origine: 'riconciliazione' | null): Transaction => ({
  id,
  tipo: 'expense',
  importo: 12,
  data: '2026-11-03',
  categoriaId: null,
  accountId: null,
  goalId: null,
  descrizione: `Riga ${id}`,
  nota: null,
  createdAt: '2026-11-03T10:00:00Z',
  origine,
  stima: false,
});

describe('Storico: righe della riconciliazione', () => {
  it('senza matita ma con il cestino; le righe normali hanno entrambi', () => {
    render(
      <StoricoVista
        transactionsFiltrate={[tx('a', 'riconciliazione'), tx('b', null)]}
        transactionsTotali={2}
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
    expect(screen.getAllByLabelText('Modifica transazione')).toHaveLength(1);
    expect(screen.getAllByLabelText('Elimina transazione')).toHaveLength(2);
  });
});
