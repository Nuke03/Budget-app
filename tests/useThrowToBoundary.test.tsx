import { describe, it, expect, vi } from 'vitest';
import { Component, useEffect, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? <p>catturato: {this.state.error.message}</p> : this.props.children;
  }
}

function Pagina({ carica }: { carica: () => Promise<void> }) {
  const fail = useThrowToBoundary();
  useEffect(() => {
    carica().catch(fail);
  }, [carica, fail]);
  return <p>contenuto</p>;
}

describe('useThrowToBoundary', () => {
  it('porta un errore di caricamento asincrono fino all\'error boundary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const carica = () => Promise.reject(new Error('database giù'));
    render(
      <Boundary>
        <Pagina carica={carica} />
      </Boundary>
    );
    expect(await screen.findByText('catturato: database giù')).toBeInTheDocument();
  });

  it('non fa nulla se il caricamento va a buon fine', async () => {
    const carica = () => Promise.resolve();
    render(
      <Boundary>
        <Pagina carica={carica} />
      </Boundary>
    );
    expect(await screen.findByText('contenuto')).toBeInTheDocument();
  });
});
