import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRegistraMovimento } from '@/app/casa/usaRegistraMovimento';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/transfers', async () => ({
  ...(await vi.importActual<typeof import('@/lib/data/transfers')>('@/lib/data/transfers')),
  recordTransfer: vi.fn(),
}));
import { recordTransfer } from '@/lib/data/transfers';

const input = { householdId: 'h1', causale: 'versamento' as const, importo: 10, data: '2026-11-09' };

beforeEach(() => {
  vi.mocked(recordTransfer).mockReset();
});

describe('useRegistraMovimento', () => {
  it('un doppio tocco fa una sola chiamata finché la RPC non risponde', async () => {
    let risolvi: (v: string) => void = () => {};
    vi.mocked(recordTransfer).mockReturnValue(new Promise((r) => (risolvi = r)));
    const onDone = vi.fn();
    const { result } = renderHook(() => useRegistraMovimento({ onDone }));
    let p1: Promise<boolean> = Promise.resolve(false);
    let p2: Promise<boolean> = Promise.resolve(false);
    act(() => {
      p1 = result.current.registra(input);
      p2 = result.current.registra(input);
    });
    expect(recordTransfer).toHaveBeenCalledTimes(1);
    expect(result.current.inCorso).toBe(true);
    await act(async () => {
      risolvi('t1');
      await p1;
    });
    expect(await p2).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.inCorso).toBe(false);
  });

  it('legge la virgola, rifiuta zero, negativi e oltre il massimo', () => {
    const { result } = renderHook(() => useRegistraMovimento({ onDone: vi.fn(), max: 100 }));
    const con = (t: string) => {
      act(() => result.current.setImportoTesto(t));
      return result.current.importo;
    };
    expect(con('76,5')).toBe(76.5);
    expect(con('0')).toBeNull();
    expect(con('')).toBeNull();
    expect(con('-3')).toBeNull();
    expect(con('100,01')).toBeNull();
    expect(result.current.oltreMax).toBe(true);
    expect(con('100')).toBe(100);
    expect(con('99,9951')).toBe(100);
  });

  it('arrotonda ai centesimi prima del tetto: 603,0004 diventa 603', () => {
    const { result } = renderHook(() => useRegistraMovimento({ onDone: vi.fn(), max: 603 }));
    act(() => result.current.setImportoTesto('603,0004'));
    expect(result.current.importo).toBe(603);
    expect(result.current.oltreMax).toBe(false);
  });
});
