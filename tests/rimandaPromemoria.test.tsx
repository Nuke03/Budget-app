import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StrisciaPromemoria } from '@/app/casa/StrisciaPromemoria';
import { RimandatiProvider, giornoDopo } from '@/app/casa/rimandaPromemoria';
import type { Promemoria } from '@/lib/calculations/casa/promemoria';

const salvaRimandato = vi.hoisted(() => vi.fn());
vi.mock('@/lib/data/notifiche', async (originale) => ({
  ...(await originale<typeof import('@/lib/data/notifiche')>()),
  salvaRimandato: (...a: unknown[]) => salvaRimandato(...a),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ marca: 'client' }) }));

const promemoria: Promemoria[] = [
  { id: 'a', tipo: 'credito', testo: 'Primo promemoria.', azione: null },
  { id: 'b', tipo: 'quota', testo: 'Rivedi la quota.', azione: null, silenzia: ['b', 'c'] },
];

beforeEach(() => {
  salvaRimandato.mockReset();
  salvaRimandato.mockResolvedValue({});
});
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function mostra(iniziale: Record<string, string> | null, oggi = '2026-11-03') {
  return render(
    <RimandatiProvider iniziale={iniziale}>
      <StrisciaPromemoria promemoria={promemoria} oggi={oggi} />
    </RimandatiProvider>
  );
}

describe('giornoDopo', () => {
  it('il giorno dopo, anche a fine mese e fine anno', () => {
    expect(giornoDopo('2026-11-03')).toBe('2026-11-04');
    expect(giornoDopo('2026-11-30')).toBe('2026-12-01');
    expect(giornoDopo('2026-12-31')).toBe('2027-01-01');
  });
});

describe('rimandati nel database', () => {
  it('un promemoria nella mappa non si vede finché non arriva la data, poi ricompare', () => {
    const { unmount } = mostra({ a: '2026-11-04' });
    expect(screen.queryByText('Primo promemoria.')).not.toBeInTheDocument();
    expect(screen.getByText('Rivedi la quota.')).toBeInTheDocument();
    unmount();
    mostra({ a: '2026-11-04' }, '2026-11-04');
    expect(screen.getByText('Primo promemoria.')).toBeInTheDocument();
  });

  it('Più tardi nasconde subito, salva fino a domani nel database e non scrive localStorage', async () => {
    mostra({});
    fireEvent.click(screen.getAllByRole('button', { name: 'Più tardi' })[0]);
    expect(screen.queryByText('Primo promemoria.')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(salvaRimandato).toHaveBeenCalledWith({ marca: 'client' }, 'a', '2026-11-04', '2026-11-03')
    );
    expect(window.localStorage.length).toBe(0);
  });

  it('Va bene così salva la data dopo 6 mesi per ogni id da silenziare, uno alla volta', async () => {
    mostra({});
    fireEvent.click(screen.getByRole('button', { name: 'Va bene così' }));
    expect(screen.queryByText('Rivedi la quota.')).not.toBeInTheDocument();
    await waitFor(() => expect(salvaRimandato).toHaveBeenCalledTimes(2));
    expect(salvaRimandato.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      ['b', '2027-05-03'],
      ['c', '2027-05-03'],
    ]);
  });

  it('se il salvataggio fallisce resta nascosto e si ripiega su localStorage', async () => {
    salvaRimandato.mockRejectedValue(new Error('rete'));
    mostra({});
    fireEvent.click(screen.getAllByRole('button', { name: 'Più tardi' })[0]);
    expect(screen.queryByText('Primo promemoria.')).not.toBeInTheDocument();
    await waitFor(() => expect(window.localStorage.getItem('promemoria-fino:a')).toBe('2026-11-04'));
  });

  it('quando il server manda una mappa nuova, la mappa si riallinea', () => {
    const strisciaConMappa = (m: Record<string, string>) => (
      <RimandatiProvider iniziale={m}>
        <StrisciaPromemoria promemoria={promemoria} oggi="2026-11-03" />
      </RimandatiProvider>
    );
    const { rerender } = render(strisciaConMappa({ a: '2026-11-04' }));
    expect(screen.queryByText('Primo promemoria.')).not.toBeInTheDocument();
    rerender(strisciaConMappa({}));
    expect(screen.getByText('Primo promemoria.')).toBeInTheDocument();
  });

  it('se la lettura è fallita (iniziale null) tutto passa da localStorage, senza chiamare il database', () => {
    mostra(null);
    fireEvent.click(screen.getAllByRole('button', { name: 'Più tardi' })[0]);
    expect(screen.queryByText('Primo promemoria.')).not.toBeInTheDocument();
    expect(salvaRimandato).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('promemoria:a:2026-11-03')).not.toBeNull();
  });
});
