import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GoalsList } from '@/app/goals/GoalsList';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

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

    expect(screen.getByText(/Da mettere da parte questo mese/)).toBeInTheDocument();
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

    expect(screen.queryByText(/Da mettere da parte questo mese/)).not.toBeInTheDocument();
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

    expect(screen.getByText(/Da mettere da parte questo mese/)).toBeInTheDocument();
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
    fireEvent.click(screen.getByLabelText('Modifica cassetto'));

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

    expect(screen.getByText('Già spesi 50,00 €, restano 350,00 € da parte')).toBeInTheDocument();
  });

  it('per un obiettivo dilazionato dice "Ancora riservato"', () => {
    const goals = [
      {
        id: '1', nome: 'Vacanza', importoTarget: 300, modalita: 'dilazionato' as const,
        scadenza: '2027-04-16', categoriaId: null, ricorrente: false, frequenzaMesi: null,
        stato: 'aperto' as const, createdAt: '2026-01-01T00:00:00Z', quotaMensile: 30, accantonato: 150,
      },
    ];
    render(<GoalsList goals={goals} categories={[]} />);
    expect(screen.getByText('Ancora riservato')).toBeInTheDocument();
    expect(screen.getByText('entro il 16 aprile 2027')).toBeInTheDocument();
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

  it('chiama onClose con l\'obiettivo al click del pulsante di chiusura', () => {
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
    const onClose = vi.fn();

    render(<GoalsList goals={[goal]} categories={[]} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Chiudi cassetto'));

    expect(onClose).toHaveBeenCalledWith(goal);
  });

  it('non mostra il pulsante di chiusura se onClose non è passato', () => {
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

    render(<GoalsList goals={[goal]} categories={[]} />);
    expect(screen.queryByLabelText('Chiudi cassetto')).not.toBeInTheDocument();
  });
});

describe('GoalsList variante casa', () => {
  const fondo = {
    id: 'g1', nome: 'TARI', importoTarget: 300, modalita: 'dilazionato' as const, scadenza: '2027-03-31',
    categoriaId: null, ricorrente: true, frequenzaMesi: 12, stato: 'aperto' as const,
    createdAt: '2026-11-09T00:00:00Z', quotaMensile: 25, accantonato: 100,
    spiegazione: { valore: 100, formula: 'Bolletta di 300 euro in 12 mesi.', ingredienti: [] },
  };

  it('etichetta Da parte, niente Bloccato né Dilazionato', () => {
    const { container } = render(<GoalsList goals={[fondo]} categories={[]} variante="casa" />);
    expect(screen.getByText('Da parte')).toBeInTheDocument();
    expect(screen.getByText('100 di 300 €')).toBeInTheDocument();
    expect(screen.getByText('25 € al mese')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Come si calcola?' })).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('vuota: Ancora niente messo da parte.', () => {
    render(<GoalsList goals={[]} categories={[]} variante="casa" />);
    expect(screen.getByText('Ancora niente messo da parte.')).toBeInTheDocument();
  });

  it('la variante di default resta com\'è', () => {
    render(<GoalsList goals={[fondo]} categories={[]} />);
    expect(screen.getByText('messo da parte finora')).toBeInTheDocument();
    render(<GoalsList goals={[]} categories={[]} />);
    expect(screen.getByText('Nessun cassetto aperto.')).toBeInTheDocument();
  });
});

describe('GoalsList: rientri', () => {
  const cassetto = (over = {}) => ({
    id: 'g1', nome: 'Vacanza', importoTarget: 900, modalita: 'dilazionato' as const, scadenza: '2027-06-01',
    categoriaId: null, ricorrente: false, frequenzaMesi: null, stato: 'aperto' as const,
    createdAt: '2026-01-01T00:00:00Z', quotaMensile: 50, accantonato: 200, confermatoMese: 0,
    versatoNellaFinestra: 100, ...over,
  });
  const rientro = (over = {}) => ({
    id: 'r1', userId: 'u', householdId: null, goalId: 'g1', accountId: null, importo: 300, mesi: 3 as const,
    creatoIl: '2099-01-01', stato: 'aperto' as const, fermatoIl: null, ...over,
  });

  it('un rientro aperto: riga con la frase e Ferma', () => {
    const onFermaRientro = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <GoalsList goals={[cassetto()]} categories={[]} rientri={[rientro()]} onFermaRientro={onFermaRientro} />
    );
    expect(screen.getByText('Rientro: 100 € al mese fino a marzo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ferma' }));
    expect(onFermaRientro).toHaveBeenCalledWith('r1');
    assertNessunaParolaVietata(container);
    expect(container.textContent!.toLowerCase()).not.toMatch(/autorata|debito|rimborso/);
  });

  it('con speso collegato e nessun rientro aperto: link Rimetti a rate verso quel cassetto', () => {
    render(<GoalsList goals={[cassetto({ specoCollegato: 120 })]} categories={[]} rientri={[]} />);
    expect(screen.getByRole('link', { name: 'Rimetti a rate' })).toHaveAttribute('href', '/?rimetti=g1');
  });

  it("con un rientro aperto il link non c'e'; senza speso nemmeno", () => {
    const { unmount } = render(
      <GoalsList goals={[cassetto({ specoCollegato: 120 })]} categories={[]} rientri={[rientro()]} />
    );
    expect(screen.queryByRole('link', { name: 'Rimetti a rate' })).toBeNull();
    unmount();
    render(<GoalsList goals={[cassetto()]} categories={[]} rientri={[]} />);
    expect(screen.queryByRole('link', { name: 'Rimetti a rate' })).toBeNull();
  });

  it('Ho messo da parte propone la quota piu la rata del rientro in corso', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T10:00:00Z'));
    try {
      render(
        <GoalsList
          goals={[cassetto()]}
          categories={[]}
          rientri={[rientro({ creatoIl: '2026-11-01' })]}
          onHoMessoDaParte={vi.fn()}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Ho messo da parte' }));
      expect(screen.getByLabelText('Importo')).toHaveValue(150);
    } finally {
      vi.useRealTimers();
    }
  });
});
