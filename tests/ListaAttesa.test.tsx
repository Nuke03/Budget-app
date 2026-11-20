import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const refresh = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }));
const azioni = vi.hoisted(() => ({
  aggiungiVoce: vi.fn(async () => {}),
  decidiVoce: vi.fn(async () => {}),
}));
vi.mock('@/app/impara/attesa/actions', () => azioni);

import { ListaAttesa } from '@/app/impara/attesa/ListaAttesa';
import type { VoceAttesa } from '@/lib/percorso/tipi';

const OGGI = '2026-11-19';
const voce = (o: Partial<VoceAttesa>): VoceAttesa => ({
  id: 'a1', nome: 'Cuffie', importo: 89.9, aggiuntoIl: '2026-11-10', rivediIl: '2026-11-17', stato: 'in_attesa', ...o,
});

beforeEach(() => {
  for (const f of Object.values(azioni)) f.mockClear();
  refresh.mockClear();
  push.mockClear();
});

describe('lista d attesa', () => {
  it('aggiunge una voce con ripensamento fra 7 giorni', async () => {
    render(<ListaAttesa voci={[]} oggi={OGGI} />);
    fireEvent.change(screen.getByLabelText('Cosa'), { target: { value: ' Cuffie ' } });
    fireEvent.change(screen.getByLabelText('Quanto'), { target: { value: '89,90' } });
    expect(screen.getByText(/ci ripensi il 26 novembre/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
    await waitFor(() => expect(azioni.aggiungiVoce).toHaveBeenCalledWith('Cuffie', 89.9));
    expect(refresh).toHaveBeenCalled();
  });

  it('una voce scaduta mostra le due scelte', async () => {
    const { container } = render(<ListaAttesa voci={[voce({})]} oggi={OGGI} />);
    expect(screen.getByRole('button', { name: 'Non più' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lo voglio ancora' }));
    await waitFor(() => expect(azioni.decidiVoce).toHaveBeenCalledWith('a1', 'voluto'));
    expect(push).toHaveBeenCalledWith('/goals?nuovo=1&nome=Cuffie&importo=89.9');
    fireEvent.click(screen.getByRole('button', { name: 'Non più' }));
    await waitFor(() => expect(azioni.decidiVoce).toHaveBeenCalledWith('a1', 'non_piu'));
    assertNessunaParolaVietata(container);
  });

  it('con ?nuovo=1 il focus va su Cosa', () => {
    window.history.pushState({}, '', '/impara/attesa?nuovo=1');
    try {
      render(<ListaAttesa voci={[]} oggi={OGGI} />);
      expect(screen.getByLabelText('Cosa')).toHaveFocus();
    } finally {
      window.history.pushState({}, '', '/');
    }
  });

  it('senza ?nuovo=1 il focus non va su Cosa', () => {
    render(<ListaAttesa voci={[]} oggi={OGGI} />);
    expect(screen.getByLabelText('Cosa')).not.toHaveFocus();
  });

  it('una voce non ancora scaduta non ha scelte', () => {
    render(<ListaAttesa voci={[voce({ rivediIl: '2026-11-25' })]} oggi={OGGI} />);
    expect(screen.getByText(/ci ripensi il 25 novembre/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Non più' })).toBeNull();
  });

  it('non mostra totali risparmiati', () => {
    const { container } = render(
      <ListaAttesa voci={[voce({}), voce({ id: 'a2', stato: 'non_piu' })]} oggi={OGGI} />
    );
    expect(container.textContent?.toLowerCase()).not.toMatch(/risparmiat|totale|bravo/);
    // le voci già decise non compaiono nell'elenco
    expect(screen.getAllByText('Cuffie')).toHaveLength(1);
  });
});
