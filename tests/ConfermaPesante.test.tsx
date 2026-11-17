import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfermaPesante } from '@/app/ConfermaPesante';
import { serveConferma } from '@/lib/conferme';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const FRASE = 'Il versamento di 640 € sparisce anche dai saldi dei conti. Puoi comunque annullare per qualche secondo.';

function monta(over: Partial<React.ComponentProps<typeof ConfermaPesante>> = {}) {
  const onConferma = vi.fn();
  const onChiudi = vi.fn();
  const r = render(
    <ConfermaPesante titolo="Eliminare il movimento?" frase={FRASE} tipo="movimento_casa" onConferma={onConferma} onChiudi={onChiudi} {...over} />
  );
  return { ...r, onConferma, onChiudi };
}

describe('ConfermaPesante', () => {
  beforeEach(() => window.localStorage.clear());

  it('dice cosa succede e offre Elimina / Lascia stare', () => {
    const { container } = monta();
    expect(screen.getByText(FRASE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elimina' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lascia stare' })).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });
  it('con la spunta salva la preferenza e conferma', () => {
    const { onConferma } = monta();
    fireEvent.click(screen.getByLabelText('Non avvisarmi più'));
    fireEvent.click(screen.getByRole('button', { name: 'Elimina' }));
    expect(onConferma).toHaveBeenCalledTimes(1);
    expect(serveConferma('movimento_casa')).toBe(false);
  });
  it('senza spunta conferma e continua a chiedere', () => {
    const { onConferma } = monta();
    fireEvent.click(screen.getByRole('button', { name: 'Elimina' }));
    expect(onConferma).toHaveBeenCalledTimes(1);
    expect(serveConferma('movimento_casa')).toBe(true);
  });
  it('Lascia stare non fa nulla e non salva la spunta', () => {
    const { onConferma, onChiudi } = monta();
    fireEvent.click(screen.getByLabelText('Non avvisarmi più'));
    fireEvent.click(screen.getByRole('button', { name: 'Lascia stare' }));
    expect(onChiudi).toHaveBeenCalledTimes(1);
    expect(onConferma).not.toHaveBeenCalled();
    expect(serveConferma('movimento_casa')).toBe(true);
  });
  it('con salta=false non c è la spunta', () => {
    monta({ tipo: 'esci_casa', salta: false, etichettaConferma: 'Esci dalla casa' });
    expect(screen.queryByLabelText('Non avvisarmi più')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Esci dalla casa' })).toBeInTheDocument();
  });
});
