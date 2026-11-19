import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NavBar } from '@/app/NavBar';
import { CasaSegnaleProvider, useCasaDaFare, useSegnalaCasa } from '@/app/CasaSegnale';
import { CasaHome } from '@/app/casa/CasaHome';
import type { CasaHomeDati } from '@/lib/calculations/supporto/casaHome';
import type { CasaCorrente } from '@/lib/data/households';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

vi.mock('next/navigation', () => ({
  usePathname: () => '/storico',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const ETICHETTA = "Casa, c'è una cosa da fare";

function Pubblica({ attivo }: { attivo: boolean }) {
  useSegnalaCasa(attivo);
  return null;
}

describe('puntino sulla scheda Casa', () => {
  it('senza nessuno che pubblichi la scheda è quella di sempre', () => {
    render(
      <CasaSegnaleProvider>
        <NavBar />
      </CasaSegnaleProvider>
    );
    expect(screen.getByRole('link', { name: 'Casa' })).toBeInTheDocument();
    expect(screen.queryByTestId('puntino-casa')).not.toBeInTheDocument();
  });

  it('la NavBar funziona anche senza il contesto', () => {
    render(<NavBar />);
    expect(screen.getByRole('link', { name: 'Casa' })).toBeInTheDocument();
  });

  it('quando una pagina pubblica "c\u2019è una cosa da fare" compare il puntino, con il suo nome accessibile', () => {
    render(
      <CasaSegnaleProvider>
        <Pubblica attivo />
        <NavBar />
      </CasaSegnaleProvider>
    );
    const link = screen.getByRole('link', { name: ETICHETTA });
    expect(link).toHaveAttribute('href', '/casa');
    expect(screen.getByTestId('puntino-casa')).toHaveAttribute('aria-hidden', 'true');
    assertNessunaParolaVietata(link);
  });

  it('il puntino resta anche quando la pagina che l\u2019ha pubblicato si chiude, finché un\u2019altra non dice il contrario', () => {
    function Pagine({ pagina }: { pagina: 'casa' | 'altrove' | 'home' }) {
      return (
        <CasaSegnaleProvider>
          {pagina === 'casa' ? <Pubblica attivo /> : pagina === 'home' ? <Pubblica attivo={false} /> : null}
          <NavBar />
        </CasaSegnaleProvider>
      );
    }
    const { rerender } = render(<Pagine pagina="casa" />);
    expect(screen.getByTestId('puntino-casa')).toBeInTheDocument();
    rerender(<Pagine pagina="altrove" />);
    expect(screen.getByTestId('puntino-casa')).toBeInTheDocument();
    rerender(<Pagine pagina="home" />);
    expect(screen.queryByTestId('puntino-casa')).not.toBeInTheDocument();
  });

  it('useCasaDaFare legge il valore pubblicato', () => {
    function Sonda() {
      return <p data-testid="sonda">{String(useCasaDaFare())}</p>;
    }
    render(
      <CasaSegnaleProvider>
        <Pubblica attivo />
        <Sonda />
      </CasaSegnaleProvider>
    );
    expect(screen.getByTestId('sonda')).toHaveTextContent('true');
  });
});

describe('la Casa pubblica i suoi promemoria visibili', () => {
  const fabio = { householdId: 'h1', userId: 'u1', displayName: 'Fabio', joinedAt: '2026-01-01', slot: 1, attivo: true };
  const casa: CasaCorrente = {
    household: { id: 'h1', nome: 'Casa Rossi', createdAt: '2026-01-01', archiviataIl: null, createdBy: 'u1' },
    members: [fabio],
    invite: null,
    me: fabio,
  };
  const libretto = (daFare: CasaHomeDati['daFare']): CasaHomeDati => ({
    gestisce: true,
    disponibile: 100,
    spesoMese: 0,
    previstoMese: null,
    daFare,
    ultime: [],
    vistaSemplice: { quota: null, entroGiorno: null, versato: 0, stato: { tipo: 'pari' }, creditoVersoCasa: 0 },
  });
  const monta = (daFare: CasaHomeDati['daFare']) =>
    render(
      <CasaSegnaleProvider>
        <CasaHome casa={casa} libretto={libretto(daFare)} oggi="2026-11-12" />
        <NavBar />
      </CasaSegnaleProvider>
    );

  it('con una cosa da fare compare il puntino; con "Più tardi" sparisce', () => {
    monta([{ tipo: 'promemoria', id: 'credito:u1', testo: 'In attesa del rimborso: 45 €.', href: '/casa' }]);
    expect(screen.getByRole('link', { name: ETICHETTA })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Più tardi' }));
    expect(screen.queryByTestId('puntino-casa')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Casa' })).toBeInTheDocument();
  });

  it('senza niente da fare non c\u2019è puntino', () => {
    monta([]);
    expect(screen.queryByTestId('puntino-casa')).not.toBeInTheDocument();
  });
});
