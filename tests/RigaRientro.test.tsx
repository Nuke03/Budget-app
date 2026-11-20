import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RigaRientro } from '@/app/rientri/RigaRientro';
import type { Rientro, SituazioneRientroConto } from '@/lib/calculations/rientri';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const rientro = (over: Partial<Rientro> = {}): Rientro => ({
  id: 'r1', userId: 'u', householdId: null, goalId: null, accountId: 'c1',
  importo: 300, mesi: 3, creatoIl: '2026-11-20', stato: 'aperto', fermatoIl: null, ...over,
});
const situazione = (r: Rientro, daSpostare: number): SituazioneRientroConto => ({
  rientro: r, maturato: 200, spostato: 200 - daSpostare, daSpostare, finito: false,
});

describe('RigaRientro', () => {
  it('mostra la frase, il da spostare e Ferma; Ferma parte una volta sola col doppio tocco', async () => {
    const r = rientro();
    let fine: () => void = () => {};
    const onFerma = vi.fn(() => new Promise<void>((ok) => { fine = ok; }));
    const { container } = render(<RigaRientro rientro={r} situazione={situazione(r, 200)} onFerma={onFerma} />);
    expect(screen.getByText('Rientro: 100 € al mese fino a gennaio')).toBeInTheDocument();
    expect(screen.getByText('Da spostare: 200 €')).toBeInTheDocument();
    const b = screen.getByRole('button', { name: 'Ferma' });
    fireEvent.click(b);
    fireEvent.click(b);
    expect(onFerma).toHaveBeenCalledTimes(1);
    fine();
    await waitFor(() => expect(b).not.toBeDisabled());
    assertNessunaParolaVietata(container);
    expect(container.textContent!.toLowerCase()).not.toMatch(/autorata|debito|rimborso/);
  });

  it('"Lascia stare" solo se c\'è da spostare', () => {
    const r = rientro();
    const { rerender } = render(<RigaRientro rientro={r} situazione={situazione(r, 0)} onFerma={vi.fn()} onLasciaStare={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Lascia stare' })).toBeNull();
    const onLascia = vi.fn().mockResolvedValue(undefined);
    rerender(<RigaRientro rientro={r} situazione={situazione(r, 100)} onFerma={vi.fn()} onLasciaStare={onLascia} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lascia stare' }));
    expect(onLascia).toHaveBeenCalledTimes(1);
  });

  it('un rientro fermato non ha Ferma', () => {
    const r = rientro({ stato: 'fermato', fermatoIl: '2026-12-01' });
    render(<RigaRientro rientro={r} situazione={situazione(r, 100)} onFerma={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Ferma' })).toBeNull();
  });

  it('se fallisce lo dice', async () => {
    render(<RigaRientro rientro={rientro()} onFerma={() => Promise.reject(new Error('x'))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ferma' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Non è andata: riprova.');
  });
});
