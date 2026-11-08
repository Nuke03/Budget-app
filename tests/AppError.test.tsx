import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AppError from '@/app/error';

describe('error boundary dell\'app', () => {
  it('spiega che il database non risponde e permette di riprovare', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const retry = vi.fn();
    render(<AppError error={new Error('fetch failed')} retry={retry} />);

    expect(screen.getByText(/Non riesco a raggiungere il database/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(retry).toHaveBeenCalled();
  });
});
