import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { AddTransactionSheet } from '@/app/add/AddTransactionSheet';
import type { CasaAggiunta } from '@/lib/loadCasaData';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const rpc = vi.hoisted(() => vi.fn());
const clienteFinto = vi.hoisted(() => ({ marca: 'client' }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc, ...clienteFinto }) }));

const createGoal = vi.hoisted(() => vi.fn());
vi.mock('@/lib/data/goals', () => ({ createGoal: (...a: unknown[]) => createGoal(...a) }));

vi.mock('@/app/impara/dopoSalvataggio', () => ({
  valutaDopoSalvataggio: vi.fn(),
  rispondiAvviso: vi.fn(),
}));

const personale = {
  categories: [{ id: 'cp', nome: 'Personale cat', tipo: 'expense' as const, colore: null, archiviata: false, ruolo: null }],
  accounts: [{ id: 'ap', nome: 'Conto mio', saldoAttuale: 100, contaInDisponibile: true, targetSaldo: null, archiviato: false }],
  goals: [],
};

const casa: CasaAggiunta = {
  householdId: 'h1',
  meUserId: 'u1',
  nomi: [
    { userId: 'u1', nome: 'Fabio' },
    { userId: 'u2', nome: 'Anna' },
  ],
  conti: [{ id: 'ac', nome: 'Conto comune', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null, archiviato: false }],
  categorie: [{ id: 'cc', nome: 'Bollette', tipo: 'expense', colore: null, archiviata: false, ruolo: null }],
  obiettivi: [],
};

const nuovo = {
  id: 'g-nuovo',
  nome: 'Assicurazione casa',
  importoTarget: 250,
  modalita: 'bloccato' as const,
  scadenza: null,
  categoriaId: 'cc',
  ricorrente: false,
  frequenzaMesi: null,
  stato: 'aperto' as const,
  createdAt: '2026-11-19T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  createGoal.mockResolvedValue(nuovo);
});

// Il foglio usa il modulo veloce, che oggi non disegna il pulsante dell'obiettivo: si prova il collegamento
// (la prop passata al modulo), non il pulsante.
type PropsForm = { key?: string; onCreateGoal?: (p: { nome: string; importoTarget: number; categoriaId: string | null }) => Promise<unknown> };
const form = vi.hoisted(() => ({ ultime: [] as { contesto: string; props: unknown }[] }));
vi.mock('@/app/add/AddTransactionForm', () => ({
  AddTransactionForm: (props: PropsForm & { goals?: unknown[]; contoEtichetta?: string }) => {
    form.ultime.push({ contesto: props.contoEtichetta === 'Chi ha pagato' ? 'casa' : 'personale', props });
    return null;
  },
}));

function apri(modoIniziale: 'casa' | 'personale') {
  form.ultime = [];
  return render(
    <AddTransactionSheet aperto onClose={vi.fn()} personale={personale} casa={casa} modoIniziale={modoIniziale} meUserId="u1" onSaved={vi.fn()} />
  );
}

const propsDi = (contesto: 'casa' | 'personale') =>
  form.ultime.filter((u) => u.contesto === contesto).at(-1)!.props as PropsForm;

describe('foglio di aggiunta: nuova cosa da mettere da parte in Casa', () => {
  it('in Casa il modulo riceve onCreateGoal, che crea un obiettivo della casa', async () => {
    apri('casa');
    const onCreateGoal = propsDi('casa').onCreateGoal;
    expect(onCreateGoal).toBeTypeOf('function');
    const creato = await onCreateGoal!({ nome: 'Assicurazione casa', importoTarget: 250, categoriaId: 'cc' });
    expect(creato).toBe(nuovo);
    expect(createGoal).toHaveBeenCalledTimes(1);
    const [client, input, scope] = createGoal.mock.calls[0];
    expect(client).toMatchObject({ marca: 'client' });
    expect(input).toEqual({
      nome: 'Assicurazione casa',
      importoTarget: 250,
      modalita: 'bloccato',
      scadenza: null,
      categoriaId: 'cc',
      ricorrente: false,
      frequenzaMesi: null,
    });
    expect(scope).toEqual({ kind: 'casa', householdId: 'h1' });
  });

  it('in Personale continua a creare un obiettivo personale (senza scope di casa)', async () => {
    apri('personale');
    await propsDi('personale').onCreateGoal!({ nome: 'Vacanza', importoTarget: 500, categoriaId: null });
    expect(createGoal).toHaveBeenCalledTimes(1);
    expect(createGoal.mock.calls[0][2]).toBeUndefined();
  });
});
