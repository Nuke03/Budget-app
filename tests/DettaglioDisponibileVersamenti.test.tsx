import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DettaglioDisponibile } from '@/app/home/DettaglioDisponibile';

const goal = {
  id: 'g1', nome: 'Assicurazione', importoTarget: 1200, modalita: 'dilazionato' as const, scadenza: '2026-12-01',
  categoriaId: null, ricorrente: false, frequenzaMesi: null, stato: 'aperto' as const,
  createdAt: '2026-06-01T00:00:00Z', accantonato: 400,
};

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
