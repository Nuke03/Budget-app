import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PromptQuota, contoDaCuiSpostare } from '@/app/piva/PromptQuota';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

function apri(over: Partial<React.ComponentProps<typeof PromptQuota>> = {}) {
  const props = {
    importo: 600,
    quota: 82,
    contoTasse: 'Conto tasse',
    onFatto: vi.fn().mockResolvedValue(undefined),
    onPiuTardi: vi.fn(),
    ...over,
  };
  return { props, ...render(<PromptQuota {...props} />) };
}

describe('PromptQuota', () => {
  it('dice quanto mettere da parte con la frase esatta', () => {
    apri();
    expect(screen.getByText('Di 600 € metti da parte 82 € sul conto tasse')).toBeInTheDocument();
  });

  it('Fatto passa l importo proposto', async () => {
    const { props } = apri();
    fireEvent.click(screen.getByRole('button', { name: 'Fatto, li ho spostati' }));
    await waitFor(() => expect(props.onFatto).toHaveBeenCalledWith(82));
  });

  it('l importo spostato si può cambiare prima di confermare', async () => {
    const { props } = apri();
    fireEvent.change(screen.getByLabelText('Importo spostato (€)'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fatto, li ho spostati' }));
    await waitFor(() => expect(props.onFatto).toHaveBeenCalledWith(100));
  });

  it('un importo vuoto o zero blocca il pulsante', () => {
    apri();
    fireEvent.change(screen.getByLabelText('Importo spostato (€)'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Fatto, li ho spostati' })).toBeDisabled();
  });

  it('durante il salvataggio il pulsante è disabilitato: un solo tocco conta', async () => {
    let finisci: () => void = () => {};
    const onFatto = vi.fn(() => new Promise<void>((r) => (finisci = r)));
    apri({ onFatto });
    const bottone = screen.getByRole('button', { name: 'Fatto, li ho spostati' });
    fireEvent.click(bottone);
    fireEvent.click(bottone);
    expect(onFatto).toHaveBeenCalledTimes(1);
    expect(bottone).toBeDisabled();
    finisci();
  });

  it('se il salvataggio fallisce lo dice e si può riprovare', async () => {
    const onFatto = vi.fn().mockRejectedValueOnce(new Error('rete')).mockResolvedValue(undefined);
    apri({ onFatto });
    fireEvent.click(screen.getByRole('button', { name: 'Fatto, li ho spostati' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Fatto, li ho spostati' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fatto, li ho spostati' }));
    await waitFor(() => expect(onFatto).toHaveBeenCalledTimes(2));
  });

  it('Più tardi chiude senza spostare', () => {
    const { props } = apri();
    fireEvent.click(screen.getByRole('button', { name: 'Più tardi' }));
    expect(props.onPiuTardi).toHaveBeenCalled();
    expect(props.onFatto).not.toHaveBeenCalled();
  });

  it('nessuna parola vietata', () => {
    const { container } = apri();
    assertNessunaParolaVietata(container);
  });
});

describe('contoDaCuiSpostare', () => {
  const conti = [
    { id: 'a1', nome: 'Corrente', saldoAttuale: 1, contaInDisponibile: true, targetSaldo: null },
    { id: 'a2', nome: 'Risparmi', saldoAttuale: 1, contaInDisponibile: false, targetSaldo: null },
    { id: 'tasse', nome: 'Tasse', saldoAttuale: 0, contaInDisponibile: false, targetSaldo: null },
  ];
  it('usa il conto dell incasso', () => {
    expect(contoDaCuiSpostare('a2', conti, 'tasse')).toBe('a2');
  });
  it('senza conto usa il primo che conta nel disponibile', () => {
    expect(contoDaCuiSpostare(null, conti, 'tasse')).toBe('a1');
  });
  it('se l incasso è finito sul conto tasse usa il primo che conta nel disponibile', () => {
    expect(contoDaCuiSpostare('tasse', conti, 'tasse')).toBe('a1');
  });
  it('senza nessun conto adatto torna null', () => {
    expect(contoDaCuiSpostare(null, [conti[1], conti[2]], 'tasse')).toBeNull();
  });
});
