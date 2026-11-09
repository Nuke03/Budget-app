import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VersamentoForm } from '@/app/casa/VersamentoForm';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { Account } from '@/lib/types';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/transfers', async () => ({
  ...(await vi.importActual<typeof import('@/lib/data/transfers')>('@/lib/data/transfers')),
  recordTransfer: vi.fn(),
}));
import { recordTransfer } from '@/lib/data/transfers';

const conto = (id: string, nome: string): Account => ({
  id, nome, saldoAttuale: 100, contaInDisponibile: true, targetSaldo: null,
});
const membri = [
  { userId: 'u1', nome: 'Fabio' },
  { userId: 'u2', nome: 'Anna' },
];

function monta(over: Partial<React.ComponentProps<typeof VersamentoForm>> = {}) {
  const onDone = vi.fn();
  const utente = render(
    <VersamentoForm
      householdId="h1"
      membri={membri}
      meUserId="u1"
      contiPersonali={[conto('p1', 'Conto Fabio'), conto('p2', 'Carta Fabio')]}
      contiCasa={[conto('c1', 'Conto comune')]}
      meseDefault="2026-11-01"
      onDone={onDone}
      onClose={vi.fn()}
      {...over}
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

describe('VersamentoForm', () => {
  it('registra un versamento con importo 776,5 e mese di novembre', async () => {
    const { onDone } = monta();
    fireEvent.change(screen.getByLabelText('Da'), { target: { value: 'p2' } });
    fireEvent.change(importo(), { target: { value: '776,5' } });
    fireEvent.change(screen.getByLabelText('Per il mese di'), { target: { value: '2026-11-01' } });
    fireEvent.click(registra());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(recordTransfer).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordTransfer).mock.calls[0][1]).toMatchObject({
      householdId: 'h1',
      causale: 'versamento',
      importo: 776.5,
      meseCompetenza: '2026-11-01',
      daAccountId: 'p2',
      aAccountId: 'c1',
      perContoDiUserId: null,
      soloRegistrazione: false,
    });
  });

  it('per conto di Anna invia perContoDiUserId', async () => {
    monta();
    fireEvent.change(importo(), { target: { value: '603' } });
    fireEvent.change(screen.getByLabelText('Per chi'), { target: { value: 'u2' } });
    fireEvent.click(registra());
    await waitFor(() => expect(recordTransfer).toHaveBeenCalled());
    expect(vi.mocked(recordTransfer).mock.calls[0][1]).toMatchObject({ perContoDiUserId: 'u2' });
  });

  it('senza altri membri non offre per conto di', () => {
    monta({ membri: [membri[0]] });
    expect(screen.queryByLabelText('Per chi')).toBeNull();
  });

  it('vuoto, zero e negativo disabilitano Registra e non mostrano NaN', () => {
    const { container } = monta();
    expect(registra()).toBeDisabled();
    for (const v of ['0', '-5', 'abc']) {
      fireEvent.change(importo(), { target: { value: v } });
      expect(registra()).toBeDisabled();
    }
    expect(container.textContent).not.toContain('NaN');
    fireEvent.change(importo(), { target: { value: '10' } });
    expect(registra()).toBeEnabled();
  });

  it('un doppio tocco su Registra fa una sola chiamata', async () => {
    let risolvi: (v: string) => void = () => {};
    vi.mocked(recordTransfer).mockReturnValue(new Promise((r) => (risolvi = r)));
    monta();
    fireEvent.change(importo(), { target: { value: '10' } });
    fireEvent.click(registra());
    fireEvent.click(registra());
    expect(recordTransfer).toHaveBeenCalledTimes(1);
    expect(registra()).toBeDisabled();
    risolvi('t1');
    await waitFor(() => expect(registra()).toBeEnabled());
  });

  it('se la RPC risponde "membro non valido" mostra la frase neutra e conserva i campi', async () => {
    vi.mocked(recordTransfer).mockRejectedValue(new Error('membro non valido'));
    const { onDone } = monta();
    fireEvent.change(importo(), { target: { value: '55,5' } });
    fireEvent.change(screen.getByLabelText('Per chi'), { target: { value: 'u2' } });
    fireEvent.click(registra());
    expect(await screen.findByRole('alert')).toHaveTextContent('Quella persona non è più in casa.');
    expect(importo()).toHaveValue('55,5');
    expect(screen.getByLabelText('Per chi')).toHaveValue('u2');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('con già riflesso nei saldi invia soloRegistrazione true', async () => {
    monta();
    fireEvent.change(importo(), { target: { value: '10' } });
    fireEvent.click(screen.getByLabelText("Il bonifico l'ho già riflesso nei saldi"));
    fireEvent.click(registra());
    await waitFor(() => expect(recordTransfer).toHaveBeenCalled());
    expect(vi.mocked(recordTransfer).mock.calls[0][1]).toMatchObject({ soloRegistrazione: true });
  });

  it('con già riflesso nei saldi non servono i conti personali', async () => {
    monta({ contiPersonali: [] });
    fireEvent.change(importo(), { target: { value: '10' } });
    expect(registra()).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Il bonifico l'ho già riflesso nei saldi"));
    fireEvent.click(registra());
    await waitFor(() => expect(recordTransfer).toHaveBeenCalled());
    expect(vi.mocked(recordTransfer).mock.calls[0][1]).toMatchObject({
      daAccountId: null,
      soloRegistrazione: true,
    });
  });

  it('nessuna parola vietata', () => {
    const { container } = monta();
    assertNessunaParolaVietata(container);
  });
});
