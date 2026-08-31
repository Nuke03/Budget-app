import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PeriodoFilter } from '@/app/history/PeriodoFilter';

describe('PeriodoFilter', () => {
  it('chiama onChangePeriodo cliccando una pillola preimpostata', () => {
    const onChangePeriodo = vi.fn();
    render(
      <PeriodoFilter
        periodo="mese"
        onChangePeriodo={onChangePeriodo}
        rangePersonalizzato={{ da: '', a: '' }}
        onChangeRangePersonalizzato={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Ultimi 3 mesi'));
    expect(onChangePeriodo).toHaveBeenCalledWith('3mesi');
  });

  it('non mostra i campi data personalizzati se non è selezionato "Personalizzato"', () => {
    render(
      <PeriodoFilter
        periodo="mese"
        onChangePeriodo={vi.fn()}
        rangePersonalizzato={{ da: '', a: '' }}
        onChangeRangePersonalizzato={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('Data inizio')).not.toBeInTheDocument();
  });

  it('mostra i campi data quando è selezionato "Personalizzato" e ne aggiorna il valore', () => {
    const onChangeRangePersonalizzato = vi.fn();
    render(
      <PeriodoFilter
        periodo="personalizzato"
        onChangePeriodo={vi.fn()}
        rangePersonalizzato={{ da: '', a: '' }}
        onChangeRangePersonalizzato={onChangeRangePersonalizzato}
      />
    );

    fireEvent.change(screen.getByLabelText('Data inizio'), { target: { value: '2026-01-01' } });
    expect(onChangeRangePersonalizzato).toHaveBeenCalledWith({ da: '2026-01-01', a: '' });
  });
});
