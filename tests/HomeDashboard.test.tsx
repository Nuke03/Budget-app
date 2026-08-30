import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HomeDashboard } from '@/app/HomeDashboard';

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
    frequenzaAnni: null,
    stato: 'aperto' as const,
    createdAt: '2026-02-01T00:00:00Z',
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
        goals={goals}
      />
    );

    expect(screen.queryByText('Conto corrente')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Mostra dettaglio'));

    expect(screen.getByText('Conto corrente')).toBeInTheDocument();
    expect(screen.getByText(/Telepass/)).toBeInTheDocument();
  });
});
