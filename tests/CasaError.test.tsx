import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CasaError from '@/app/casa/error';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

describe('error boundary della casa', () => {
  it('dice che i dati personali restano e permette di riprovare o tornare alla home', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const retry = vi.fn();
    const { container } = render(<CasaError error={new Error('boom')} retry={retry} />);

    expect(screen.getByRole('heading', { name: 'Non riesco a leggere la casa' })).toBeInTheDocument();
    expect(
      screen.getByText('I tuoi dati personali non sono toccati. Riprova tra un attimo.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(retry).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Torna alla home' })).toHaveAttribute('href', '/');
    assertNessunaParolaVietata(container);
  });
});
