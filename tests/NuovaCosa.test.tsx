import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NuovaCosa } from '@/app/casa/da-parte/NuovaCosa';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/fondiCasa', () => ({ creaFondoUnaVolta: vi.fn() }));
import { creaFondoUnaVolta } from '@/lib/data/fondiCasa';

beforeEach(() => {
  refresh.mockReset();
  vi.mocked(creaFondoUnaVolta).mockReset();
  vi.mocked(creaFondoUnaVolta).mockResolvedValue({} as never);
});

const scrivi = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const monta = () => render(<NuovaCosa householdId="h1" oggi="2026-11-09" />);

describe('NuovaCosa', () => {
  it('"Entro quando" parte da 6 mesi avanti; nome e importo creano il fondo', async () => {
    const { container } = monta();
    expect(screen.getByLabelText('Entro quando')).toHaveValue('2027-05-09');
    scrivi('Nome', 'Divano');
    scrivi('Importo (€)', '600,50');
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(vi.mocked(creaFondoUnaVolta).mock.calls[0][1]).toEqual({
      householdId: 'h1', nome: 'Divano', importo: 600.5, scadenza: '2027-05-09', oggi: '2026-11-09',
    });
    assertNessunaParolaVietata(container);
  });

  it('nome vuoto o importo non valido disabilitano', () => {
    monta();
    const b = screen.getByRole('button', { name: 'Aggiungi' });
    expect(b).toBeDisabled();
    scrivi('Nome', 'Divano');
    scrivi('Importo (€)', 'abc');
    expect(b).toBeDisabled();
    scrivi('Importo (€)', '-5');
    expect(b).toBeDisabled();
    scrivi('Importo (€)', '50');
    expect(b).toBeEnabled();
    scrivi('Nome', '  ');
    expect(b).toBeDisabled();
  });

  it('data passata rifiutata', () => {
    monta();
    scrivi('Nome', 'Divano');
    scrivi('Importo (€)', '50');
    scrivi('Entro quando', '2026-11-01');
    expect(screen.getByText('La data di ingresso è già passata.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aggiungi' })).toBeDisabled();
  });
});
