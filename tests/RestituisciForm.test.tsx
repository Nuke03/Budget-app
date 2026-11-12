import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RestituisciForm } from '@/app/casa/RestituisciForm';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { DebitoMembro } from '@/lib/calculations/casa/debitiMembri';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/transfers', async () => ({
  ...(await vi.importActual<typeof import('@/lib/data/transfers')>('@/lib/data/transfers')),
  recordTransfer: vi.fn(),
}));
import { recordTransfer } from '@/lib/data/transfers';

const conto = (id: string, nome: string) => ({ id, nome, saldoAttuale: 100, contaInDisponibile: true, targetSaldo: null });
const debito: DebitoMembro = {
  debitoreId: 'u2',
  creditoreId: 'u1',
  importo: 603,
  mesi: [{ mese: '2026-10-01', importo: 603, versato: 603 }],
};

function monta() {
  const onDone = vi.fn();
  const utente = render(
    <RestituisciForm
      householdId="h1"
      debito={debito}
      nomeCreditore="Fabio"
      contiPersonali={[conto('p2', 'Conto Anna')]}
      contiCasa={[conto('c1', 'Conto comune')]}
      onDone={onDone}
      onClose={vi.fn()}
    />
  );
  return { ...utente, onDone };
}

const importo = () => screen.getByLabelText('Importo');
const registra = () => screen.getByRole('button', { name: 'Registra' });

beforeEach(() => {
  vi.mocked(recordTransfer).mockReset();
  vi.mocked(recordTransfer).mockResolvedValue('t1');
});

describe('RestituisciForm', () => {
  it('restituzione diretta parziale di 200 su 603', async () => {
    const { onDone } = monta();
    fireEvent.change(importo(), { target: { value: '200' } });
    fireEvent.click(registra());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(vi.mocked(recordTransfer).mock.calls[0][1]).toMatchObject({
      householdId: 'h1',
      causale: 'restituzione',
      importo: 200,
      daAccountId: 'p2',
      beneficiarioUserId: 'u1',
      soloRegistrazione: false,
    });
  });

  it('verso di più sul conto comune manda versamento con beneficiario e senza mese', async () => {
    monta();
    fireEvent.click(screen.getByRole('radio', { name: 'Verso di più sul conto comune' }));
    fireEvent.change(importo(), { target: { value: '603' } });
    fireEvent.click(registra());
    await waitFor(() => expect(recordTransfer).toHaveBeenCalled());
    const input = vi.mocked(recordTransfer).mock.calls[0][1];
    expect(input).toMatchObject({
      causale: 'versamento',
      importo: 603,
      daAccountId: 'p2',
      aAccountId: 'c1',
      beneficiarioUserId: 'u1',
    });
    expect(input.meseCompetenza).toBeUndefined();
  });

  it('con già riflesso nei saldi non servono i conti personali', async () => {
    const onDone = vi.fn();
    render(
      <RestituisciForm
        householdId="h1"
        debito={debito}
        nomeCreditore="Fabio"
        contiPersonali={[]}
        contiCasa={[]}
        onDone={onDone}
        onClose={vi.fn()}
      />
    );
    expect(registra()).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Già riflesso nei saldi'));
    fireEvent.click(registra());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(vi.mocked(recordTransfer).mock.calls[0][1]).toMatchObject({
      causale: 'restituzione',
      daAccountId: null,
      soloRegistrazione: true,
    });
  });

  it('non accetta più del debito residuo', () => {
    const { container } = monta();
    fireEvent.change(importo(), { target: { value: '603,01' } });
    expect(registra()).toBeDisabled();
    expect(container.textContent).toContain('Il debito residuo è di 603 €');
    fireEvent.change(importo(), { target: { value: '603' } });
    expect(registra()).toBeEnabled();
  });

  it('un doppio tocco fa una sola chiamata e nessuna parola vietata', () => {
    vi.mocked(recordTransfer).mockReturnValue(new Promise(() => {}));
    const { container } = monta();
    fireEvent.click(registra());
    fireEvent.click(registra());
    expect(recordTransfer).toHaveBeenCalledTimes(1);
    assertNessunaParolaVietata(container);
  });
});
