import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VistaSemplice } from '@/app/casa/VistaSemplice';
import { EVENTO_AGGIUNGI, type DettaglioAggiungi } from '@/lib/eventoAggiungi';
import type { CasaHomeDati } from '@/lib/calculations/supporto/casaHome';
import type { CasaCorrente } from '@/lib/data/households';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

const fabio = { householdId: 'h1', userId: 'u1', displayName: 'Fabio', joinedAt: '2026-01-01', slot: 1, attivo: true };
const anna = { householdId: 'h1', userId: 'u2', displayName: 'Anna', joinedAt: '2026-01-02', slot: 2, attivo: true };
const casa: CasaCorrente = {
  household: { id: 'h1', nome: 'Casa', createdAt: '2026-01-01', archiviataIl: null, createdBy: 'u1' },
  members: [fabio, anna],
  invite: null,
  me: anna,
};
const aggiunta = { householdId: 'h1', meUserId: 'u2', nomi: [], conti: [], categorie: [], obiettivi: [] } as unknown as CasaAggiunta;

type Semplice = CasaHomeDati['vistaSemplice'];
const base: Semplice = { quota: 450, entroGiorno: 5, versato: 0, stato: { tipo: 'pari' }, creditoVersoCasa: 0 };

function vista(s: Partial<Semplice>, debiti = [] as { debitoreId: string; creditoreId: string; importo: number }[]) {
  return render(
    <VistaSemplice
      casa={casa}
      vista={{ ...base, ...s }}
      aggiunta={aggiunta}
      debiti={debiti as never}
      oggi="2026-11-12"
    />
  );
}

describe('VistaSemplice', () => {
  it('mostra la quota del mese e il giorno', () => {
    vista({});
    expect(screen.getByText(/La tua quota di novembre/)).toBeInTheDocument();
    expect(screen.getByText(/entro il 5/)).toBeInTheDocument();
    expect(screen.getByTestId('quota').textContent).toContain('450');
  });

  it('quota già versata', () => {
    vista({ versato: 450 });
    expect(screen.getByText('Hai già versato la quota di novembre.')).toBeInTheDocument();
  });

  it('senza piano', () => {
    vista({ quota: null, entroGiorno: null });
    expect(screen.getByText('La quota non è ancora stata calcolata.')).toBeInTheDocument();
  });

  it('stato: in pari', () => {
    vista({});
    expect(screen.getByText('Siete in pari')).toBeInTheDocument();
  });

  it('stato: ti deve', () => {
    vista({ stato: { tipo: 'ti_deve', importo: 30, da: 'Fabio' } });
    expect(screen.getByText(/Fabio ti deve/)).toBeInTheDocument();
  });

  it('stato: devi, apre il foglio per restituire', () => {
    vista(
      { stato: { tipo: 'devi', importo: 30, a: 'Fabio' } },
      [{ debitoreId: 'u2', creditoreId: 'u1', importo: 30 }]
    );
    fireEvent.click(screen.getByRole('button', { name: /Devi.*30.*Fabio/ }));
    expect(screen.getByText('Restituisci')).toBeInTheDocument();
  });

  it('credito verso la casa, riga a parte', () => {
    vista({ creditoVersoCasa: 20 });
    expect(screen.getByText(/La casa ti deve/)).toBeInTheDocument();
  });

  it('il pulsante lancia l\'evento in modalità casa', () => {
    vista({});
    const visti: DettaglioAggiungi[] = [];
    const ascolta = (e: Event) => visti.push((e as CustomEvent<DettaglioAggiungi>).detail);
    window.addEventListener(EVENTO_AGGIUNGI, ascolta);
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi una spesa di casa' }));
    window.removeEventListener(EVENTO_AGGIUNGI, ascolta);
    expect(visti).toHaveLength(1);
    expect(visti[0]).toMatchObject({ casa: true });
  });

  it('link Vedi tutto alla vista completa', () => {
    vista({});
    expect(screen.getByRole('link', { name: 'Vedi tutto' })).toHaveAttribute('href', '/casa?vista=completa');
  });

  it('testi senza parole vietate', () => {
    const { container } = vista({ stato: { tipo: 'devi', importo: 30, a: 'Fabio' }, creditoVersoCasa: 5 });
    assertNessunaParolaVietata(container);
  });
});
