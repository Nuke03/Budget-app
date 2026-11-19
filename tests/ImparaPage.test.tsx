import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LEZIONI } from '@/lib/percorso/lezioni';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const notFound = vi.fn(() => {
  throw new Error('NOT_FOUND');
});
vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }), getSession: async () => ({ data: { session: null } }) },
  }),
}));
const loadPercorsoData = vi.fn();
vi.mock('@/lib/loadPercorsoData', () => ({ loadPercorsoData: (...a: unknown[]) => loadPercorsoData(...a) }));
vi.mock('@/app/impara/SchedaLezione', () => ({
  SchedaLezione: ({ lezione, numeri }: { lezione: { titolo: string }; numeri: string | null }) => (
    <div>
      scheda:{lezione.titolo}|{String(numeri)}
    </div>
  ),
}));

import ImparaPage from '@/app/impara/page';
import LezionePage from '@/app/impara/[argomento]/page';

function dati(over: Record<string, unknown> = {}) {
  return {
    oggi: '2026-11-19',
    transazioni: [],
    categorie: [],
    goals: [],
    lezioni: {},
    percorso: null,
    disponibileReale: 0,
    ultimaEntrataIl: null,
    primiPassiVisibili: false,
    primiPassi: { passi: [], fatti: 0, totale: 0, prossimo: null, visibile: false },
    ...over,
  };
}

beforeEach(() => {
  loadPercorsoData.mockReset();
  notFound.mockClear();
});

describe('pagina Impara', () => {
  it('l indice mostra 15 lezioni in ordine e segna le lette', async () => {
    loadPercorsoData.mockResolvedValue(
      dati({ lezioni: { piano: { vistaIl: '2026-11-01', rimandataAl: null, azioneIl: null, propostaIl: null } } })
    );
    render(await ImparaPage());
    const voci = screen.getAllByRole('listitem').filter((li) => li.closest('ol'));
    expect(voci).toHaveLength(15);
    LEZIONI.forEach((l, i) => expect(voci[i]).toHaveTextContent(l.titolo));
    expect(screen.getAllByText('letta')).toHaveLength(1);
    expect(voci[1]).toHaveTextContent('letta');
  });

  it('l indice non mostra percentuali', async () => {
    loadPercorsoData.mockResolvedValue(dati());
    const { container } = render(await ImparaPage());
    expect(container.textContent).not.toContain('%');
    assertNessunaParolaVietata(container);
  });

  it('Primi passi si vede solo se non finiti, la Lista d attesa sempre', async () => {
    loadPercorsoData.mockResolvedValue(dati());
    const { unmount } = render(await ImparaPage());
    expect(screen.queryByRole('link', { name: /Primi passi/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Lista d.attesa/ })).toBeInTheDocument();
    unmount();
    loadPercorsoData.mockResolvedValue(dati({ primiPassi: { passi: [], fatti: 1, totale: 6, prossimo: 'entrate', visibile: true } }));
    render(await ImparaPage());
    expect(screen.getByRole('link', { name: /Primi passi/ })).toHaveAttribute('href', '/impara/primi-passi');
  });
});

describe('pagina lezione', () => {
  it('passa alla scheda la lezione e i numeri', async () => {
    loadPercorsoData.mockResolvedValue(dati({ disponibileReale: 100 }));
    render(await LezionePage({ params: Promise.resolve({ argomento: 'piano' }) }));
    expect(screen.getByText(/scheda:Un piano per ogni euro\|Adesso il tuo libero/)).toBeInTheDocument();
  });

  it('argomento sconosciuto: notFound', async () => {
    await expect(LezionePage({ params: Promise.resolve({ argomento: 'boh' }) })).rejects.toThrow('NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
