import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StipendioPiva } from '@/app/piva/StipendioPiva';

const OGGI = '2026-11-17';

function apri(over: Partial<React.ComponentProps<typeof StipendioPiva>> = {}) {
  const props = {
    stipendio: null,
    oggi: OGGI,
    calcolo: { a: 800, b: 600, proposta: 600, serveMeseMagro: false },
    riga: null,
    onSalva: vi.fn().mockResolvedValue(undefined),
    onMeseMagro: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  render(<StipendioPiva {...props} />);
  return props;
}

describe('StipendioPiva', () => {
  it('propone lo stipendio con A, B e il resto che va nel cuscinetto', () => {
    apri();
    expect(screen.getByText(/Ti propongo 600 € al mese/)).toBeInTheDocument();
    expect(screen.getByText('Incassi netti medi')).toBeInTheDocument();
    expect(screen.getByText('800 €')).toBeInTheDocument();
    expect(screen.getByText('Quanto ti serve al mese')).toBeInTheDocument();
    expect(screen.getByText('Il resto, 200 € al mese, riempie il cuscinetto.')).toBeInTheDocument();
  });

  it('senza B non lo mostra come 0 ma dice che mancano spese', () => {
    apri({ calcolo: { a: 800, b: 0, proposta: 800, serveMeseMagro: false } });
    expect(screen.queryByText('Quanto ti serve al mese')).not.toBeInTheDocument();
    expect(screen.getByText('Non vedo ancora abbastanza spese: parto da quanto incassi.')).toBeInTheDocument();
    expect(screen.getByText(/Ti propongo 800 € al mese/)).toBeInTheDocument();
  });

  it('senza resto non parla del cuscinetto', () => {
    apri({ calcolo: { a: 500, b: 600, proposta: 500, serveMeseMagro: false } });
    expect(screen.queryByText(/riempie il cuscinetto/)).not.toBeInTheDocument();
  });

  it('ogni numero ha il suo Perché', () => {
    apri();
    const perche = screen.getAllByRole('button', { name: 'Perché?' });
    expect(perche).toHaveLength(2);
    fireEvent.click(perche[0]);
    expect(screen.getByText(/media di quanto hai incassato/)).toBeInTheDocument();
    fireEvent.click(perche[1]);
    expect(screen.getByText(/media delle tue spese/)).toBeInTheDocument();
  });

  it('Va bene salva stipendio e data', async () => {
    const p = apri();
    fireEvent.click(screen.getByRole('button', { name: 'Va bene' }));
    await waitFor(() =>
      expect(p.onSalva).toHaveBeenCalledWith({ stipendioMensile: 600, stipendioRivistoIl: OGGI })
    );
  });

  it('Cambia apre un campo e salva il numero scelto, solo se maggiore di zero', async () => {
    const p = apri();
    fireEvent.click(screen.getByRole('button', { name: 'Cambia' }));
    const campo = screen.getByLabelText('Stipendio al mese (€)');
    const salva = screen.getByRole('button', { name: 'Salva' });
    fireEvent.change(campo, { target: { value: '0' } });
    expect(salva).toBeDisabled();
    fireEvent.change(campo, { target: { value: '550,50' } });
    fireEvent.click(salva);
    await waitFor(() =>
      expect(p.onSalva).toHaveBeenCalledWith({ stipendioMensile: 550.5, stipendioRivistoIl: OGGI })
    );
  });

  it('senza storico chiede il mese magro, una domanda sola', async () => {
    const p = apri({ calcolo: { a: null, b: 600, proposta: null, serveMeseMagro: true } });
    const campo = screen.getByLabelText('In un mese magro, quanto incassi più o meno?');
    expect(screen.queryByRole('button', { name: 'Va bene' })).not.toBeInTheDocument();
    fireEvent.change(campo, { target: { value: '900' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }));
    await waitFor(() => expect(p.onMeseMagro).toHaveBeenCalledWith(900));
  });

  it('con lo stipendio mostra le due righe', () => {
    apri({ stipendio: 800, riga: { rimasto: 450, cuscinetto: 1200, mesiCoperti: 1.5 } });
    expect(screen.getByText('Stipendio di questo mese 800 € (te ne restano 450 €)')).toBeInTheDocument();
    expect(screen.getByText('Cuscinetto 1.200 € copre 1,5 mesi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Va bene' })).not.toBeInTheDocument();
  });

  it('con lo stipendio si può cambiare', async () => {
    const p = apri({ stipendio: 800, riga: { rimasto: 450, cuscinetto: 0, mesiCoperti: 0 } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambia lo stipendio' }));
    fireEvent.change(screen.getByLabelText('Stipendio al mese (€)'), { target: { value: '700' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() =>
      expect(p.onSalva).toHaveBeenCalledWith({ stipendioMensile: 700, stipendioRivistoIl: OGGI })
    );
  });

  it('se il salvataggio fallisce lo dice con calma', async () => {
    apri({ onSalva: vi.fn().mockRejectedValue(new Error('x')) });
    fireEvent.click(screen.getByRole('button', { name: 'Va bene' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Non è riuscito. Riprova.');
  });
});
