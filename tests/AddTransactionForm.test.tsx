import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddTransactionForm } from '@/app/add/AddTransactionForm';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const categories = [
  { id: 'cat-1', nome: 'Groceries', tipo: 'expense' as const, colore: null, archiviata: false },
];
const accounts = [
  { id: 'acc-1', nome: 'Conto corrente', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null },
];
const goals = [
  {
    id: 'goal-1',
    nome: 'Gita',
    importoTarget: 400,
    modalita: 'bloccato' as const,
    scadenza: null,
    categoriaId: null,
    ricorrente: false,
    frequenzaMesi: null,
    stato: 'aperto' as const,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('AddTransactionForm', () => {
  it('chiama onSubmit con i valori del form e mostra subito la transazione come aggiunta (optimistic UI)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <AddTransactionForm categories={categories} accounts={accounts} onSubmit={onSubmit} />
    );

    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '26' } });
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Spesa' } });
    fireEvent.click(screen.getByText('Salva'));

    expect(screen.getByText('Salvata ✓')).toBeInTheDocument();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        tipo: 'expense',
        importo: 26,
        categoriaId: 'cat-1',
        accountId: 'acc-1',
        goalId: null,
        descrizione: 'Spesa',
      });
    });
  });

  it('in modifica mostra tutti i campi di sempre e non sposta il fuoco sull importo', () => {
    render(
      <AddTransactionForm
        categories={categories}
        accounts={accounts}
        initial={{ tipo: 'expense', importo: 42, categoriaId: 'cat-1', accountId: 'acc-1', descrizione: 'Vecchia spesa' }}
        submitLabel="Salva modifiche"
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Importo')).not.toHaveFocus();
    expect(screen.getByLabelText('Descrizione')).toHaveValue('Vecchia spesa');
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Conto corrente')).toBeInTheDocument();
  });

  it('in aggiunta veloce con importo vuoto o zero Salva resta disattivo', () => {
    render(<AddTransactionForm categories={categories} accounts={accounts} veloce onSubmit={vi.fn()} />);
    expect(screen.getByText('Salva')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '0' } });
    expect(screen.getByText('Salva')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '3' } });
    expect(screen.getByText('Salva')).not.toBeDisabled();
  });

  it('disabilita il pulsante se importo o descrizione sono vuoti', () => {
    const onSubmit = vi.fn();
    render(
      <AddTransactionForm categories={categories} accounts={accounts} onSubmit={onSubmit} />
    );

    expect(screen.getByText('Salva')).toBeDisabled();
  });

  it('precompila i campi con i valori iniziali e usa l\'etichetta di modifica', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AddTransactionForm
        categories={categories}
        accounts={accounts}
        initial={{
          tipo: 'expense',
          importo: 42,
          categoriaId: 'cat-1',
          accountId: 'acc-1',
          descrizione: 'Vecchia spesa',
        }}
        submitLabel="Salva modifiche"
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByLabelText('Importo')).toHaveValue(42);
    expect(screen.getByLabelText('Descrizione')).toHaveValue('Vecchia spesa');
    expect(screen.getByText('Salva modifiche')).toBeInTheDocument();
  });

  it('precompila anche l\'obiettivo collegato quando presente nei valori iniziali', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AddTransactionForm
        categories={categories}
        accounts={accounts}
        goals={goals}
        initial={{
          tipo: 'expense',
          importo: 50,
          categoriaId: 'cat-1',
          accountId: 'acc-1',
          goalId: 'goal-1',
          descrizione: 'Biglietti treno',
        }}
        submitLabel="Salva modifiche"
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByText('Salva modifiche'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ goalId: 'goal-1' }));
    });
  });

  it('mostra un pulsante Annulla solo se viene passato onCancel, e lo chiama al click', () => {
    const onCancel = vi.fn();
    render(
      <AddTransactionForm
        categories={categories}
        accounts={accounts}
        onCancel={onCancel}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Annulla'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('non mostra il pulsante Annulla se onCancel non è passato', () => {
    render(<AddTransactionForm categories={categories} accounts={accounts} onSubmit={vi.fn()} />);
    expect(screen.queryByText('Annulla')).not.toBeInTheDocument();
  });

  it('mostra il selettore obiettivo solo per le spese, non per le entrate', () => {
    render(
      <AddTransactionForm categories={categories} accounts={accounts} goals={goals} onSubmit={vi.fn()} />
    );

    expect(screen.getByText('Gita')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Entrata'));
    expect(screen.queryByText('Gita')).not.toBeInTheDocument();
  });

  it('include l\'obiettivo selezionato nel payload inviato', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AddTransactionForm categories={categories} accounts={accounts} goals={goals} onSubmit={onSubmit} />
    );

    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Biglietti treno' } });
    fireEvent.click(screen.getByText('Gita'));
    fireEvent.click(screen.getByText('Salva'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ goalId: 'goal-1' }));
    });
  });

  it('non mostra "+ Nuovo obiettivo" se onCreateGoal non è passato', () => {
    render(
      <AddTransactionForm categories={categories} accounts={accounts} goals={goals} onSubmit={vi.fn()} />
    );
    expect(screen.queryByText('+ Nuovo obiettivo')).not.toBeInTheDocument();
  });

  it('crea un nuovo obiettivo al volo e lo collega automaticamente', async () => {
    const nuovoGoal = {
      id: 'goal-2',
      nome: 'Assicurazione auto',
      importoTarget: 250,
      modalita: 'bloccato' as const,
      scadenza: null,
      categoriaId: 'cat-1',
      ricorrente: false,
      frequenzaMesi: null,
      stato: 'aperto' as const,
      createdAt: '2026-01-01T00:00:00Z',
    };
    const onCreateGoal = vi.fn().mockResolvedValue(nuovoGoal);
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <AddTransactionForm
        categories={categories}
        accounts={accounts}
        goals={goals}
        onCreateGoal={onCreateGoal}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByText('+ Nuovo obiettivo'));
    fireEvent.change(screen.getByLabelText('Nome nuovo obiettivo'), {
      target: { value: 'Assicurazione auto' },
    });
    fireEvent.change(screen.getByLabelText('Importo nuovo obiettivo'), {
      target: { value: '250' },
    });
    fireEvent.click(screen.getByText('Crea e collega'));

    await waitFor(() => {
      expect(onCreateGoal).toHaveBeenCalledWith({
        nome: 'Assicurazione auto',
        importoTarget: 250,
        categoriaId: 'cat-1',
      });
    });

    expect(await screen.findByText('Assicurazione auto')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Rata' } });
    fireEvent.click(screen.getByText('Salva'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ goalId: 'goal-2' }));
    });
  });

  it('contoEtichetta e obiettivoEtichetta cambiano i titoli', () => {
    render(
      <AddTransactionForm
        categories={categories}
        accounts={accounts}
        goals={goals}
        contoEtichetta="Chi ha pagato"
        obiettivoEtichetta="Da parte (opzionale)"
        nascondiGestisciCategorie
        nota="Lo vedrà anche Anna"
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText('Chi ha pagato')).toBeInTheDocument();
    expect(screen.getByText('Da parte (opzionale)')).toBeInTheDocument();
    expect(screen.queryByText('Gestisci categorie')).not.toBeInTheDocument();
    expect(screen.getByText('Lo vedrà anche Anna')).toBeInTheDocument();
    expect(screen.queryByText('Obiettivo (opzionale)')).not.toBeInTheDocument();
  });

  it('idContiSoloSpesa nasconde quei conti per le entrate', () => {
    const due = [
      ...accounts,
      { id: 'acc-2', nome: 'Carta casa', saldoAttuale: 0, contaInDisponibile: true, targetSaldo: null },
    ];
    render(
      <AddTransactionForm categories={categories} accounts={due} idContiSoloSpesa={['acc-2']} onSubmit={vi.fn()} />
    );
    expect(screen.getByText('Carta casa')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Entrata'));
    expect(screen.queryByText('Carta casa')).not.toBeInTheDocument();
    expect(screen.getByText('Conto corrente')).toBeInTheDocument();
  });
});

