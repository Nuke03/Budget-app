import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NuovaFattura } from '@/app/piva/NuovaFattura';

const conti = [
  { id: 'a1', nome: 'Corrente' },
  { id: 'a2', nome: 'Risparmi' },
];

function apri(over: Partial<React.ComponentProps<typeof NuovaFattura>> = {}) {
  const props = {
    onSalva: vi.fn().mockResolvedValue(undefined),
    pagataAdessoIniziale: false,
    conti,
    contoIniziale: 'a1',
    oggi: '2026-11-17',
    ...over,
  };
  render(<NuovaFattura {...props} />);
  return props;
}

describe('NuovaFattura', () => {
  it('da + Fattura l interruttore parte spento, la data è oggi e il cliente vuoto', () => {
    apri();
    expect(screen.getByRole('checkbox', { name: 'Pagata adesso' })).not.toBeChecked();
    expect(screen.getByLabelText('Data')).toHaveValue('2026-11-17');
    expect(screen.getByLabelText('Chi')).toHaveValue('');
    expect(screen.queryByLabelText('Conto')).not.toBeInTheDocument();
  });

  it('da + Incasso l interruttore parte acceso e il cliente è Incasso diretto', () => {
    apri({ pagataAdessoIniziale: true });
    expect(screen.getByRole('checkbox', { name: 'Pagata adesso' })).toBeChecked();
    expect(screen.getByLabelText('Chi')).toHaveValue('Incasso diretto');
    expect(screen.getByLabelText('Conto')).toHaveValue('a1');
  });

  it('salva con chi, quanto, data e pagata adesso', async () => {
    const props = apri({ pagataAdessoIniziale: true });
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '600' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() =>
      expect(props.onSalva).toHaveBeenCalledWith({
        cliente: 'Incasso diretto', importo: 600, dataEmissione: '2026-11-17', nota: null, pagataAdesso: true, accountId: 'a1',
      })
    );
  });

  it('senza pagata adesso non manda il conto', async () => {
    const props = apri();
    fireEvent.change(screen.getByLabelText('Chi'), { target: { value: 'Rossi' } });
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '90,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() =>
      expect(props.onSalva).toHaveBeenCalledWith({
        cliente: 'Rossi', importo: 90.5, dataEmissione: '2026-11-17', nota: null, pagataAdesso: false, accountId: null,
      })
    );
  });

  it('Salva è spento senza chi o senza importo', () => {
    apri();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Chi'), { target: { value: 'Rossi' } });
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
  });

  it('non si salva due volte mentre è in corso', () => {
    let finisci: () => void = () => {};
    const onSalva = vi.fn().mockReturnValue(new Promise<void>((r) => (finisci = r)));
    apri({ onSalva });
    fireEvent.change(screen.getByLabelText('Chi'), { target: { value: 'Rossi' } });
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '100' } });
    const salva = screen.getByRole('button', { name: 'Salva' });
    fireEvent.click(salva);
    fireEvent.click(salva);
    expect(onSalva).toHaveBeenCalledTimes(1);
    expect(salva).toBeDisabled();
    finisci();
  });

  it('se salvare fallisce lo dice e si può riprovare', async () => {
    const onSalva = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined);
    apri({ onSalva });
    fireEvent.change(screen.getByLabelText('Chi'), { target: { value: 'Rossi' } });
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Non è riuscito. Riprova.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salva' })).toBeEnabled());
  });

  it('in modifica parte dai valori della fattura e senza interruttore', async () => {
    const props = apri({ modifica: { cliente: 'Verdi', importo: 250, dataEmissione: '2026-10-01', nota: 'n' } });
    expect(screen.queryByRole('checkbox', { name: 'Pagata adesso' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Chi')).toHaveValue('Verdi');
    expect(screen.getByLabelText('Importo (€)')).toHaveValue('250');
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() =>
      expect(props.onSalva).toHaveBeenCalledWith(
        expect.objectContaining({ cliente: 'Verdi', importo: 250, dataEmissione: '2026-10-01', nota: 'n', pagataAdesso: false })
      )
    );
  });
});
