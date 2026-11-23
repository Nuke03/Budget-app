import { afterEach, describe, expect, it, vi } from 'vitest';

async function caricaConfig() {
  vi.resetModules();
  const mod = await import('../next.config');
  return mod.default;
}

describe('next.config deploymentId', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("usa VERCEL_DEPLOYMENT_ID come deploymentId, così una versione nuova ricarica l'app", async () => {
    vi.stubEnv('VERCEL_DEPLOYMENT_ID', 'dpl_x');
    const config = await caricaConfig();
    expect(config.deploymentId).toBe('dpl_x');
  });

  it('in locale, senza VERCEL_DEPLOYMENT_ID, non imposta nessun id', async () => {
    vi.stubEnv('VERCEL_DEPLOYMENT_ID', '');
    delete process.env.VERCEL_DEPLOYMENT_ID;
    const config = await caricaConfig();
    expect(config.deploymentId).toBeUndefined();
  });
});
