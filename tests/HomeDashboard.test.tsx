import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HomeDashboard } from '@/app/HomeDashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/lib/data/transactions', () => ({
  createTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/data/accounts', () => ({
  updateAccountBalance: vi.fn().mockResolvedValue(undefined),
}));

import { updateAccountBalance } from '@/lib/data/accounts';

const accounts = [
  { id: '1', nome: 'Conto corrente', saldoAttuale: 870, contaInDisponibile: true, targetSaldo: null },
];
const goals = [
  {
    id: '1',
    nome: 'Telepass',
    importoTarget: 130,
    modalita: 'bloccato' as const,
    scadenza: null,
    categoriaId: null,
    ricorrente: false,
    frequenzaMesi: null,
    stato: 'aperto' as const,
    createdAt: '2026-02-01T00:00:00Z',
    accantonato: 130,
  },
];

describe('HomeDashboard', () => {
  it('mostra il disponibile libero e il margine giornaliero', () => {
    render(
      <HomeDashboard
        disponibileLibero={870}
        margineGiornaliero={29}
        dataTarget="2026-07-01T00:00:00Z"
        accounts={accounts}
        categories={[]}
        goals={goals}
      />
    );

    expect(screen.getByText(/870,00/)).toBeInTheDocument();
    expect(screen.getByText(/29,00/)).toBeInTheDocument();
  });

  it('mostra il dettaglio conti/obiettivi solo dopo il click', () => {
    render(
      <HomeDashboard
        disponibileLibero={870}
        margineGiornaliero={29}
        dataTarget="2026-07-01T00:00:00Z"
        accounts={accounts}
        categories={[]}
        goals={goals}
      />
    );

    expect(screen.queryByText('Conto corrente')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Mostra dettaglio'));

    expect(screen.getByText('Conto corrente')).toBeInTheDocument();
    expect(screen.getByText(/Telepass/)).toBeInTheDocument();
  });

  it('nel dettaglio mostra la quota accantonata (non il target) per un obiettivo dilazionato e separa i conti esclusi dal disponibile', () => {
    const accountsConFondo = [
      ...accounts,
      { id: '2', nome: 'Fondo emergenza', saldoAttuale: 500, contaInDisponibile: false, targetSaldo: null },
    ];
    const goalsDilazionato = [
      {
        id: '2',
        nome: 'Vacanza',
        importoTarget: 300,
        modalita: 'dilazionato' as const,
        scadenza: '2026-12-01',
        categoriaId: null,
        ricorrente: false,
        frequenzaMesi: null,
        stato: 'aperto' as const,
        createdAt: '2026-01-01T00:00:00Z',
        accantonato: 150,
      },
    ];

    render(
      <HomeDashboard
        disponibileLibero={720}
        margineGiornaliero={29}
        dataTarget="2026-07-01T00:00:00Z"
        accounts={accountsConFondo}
        categories={[]}
        goals={goalsDilazionato}
      />
    );

    fireEvent.click(screen.getByText('Mostra dettaglio'));

    // Mostra la quota maturata (150), non l'intero importoTarget (300).
    expect(screen.getByText(/150,00/)).toBeInTheDocument();
    expect(screen.queryByText(/300,00/)).not.toBeInTheDocument();

    // Il conto escluso dal disponibile è mostrato ma etichettato come tale.
    expect(screen.getByText(/Fondo emergenza \(non conta nel disponibile\)/)).toBeInTheDocument();
  });

  it('scarica una spesa dal saldo del conto selezionato quando si aggiunge una transazione', async () => {
    render(
      <HomeDashboard
        disponibileLibero={870}
        margineGiornaliero={29}
        dataTarget="2026-07-01T00:00:00Z"
        accounts={accounts}
        categories={[]}
        goals={goals}
      />
    );

    fireEvent.click(screen.getByLabelText('Aggiungi transazione'));
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '26' } });
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Spesa' } });
    fireEvent.click(screen.getByText('Salva'));

    await waitFor(() => {
      expect(updateAccountBalance).toHaveBeenCalledWith(expect.anything(), '1', 844);
    });
  });
});
