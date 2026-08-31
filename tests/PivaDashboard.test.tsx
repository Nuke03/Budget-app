import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PivaDashboard } from '@/app/piva/PivaDashboard';

describe('PivaDashboard', () => {
  it('mostra tutte le cifre calcolate formattate in euro', () => {
    render(
      <PivaDashboard
        fatturatoAnnuo={10000}
        impostaSostitutiva={365}
        contributoSoggettivo={1000}
        contributoIntegrativo={400}
        totaleDaAccantonare={1765}
        quotaMensileSuggerita={147.08}
        onModifica={vi.fn()}
        onDisattiva={vi.fn()}
      />
    );

    expect(screen.getByText(/10\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/365,00/)).toBeInTheDocument();
    expect(screen.getByText(/1\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/400,00/)).toBeInTheDocument();
    expect(screen.getByText(/1\.765,00/)).toBeInTheDocument();
    expect(screen.getByText(/147,08/)).toBeInTheDocument();
  });

  it('chiama onModifica e onDisattiva al click dei rispettivi pulsanti', () => {
    const onModifica = vi.fn();
    const onDisattiva = vi.fn();
    render(
      <PivaDashboard
        fatturatoAnnuo={10000}
        impostaSostitutiva={365}
        contributoSoggettivo={1000}
        contributoIntegrativo={400}
        totaleDaAccantonare={1765}
        quotaMensileSuggerita={147.08}
        onModifica={onModifica}
        onDisattiva={onDisattiva}
      />
    );

    fireEvent.click(screen.getByText('Modifica impostazioni'));
    expect(onModifica).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Disattiva gestione P.IVA'));
    expect(onDisattiva).toHaveBeenCalled();
  });
});
