import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StrisciaPromemoria } from '@/app/casa/StrisciaPromemoria';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { Promemoria } from '@/lib/calculations/casa/promemoria';

const promemoria: Promemoria[] = [
  {
    id: 'versamento:2026-11-01',
    tipo: 'versamento',
    testo: 'Il tuo versamento di 776 € è da fare entro il 5.',
    azione: { tipo: 'versamento', etichetta: 'Registra', importo: 776 },
  },
  { id: 'credito:u1', tipo: 'credito', testo: 'In attesa del rimborso: 45 €.', azione: null },
];

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('StrisciaPromemoria', () => {
  it('Più tardi nasconde il promemoria per oggi e scrive la chiave in localStorage', () => {
    const { container } = render(<StrisciaPromemoria promemoria={promemoria} oggi="2026-11-03" />);
    assertNessunaParolaVietata(container);
    fireEvent.click(screen.getAllByRole('button', { name: 'Più tardi' })[0]);
    expect(screen.queryByText(/Il tuo versamento/)).not.toBeInTheDocument();
    expect(screen.getByText('In attesa del rimborso: 45 €.')).toBeInTheDocument();
    expect(window.localStorage.getItem('promemoria:versamento:2026-11-01:2026-11-03')).not.toBeNull();
  });

  it('i rimandati si tolgono prima del taglio a due: il terzo prende il posto', () => {
    const tre: Promemoria[] = [
      ...promemoria,
      { id: 'debito:u2>u1', tipo: 'debito', testo: 'Anna deve ancora 10 € a te.', azione: null },
    ];
    render(<StrisciaPromemoria promemoria={tre} oggi="2026-11-03" />);
    expect(screen.queryByText(/Anna deve ancora/)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Più tardi' })[0]);
    expect(screen.getByText('Anna deve ancora 10 € a te.')).toBeInTheDocument();
    expect(screen.getByText('In attesa del rimborso: 45 €.')).toBeInTheDocument();
  });

  it('un promemoria già rimandato oggi non ricompare', () => {
    window.localStorage.setItem('promemoria:versamento:2026-11-01:2026-11-03', '1');
    render(<StrisciaPromemoria promemoria={promemoria} oggi="2026-11-03" />);
    expect(screen.queryByText(/Il tuo versamento/)).not.toBeInTheDocument();
  });

  it('il giorno dopo ricompare', () => {
    window.localStorage.setItem('promemoria:versamento:2026-11-01:2026-11-03', '1');
    render(<StrisciaPromemoria promemoria={promemoria} oggi="2026-11-04" />);
    expect(screen.getByText(/Il tuo versamento/)).toBeInTheDocument();
  });

  it('con localStorage che lancia, Più tardi nasconde comunque', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('negato');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('negato');
    });
    render(<StrisciaPromemoria promemoria={promemoria} oggi="2026-11-03" />);
    expect(screen.getByText(/Il tuo versamento/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Più tardi' })[0]);
    expect(screen.queryByText(/Il tuo versamento/)).not.toBeInTheDocument();
  });

  it('il pulsante azione chiama onAzione con l azione', () => {
    const onAzione = vi.fn();
    render(<StrisciaPromemoria promemoria={promemoria} oggi="2026-11-03" onAzione={onAzione} />);
    fireEvent.click(screen.getByRole('button', { name: 'Registra' }));
    expect(onAzione).toHaveBeenCalledWith(promemoria[0].azione);
  });

  it('senza promemoria non mostra nulla', () => {
    const { container } = render(<StrisciaPromemoria promemoria={[]} oggi="2026-11-03" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('StrisciaPromemoria con href', () => {
  it('l azione con href è un link alla pagina', () => {
    const controllo: Promemoria[] = [
      {
        id: 'controllo:2026-10-25',
        tipo: 'controllo',
        testo: 'Un controllo veloce del conto comune? Confrontate il saldo con quello della banca.',
        azione: { tipo: 'controllo', etichetta: 'Controlla', href: '/casa/controllo/conto' },
      },
    ];
    render(<StrisciaPromemoria promemoria={controllo} oggi="2026-11-09" />);
    expect(screen.getByRole('link', { name: 'Controlla' })).toHaveAttribute('href', '/casa/controllo/conto');
    expect(screen.queryByRole('button', { name: 'Controlla' })).not.toBeInTheDocument();
  });
});
