import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));
const azzeraFumetti = vi.fn();
vi.mock('@/lib/fumetti/visti', () => ({ azzeraFumetti: (...a: unknown[]) => azzeraFumetti(...a) }));
vi.mock('@/lib/fumetti/ambiente', () => ({ useUtenteId: () => 'u1' }));

import { RivediGiro } from '@/app/altro/RivediGiro';

beforeEach(() => vi.clearAllMocks());

describe('RivediGiro', () => {
  it('azzera i fumetti dell utente e va alla Home', () => {
    const { container } = render(<RivediGiro />);
    expect(screen.getByRole('heading', { name: "Il giro dell'app" })).toBeInTheDocument();
    expect(screen.getByText('Rivedi i fumetti che spiegano dove sono le cose.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rivedi il giro' }));
    expect(azzeraFumetti).toHaveBeenCalledWith('u1');
    expect(push).toHaveBeenCalledWith('/');
    assertNessunaParolaVietata(container);
  });
});
