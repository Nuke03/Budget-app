import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NuovaFattura } from '@/app/piva/NuovaFattura';

const conti = [
  { id: 'a1', nome: 'Corrente' },
  { id: 'a2', nome: 'Risparmi' },
];

function apriOld(over: Partial<React.ComponentProps<typeof NuovaFattura>> = {}) {
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

function apri(over: Partial<React.ComponentProps<typeof NuovaFattura>> = {}) {
  const onSalva = vi.fn().mockResolvedValue(undefined);
  render(
    <NuovaFattura onSalva={onSalva} pagataAdessoIniziale={false} conti={conti} contoIniziale="a2" oggi="2026-11-17" {...over} />
  );
  return onSalva;
}

describe('NuovaFattura', () => {
  it('in modalità incasso: importo a fuoco, conto preselezionato, Chi facoltativo, nessun interruttore', () => {
    apri({ pagataAdessoIniziale: true });
    expect(screen.getByLabelText('Importo (€)')).toHaveFocus();
    expect(screen.getByLabelText('Conto')).toHaveValue('a2');
    expect(screen.getByLabelText('Chi')).toHaveAttribute('placeholder', 'Chi ti ha pagato (se vuoi)');
    expect(screen.getByLabelText("Data dell'incasso")).toHaveValue('2026-11-17');
    expect(screen.queryByRole('checkbox', { name: 'Pagata adesso' })).not.toBeInTheDocument();
  });

  it('incasso senza Chi: salva già pagato come Incasso in studio', async () => {
    const onSalva = apri({ pagataAdessoIniziale: true });
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '90,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() =>
      expect(onSalva).toHaveBeenCalledWith({
        cliente: 'Incasso in studio', importo: 90.5, dataEmissione: '2026-11-17', nota: null, pagataAdesso: true, accountId: 'a2',
      })
    );
  });

  it('incasso con Chi: usa il nome scritto', async () => {
    const onSalva = apri({ pagataAdessoIniziale: true });
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Chi'), { target: { value: ' Anna ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(onSalva).toHaveBeenCalledWith(expect.objectContaining({ cliente: 'Anna', pagataAdesso: true })));
  });

  it('in modalità fattura Chi serve, la data è di emissione e Pagata adesso c è', () => {
    apri();
    expect(screen.getByLabelText('Data di emissione')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Pagata adesso' })).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '100' } });
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Chi'), { target: { value: 'Rossi' } });
    expect(screen.getByRole('button', { name: 'Salva' })).not.toBeDisabled();
  });

  it('un solo tocco su Salva conta', () => {
    let finisci: () => void = () => {};
    const onSalva = vi.fn(() => new Promise<void>((r) => (finisci = r)));
    apri({ pagataAdessoIniziale: true, onSalva });
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '100' } });
    const salva = screen.getByRole('button', { name: 'Salva' });
    fireEvent.click(salva);
    fireEvent.click(salva);
    expect(onSalva).toHaveBeenCalledTimes(1);
    finisci();
  });

  it('da + Fattura l interruttore parte spento, la data è di emissione e il cliente vuoto', () => {
    apriOld();
    expect(screen.getByRole('checkbox', { name: 'Pagata adesso' })).not.toBeChecked();
    expect(screen.getByLabelText('Data di emissione')).toHaveValue('2026-11-17');
    expect(screen.getByLabelText('Chi')).toHaveValue('');
    expect(screen.queryByLabelText('Conto')).not.toBeInTheDocument();
  });

  it('senza pagata adesso non manda il conto', async () => {
    const props = apriOld();
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
    apriOld();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Chi'), { target: { value: 'Rossi' } });
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
  });

  it('non si salva due volte mentre è in corso', () => {
    let finisci: () => void = () => {};
    const onSalva = vi.fn().mockReturnValue(new Promise<void>((r) => (finisci = r)));
    apriOld({ onSalva });
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
    apriOld({ onSalva });
    fireEvent.change(screen.getByLabelText('Chi'), { target: { value: 'Rossi' } });
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Non è riuscito. Riprova.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salva' })).toBeEnabled());
  });

  it('in modifica parte dai valori della fattura e senza interruttore', async () => {
    const props = apriOld({ modifica: { cliente: 'Verdi', importo: 250, dataEmissione: '2026-10-01', nota: 'n' } });
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
