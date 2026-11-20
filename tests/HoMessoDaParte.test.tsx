import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HoMessoDaParte } from '@/app/goals/HoMessoDaParte';
import { GoalsList, type GoalWithQuotaMensile } from '@/app/goals/GoalsList';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

describe('HoMessoDaParte', () => {
  it('con finora il campo parte da quella cifra e la frase la riporta', () => {
    render(<HoMessoDaParte quota={200} finora={600} oggi="2026-11-19" onConferma={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ho messo da parte' }));
    expect(screen.getByLabelText('Importo')).toHaveValue(600);
    expect(screen.getByText(/Finora dovrebbero esserci 600,00 €/)).toBeInTheDocument();
  });

  it('apre una conferma con la quota del mese e la data di oggi già scritte', () => {
    render(<HoMessoDaParte quota={200} oggi="2026-11-19" onConferma={vi.fn()} />);
    expect(screen.queryByLabelText('Importo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ho messo da parte' }));
    expect(screen.getByLabelText('Importo')).toHaveValue(200);
    expect(screen.getByLabelText('Data')).toHaveValue('2026-11-19');
  });

  it('apertoIniziale mostra subito Importo e Data, con la quota del mese', () => {
    render(<HoMessoDaParte quota={200} oggi="2026-11-19" apertoIniziale onConferma={vi.fn()} />);
    expect(screen.getByLabelText('Importo')).toHaveValue(200);
    expect(screen.getByLabelText('Data')).toHaveValue('2026-11-19');
  });

  it('apertoIniziale che diventa vero a pagina già aperta apre la conferma', () => {
    const { rerender } = render(<HoMessoDaParte quota={200} oggi="2026-11-19" onConferma={vi.fn()} />);
    expect(screen.queryByLabelText('Importo')).not.toBeInTheDocument();
    rerender(<HoMessoDaParte quota={200} oggi="2026-11-19" apertoIniziale onConferma={vi.fn()} />);
    expect(screen.getByLabelText('Importo')).toHaveValue(200);
    expect(screen.getByLabelText('Data')).toHaveValue('2026-11-19');
  });

  it('apertoIniziale con finora parte da quella cifra', () => {
    render(<HoMessoDaParte quota={200} finora={600} oggi="2026-11-19" apertoIniziale onConferma={vi.fn()} />);
    expect(screen.getByLabelText('Importo')).toHaveValue(600);
  });

  it('conferma con importo e data, anche modificati, poi si richiude', async () => {
    const onConferma = vi.fn().mockResolvedValue(undefined);
    render(<HoMessoDaParte quota={200} oggi="2026-11-19" onConferma={onConferma} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ho messo da parte' }));
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-11-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }));
    await waitFor(() => expect(onConferma).toHaveBeenCalledWith(150, '2026-11-10'));
    await waitFor(() => expect(screen.queryByLabelText('Importo')).not.toBeInTheDocument());
  });

  it('non conferma una data nel futuro né un importo non valido', () => {
    const onConferma = vi.fn();
    render(<HoMessoDaParte quota={200} oggi="2026-11-19" onConferma={onConferma} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ho messo da parte' }));
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-11-20' } });
    expect(screen.getByRole('button', { name: 'Conferma' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-11-19' } });
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Conferma' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Conferma' })).toBeDisabled();
    expect(onConferma).not.toHaveBeenCalled();
  });

  it('se la scrittura non riesce lo dice e lascia la conferma aperta', async () => {
    const onConferma = vi.fn().mockRejectedValue(new Error('no'));
    render(<HoMessoDaParte quota={200} oggi="2026-11-19" onConferma={onConferma} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ho messo da parte' }));
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/non sono riuscito/i);
    expect(screen.getByLabelText('Importo')).toBeInTheDocument();
  });

  it('Annulla chiude senza scrivere', () => {
    const onConferma = vi.fn();
    render(<HoMessoDaParte quota={200} oggi="2026-11-19" onConferma={onConferma} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ho messo da parte' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.queryByLabelText('Importo')).not.toBeInTheDocument();
    expect(onConferma).not.toHaveBeenCalled();
  });
});

describe('GoalsList: Ho messo da parte', () => {
  const dilazionato: GoalWithQuotaMensile = {
    id: 'g1', nome: 'Vacanza', importoTarget: 300, modalita: 'dilazionato', scadenza: '2026-12-01', categoriaId: null,
    ricorrente: false, frequenzaMesi: null, stato: 'aperto', createdAt: '2026-01-01T00:00:00Z',
    quotaMensile: 30, accantonato: 150,
  };

  it('solo per gli obiettivi dilazionati, e solo se la pagina sa scriverlo', () => {
    const { rerender } = render(<GoalsList goals={[dilazionato]} categories={[]} />);
    expect(screen.queryByRole('button', { name: 'Ho messo da parte' })).not.toBeInTheDocument();
    rerender(<GoalsList goals={[dilazionato]} categories={[]} onHoMessoDaParte={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Ho messo da parte' })).toBeInTheDocument();
    rerender(
      <GoalsList
        goals={[{ ...dilazionato, modalita: 'bloccato', scadenza: null, quotaMensile: null }]}
        categories={[]}
        onHoMessoDaParte={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: 'Ho messo da parte' })).not.toBeInTheDocument();
  });

  it('la prima conferma è preimpostata su quanto dovrebbe esserci finora, con la frase sopra il campo', () => {
    render(<GoalsList goals={[dilazionato]} categories={[]} onHoMessoDaParte={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ho messo da parte' }));
    expect(screen.getByLabelText('Importo')).toHaveValue(150);
    expect(screen.getByText(/Finora dovrebbero esserci 150,00 € per questo cassetto\./)).toBeInTheDocument();
  });

  it('le conferme successive restano sulla quota del mese', () => {
    render(
      <GoalsList
        goals={[{ ...dilazionato, versatoNellaFinestra: 100 }]}
        categories={[]}
        onHoMessoDaParte={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ho messo da parte' }));
    expect(screen.getByLabelText('Importo')).toHaveValue(30);
    expect(screen.queryByText(/Finora dovrebbero esserci/)).not.toBeInTheDocument();
  });

  it('nel primo mese dell obiettivo dice che conta dal mese prossimo e il bottone resta usabile', () => {
    const oggi = new Date();
    const nuovo: GoalWithQuotaMensile = {
      ...dilazionato,
      createdAt: oggi.toISOString(),
      scadenza: new Date(oggi.getFullYear() + 1, oggi.getMonth(), 15).toISOString().slice(0, 10),
      accantonato: 0,
    };
    render(<GoalsList goals={[nuovo]} categories={[]} onHoMessoDaParte={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ho messo da parte' }));
    expect(
      screen.getByText("Conta dal mese prossimo: per ora non c'è niente da mettere da parte.")
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conferma' })).toBeEnabled();
  });

  it('una riga piccola dice quanto hai confermato questo mese, solo se più di zero', () => {
    const { rerender } = render(
      <GoalsList goals={[{ ...dilazionato, confermatoMese: 0 }]} categories={[]} onHoMessoDaParte={vi.fn()} />
    );
    expect(screen.queryByText(/Confermato questo mese/)).not.toBeInTheDocument();
    rerender(<GoalsList goals={[{ ...dilazionato, confermatoMese: 150 }]} categories={[]} onHoMessoDaParte={vi.fn()} />);
    expect(screen.getByText(/Confermato questo mese: 150,00/)).toBeInTheDocument();
  });

  it('nessuna parola vietata', () => {
    const { container } = render(
      <GoalsList goals={[{ ...dilazionato, confermatoMese: 150 }]} categories={[]} onHoMessoDaParte={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ho messo da parte' }));
    assertNessunaParolaVietata(container);
  });
});
