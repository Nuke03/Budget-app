import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GoalsList } from '@/app/goals/GoalsList';

describe('GoalsList', () => {
  it('mostra la quota da spostare questo mese per un obiettivo dilazionato', () => {
    const goals = [
      {
        id: '1',
        nome: 'Vacanza',
        importoTarget: 300,
        modalita: 'dilazionato' as const,
        scadenza: '2026-12-01',
        categoriaId: null,
        ricorrente: false,
        frequenzaMesi: null,
        stato: 'aperto' as const,
        createdAt: '2026-01-01T00:00:00Z',
        quotaMensile: 30,
        accantonato: 150,
      },
    ];

    render(<GoalsList goals={goals} categories={[]} />);

    expect(screen.getByText(/Sposta questo mese/)).toBeInTheDocument();
    expect(screen.getByText(/30,00/)).toBeInTheDocument();
  });

  it('non mostra la quota per un obiettivo bloccato non ricorrente (versamento unico)', () => {
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
        createdAt: '2026-01-01T00:00:00Z',
        quotaMensile: null,
        accantonato: 130,
      },
    ];

    render(<GoalsList goals={goals} categories={[]} />);

    expect(screen.queryByText(/Sposta questo mese/)).not.toBeInTheDocument();
  });

  it('mostra la quota per un obiettivo bloccato ricorrente (es. abbonamento mensile)', () => {
    const goals = [
      {
        id: '1',
        nome: 'Tidal',
        importoTarget: 9.99,
        modalita: 'bloccato' as const,
        scadenza: '2026-01-01',
        categoriaId: null,
        ricorrente: true,
        frequenzaMesi: 1,
        stato: 'aperto' as const,
        createdAt: '2026-01-01T00:00:00Z',
        quotaMensile: 9.99,
        accantonato: 9.99,
      },
    ];

    render(<GoalsList goals={goals} categories={[]} />);

    expect(screen.getByText(/Sposta questo mese/)).toBeInTheDocument();
    // Compare per un bloccato ricorrente sia nell'intestazione (importoTarget) sia nella riga quota (quotaMensile) — stesso valore, entrambi visibili.
    expect(screen.getAllByText('9,99 €')).toHaveLength(2);
  });

  it('chiama onEdit con l\'obiettivo al click della matita', () => {
    const goal = {
      id: '1',
      nome: 'Telepass',
      importoTarget: 130,
      modalita: 'bloccato' as const,
      scadenza: null,
      categoriaId: null,
      ricorrente: false,
      frequenzaMesi: null,
      stato: 'aperto' as const,
      createdAt: '2026-01-01T00:00:00Z',
      quotaMensile: null,
      accantonato: 130,
    };
    const onEdit = vi.fn();

    render(<GoalsList goals={[goal]} categories={[]} onEdit={onEdit} />);
    fireEvent.click(screen.getByLabelText('Modifica obiettivo'));

    expect(onEdit).toHaveBeenCalledWith(goal);
  });

  it('mostra quanto resta ancora riservato quando è già stata collegata una spesa', () => {
    const goals = [
      {
        id: '1',
        nome: 'Gita',
        importoTarget: 400,
        modalita: 'bloccato' as const,
        scadenza: null,
        categoriaId: null,
        ricorrente: false,
        frequenzaMesi: null,
        stato: 'aperto' as const,
        createdAt: '2026-01-01T00:00:00Z',
        quotaMensile: null,
        accantonato: 350,
      },
    ];

    render(<GoalsList goals={goals} categories={[]} />);

    expect(screen.getByText(/Ancora riservato/)).toBeInTheDocument();
    expect(screen.getByText(/350,00/)).toBeInTheDocument();
  });

  it('non mostra la riga "ancora riservato" se non è stata collegata nessuna spesa', () => {
    const goals = [
      {
        id: '1',
        nome: 'Gita',
        importoTarget: 400,
        modalita: 'bloccato' as const,
        scadenza: null,
        categoriaId: null,
        ricorrente: false,
        frequenzaMesi: null,
        stato: 'aperto' as const,
        createdAt: '2026-01-01T00:00:00Z',
        quotaMensile: null,
        accantonato: 400,
      },
    ];

    render(<GoalsList goals={goals} categories={[]} />);

    expect(screen.queryByText(/Ancora riservato/)).not.toBeInTheDocument();
  });
});
