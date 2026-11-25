// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const segnaVoce = vi.fn(async (_id?: unknown, _stato?: unknown) => {});
vi.mock('@/app/agevolazioni/actions', () => ({
  salvaSituazione: vi.fn(async () => {}),
  segnaVoce: (id: unknown, stato: unknown) => segnaVoce(id, stato),
  segnaSezioneAperta: vi.fn(async () => {}),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { AgevolazioniVista } from '@/app/agevolazioni/AgevolazioniVista';
import type { Situazione } from '@/lib/agevolazioni/tipi';

const vuota: Situazione = { isee: null, dsuData: null, comune: null, inAffitto: null, studente: null, piva: false };

beforeEach(() => segnaVoce.mockClear());
afterEach(cleanup);

function righe(): string[] {
  return screen.getAllByRole('button', { name: /./ }).filter((b) => b.hasAttribute('aria-expanded')).map((b) => b.textContent ?? '');
}

describe('AgevolazioniVista', () => {
  it('situazione vuota: invito e voci generali', () => {
    const { container } = render(<AgevolazioniVista situazione={vuota} stati={[]} oggi="2026-11-24" />);
    expect(screen.getByRole('heading', { name: 'Agevolazioni e scadenze' })).toBeInTheDocument();
    expect(screen.getByText('Rispondi a 4 domande per vedere cosa potrebbe riguardarti.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ISEE e DSU/ })).toBeInTheDocument();
    expect(container.querySelector('#isee-dsu')).not.toBeNull();
    const testo = container.textContent ?? '';
    expect(testo).not.toMatch(/hai diritto|ti spetta|devi/i);
    assertNessunaParolaVietata(container);
  });

  it('ISEE basso: il bonus sociale sta in cima', () => {
    render(
      <AgevolazioniVista situazione={{ ...vuota, isee: 5000, dsuData: '2026-03-01' }} stati={[]} oggi="2026-11-24" />,
    );
    expect(righe()[0]).toContain('Bonus sociale');
  });

  it('la riga si apre come accordion con dettagli, una alla volta', () => {
    render(<AgevolazioniVista situazione={vuota} stati={[]} oggi="2026-11-24" />);
    const riga = screen.getByRole('button', { name: /ISEE e DSU/ });
    fireEvent.click(riga);
    expect(riga).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('DSU precompilata INPS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copia' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /INPS: tipologie di ISEE/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(/Controllato il 23 novembre 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Potrebbe essere cambiata/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Bonus sociale/ }));
    expect(riga).toHaveAttribute('aria-expanded', 'false');
  });

  it('Copia usa la clipboard e non rompe se manca', async () => {
    const writeText = vi.fn(async (_t: string) => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<AgevolazioniVista situazione={vuota} stati={[]} oggi="2026-11-24" />);
    fireEvent.click(screen.getByRole('button', { name: /ISEE e DSU/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Copia' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('DSU precompilata INPS'));
    cleanup();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    render(<AgevolazioniVista situazione={vuota} stati={[]} oggi="2026-11-24" />);
    fireEvent.click(screen.getByRole('button', { name: /ISEE e DSU/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Copia' }));
    expect(screen.getByRole('button', { name: 'Copia' })).toBeInTheDocument();
  });

  it('Fatto sposta la voce fra le chiuse; Rimetti la riporta', async () => {
    render(<AgevolazioniVista situazione={vuota} stati={[]} oggi="2026-11-24" />);
    fireEvent.click(screen.getByRole('button', { name: /ISEE e DSU/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await waitFor(() => expect(segnaVoce).toHaveBeenCalledWith('isee-dsu', 'fatto'));
    const chiuse = await screen.findByRole('button', { name: /Fatte e non mi riguardano \(1\)/ });
    expect(screen.queryByRole('button', { name: /^ISEE e DSU/ })).toBeNull();
    fireEvent.click(chiuse);
    fireEvent.click(screen.getByRole('button', { name: /ISEE e DSU/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Rimetti fra da controllare' }));
    await waitFor(() => expect(segnaVoce).toHaveBeenCalledWith('isee-dsu', null));
    expect(await screen.findByRole('button', { name: /ISEE e DSU/ })).toBeInTheDocument();
  });

  it('Non mi riguarda chiude con lo stato giusto', async () => {
    render(<AgevolazioniVista situazione={vuota} stati={[]} oggi="2026-11-24" />);
    fireEvent.click(screen.getByRole('button', { name: /ISEE e DSU/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Non mi riguarda' }));
    await waitFor(() => expect(segnaVoce).toHaveBeenCalledWith('isee-dsu', 'non-mi-riguarda'));
  });

  it('azione fallita: la voce resta e c e un messaggio', async () => {
    segnaVoce.mockRejectedValueOnce(new Error('x'));
    render(<AgevolazioniVista situazione={vuota} stati={[]} oggi="2026-11-24" />);
    fireEvent.click(screen.getByRole('button', { name: /ISEE e DSU/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    expect(await screen.findByText(/Non sono riuscito/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ISEE e DSU/ })).toBeInTheDocument();
  });

  it('nota "Potrebbe essere cambiata" con data oltre 12 mesi', () => {
    render(<AgevolazioniVista situazione={vuota} stati={[]} oggi="2027-12-01" />);
    fireEvent.click(screen.getByRole('button', { name: /ISEE e DSU/ }));
    expect(screen.getByText(/Potrebbe essere cambiata: controlla il link\./)).toBeInTheDocument();
  });

  it('Modifica apre il foglio della situazione', () => {
    render(<AgevolazioniVista situazione={{ ...vuota, comune: 'Roma' }} stati={[]} oggi="2026-11-24" />);
    expect(screen.queryByText('Rispondi a 4 domande per vedere cosa potrebbe riguardarti.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Modifica' }));
    expect(within(screen.getByRole('dialog')).getByLabelText('Comune')).toHaveValue('Roma');
  });

  it('le righe portano le etichette Automatico e Su domanda', () => {
    render(<AgevolazioniVista situazione={vuota} stati={[]} oggi="2026-11-24" />);
    expect(screen.getAllByText('Automatico').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Su domanda').length).toBeGreaterThan(0);
  });
});
