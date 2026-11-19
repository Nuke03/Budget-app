import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const nascondiPrimiPassi = vi.fn(async () => {});
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock('@/app/impara/primi-passi/actions', () => ({
  nascondiPrimiPassi: () => nascondiPrimiPassi(),
}));

import { PrimiPassiCard } from '@/app/home/PrimiPassiCard';
import type { PrimiPassi } from '@/lib/calculations/percorso/passi';

const STATO: PrimiPassi = {
  passi: [
    { id: 'conti', fatto: true },
    { id: 'entrate', fatto: true },
    { id: 'settimana', fatto: false },
    { id: 'spese-certe', fatto: false },
    { id: 'imprevisti', fatto: false },
    { id: 'obiettivo', fatto: false },
  ],
  fatti: 2,
  totale: 6,
  prossimo: 'settimana',
  visibile: true,
};

beforeEach(() => {
  nascondiPrimiPassi.mockClear();
  refresh.mockClear();
});

describe('PrimiPassiCard', () => {
  it('mostra 2 di 6 e il prossimo passo', () => {
    const { container } = render(<PrimiPassiCard primiPassi={STATO} />);
    expect(screen.getByText('2 di 6')).toBeTruthy();
    const link = screen.getByRole('link', { name: /Una settimana di spese/ });
    expect(link.getAttribute('href')).toBe('/impara/primi-passi/settimana');
    expect(container.textContent).not.toMatch(/%/);
    assertNessunaParolaVietata(container);
  });

  it('Li vedo più tardi salva nascosti', async () => {
    render(<PrimiPassiCard primiPassi={STATO} />);
    fireEvent.click(screen.getByRole('button', { name: 'Li vedo più tardi' }));
    await waitFor(() => expect(nascondiPrimiPassi).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
