import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ForgotPasswordPage from '@/app/forgot-password/page';

const resetPasswordForEmail = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmail(...args),
    },
  }),
}));

describe('ForgotPasswordPage', () => {
  it('disabilita il pulsante finché non si scrive un\'email', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByText('Invia link di recupero')).toBeDisabled();
  });

  it('invia il link di recupero con il redirect a reset-password e mostra conferma', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@example.com' } });
    fireEvent.click(screen.getByText('Invia link di recupero'));

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith(
        'me@example.com',
        expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') })
      );
    });

    expect(await screen.findByText(/Controlla la tua casella email/)).toBeInTheDocument();
  });

  it('mostra un errore se la richiesta fallisce', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { message: 'Troppi tentativi, riprova più tardi.' } });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@example.com' } });
    fireEvent.click(screen.getByText('Invia link di recupero'));

    expect(await screen.findByText('Troppi tentativi, riprova più tardi.')).toBeInTheDocument();
  });
});
