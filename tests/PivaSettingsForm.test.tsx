import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PivaSettingsForm } from '@/app/piva/PivaSettingsForm';

const categories = [
  { id: 'cat-fatt', nome: 'Compensi liberi professionali', tipo: 'income' as const, colore: null, archiviata: false },
  { id: 'cat-regalo', nome: 'Regali', tipo: 'income' as const, colore: null, archiviata: false },
  { id: 'cat-spesa', nome: 'Spesa', tipo: 'expense' as const, colore: null, archiviata: false },
];

describe('PivaSettingsForm', () => {
  it('disabilita il submit finché non si seleziona una categoria fatturato', () => {
    render(
      <PivaSettingsForm categories={categories} initial={null} submitLabel="Attiva gestione P.IVA" onSubmit={vi.fn()} />
    );

    expect(screen.getByText('Attiva gestione P.IVA')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Categoria fatturato'), { target: { value: 'cat-fatt' } });

    expect(screen.getByText('Attiva gestione P.IVA')).not.toBeDisabled();
  });

  it('non mostra le categorie di spesa nel select', () => {
    render(
      <PivaSettingsForm categories={categories} initial={null} submitLabel="Attiva gestione P.IVA" onSubmit={vi.fn()} />
    );

    expect(screen.queryByText('Spesa')).not.toBeInTheDocument();
    expect(screen.getByText('Regali')).toBeInTheDocument();
  });

  it('invia i valori di default insieme alla categoria selezionata', () => {
    const onSubmit = vi.fn();
    render(
      <PivaSettingsForm categories={categories} initial={null} submitLabel="Attiva gestione P.IVA" onSubmit={onSubmit} />
    );

    fireEvent.change(screen.getByLabelText('Categoria fatturato'), { target: { value: 'cat-fatt' } });
    fireEvent.click(screen.getByText('Attiva gestione P.IVA'));

    expect(onSubmit).toHaveBeenCalledWith({
      dataApertura: null,
      categoriaFatturatoId: 'cat-fatt',
      coefficienteRedditivita: 78,
      aliquotaSostitutivaOverride: null,
      aliquotaContributoSoggettivo: 10,
      aliquotaContributoIntegrativo: 4,
      minimaleContributivoAnnuo: 0,
      contributiVersatiAnnoPrecedente: 0,
    });
  });

  it('precompila i campi quando riceve dei valori iniziali e li invia modificati', () => {
    const onSubmit = vi.fn();
    render(
      <PivaSettingsForm
        categories={categories}
        initial={{
          dataApertura: '2023-05-01',
          categoriaFatturatoId: 'cat-fatt',
          coefficienteRedditivita: 78,
          aliquotaSostitutivaOverride: 15,
          aliquotaContributoSoggettivo: 12,
          aliquotaContributoIntegrativo: 4,
          minimaleContributivoAnnuo: 856,
          contributiVersatiAnnoPrecedente: 300,
        }}
        submitLabel="Salva modifiche"
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByLabelText('Minimale contributivo annuo')).toHaveValue(856);

    fireEvent.change(screen.getByLabelText('Minimale contributivo annuo'), { target: { value: '900' } });
    fireEvent.click(screen.getByText('Salva modifiche'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ minimaleContributivoAnnuo: 900, aliquotaSostitutivaOverride: 15 })
    );
  });
});
