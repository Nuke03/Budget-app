import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PianoAttuale } from '@/app/casa/quota/PianoAttuale';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import { ESEMPIO_VOCI } from './helpers/esempioCasa';
import type { PlanBundle } from '@/lib/data/householdPlans';
import type { PlanShare } from '@/lib/types';

const share = (over: Partial<PlanShare>): PlanShare => ({
  planId: 'p1',
  slot: 1,
  userId: 'u1',
  displayName: 'Fabio',
  redditoNettoMensile: 1800,
  redditoIrregolare: false,
  percentuale: null,
  inCasaDal: null,
  esceDal: null,
  quotaMensile: 777,
  ...over,
});

function bundle(shares: PlanShare[]): PlanBundle {
  return {
    plan: {
      id: 'p1',
      householdId: 'h1',
      validoDal: '2026-12-01',
      giornoVersamento: 5,
      regola: 'proporzionale',
      cuscinettoObiettivo: 1321,
      cuscinettoQuotaMensile: 59,
      arrotondamento: 10,
      totaleMensile: 1380,
      createdAt: '2026-11-08T00:00:00Z',
    },
    items: ESEMPIO_VOCI.map((v, i) => ({
      id: `i${i}`,
      planId: 'p1',
      nome: v.nome,
      categoriaId: null,
      frequenzaMesi: v.frequenzaMesi,
      importoRicorrenza: v.importoRicorrenza,
      importoMensile: v.importoRicorrenza / v.frequenzaMesi,
      origineStima: 'suggerita',
      goalId: null,
      stimaIgnorataConN: null,
      ordine: i,
    })),
    shares,
  };
}

const fabio = share({});
const giuliaLegata = share({ slot: 2, userId: 'u2', displayName: 'Giulia', redditoNettoMensile: 1400, quotaMensile: 603 });
const giuliaSegnaposto = { ...giuliaLegata, userId: null };

