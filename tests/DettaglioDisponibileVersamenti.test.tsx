import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DettaglioDisponibile } from '@/app/home/DettaglioDisponibile';
import { formatEuro } from '@/lib/format';

const goal = {
  id: 'g1', nome: 'Assicurazione', importoTarget: 1200, modalita: 'dilazionato' as const, scadenza: '2026-12-01',
  categoriaId: null, ricorrente: false, frequenzaMesi: null, stato: 'aperto' as const,
  createdAt: '2026-06-01T00:00:00Z', accantonato: 400,
};

describe('DettaglioDisponibile: da spostare', () => {
  it('mostra la riga "Da spostare sui conti risparmio" quando il valore è > 0', () => {
    render(<DettaglioDisponibile accounts={[]} casa={null} goals={[]} daSpostare={250} />);
    expect(screen.getByText('Da spostare sui conti risparmio')).toBeInTheDocument();
    const riga = screen.getByText('Da spostare sui conti risparmio').parentElement as HTMLElement;
    expect(within(riga).getByText(`-${formatEuro(250)}`)).toBeInTheDocument();
  });

  it('non mostra la riga quando il valore è 0', () => {
    render(<DettaglioDisponibile accounts={[]} casa={null} goals={[]} daSpostare={0} />);
    expect(screen.queryByText('Da spostare sui conti risparmio')).not.toBeInTheDocument();
  });

  it('non mostra la riga se il prop manca', () => {
    render(<DettaglioDisponibile accounts={[]} casa={null} goals={[]} />);
    expect(screen.queryByText('Da spostare sui conti risparmio')).not.toBeInTheDocument();
  });
});

describe('DettaglioDisponibile: conferme', () => {
  it('per un obiettivo con conferme dice che conta quanto hai confermato', () => {
    render(<DettaglioDisponibile accounts={[]} casa={null} goals={[{ ...goal, versatoNellaFinestra: 400 }]} />);
    expect(screen.getByText('conta quanto hai confermato')).toBeInTheDocument();
  });

  it('senza conferme resta la frase di sempre', () => {
    render(<DettaglioDisponibile accounts={[]} casa={null} goals={[{ ...goal, versatoNellaFinestra: null }]} />);
    expect(screen.getByText('messo da parte finora')).toBeInTheDocument();
  });
});
