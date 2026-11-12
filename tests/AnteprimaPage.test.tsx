import { describe, it, expect, vi, afterEach } from 'vitest';

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock('next/navigation', () => ({ notFound, useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import AnteprimaPage from '@/app/anteprima/page';

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

  it.each(['casa', 'casa-semplice', 'casa-dettagli', 'checkin'])('in sviluppo la vista %s si costruisce', async (vista) => {
    vi.stubEnv('NODE_ENV', 'development');
    const el = await AnteprimaPage({ searchParams: Promise.resolve({ vista }) });
    expect(notFound).not.toHaveBeenCalled();
    expect(el).toBeTruthy();
  });

  it.each(['casa', 'casa-semplice', 'casa-dettagli', 'checkin'])('in produzione la vista %s dà 404', async (vista) => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(AnteprimaPage({ searchParams: Promise.resolve({ vista }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
