import { describe, it, expect, vi } from 'vitest';
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

vi.mock('@/lib/data/transactions', () => ({
  getTransactions: vi.fn(),
}));

import { getPivaSettings, createPivaSettings, updatePivaSettings } from '@/lib/data/pivaSettings';
import { getCategories } from '@/lib/data/categories';
import { getTransactions } from '@/lib/data/transactions';

const categories = [
  { id: 'cat-fatt', nome: 'Compensi', tipo: 'income' as const, colore: null, archiviata: false },
];

const annoCorrente = new Date().getFullYear();

const transactions = [
  {
    id: 't1',
    tipo: 'income' as const,
    importo: 6000,
    data: `${annoCorrente}-02-10`,
    categoriaId: 'cat-fatt',
    accountId: null,
    goalId: null,
    descrizione: 'Fattura 1',
    nota: null,
    createdAt: `${annoCorrente}-02-10T00:00:00Z`,
  },
  {
    id: 't2',
    tipo: 'income' as const,
    importo: 4000,
    data: `${annoCorrente}-05-20`,
    categoriaId: 'cat-fatt',
    accountId: null,
    goalId: null,
    descrizione: 'Fattura 2',
    nota: null,
    createdAt: `${annoCorrente}-05-20T00:00:00Z`,
  },
];

describe('PivaPage', () => {
  it('mostra il form di attivazione quando non esistono impostazioni', async () => {
    vi.mocked(getPivaSettings).mockResolvedValue(null);
    vi.mocked(getCategories).mockResolvedValue(categories);
    vi.mocked(getTransactions).mockResolvedValue([]);
    vi.mocked(createPivaSettings).mockResolvedValue({
      id: '1',
      attivo: true,
      dataApertura: null,
      categoriaFatturatoId: 'cat-fatt',
      coefficienteRedditivita: 78,
      aliquotaSostitutivaOverride: null,
      aliquotaContributoSoggettivo: 10,
      aliquotaContributoIntegrativo: 4,
      minimaleContributivoAnnuo: 0,
      contributiVersatiAnnoPrecedente: 0,
    });

    render(<PivaPage />);

    await waitFor(() => {
      expect(screen.getByText('Attiva gestione P.IVA')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Categoria fatturato'), { target: { value: 'cat-fatt' } });
    fireEvent.click(screen.getByText('Attiva gestione P.IVA'));

    await waitFor(() => {
      expect(createPivaSettings).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ attivo: true, categoriaFatturatoId: 'cat-fatt' })
      );
    });
  });

  it('mostra la dashboard con i totali calcolati quando la gestione è attiva', async () => {
    vi.mocked(getPivaSettings).mockResolvedValue({
      id: '1',
      attivo: true,
      dataApertura: null,
      categoriaFatturatoId: 'cat-fatt',
      coefficienteRedditivita: 78,
      aliquotaSostitutivaOverride: 5,
      aliquotaContributoSoggettivo: 10,
      aliquotaContributoIntegrativo: 4,
      minimaleContributivoAnnuo: 0,
      contributiVersatiAnnoPrecedente: 0,
    });
    vi.mocked(getCategories).mockResolvedValue(categories);
    vi.mocked(getTransactions).mockResolvedValue(transactions);

    render(<PivaPage />);

    // fatturato = 10000, reddito imponibile = 7800, imposta sostitutiva 5% = 390
    await waitFor(() => {
      expect(screen.getByText(/390,00/)).toBeInTheDocument();
    });
    // contributo soggettivo 10% di 7800 = 780
    expect(screen.getByText(/780,00/)).toBeInTheDocument();
    // contributo integrativo 4% di 10000 = 400
    expect(screen.getByText(/400,00/)).toBeInTheDocument();
  });

  it('disattiva la gestione P.IVA al click e torna al form', async () => {
    vi.mocked(getPivaSettings).mockResolvedValue({
      id: '1',
      attivo: true,
      dataApertura: null,
      categoriaFatturatoId: 'cat-fatt',
      coefficienteRedditivita: 78,
      aliquotaSostitutivaOverride: 5,
      aliquotaContributoSoggettivo: 10,
      aliquotaContributoIntegrativo: 4,
      minimaleContributivoAnnuo: 0,
      contributiVersatiAnnoPrecedente: 0,
    });
    vi.mocked(getCategories).mockResolvedValue(categories);
    vi.mocked(getTransactions).mockResolvedValue(transactions);
    vi.mocked(updatePivaSettings).mockResolvedValue({
      id: '1',
      attivo: false,
      dataApertura: null,
      categoriaFatturatoId: 'cat-fatt',
      coefficienteRedditivita: 78,
      aliquotaSostitutivaOverride: 5,
      aliquotaContributoSoggettivo: 10,
      aliquotaContributoIntegrativo: 4,
      minimaleContributivoAnnuo: 0,
      contributiVersatiAnnoPrecedente: 0,
    });

    render(<PivaPage />);

    await waitFor(() => {
      expect(screen.getByText('Disattiva gestione P.IVA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Disattiva gestione P.IVA'));

    await waitFor(() => {
      expect(updatePivaSettings).toHaveBeenCalledWith(
        expect.anything(),
        '1',
        expect.objectContaining({ attivo: false })
      );
    });
  });

  it('modifica le impostazioni esistenti tramite "Modifica impostazioni" e salva', async () => {
    vi.mocked(getPivaSettings).mockResolvedValue({
      id: '1',
      attivo: true,
      dataApertura: null,
      categoriaFatturatoId: 'cat-fatt',
      coefficienteRedditivita: 78,
      aliquotaSostitutivaOverride: 5,
      aliquotaContributoSoggettivo: 10,
      aliquotaContributoIntegrativo: 4,
      minimaleContributivoAnnuo: 0,
      contributiVersatiAnnoPrecedente: 0,
    });
    vi.mocked(getCategories).mockResolvedValue(categories);
    vi.mocked(getTransactions).mockResolvedValue(transactions);
    vi.mocked(updatePivaSettings).mockResolvedValue({
      id: '1',
      attivo: true,
      dataApertura: null,
      categoriaFatturatoId: 'cat-fatt',
      coefficienteRedditivita: 78,
      aliquotaSostitutivaOverride: 5,
      aliquotaContributoSoggettivo: 10,
      aliquotaContributoIntegrativo: 4,
      minimaleContributivoAnnuo: 900,
      contributiVersatiAnnoPrecedente: 0,
    });

    render(<PivaPage />);

    await waitFor(() => {
      expect(screen.getByText('Modifica impostazioni')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Modifica impostazioni'));

    await waitFor(() => {
      expect(screen.getByText('Salva modifiche')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Minimale contributivo annuo')).toHaveValue(0);
    fireEvent.change(screen.getByLabelText('Minimale contributivo annuo'), {
      target: { value: '900' },
    });
    fireEvent.click(screen.getByText('Salva modifiche'));

    await waitFor(() => {
      expect(updatePivaSettings).toHaveBeenCalledWith(
        expect.anything(),
        '1',
        expect.objectContaining({ minimaleContributivoAnnuo: 900 })
      );
    });
  });
});
