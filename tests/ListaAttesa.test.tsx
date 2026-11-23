import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const refresh = vi.fn();
const push = vi.fn();
const replace = vi.fn();
const router = { refresh, push, replace };
const qs = vi.hoisted(() => ({ current: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(qs.current),
}));
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
  replace.mockClear();
  qs.current = '';
});

describe('lista d attesa', () => {
  it('aggiunge una voce con ripensamento fra 7 giorni', async () => {
    render(<ListaAttesa voci={[]} oggi={OGGI} />);
    fireEvent.change(screen.getByLabelText('Cosa'), { target: { value: ' Cuffie ' } });
    fireEvent.change(screen.getByLabelText('Quanto'), { target: { value: '89,90' } });
    expect(screen.getByText(/ci ripensi il 26 novembre/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
    await waitFor(() => expect(azioni.aggiungiVoce).toHaveBeenCalledWith('Cuffie', 89.9));
    expect(refresh).not.toHaveBeenCalled();
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

  it('con ?nuovo=1 il focus va su Cosa e l indirizzo si pulisce', () => {
    qs.current = 'nuovo=1';
    render(<ListaAttesa voci={[]} oggi={OGGI} />);
    expect(screen.getByLabelText('Cosa')).toHaveFocus();
    expect(replace).toHaveBeenCalledWith('/impara/attesa');
  });

  it('senza ?nuovo=1 il focus non va su Cosa', () => {
    render(<ListaAttesa voci={[]} oggi={OGGI} />);
    expect(screen.getByLabelText('Cosa')).not.toHaveFocus();
    expect(replace).not.toHaveBeenCalled();
  });

  it('se la pagina è già aperta, un nuovo ?nuovo=1 mette il focus su Cosa', () => {
    const { rerender } = render(<ListaAttesa voci={[]} oggi={OGGI} />);
    expect(screen.getByLabelText('Cosa')).not.toHaveFocus();
    qs.current = 'nuovo=1';
    rerender(<ListaAttesa voci={[]} oggi={OGGI} />);
    expect(screen.getByLabelText('Cosa')).toHaveFocus();
    expect(replace).toHaveBeenCalledWith('/impara/attesa');
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

describe('lista d attesa fumetto', () => {
  it('il campo Cosa porta data-fumetto="attesa"', () => {
    const { container } = render(<ListaAttesa voci={[]} oggi={OGGI} />);
    expect(container.querySelector('[data-fumetto="attesa"]')).toBe(screen.getByLabelText('Cosa'));
  });
});
