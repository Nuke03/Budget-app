import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { subYears, format } from 'date-fns';
import { ImpostazioneGuidata } from '@/app/piva/ImpostazioneGuidata';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { Account, Category, PivaSettings } from '@/lib/types';

const fakeClient = { id: 'client' };
vi.mock('@/lib/supabase/client', () => ({ createClient: () => fakeClient }));
const createAccount = vi.fn();
const updateAccountDetails = vi.fn();
vi.mock('@/lib/data/accounts', () => ({
  createAccount: (...a: unknown[]) => createAccount(...a),
  updateAccountDetails: (...a: unknown[]) => updateAccountDetails(...a),
}));
const createCategory = vi.fn();
vi.mock('@/lib/data/categories', () => ({
  createCategory: (...a: unknown[]) => createCategory(...a),
}));

const conti: Account[] = [
  { id: 'a1', nome: 'Conto corrente', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null },
  { id: 'a2', nome: 'Risparmi', saldoAttuale: 100, contaInDisponibile: true, targetSaldo: null },
];
const categorie: Category[] = [
  { id: 'c1', nome: 'Fatture studio', tipo: 'income', colore: null, archiviata: false },
  { id: 'c2', nome: 'Altro', tipo: 'income', colore: null, archiviata: false },
];

const dueAnniFa = format(subYears(new Date(), 2), 'yyyy-MM-dd');

function base(over: Partial<PivaSettings> = {}): PivaSettings {
  return {
    id: 's1',
    attivo: true,
    dataApertura: dueAnniFa,
    categoriaFatturatoId: 'c1',
    coefficienteRedditivita: 78,
    aliquotaSostitutivaOverride: null,
    aliquotaContributoSoggettivo: 10,
    aliquotaContributoIntegrativo: 2,
    minimaleContributivoAnnuo: 856,
    contributiVersatiAnnoPrecedente: 0,
    contoTasseId: null,
    preset: null,
    guidataDal: null,
    stipendioMensile: null,
    stipendioRivistoIl: null,
    incassoMeseMagro: null,
    ...over,
  };
}

function avanti() {
  fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
}

function percorsoFinoAlRiepilogo(data = dueAnniFa) {
  fireEvent.click(screen.getByRole('radio', { name: 'Psicologa, ENPAP' }));
  avanti();
  fireEvent.change(screen.getByLabelText('Quando hai aperto la P.IVA?'), { target: { value: data } });
  avanti();
  avanti(); // conto e categoria di default
}

beforeEach(() => {
  createAccount
    .mockReset()
    .mockResolvedValue({ id: 'nuovo', nome: 'Conto tasse', saldoAttuale: 0, contaInDisponibile: false, targetSaldo: null });
  updateAccountDetails.mockReset().mockResolvedValue({});
  createCategory
    .mockReset()
    .mockResolvedValue({ id: 'cnuova', nome: 'Fatture', tipo: 'income', colore: null, archiviata: false });
});

