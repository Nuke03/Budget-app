import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PivaPage from '@/app/piva/page';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/lib/data/pivaSettings', () => ({
  getPivaSettings: vi.fn(),
  createPivaSettings: vi.fn(),
  updatePivaSettings: vi.fn(),
}));

vi.mock('@/lib/data/categories', () => ({
  getCategories: vi.fn(),
}));

vi.mock('@/lib/data/accounts', () => ({
  getAccounts: vi.fn(),
  createAccount: vi.fn(),
  updateAccountDetails: vi.fn(),
}));

import { getPivaSettings, createPivaSettings, updatePivaSettings } from '@/lib/data/pivaSettings';
import { getCategories } from '@/lib/data/categories';
import { getAccounts } from '@/lib/data/accounts';

const categories = [
  { id: 'cat-fatt', nome: 'Compensi', tipo: 'income' as const, colore: null, archiviata: false },
];

const conti = [
  { id: 'a1', nome: 'Conto corrente', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null },
  { id: 'tasse', nome: 'Conto tasse', saldoAttuale: 0, contaInDisponibile: false, targetSaldo: null },
];

const guidata = {
  id: '1',
  attivo: true,
  dataApertura: '2024-01-10',
  categoriaFatturatoId: 'cat-fatt',
  coefficienteRedditivita: 78,
  aliquotaSostitutivaOverride: 5,
  aliquotaContributoSoggettivo: 10,
  aliquotaContributoIntegrativo: 2,
  minimaleContributivoAnnuo: 856,
  contributiVersatiAnnoPrecedente: 0,
  contoTasseId: 'tasse',
  preset: 'enpap' as const,
  guidataDal: '2026-11-01',
  stipendioMensile: null,
  stipendioRivistoIl: null,
  incassoMeseMagro: null,
};

beforeEach(() => {
  vi.mocked(getCategories).mockResolvedValue(categories);
  vi.mocked(getAccounts).mockResolvedValue(conti);
  vi.mocked(updatePivaSettings).mockReset();
  vi.mocked(createPivaSettings).mockReset();
});

describe('PivaPage', () => {
  it('senza impostazioni parte la guida dal passo 1', async () => {
    vi.mocked(getPivaSettings).mockResolvedValue(null);
    render(<PivaPage />);
    expect(await screen.findByText('Che lavoro fai?', { selector: 'h2' })).toBeInTheDocument();
  });

  it('impostazioni vecchie senza conto tasse aprono la guida con i valori salvati', async () => {
    vi.mocked(getPivaSettings).mockResolvedValue({
      ...guidata,
      contoTasseId: null,
      preset: null,
      guidataDal: null,
      coefficienteRedditivita: 65,
    });
    render(<PivaPage />);
    await screen.findByText('Che lavoro fai?', { selector: 'h2' });
    // "Altro" non precompila: restano i valori salvati
    fireEvent.click(screen.getByRole('radio', { name: 'Altro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    expect(screen.getByLabelText('Quando hai aperto la P.IVA?')).toHaveValue('2024-01-10');
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    expect(screen.getByLabelText('Coefficiente di redditività (%)')).toHaveValue(65);
  });

  it('conto tasse eliminato (id che non esiste più tra i conti) riapre la guida al passo 3', async () => {
    vi.mocked(getPivaSettings).mockResolvedValue({ ...guidata, contoTasseId: 'sparito' });
    render(<PivaPage />);
    expect(await screen.findByText('Su quale conto metti da parte le tasse?')).toBeInTheDocument();
  });

  it('a guida completata mostra la percentuale e il conto tasse', async () => {
    vi.mocked(getPivaSettings).mockResolvedValue(guidata);
    render(<PivaPage />);
    // 78% * (5% + 10%) + 2% = 13,7%
    expect(await screen.findByText(/13,7% di ogni incasso/)).toBeInTheDocument();
    expect(screen.getByText(/Conto tasse/)).toBeInTheDocument();
  });

  it('Modifica i parametri apre il vecchio modulo e salva senza perdere i campi guidati', async () => {
    vi.mocked(getPivaSettings).mockResolvedValue(guidata);
    vi.mocked(updatePivaSettings).mockResolvedValue(guidata);
    render(<PivaPage />);
    fireEvent.click(await screen.findByText('Modifica i parametri'));
    await waitFor(() => expect(screen.getByText('Salva modifiche')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Minimale contributivo annuo'), { target: { value: '900' } });
    fireEvent.click(screen.getByText('Salva modifiche'));
    await waitFor(() => {
      expect(updatePivaSettings).toHaveBeenCalledWith(
        expect.anything(),
        '1',
        expect.objectContaining({ minimaleContributivoAnnuo: 900, contoTasseId: 'tasse', guidataDal: '2026-11-01' })
      );
    });
  });

  it('disattiva la gestione P.IVA al click', async () => {
    vi.mocked(getPivaSettings).mockResolvedValue(guidata);
    vi.mocked(updatePivaSettings).mockResolvedValue({ ...guidata, attivo: false });
    render(<PivaPage />);
    fireEvent.click(await screen.findByText('Disattiva gestione P.IVA'));
    await waitFor(() => {
      expect(updatePivaSettings).toHaveBeenCalledWith(
        expect.anything(),
        '1',
        expect.objectContaining({ attivo: false })
      );
    });
  });
});
