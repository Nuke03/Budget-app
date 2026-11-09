import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CodiceInvito } from '@/app/casa/CodiceInvito';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const LINK = 'https://budget.example/casa/inizia?modo=entra&codice=K7M2QX9P';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CodiceInvito', () => {
  let scrivi: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    scrivi = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: scrivi }, configurable: true });
  });

  it('copia il testo con il link e il codice a parte', async () => {
    const { container } = render(<CodiceInvito codice="K7M2QX9P" origin="https://budget.example" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copia il codice' }));
    await waitFor(() => expect(scrivi).toHaveBeenCalled());
    const testo = scrivi.mock.calls[0][0] as string;
    expect(testo).toContain(`Entra nella nostra casa su Budget: ${LINK}`);
    expect(testo).toContain('K7M2-QX9P');
    expect(await screen.findByText('Codice copiato.')).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('senza origin dal server usa quello della finestra', async () => {
    render(<CodiceInvito codice="K7M2QX9P" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copia il codice' }));
    await waitFor(() => expect(scrivi).toHaveBeenCalled());
    expect(scrivi.mock.calls[0][0]).toContain(`${window.location.origin}/casa/inizia?modo=entra&codice=K7M2QX9P`);
  });

  it('condivide testo e link quando il browser lo permette', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    render(<CodiceInvito codice="K7M2QX9P" origin="https://budget.example" />);
    fireEvent.click(screen.getByRole('button', { name: 'Condividi' }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0].url).toBe(LINK);
    expect(share.mock.calls[0][0].text).toContain(LINK);
    delete (navigator as unknown as Record<string, unknown>).share;
  });
});