describe('ImpostazioneGuidata', () => {
  it('con ENPAP il riepilogo mostra 78, 10, 2 e 856', () => {
    render(<ImpostazioneGuidata iniziale={null} conti={conti} categorie={categorie} onFatto={vi.fn()} />);
    percorsoFinoAlRiepilogo();
    expect(screen.getByLabelText('Coefficiente di redditività (%)')).toHaveValue(78);
    expect(screen.getByLabelText('Contributo soggettivo (%)')).toHaveValue(10);
    expect(screen.getByLabelText('Contributo integrativo (%)')).toHaveValue(2);
    expect(screen.getByLabelText('Minimale contributivo annuo (€)')).toHaveValue(856);
    expect(screen.getByText(/13,7% di ogni incasso/)).toBeInTheDocument();
  });

  it('data di apertura di 2 anni fa: aliquota 5%', () => {
    render(<ImpostazioneGuidata iniziale={null} conti={conti} categorie={categorie} onFatto={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Altro' }));
    avanti();
    fireEvent.change(screen.getByLabelText('Quando hai aperto la P.IVA?'), { target: { value: dueAnniFa } });
    expect(screen.getByText('Primi 5 anni: aliquota 5%')).toBeInTheDocument();
  });

  it('data di apertura di 8 anni fa: aliquota 15%', () => {
    render(<ImpostazioneGuidata iniziale={null} conti={conti} categorie={categorie} onFatto={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Altro' }));
    avanti();
    fireEvent.change(screen.getByLabelText('Quando hai aperto la P.IVA?'), {
      target: { value: format(subYears(new Date(), 8), 'yyyy-MM-dd') },
    });
    expect(screen.getByText('Dopo i primi 5 anni: aliquota 15%')).toBeInTheDocument();
  });

  it('Altro non precompila i valori', () => {
    render(<ImpostazioneGuidata iniziale={null} conti={conti} categorie={categorie} onFatto={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Altro' }));
    avanti();
    fireEvent.change(screen.getByLabelText('Quando hai aperto la P.IVA?'), { target: { value: dueAnniFa } });
    avanti();
    avanti();
    expect(screen.getByLabelText('Coefficiente di redditività (%)')).toHaveValue(null);
    expect(screen.getByRole('button', { name: 'Confermo' })).toBeDisabled();
  });

  it('il conto scelto viene salvato fuori dal disponibile', async () => {
    const onFatto = vi.fn().mockResolvedValue(undefined);
    render(<ImpostazioneGuidata iniziale={null} conti={conti} categorie={categorie} onFatto={onFatto} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Psicologa, ENPAP' }));
    avanti();
    fireEvent.change(screen.getByLabelText('Quando hai aperto la P.IVA?'), { target: { value: dueAnniFa } });
    avanti();
    fireEvent.click(screen.getByRole('radio', { name: 'Risparmi' }));
    avanti();
    fireEvent.click(screen.getByRole('button', { name: 'Confermo' }));
    await waitFor(() => expect(onFatto).toHaveBeenCalled());
    expect(updateAccountDetails).toHaveBeenCalledWith(fakeClient, 'a2', {
      nome: 'Risparmi',
      contaInDisponibile: false,
      targetSaldo: null,
    });
    expect(onFatto).toHaveBeenCalledWith(
      expect.objectContaining({ contoTasseId: 'a2', categoriaFatturatoId: 'c1', preset: 'enpap', attivo: true })
    );
  });

  it('Creane uno crea un conto personale fuori dal disponibile', async () => {
    const onFatto = vi.fn().mockResolvedValue(undefined);
    render(<ImpostazioneGuidata iniziale={null} conti={conti} categorie={categorie} onFatto={onFatto} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Psicologa, ENPAP' }));
    avanti();
    fireEvent.change(screen.getByLabelText('Quando hai aperto la P.IVA?'), { target: { value: dueAnniFa } });
    avanti();
    fireEvent.click(screen.getByRole('radio', { name: 'Creane uno' }));
    avanti();
    fireEvent.click(screen.getByRole('button', { name: 'Confermo' }));
    await waitFor(() => expect(onFatto).toHaveBeenCalled());
    expect(createAccount).toHaveBeenCalledWith(fakeClient, {
      nome: 'Conto tasse',
      saldoAttuale: 0,
      contaInDisponibile: false,
      targetSaldo: null,
    });
    expect(onFatto).toHaveBeenCalledWith(expect.objectContaining({ contoTasseId: 'nuovo' }));
  });

  it('senza categoria adatta crea "Fatture"', async () => {
    const onFatto = vi.fn().mockResolvedValue(undefined);
    const senza: Category[] = [{ id: 'c2', nome: 'Altro', tipo: 'income', colore: null, archiviata: false }];
    render(<ImpostazioneGuidata iniziale={null} conti={conti} categorie={senza} onFatto={onFatto} />);
    percorsoFinoAlRiepilogo();
    fireEvent.click(screen.getByRole('button', { name: 'Confermo' }));
    await waitFor(() => expect(onFatto).toHaveBeenCalled());
    expect(createCategory).toHaveBeenCalledWith(fakeClient, { nome: 'Fatture', tipo: 'income', colore: null });
    expect(onFatto).toHaveBeenCalledWith(expect.objectContaining({ categoriaFatturatoId: 'cnuova' }));
  });

  it('Confermo salva guidataDal di oggi solo se era vuoto', async () => {
    const onFatto = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(
      <ImpostazioneGuidata iniziale={base({ guidataDal: null })} conti={conti} categorie={categorie} onFatto={onFatto} />
    );
    percorsoFinoAlRiepilogo();
    fireEvent.click(screen.getByRole('button', { name: 'Confermo' }));
    await waitFor(() => expect(onFatto).toHaveBeenCalled());
    expect(onFatto.mock.calls[0][0].guidataDal).toBe(oggiRomaISO());
    unmount();

    const onFatto2 = vi.fn().mockResolvedValue(undefined);
    render(
      <ImpostazioneGuidata
        iniziale={base({ guidataDal: '2026-03-01', preset: 'enpap', contoTasseId: 'a2' })}
        conti={conti}
        categorie={categorie}
        onFatto={onFatto2}
      />
    );
    avanti();
    avanti();
    avanti();
    fireEvent.click(screen.getByRole('button', { name: 'Confermo' }));
    await waitFor(() => expect(onFatto2).toHaveBeenCalled());
    expect(onFatto2.mock.calls[0][0].guidataDal).toBe('2026-03-01');
  });

  it('il passo iniziale 3 apre la scelta del conto', () => {
    render(
      <ImpostazioneGuidata
        iniziale={base({ preset: 'enpap' })}
        passoIniziale={3}
        conti={conti}
        categorie={categorie}
        onFatto={vi.fn()}
      />
    );
    expect(screen.getByText('Su quale conto metti da parte le tasse?')).toBeInTheDocument();
  });
});
