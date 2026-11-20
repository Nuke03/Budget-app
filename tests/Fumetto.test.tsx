// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { Fumetto } from '@/app/fumetti/Fumetto';

function ancora(w = 100, h = 40) {
  const el = document.createElement('button');
  el.setAttribute('data-fumetto', 'prova');
  el.getBoundingClientRect = () => ({ x: 50, y: 100, left: 50, top: 100, right: 50 + w, bottom: 100 + h, width: w, height: h, toJSON() {} }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('Fumetto dentro lo schermo', () => {
  it('con un ancora più alta della finestra la bolla resta tra i margini', async () => {
    window.innerHeight = 600;
    window.innerWidth = 375;
    const el = document.createElement('div');
    el.setAttribute('data-fumetto', 'prova');
    el.getBoundingClientRect = () => ({ x: 20, y: -50, left: 20, top: -50, right: 340, bottom: 700, width: 320, height: 750, toJSON() {} }) as DOMRect;
    document.body.appendChild(el);
    const orig = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      return this.getAttribute('role') === 'dialog'
        ? ({ x: 0, y: 0, left: 0, top: 0, right: 300, bottom: 150, width: 300, height: 150, toJSON() {} } as DOMRect)
        : orig.call(this);
    };
    try {
      render(<Fumetto ancora="prova" testo="Qui vedi tutto." modale={false} onChiudi={() => {}} />);
      const d = await screen.findByRole('dialog');
      await waitFor(() => expect(Number(d.getAttribute('data-fumetto-top'))).toBeGreaterThanOrEqual(12));
      const top = Number(d.getAttribute('data-fumetto-top'));
      expect(top).toBeGreaterThanOrEqual(12);
      expect(top + 150).toBeLessThanOrEqual(600 - 80 - 12);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = orig;
    }
  });
});

describe('Fumetto modale', () => {
  it('mostra passo, Avanti e Salta, focus su Avanti, Esc salta', async () => {
    ancora();
    const onSalta = vi.fn();
    render(<Fumetto ancora="prova" testo="Qui vedi tutto." modale passo={{ n: 2, di: 5 }} onSalta={onSalta} />);
    expect(await screen.findByText('2 di 5')).toBeTruthy();
    const avanti = screen.getByRole('button', { name: 'Avanti' });
    expect(screen.getByRole('button', { name: 'Salta' })).toBeTruthy();
    expect(document.activeElement).toBe(avanti);
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('dialog').hasAttribute('data-fumetto-giro')).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSalta).toHaveBeenCalled();
  });

  it('usa etichettaAvanti e chiama onAvanti', async () => {
    ancora();
    const onAvanti = vi.fn();
    render(<Fumetto ancora="prova" testo="x" modale passo={{ n: 5, di: 5 }} etichettaAvanti="Fine" onAvanti={onAvanti} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fine' }));
    expect(onAvanti).toHaveBeenCalled();
  });

  it('senza ancora non rende niente', () => {
    const { container } = render(<Fumetto ancora="prova" testo="x" modale />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('con ancora 0x0 non rende niente', async () => {
    ancora(0, 0);
    render(<Fumetto ancora="prova" testo="x" modale />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Fumetto non modale', () => {
  it('niente aria-modal, Ho capito e X chiamano onChiudi, focus fermo', async () => {
    ancora();
    const onChiudi = vi.fn();
    render(<Fumetto ancora="prova" testo="Ciao" modale={false} onChiudi={onChiudi} />);
    const d = await screen.findByRole('dialog');
    expect(d.hasAttribute('aria-modal')).toBe(false);
    expect(d.getAttribute('aria-live')).toBe('polite');
    expect(d.contains(document.activeElement)).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Ho capito' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(onChiudi).toHaveBeenCalledTimes(2);
  });
});
