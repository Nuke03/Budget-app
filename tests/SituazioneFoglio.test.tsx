// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const salvaSituazione = vi.fn(async (_input?: unknown) => {});
vi.mock('@/app/agevolazioni/actions', () => ({
  salvaSituazione: (input: unknown) => salvaSituazione(input),
  segnaVoce: vi.fn(),
  segnaSezioneAperta: vi.fn(),
}));

import { SituazioneFoglio } from '@/app/agevolazioni/SituazioneFoglio';

const vuota = { isee: null, dsuData: null, comune: null, inAffitto: null, studente: null };

beforeEach(() => salvaSituazione.mockClear());
afterEach(cleanup);

describe('SituazioneFoglio', () => {
  it('salva i valori scritti e chiude', async () => {
    const onSalvato = vi.fn();
    const { container } = render(<SituazioneFoglio iniziale={vuota} oggi="2026-11-24" onSalvato={onSalvato} />);
    assertNessunaParolaVietata(container);
    fireEvent.change(screen.getByLabelText('ISEE (facoltativo)'), { target: { value: '8500,50' } });
    fireEvent.change(screen.getByLabelText('Data della DSU'), { target: { value: '2026-03-10' } });
    fireEvent.change(screen.getByLabelText('Comune'), { target: { value: ' Roma ' } });
    fireEvent.click(screen.getAllByRole('radio', { name: 'Sì' })[0]);
    fireEvent.click(screen.getAllByRole('radio', { name: 'No' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(onSalvato).toHaveBeenCalled());
    expect(salvaSituazione).toHaveBeenCalledWith({
      isee: 8500.5,
      dsuData: '2026-03-10',
      comune: 'Roma',
      inAffitto: true,
      studente: false,
    });
  });

  it('Non so e campi vuoti diventano null', async () => {
    render(
      <SituazioneFoglio iniziale={{ ...vuota, inAffitto: true, studente: true }} oggi="2026-11-24" onSalvato={() => {}} />,
    );
    fireEvent.click(screen.getAllByRole('radio', { name: 'Non so' })[0]);
    fireEvent.click(screen.getAllByRole('radio', { name: 'Non so' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(salvaSituazione).toHaveBeenCalled());
    expect(salvaSituazione).toHaveBeenCalledWith(vuota);
  });

  it('ISEE non numerico: messaggio e nessun salvataggio', async () => {
    render(<SituazioneFoglio iniziale={vuota} oggi="2026-11-24" onSalvato={() => {}} />);
    fireEvent.change(screen.getByLabelText('ISEE (facoltativo)'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByText(/numero/i)).toBeInTheDocument();
    expect(salvaSituazione).not.toHaveBeenCalled();
  });

  it('salvataggio fallito: messaggio gentile, foglio aperto', async () => {
    salvaSituazione.mockRejectedValueOnce(new Error('x'));
    const onSalvato = vi.fn();
    render(<SituazioneFoglio iniziale={vuota} oggi="2026-11-24" onSalvato={onSalvato} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByText(/Non sono riuscito a salvare/)).toBeInTheDocument();
    expect(onSalvato).not.toHaveBeenCalled();
  });
});
