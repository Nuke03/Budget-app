import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  it('mostra il grafico a barre di default, senza la legenda della torta', () => {
    render(<HistoryChartCard chartData={chartData} colorByCategoryName={colorByCategoryName} />);
    expect(screen.queryByText('Bollette')).not.toBeInTheDocument();
  });

  it('cliccando il pallino "torta" mostra la legenda con importi e percentuali', () => {
    render(<HistoryChartCard chartData={chartData} colorByCategoryName={colorByCategoryName} />);

    fireEvent.click(screen.getByLabelText('Mostra grafico a torta'));

    expect(screen.getByText('Bollette')).toBeInTheDocument();
    expect(screen.getByText(/40,00/)).toBeInTheDocument();
    expect(screen.getByText(/40%/)).toBeInTheDocument();
  });

  it('uno swipe verso sinistra passa dalle barre alla torta', () => {
    render(<HistoryChartCard chartData={chartData} colorByCategoryName={colorByCategoryName} />);

    const card = screen.getByTestId('history-chart-card');
    fireEvent.touchStart(card, { touches: [{ clientX: 300 }] });
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 200 }] });

    expect(screen.getByText('Bollette')).toBeInTheDocument();
  });

  it('uno swipe verso destra torna dalla torta alle barre', () => {
    render(<HistoryChartCard chartData={chartData} colorByCategoryName={colorByCategoryName} />);

    fireEvent.click(screen.getByLabelText('Mostra grafico a torta'));
    expect(screen.getByText('Bollette')).toBeInTheDocument();

    const card = screen.getByTestId('history-chart-card');
    fireEvent.touchStart(card, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 300 }] });

    expect(screen.queryByText('Bollette')).not.toBeInTheDocument();
  });

  it('uno swipe sotto la soglia non cambia vista', () => {
    render(<HistoryChartCard chartData={chartData} colorByCategoryName={colorByCategoryName} />);

    const card = screen.getByTestId('history-chart-card');
    fireEvent.touchStart(card, { touches: [{ clientX: 300 }] });
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 280 }] });

    expect(screen.queryByText('Bollette')).not.toBeInTheDocument();
  });
});
