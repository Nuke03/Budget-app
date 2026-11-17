import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HistoryChartCard } from '@/app/history/HistoryChartCard';

const chartData = [
  { nome: 'Spesa', totale: 60 },
  { nome: 'Bollette', totale: 40 },
];
const colorByCategoryName = new Map([
  ['Spesa', '#E14B4B'],
  ['Bollette', '#3B82F6'],
]);

describe('HistoryChartCard', () => {
  it('mostra una riga per categoria con importo e percentuale', () => {
    render(<HistoryChartCard chartData={chartData} colorByCategoryName={colorByCategoryName} />);
    expect(screen.getByText('Bollette')).toBeInTheDocument();
    expect(screen.getByText(/40,00/)).toBeInTheDocument();
    expect(screen.getByText(/40%/)).toBeInTheDocument();
    expect(screen.getByText(/60%/)).toBeInTheDocument();
  });

  it('le barre hanno il colore della categoria e la più grande è piena', () => {
    const { container } = render(
      <HistoryChartCard chartData={chartData} colorByCategoryName={colorByCategoryName} />
    );
    const spesa = container.querySelector('[data-barra="Spesa"]') as HTMLElement;
    const bollette = container.querySelector('[data-barra="Bollette"]') as HTMLElement;
    expect(spesa.style.width).toBe('100%');
    expect(spesa.style.backgroundColor).toBe('rgb(225, 75, 75)');
    expect(parseFloat(bollette.style.width)).toBeCloseTo(66.67, 1);
  });

  it('senza spese lo dice', () => {
    render(<HistoryChartCard chartData={[]} colorByCategoryName={colorByCategoryName} />);
    expect(screen.getByText('Nessuna spesa da mostrare.')).toBeInTheDocument();
  });
});
