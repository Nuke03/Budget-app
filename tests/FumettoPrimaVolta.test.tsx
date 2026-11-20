// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

vi.mock('@/lib/fumetti/ambiente', async (orig) => ({
  ...(await orig<typeof import('@/lib/fumetti/ambiente')>()),
  useUtenteId: () => 'u1',
}));

import { FumettoPrimaVolta } from '@/app/fumetti/FumettoPrimaVolta';
import { eVisto, segnaVisto, segnaGiroInQuestaApertura, _azzeraMemoriaPerTest } from '@/lib/fumetti/visti';

const TESTO = 'Qui trovi i movimenti passati.';

function ancora() {
  const el = document.createElement('button');
  el.setAttribute('data-fumetto', 'storico');
  el.getBoundingClientRect = () => ({ x: 50, y: 100, left: 50, top: 100, right: 150, bottom: 140, width: 100, height: 40, toJSON() {} }) as DOMRect;
  document.body.appendChild(el);
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  _azzeraMemoriaPerTest();
  ancora();
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('FumettoPrimaVolta', () => {
  it('mai visto: si vede; Ho capito lo chiude e lo segna', async () => {
    render(<FumettoPrimaVolta id="storico" ancora="storico" testo={TESTO} />);
    const t = await screen.findByRole('dialog');
    expect(t.textContent).toContain(TESTO);
    assertNessunaParolaVietata(t);
    fireEvent.click(screen.getByRole('button', { name: 'Ho capito' }));
    expect(screen.queryByText(TESTO)).toBeNull();
    expect(eVisto('u1', 'storico')).toBe(true);
  });

  it('la X segna visto', async () => {
    render(<FumettoPrimaVolta id="storico" ancora="storico" testo={TESTO} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chiudi' }));
    expect(eVisto('u1', 'storico')).toBe(true);
    expect(screen.queryByText(TESTO)).toBeNull();
  });

  it('già visto: non si vede', async () => {
    segnaVisto('u1', 'storico');
    render(<FumettoPrimaVolta id="storico" ancora="storico" testo={TESTO} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(TESTO)).toBeNull();
  });

  it('giro in questa apertura: non si vede', async () => {
    segnaGiroInQuestaApertura();
    render(<FumettoPrimaVolta id="storico" ancora="storico" testo={TESTO} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(TESTO)).toBeNull();
  });

  it('con un foglio aperto si nasconde senza segnarsi, poi torna', async () => {
    const foglio = document.createElement('div');
    foglio.setAttribute('role', 'dialog');
    foglio.setAttribute('aria-modal', 'true');
    document.body.appendChild(foglio);
    render(<FumettoPrimaVolta id="storico" ancora="storico" testo={TESTO} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(TESTO)).toBeNull();
    foglio.remove();
    expect(await screen.findByRole('dialog')).toBeTruthy();
    await waitFor(() => expect(eVisto('u1', 'storico')).toBe(false));
  });

  it('la regione aria-live c è sempre, vuota finché il fumetto non compare, poi con il testo', async () => {
    segnaVisto('u1', 'storico');
    const { container, rerender } = render(<FumettoPrimaVolta id="storico" ancora="storico" testo={TESTO} />);
    const regione = container.querySelector('[aria-live="polite"]');
    expect(regione).not.toBeNull();
    expect(regione?.textContent).toBe('');
    cleanup();
    window.localStorage.clear();
    _azzeraMemoriaPerTest();
    const r = render(<FumettoPrimaVolta id="storico" ancora="storico" testo={TESTO} />);
    await screen.findByRole('dialog');
    await waitFor(() => expect(r.container.querySelector('[aria-live="polite"]')?.textContent).toBe(TESTO));
    void rerender;
  });
});
