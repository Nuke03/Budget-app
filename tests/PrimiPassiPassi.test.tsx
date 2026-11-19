import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
const azioni = vi.hoisted(() => ({
  salvaEntrate: vi.fn(async () => {}),
  avviaSettimana: vi.fn(async () => {}),
  ripartiSettimana: vi.fn(async () => {}),
  chiudiSettimana: vi.fn(async () => {}),
  creaFondiSpeseCerte: vi.fn(async (v: { chiave: string }[]) => v.map((x) => x.chiave)),
  nessunaSpesaCerta: vi.fn(async () => {}),
  creaFondoImprevisti: vi.fn(async () => ({ creato: true })),
  obiettivoPiuAvanti: vi.fn(async () => {}),
  proponiLezione: vi.fn(async () => {}),
}));
vi.mock('@/app/impara/primi-passi/actions', () => azioni);

import { PassoEntrate } from '@/app/impara/primi-passi/PassoEntrate';
import { PassoSettimana } from '@/app/impara/primi-passi/PassoSettimana';
import { PassoSpeseCerte } from '@/app/impara/primi-passi/PassoSpeseCerte';
import { PassoImprevisti } from '@/app/impara/primi-passi/PassoImprevisti';
import { PassoObiettivo } from '@/app/impara/primi-passi/PassoObiettivo';

beforeEach(() => {
  for (const f of Object.values(azioni)) f.mockClear();
  refresh.mockClear();
});

describe('passo entrate', () => {
  it('Non so ancora la data salva entrataAttesaIl null', async () => {
    render(<PassoEntrate iniziale={null} />);
    fireEvent.click(screen.getByRole('radio', { name: /Fisse/ }));
    fireEvent.change(screen.getByLabelText(/Quanto/), { target: { value: '1200' } });
    fireEvent.change(screen.getByLabelText(/Quando arriva/), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByLabelText('Non so ancora la data'));
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(azioni.salvaEntrate).toHaveBeenCalledTimes(1));
    expect(azioni.salvaEntrate).toHaveBeenCalledWith({
      entrateTipo: 'fisse',
      entrataAttesa: 1200,
      entrataAttesaIl: null,
      redditoBase: null,
    });
  });

  it('il reddito base compare solo per irregolari e P.IVA', () => {
    render(<PassoEntrate iniziale={null} />);
    expect(screen.queryByLabelText(/Reddito base/)).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /Irregolari/ }));
    expect(screen.getByLabelText(/Reddito base/)).toBeTruthy();
  });
});

describe('passo settimana', () => {
  it('prima del 7° giorno dice quando guardare il resto', () => {
    const { container } = render(
      <PassoSettimana fase="in-corso" dal="2026-11-15" riepilogo={null} />
    );
    expect(container.textContent).toContain('Segna le spese, il resto lo guardiamo il 22 novembre');
  });

  it('settimana senza spese dice Ripartiamo da oggi e non contiene parole vietate', async () => {
    const riepilogo = { numeroSpese: 0, totale: 0, grandi: [], piccole: { numero: 0, totale: 0 } };
    const { container } = render(
      <PassoSettimana fase="finita" dal="2026-11-10" riepilogo={riepilogo} />
    );
    expect(screen.getAllByText(/Ripartiamo da oggi/).length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/devi|dovresti|%/i);
    assertNessunaParolaVietata(container);
    fireEvent.click(screen.getByRole('button', { name: /Ripartiamo da oggi/ }));
    await waitFor(() => expect(azioni.ripartiSettimana).toHaveBeenCalled());
    expect(azioni.chiudiSettimana).not.toHaveBeenCalled();
  });

  it('con spese mostra il riepilogo e chiude la settimana', async () => {
    const riepilogo = {
      numeroSpese: 4,
      totale: 60,
      grandi: [{ nome: 'Spesa', totale: 50 }],
      piccole: { numero: 2, totale: 6 },
    };
    render(<PassoSettimana fase="finita" dal="2026-11-10" riepilogo={riepilogo} />);
    expect(screen.getByText(/Spesa/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ho visto/ }));
    await waitFor(() => expect(azioni.chiudiSettimana).toHaveBeenCalled());
  });
});

describe('passo spese certe', () => {
  it('crea un fondo per voce spuntata', async () => {
    const { container } = render(<PassoSpeseCerte oggi="2026-11-19" />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Assicurazione auto/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Gomme/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Crea i fondi' }));
    await waitFor(() => expect(azioni.creaFondiSpeseCerte).toHaveBeenCalledTimes(1));
    const voci = (azioni.creaFondiSpeseCerte.mock.calls[0] as unknown[])[0] as { chiave: string; importo: number; mese: string }[];
    expect(voci.map((v) => v.chiave)).toEqual(['assicurazione-auto', 'gomme']);
    expect(voci[0].importo).toBe(480);
    expect(voci[0].mese).toMatch(/^\d{4}-\d{2}$/);
    // C'è l'assicurazione auto: compare il link alla lezione.
    const link = await screen.findByRole('link', { name: /assicurazioni/i });
    expect(link.getAttribute('href')).toBe('/impara/assicurazioni');
    assertNessunaParolaVietata(container);
  });

  it('senza assicurazione auto non c è il link alla lezione', async () => {
    render(<PassoSpeseCerte oggi="2026-11-19" />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Bollo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Crea i fondi' }));
    await waitFor(() => expect(azioni.creaFondiSpeseCerte).toHaveBeenCalled());
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: /assicurazioni/i })).toBeNull();
  });

  it('Non ne ho salva speseCerteNessuna', async () => {
    render(<PassoSpeseCerte oggi="2026-11-19" />);
    fireEvent.click(screen.getByRole('button', { name: 'Non ne ho' }));
    await waitFor(() => expect(azioni.nessunaSpesaCerta).toHaveBeenCalled());
  });
});

describe('passo imprevisti', () => {
  it('crea il cuscinetto con traguardo e quota di partenza', async () => {
    const { container } = render(<PassoImprevisti giaCreato={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crea il cuscinetto' }));
    await waitFor(() => expect(azioni.creaFondoImprevisti).toHaveBeenCalledWith({ traguardo: 200, quota: 20 }));
    assertNessunaParolaVietata(container);
  });

  it('se c è già non offre di crearne un secondo', () => {
    render(<PassoImprevisti giaCreato />);
    expect(screen.queryByRole('button', { name: 'Crea il cuscinetto' })).toBeNull();
  });
});

describe('passo obiettivo', () => {
  it('Più avanti salva obiettivoPiuAvanti', async () => {
    render(<PassoObiettivo />);
    expect(screen.getByRole('link', { name: /obiettivo/i }).getAttribute('href')).toBe('/goals?nuovo=1');
    fireEvent.click(screen.getByRole('button', { name: 'Più avanti' }));
    await waitFor(() => expect(azioni.obiettivoPiuAvanti).toHaveBeenCalled());
  });
});
