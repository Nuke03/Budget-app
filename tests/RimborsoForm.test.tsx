import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RimborsoForm } from '@/app/casa/RimborsoForm';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/transfers', async () => ({
  ...(await vi.importActual<typeof import('@/lib/data/transfers')>('@/lib/data/transfers')),
  recordTransfer: vi.fn(),
}));
import { recordTransfer } from '@/lib/data/transfers';

const contiCasa = [{ id: 'c1', nome: 'Conto comune', saldoAttuale: 900, contaInDisponibile: true, targetSaldo: null }];

function monta() {
  const onDone = vi.fn();
  const utente = render(
    <RimborsoForm
      householdId="h1"
      creditore={{ userId: 'u2', nome: 'Anna' }}
      importoIniziale={45}
      contiCasa={contiCasa}
      onDone={onDone}
      onClose={vi.fn()}
    />
  );
  return { ...utente, onDone };
}

beforeEach(() => {
  vi.mocked(recordTransfer).mockReset();
  vi.mocked(recordTransfer).mockResolvedValue('t1');
});

describe('RimborsoForm', () => {
  it('importo preimpostato a 45 e chiama record_transfer rimborso con beneficiario', async () => {
    const { onDone } = monta();
    expect(screen.getByLabelText('Importo')).toHaveValue('45');
    fireEvent.click(screen.getByRole('button', { name: 'Registra' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(vi.mocked(recordTransfer).mock.calls[0][1]).toMatchObject({
      householdId: 'h1',
      causale: 'rimborso',
      importo: 45,
      beneficiarioUserId: 'u2',
      daAccountId: 'c1',
      soloRegistrazione: false,
    });
  });

  it('non chiede un conto del creditore', () => {
    monta();
    expect(screen.queryByLabelText(/conto di anna/i)).toBeNull();
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  it('un doppio tocco fa una sola chiamata', () => {
    vi.mocked(recordTransfer).mockReturnValue(new Promise(() => {}));
    monta();
    const b = screen.getByRole('button', { name: 'Registra' });
    fireEvent.click(b);
    fireEvent.click(b);
    expect(recordTransfer).toHaveBeenCalledTimes(1);
  });

  it('il messaggio "il beneficiario non ha conti" suggerisce già riflesso nei saldi', async () => {
    vi.mocked(recordTransfer).mockRejectedValue(new Error('il beneficiario non ha conti'));
    const { container } = monta();
    fireEvent.click(screen.getByRole('button', { name: 'Registra' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/già riflesso nei saldi/i);
    expect(screen.getByLabelText('Importo')).toHaveValue('45');
    assertNessunaParolaVietata(container);
  });
});
