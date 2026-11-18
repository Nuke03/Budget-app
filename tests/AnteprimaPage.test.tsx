import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock('next/navigation', () => ({ notFound, useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/anteprima' }));

import AnteprimaPage from '@/app/anteprima/page';
import { AnnullaProvider } from '@/app/AnnullaProvider';

describe('/anteprima', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it('in produzione chiama notFound()', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(AnteprimaPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('con NODE_ENV=test chiama notFound()', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    await expect(AnteprimaPage({ searchParams: Promise.resolve({ vista: 'home' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('in sviluppo non chiama notFound()', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const el = await AnteprimaPage({ searchParams: Promise.resolve({ vista: 'vuota' }) });
    expect(notFound).not.toHaveBeenCalled();
    expect(el).toBeTruthy();
  });

  it.each(['casa', 'casa-semplice', 'casa-dettagli', 'checkin', 'storico', 'obiettivi', 'conti', 'annulla'])('in sviluppo la vista %s si costruisce', async (vista) => {
    vi.stubEnv('NODE_ENV', 'development');
    const el = await AnteprimaPage({ searchParams: Promise.resolve({ vista }) });
    expect(notFound).not.toHaveBeenCalled();
    expect(el).toBeTruthy();
  });

  it.each(['casa', 'casa-semplice', 'casa-dettagli', 'checkin', 'storico', 'obiettivi', 'conti', 'annulla'])('in produzione la vista %s dà 404', async (vista) => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(AnteprimaPage({ searchParams: Promise.resolve({ vista }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  describe('viste P.IVA', () => {
    async function mostra(vista: string) {
      vi.stubEnv('NODE_ENV', 'development');
      const el = await AnteprimaPage({ searchParams: Promise.resolve({ vista }) });
      render(<AnnullaProvider>{el}</AnnullaProvider>);
    }

    it('piva: il hub con i dati di Miriam', async () => {
      await mostra('piva');
      expect(await screen.findByText(/Metti da parte il 13,7% di ogni incasso/)).toBeTruthy();
      expect(screen.getByText(/servono circa 4\.300 €, ne hai messi da parte 3\.100 €/)).toBeTruthy();
      expect(screen.getByText(/Stipendio di questo mese 1\.300 € \(te ne restano 640 €\)/)).toBeTruthy();
      expect(screen.getByText(/Cuscinetto 2\.900 €/)).toBeTruthy();
      expect(screen.getByText(/3 fatture, 1 da 90 giorni/)).toBeTruthy();
      expect(screen.getByText(/prossima F24 30\/11/)).toBeTruthy();
      expect(screen.getByText(/^\+ Incasso$/)).toBeTruthy();
      expect(screen.getByText(/^\+ Fattura$/)).toBeTruthy();
    });

    it('piva-guida: il primo passo con il preset ENPAP', async () => {
      await mostra('piva-guida');
      expect(screen.getByText(/ENPAP/)).toBeTruthy();
    });

    it('piva-scadenze: pagata, mancano 300, cifra in arrivo, nota del primo anno', async () => {
      await mostra('piva-scadenze');
      expect(screen.getByText(/Pagata il/)).toBeTruthy();
      expect(screen.getByText(/mancano 300/)).toBeTruthy();
      expect(screen.getByText('cifra in arrivo dal commercialista')).toBeTruthy();
      expect(screen.getByText(/Gli acconti si calcolano sulle tasse dell.anno prima/)).toBeTruthy();
    });
  });
});