describe('AddTransactionForm - obiettivo scelto dalla categoria', () => {
  const categorieCasa = [
    { id: 'cat-affitto', nome: 'Affitto', tipo: 'expense' as const, colore: null, archiviata: false },
    { id: 'cat-luce', nome: 'Luce', tipo: 'expense' as const, colore: null, archiviata: false },
  ];
  const contoCasa = [
    { id: 'acc-casa', nome: 'Conto comune', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null },
  ];
  const obiettivoLuce = {
    id: 'g-luce',
    nome: 'Bolletta luce',
    importoTarget: 300,
    modalita: 'bloccato' as const,
    scadenza: null,
    categoriaId: 'cat-luce',
    ricorrente: false,
    frequenzaMesi: null,
    stato: 'aperto' as const,
    createdAt: '2026-01-01T00:00:00Z',
  };

  function compilaEInvia() {
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '26' } });
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Bolletta' } });
    fireEvent.click(screen.getByText('Salva'));
  }

  it('scegliere Luce con la preselezione collega l obiettivo della categoria', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <AddTransactionForm
        categories={categorieCasa}
        accounts={contoCasa}
        goals={[obiettivoLuce]}
        preselezionaObiettivo
        onSubmit={onSubmit}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Luce' }));
    compilaEInvia();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: 'cat-luce', goalId: 'g-luce' }))
    );
    assertNessunaParolaVietata(container);
  });

  it('scegliere Affitto non collega nessun obiettivo', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <AddTransactionForm
        categories={categorieCasa}
        accounts={contoCasa}
        goals={[obiettivoLuce]}
        preselezionaObiettivo
        onSubmit={onSubmit}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Luce' }));
    fireEvent.click(screen.getByRole('button', { name: 'Affitto' }));
    compilaEInvia();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ goalId: null })));
    assertNessunaParolaVietata(container);
  });

  it('una scelta manuale vince: deselezionare il chip e cambiare categoria non lo ripreseleziona', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <AddTransactionForm
        categories={[categorieCasa[1], categorieCasa[0]]}
        accounts={contoCasa}
        goals={[obiettivoLuce]}
        preselezionaObiettivo
        onSubmit={onSubmit}
      />
    );
    const chip = screen.getByRole('button', { name: 'Bolletta luce' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Affitto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Luce' }));
    compilaEInvia();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ goalId: null })));
    assertNessunaParolaVietata(container);
  });

  it('senza la prop il comportamento è quello di prima: nessuna preselezione', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <AddTransactionForm categories={categorieCasa} accounts={contoCasa} goals={[obiettivoLuce]} onSubmit={onSubmit} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Luce' }));
    compilaEInvia();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ goalId: null })));
    assertNessunaParolaVietata(container);
  });

  it('i chip degli obiettivi espongono aria-pressed', () => {
    const { container } = render(
      <AddTransactionForm categories={categorieCasa} accounts={contoCasa} goals={[obiettivoLuce]} onSubmit={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Bolletta luce' })).toHaveAttribute('aria-pressed', 'false');
    assertNessunaParolaVietata(container);
  });
});