describe('PianoAttuale: chi esce', () => {
  it('nel mese di uscita la quota di chi esce dal mese dopo resta in elenco', () => {
    const { container } = render(
      <PianoAttuale
        bundle={bundle([fabio, { ...giuliaLegata, esceDal: '2027-01-01' }])}
        meseCorrente="2026-12-01"
        onRivedi={() => {}}
      />,
    );
    expect(screen.getByText('Fabio versa 777 euro e Giulia 603 euro, entro il 5 di ogni mese.')).toBeInTheDocument();
    expect(screen.getByText('Giulia')).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('Come si calcola per chi resta cita la parte fissa di chi esce', () => {
    const { container } = render(
      <PianoAttuale
        bundle={bundle([fabio, { ...giuliaLegata, esceDal: '2027-01-01' }])}
        meseCorrente="2026-12-01"
        onRivedi={() => {}}
      />,
    );
    const riga = screen.getByText('Fabio').closest('li') as HTMLElement;
    fireEvent.click(within(riga).getByRole('button', { name: 'Come si calcola?' }));
    expect(within(riga).getByText(/parte fissa, Giulia 603 euro/)).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('chi è già uscito (esce_dal non oltre il mese) non compare', () => {
    render(
      <PianoAttuale
        bundle={bundle([fabio, { ...giuliaLegata, esceDal: '2026-12-01' }])}
        meseCorrente="2026-12-01"
        onRivedi={() => {}}
      />,
    );
    expect(screen.queryByText('Giulia')).not.toBeInTheDocument();
  });
});

describe('PianoAttuale', () => {
  it('mostra la frase "Fabio versa 777 euro e Giulia 603 euro, entro il 5 di ogni mese."', () => {
    render(<PianoAttuale bundle={bundle([fabio, giuliaLegata])} meseCorrente="2026-12-01" onRivedi={() => {}} />);
    expect(screen.getByText('Fabio versa 777 euro e Giulia 603 euro, entro il 5 di ogni mese.')).toBeInTheDocument();
  });

  it('con quote uguali mostra "Ognuno versa 690 euro entro il 5 di ogni mese."', () => {
    render(
      <PianoAttuale
        bundle={bundle([{ ...fabio, quotaMensile: 690 }, { ...giuliaLegata, quotaMensile: 690 }])}
        meseCorrente="2026-12-01"
        onRivedi={() => {}}
      />,
    );
    expect(screen.getByText('Ognuno versa 690 euro entro il 5 di ogni mese.')).toBeInTheDocument();
  });

  it('mostra "Diventa attivo quando entra anche Giulia" se la posizione di Giulia non è legata', () => {
    render(<PianoAttuale bundle={bundle([fabio, giuliaSegnaposto])} meseCorrente="2026-12-01" onRivedi={() => {}} />);
    expect(screen.getByText('Diventa attivo quando entra anche Giulia')).toBeInTheDocument();
    expect(screen.getByText('Bozza')).toBeInTheDocument();
  });

  it('non mostra la bozza quando tutti sono legati', () => {
    render(<PianoAttuale bundle={bundle([fabio, giuliaLegata])} meseCorrente="2026-12-01" onRivedi={() => {}} />);
    expect(screen.queryByText(/Diventa attivo/)).not.toBeInTheDocument();
    expect(screen.queryByText('Bozza')).not.toBeInTheDocument();
    expect(screen.getByText('Attivo')).toBeInTheDocument();
  });

  it('Come si calcola? del totale mostra spese comuni, cuscinetto e totale', () => {
    render(<PianoAttuale bundle={bundle([fabio, giuliaLegata])} meseCorrente="2026-12-01" onRivedi={() => {}} />);
    const totale = screen.getByTestId('totale');
    expect(totale).toHaveTextContent('1.380 €');
    fireEvent.click(within(totale).getByRole('button', { name: 'Come si calcola?' }));
    expect(within(totale).getByText(/Spese comuni 1\.321 euro \+ cuscinetto 59 euro = 1\.380 euro/)).toBeInTheDocument();
    expect(within(totale).getByText('Spese comuni')).toBeInTheDocument();
    expect(within(totale).getByText('Cuscinetto')).toBeInTheDocument();
  });

  it('la spiegazione della quota di una persona dice come si arriva al suo numero', () => {
    render(<PianoAttuale bundle={bundle([fabio, giuliaLegata])} meseCorrente="2026-12-01" onRivedi={() => {}} />);
    const bottoni = screen.getAllByRole('button', { name: 'Come si calcola?' });
    // il primo è quello del totale, poi uno per persona
    expect(bottoni).toHaveLength(3);
    fireEvent.click(bottoni[1]);
    expect(screen.getByText('Fabio: 1.800 su 3.200 di reddito, cioè 56%.')).toBeInTheDocument();
  });

  it('chi esce dal piano non compare e una quota a 0 dice che non versa', () => {
    render(
      <PianoAttuale
        bundle={bundle([
          { ...fabio, quotaMensile: 1380 },
          { ...giuliaSegnaposto, quotaMensile: 0, inCasaDal: '2027-02-01' },
          share({ slot: 3, userId: 'u3', displayName: 'Marco', esceDal: '2026-12-01', quotaMensile: 0 }),
        ])}
        meseCorrente="2026-12-01"
        onRivedi={() => {}}
      />,
    );
    expect(screen.queryByText('Marco')).not.toBeInTheDocument();
    expect(screen.getByText('Fabio versa 1.380 euro, entro il 5 di ogni mese.')).toBeInTheDocument();
    expect(screen.getByText('Nessun versamento in questo periodo')).toBeInTheDocument();
    expect(screen.queryByText(/Diventa attivo/)).not.toBeInTheDocument();
  });

  it('Rivedi la quota chiama onRivedi', () => {
    const onRivedi = vi.fn();
    render(<PianoAttuale bundle={bundle([fabio, giuliaLegata])} meseCorrente="2026-12-01" onRivedi={onRivedi} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rivedi la quota' }));
    expect(onRivedi).toHaveBeenCalledTimes(1);
  });

  it('nessuna parola vietata', () => {
    const { container } = render(
      <PianoAttuale bundle={bundle([fabio, giuliaSegnaposto])} meseCorrente="2026-12-01" onRivedi={() => {}} />,
    );
    assertNessunaParolaVietata(container);
  });
});
