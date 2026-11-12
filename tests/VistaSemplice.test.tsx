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
const base: Semplice = { quota: 450, entroGiorno: 20, versato: 0, stato: { tipo: 'pari' }, creditoVersoCasa: 0 };

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
    expect(screen.getByText('entro il 20 novembre')).toBeInTheDocument();
    expect(screen.getByTestId('quota').textContent).toContain('450');
  });

  it('il simbolo € compare una volta sola, e il giorno 1 si scrive 1°', () => {
    vista({ entroGiorno: 1 });
    expect(screen.getByTestId('quota').textContent?.match(/€/g)).toHaveLength(1);
    expect(screen.getByText('era da versare entro il 1° novembre')).toBeInTheDocument();
  });

  it('quota già versata', () => {
    vista({ versato: 450 });
    expect(screen.getByText('La quota di novembre è coperta.')).toBeInTheDocument();
    expect(screen.queryByText(/Hai già versato/)).toBeNull();
  });

  it('versamento parziale: mostra quello che manca', () => {
    vista({ versato: 200 });
    expect(screen.getByText(/Per novembre ti mancano/)).toBeInTheDocument();
    expect(screen.getByTestId('quota').textContent).toContain('250');
    expect(screen.getByText(/entro il 20/)).toBeInTheDocument();
    expect(screen.getByText(/Già coperti/).textContent).toMatch(/200.*di.*450/);
    expect(screen.queryByText(/Hai già versato/)).toBeNull();
  });

  it('dopo il giorno di versamento dice che era da versare', () => {
    vista({ entroGiorno: 5 });
    expect(screen.getByText('era da versare entro il 5 novembre')).toBeInTheDocument();
    vista({ entroGiorno: 12 });
    expect(screen.getByText('entro il 12 novembre')).toBeInTheDocument();
  });

  it('piano con quota 0: niente da versare, non "già versato"', () => {
    vista({ quota: 0, versato: 0 });
    expect(screen.getByText('Questo mese non c’è niente da versare.')).toBeInTheDocument();
    expect(screen.queryByText(/già versato/)).toBeNull();
  });

  it('senza piano', () => {
    vista({ quota: null, entroGiorno: null });
    expect(screen.getByText('La quota non è ancora stata calcolata.')).toBeInTheDocument();
  });

  it('quota che parte più avanti: dice da quando', () => {
    vista({ quota: null, entroGiorno: null, quotaDal: '2026-12-01' });
    expect(screen.getByText('La tua quota parte da dicembre.')).toBeInTheDocument();
    expect(screen.queryByText(/non è ancora stata calcolata/)).toBeNull();
  });

  it('il promemoria di versamento si fa da qui: apre il foglio', () => {
    vista({
      azione: {
        tipo: 'promemoria',
        id: 'versamento',
        testo: 'Il tuo versamento di 450 € è da fare entro il 5.',
        href: '/casa',
        azione: { tipo: 'versamento', etichetta: 'Registra', importo: 450 },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /versamento di 450/ }));
    expect(screen.getAllByText('Registra un versamento').length).toBeGreaterThan(0);
  });

  it('senza azione non c è la card Da fare', () => {
    vista({});
    expect(screen.queryByRole('heading', { name: 'Da fare' })).toBeNull();
  });

  it('stato: in pari', () => {
    vista({});
    expect(screen.getByText('Siete in pari')).toBeInTheDocument();
  });

  it('stato: ti deve', () => {
    vista({ stato: { tipo: 'ti_deve', importo: 30, da: 'Fabio', daUserId: 'u1' } });
    expect(screen.getByText(/Fabio ti deve/)).toBeInTheDocument();
  });

  it('stato: devi, apre il foglio per restituire', () => {
    vista(
      { stato: { tipo: 'devi', importo: 30, a: 'Fabio', aUserId: 'u1' } },
      [{ debitoreId: 'u2', creditoreId: 'u1', importo: 30 }]
    );
    fireEvent.click(screen.getByRole('button', { name: /Devi.*30.*Fabio/ }));
    expect(screen.getByText('Restituisci')).toBeInTheDocument();
  });

  it('restituisci si apre con il netto, non con il lordo di una direzione', () => {
    vista(
      { stato: { tipo: 'devi', importo: 30, a: 'Fabio', aUserId: 'u1' } },
      [{ debitoreId: 'u2', creditoreId: 'u1', importo: 50 }]
    );
    fireEvent.click(screen.getByRole('button', { name: /Devi.*30.*Fabio/ }));
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
  });

  it('due membri con lo stesso nome: apre il foglio del debito giusto', () => {
    const casaDoppia = { ...casa, members: [fabio, { ...anna, userId: 'u3', displayName: 'Fabio' }, anna] };
    render(
      <VistaSemplice
        casa={{ ...casaDoppia, me: anna } as never}
        vista={{ ...base, stato: { tipo: 'devi', importo: 30, a: 'Fabio', aUserId: 'u1' } }}
        aggiunta={aggiunta}
        debiti={[
          { debitoreId: 'u2', creditoreId: 'u3', importo: 99 },
          { debitoreId: 'u2', creditoreId: 'u1', importo: 30 },
        ] as never}
        oggi="2026-11-12"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Devi.*30.*Fabio/ }));
    expect(screen.getByText('Restituisci')).toBeInTheDocument();
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
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
    const { container } = vista({ stato: { tipo: 'devi', importo: 30, a: 'Fabio', aUserId: 'u1' }, creditoVersoCasa: 5 });
    assertNessunaParolaVietata(container);
  });
});
