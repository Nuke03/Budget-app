// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

vi.mock('@/lib/fumetti/ambiente', async (orig) => ({
  ...(await orig<typeof import('@/lib/fumetti/ambiente')>()),
  useUtenteId: () => 'u1',
}));

import { GiroBarra, PASSI_GIRO } from '@/app/fumetti/GiroBarra';
import { eVisto, segnaVisto, giroInQuestaApertura, _azzeraMemoriaPerTest } from '@/lib/fumetti/visti';

const T1 = 'Questo è quanto puoi spendere adesso. I soldi dei cassetti sono già tolti.';
const T2 = 'In Storico trovi tutti i movimenti, giorno per giorno, e dove vanno i soldi.';
const T3 = 'Con il + registri una spesa in pochi secondi. Dentro trovi anche le altre cose che puoi fare.';
const T4 = 'Casa è lo spazio che condividete: spese comuni, quota del mese e se siete in pari.';
const T4_SENZA = 'Qui puoi creare una casa da condividere con chi vive con te.';
const T5 = 'In Altro ci sono i cassetti, i conti, le lezioni di Impara e le impostazioni.';

function ancore() {
  for (const a of ['disponibile', 'nav-storico', 'nav-piu', 'nav-casa', 'nav-altro']) {
    const el = document.createElement('div');
    el.setAttribute('data-fumetto', a);
    el.getBoundingClientRect = () => ({ x: 50, y: 100, left: 50, top: 100, right: 150, bottom: 140, width: 100, height: 40, toJSON() {} }) as DOMRect;
    document.body.appendChild(el);
  }
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  _azzeraMemoriaPerTest();
  ancore();
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('GiroBarra', () => {
  it('percorre i 5 testi con "n di 5" e "Fatto" all\'ultimo', async () => {
    render(<GiroBarra haCasa />);
    const testi = [T1, T2, T3, T4, T5];
    for (let i = 0; i < 5; i++) {
      const t = await screen.findByText(testi[i]);
      assertNessunaParolaVietata(t.parentElement as HTMLElement);
      expect(screen.getByText(`${i + 1} di 5`)).toBeTruthy();
      if (i < 4) {
        expect(screen.queryByRole('button', { name: 'Fatto' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
      }
    }
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    expect(screen.queryByText(T5)).toBeNull();
    expect(eVisto('u1', 'giro')).toBe(true);
  });

  it('Salta al passo 2 chiude e segna visto', async () => {
    render(<GiroBarra haCasa />);
    await screen.findByText(T1);
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    await screen.findByText(T2);
    fireEvent.click(screen.getByRole('button', { name: 'Salta' }));
    expect(screen.queryByText(T2)).toBeNull();
    expect(eVisto('u1', 'giro')).toBe(true);
  });

  it('Esc salta', async () => {
    render(<GiroBarra haCasa />);
    await screen.findByText(T1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText(T1)).toBeNull();
    expect(eVisto('u1', 'giro')).toBe(true);
  });

  it('già visto: non parte', async () => {
    segnaVisto('u1', 'giro');
    render(<GiroBarra haCasa />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(T1)).toBeNull();
    expect(giroInQuestaApertura()).toBe(false);
  });

  it('con un foglio aperto non parte, parte quando si chiude', async () => {
    const foglio = document.createElement('div');
    foglio.setAttribute('role', 'dialog');
    foglio.setAttribute('aria-modal', 'true');
    document.body.appendChild(foglio);
    render(<GiroBarra haCasa />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(T1)).toBeNull();
    expect(giroInQuestaApertura()).toBe(false);
    foglio.remove();
    expect(await screen.findByText(T1)).toBeTruthy();
    expect(eVisto('u1', 'giro')).toBe(false);
  });

  it('senza casa il passo 4 invita a crearla', async () => {
    render(<GiroBarra haCasa={false} />);
    for (let i = 0; i < 3; i++) {
      await waitFor(() => expect(screen.getByText(`${i + 1} di 5`)).toBeTruthy());
      fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    }
    const t = await screen.findByText(T4_SENZA);
    assertNessunaParolaVietata(t.parentElement as HTMLElement);
    expect(screen.queryByText(T4)).toBeNull();
  });

  it('alla partenza il giro è segnato in questa apertura', async () => {
    render(<GiroBarra haCasa />);
    await screen.findByText(T1);
    expect(giroInQuestaApertura()).toBe(true);
  });

  it('PASSI_GIRO ha 5 passi con le ancore giuste', () => {
    expect(PASSI_GIRO(true).map((p) => p.ancora)).toEqual(['disponibile', 'nav-storico', 'nav-piu', 'nav-casa', 'nav-altro']);
  });
});
