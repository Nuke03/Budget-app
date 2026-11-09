import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PannelliVersamenti } from '@/app/casa/PannelliVersamenti';
import { CasaAzioniContext } from '@/app/casa/CasaAzioni';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { DebitoMembro } from '@/lib/calculations/casa/debitiMembri';
import type { RigaMese } from '@/lib/calculations/casa/versamenti';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

const membri = [
  { userId: 'u1', nome: 'Fabio' },
  { userId: 'u2', nome: 'Anna' },
];
const riga = (mese: string, atteso: number, versato: number): RigaMese => ({
  mese, atteso, versato, mancano: Math.max(0, atteso - versato),
});
const righe = {
  u1: [riga('2026-11-01', 777, 777)],
  u2: [riga('2026-10-01', 603, 0), riga('2026-11-01', 603, 300)],
};
const debito: DebitoMembro = {
  debitoreId: 'u2',
  creditoreId: 'u1',
  importo: 603,
  mesi: [{ mese: '2026-10-01', importo: 603, versato: 603 }],
};

function monta(over: Partial<React.ComponentProps<typeof PannelliVersamenti>> = {}) {
  const apri = vi.fn();
  const utente = render(
    <CasaAzioniContext.Provider value={{ apri }}>
      <PannelliVersamenti
        meUserId="u1"
        membri={membri}
        righe={righe}
        debiti={[debito]}
        crediti={{ u1: 0, u2: 0 }}
        meseCorrente="2026-11-01"
        {...over}
      />
    </CasaAzioniContext.Provider>
  );
  return { ...utente, apri };
}

describe('PannelliVersamenti', () => {
  it('mostra Fabio 777 di 777 € fatto e Anna 300 di 603 € mancano 303 €', () => {
    const { apri } = monta();
    expect(screen.getByText('Versamenti di novembre 2026')).toBeInTheDocument();
    expect(screen.getByText('Fabio 777 di 777 € fatto')).toBeInTheDocument();
    expect(screen.getByText('Anna 300 di 603 € mancano 303 €')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Registra un versamento' }));
    expect(apri).toHaveBeenCalledWith({ tipo: 'versamento' });
  });

  it('mostra arretrati e debiti con il testo del brief', () => {
    monta();
    expect(screen.getByText('ottobre 2026: Anna 603 €, ancora da versare')).toBeInTheDocument();
    expect(
      screen.getByText(
        'ottobre 2026: Fabio ha versato 603 € per Anna. Anna deve a Fabio 603 € (quota di ottobre 2026).'
      )
    ).toBeInTheDocument();
  });

  it('dopo una restituzione parziale dice quanto è stato versato e quanto è ancora dovuto', () => {
    const parziale: DebitoMembro = {
      ...debito,
      importo: 403,
      mesi: [{ mese: '2026-10-01', importo: 403, versato: 603 }],
    };
    monta({ debiti: [parziale] });
    expect(
      screen.getByText(
        'ottobre 2026: Fabio ha versato 603 € per Anna. Anna deve ancora a Fabio 403 € (quota di ottobre 2026).'
      )
    ).toBeInTheDocument();
  });

  it('Restituisci solo al debitore e Rinuncia solo al creditore', () => {
    const { apri, unmount } = monta({ meUserId: 'u2' });
    expect(screen.getByRole('button', { name: 'Restituisci' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rinuncia' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Restituisci' }));
    expect(apri).toHaveBeenCalledWith({ tipo: 'restituisci', debito, nomeCreditore: 'Fabio' });
    unmount();

    const creditore = monta({ meUserId: 'u1' });
    expect(screen.getByRole('button', { name: 'Rinuncia' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restituisci' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Rinuncia' }));
    expect(creditore.apri).toHaveBeenCalledWith({ tipo: 'rinuncia_debito', debito, nomeDebitore: 'Anna' });
  });

  it('il creditore vede In attesa del rimborso senza pulsante Rimborsa', () => {
    const { apri } = monta({ crediti: { u1: 45, u2: 0 }, debiti: [] });
    expect(screen.getByText('In attesa del rimborso: 45 €')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rimborsa' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Rinuncia' }));
    expect(apri).toHaveBeenCalledWith({ tipo: 'rinuncia_credito', importo: 45 });
  });

  it('gli altri membri vedono Rimborsa', () => {
    const { apri } = monta({ meUserId: 'u2', crediti: { u1: 45, u2: 0 }, debiti: [] });
    expect(screen.getByText('A Fabio spettano 45 € per spese anticipate.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rimborsa' }));
    expect(apri).toHaveBeenCalledWith({
      tipo: 'rimborso',
      creditore: { userId: 'u1', nome: 'Fabio' },
      importo: 45,
    });
    expect(screen.queryByText(/In attesa del rimborso/)).toBeNull();
  });

  it('chi ha atteso 0 vede Nessun versamento in questo periodo', () => {
    monta({ righe: { u1: [riga('2026-11-01', 777, 777)], u2: [riga('2026-11-01', 0, 0)] }, debiti: [] });
    expect(screen.getByText(/Anna: Nessun versamento in questo periodo/)).toBeInTheDocument();
  });

  it('le frasi sui debiti non contengono "ritardo" né parole vietate', () => {
    const { container } = monta({ crediti: { u1: 45, u2: 0 } });
    expect((container.textContent ?? '').toLowerCase()).not.toContain('ritardo');
    assertNessunaParolaVietata(container);
  });
});
