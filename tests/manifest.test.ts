// @vitest-environment node
import { describe, it, expect } from 'vitest';
import manifest from '@/app/manifest';
import { generateImageMetadata } from '@/app/icon';
import { size as sizeApple } from '@/app/apple-icon';

describe('manifest', () => {
  const m = manifest();

  it('ha i campi dell\'app', () => {
    expect(m.name).toBe('Budget');
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/');
    expect(m.theme_color).toBe('#14306b');
    expect(m.background_color).toBe('#eef2f8');
  });

  it('ha le icone 192 e 512 con purpose', () => {
    const icone = m.icons ?? [];
    for (const dim of ['192x192', '512x512']) {
      const i = icone.find((x) => x.sizes === dim);
      expect(i?.type).toBe('image/png');
      expect(i?.purpose).toBeTruthy();
    }
    expect(icone.some((x) => x.purpose === 'maskable')).toBe(true);
  });

  it('maschera e any non condividono la stessa immagine', () => {
    const icone = m.icons ?? [];
    const maschera = icone.find((x) => x.purpose === 'maskable');
    const qualsiasi = icone.filter((x) => x.purpose === 'any');
    expect(maschera?.src).toBe('/icon/maskable');
    expect(qualsiasi.map((x) => x.src)).not.toContain(maschera?.src);
  });

  it('ogni icona punta a una route generata', () => {
    const ids = generateImageMetadata().map((x) => x.id);
    for (const i of m.icons ?? []) {
      expect(ids).toContain(i.src.replace('/icon/', ''));
    }
  });
});

describe('icone generate', () => {
  it('icon: 192, 512 e maskable in png', () => {
    const meta = generateImageMetadata();
    expect(meta.map((x) => x.id)).toEqual(['192', '512', 'maskable']);
    expect(meta.map((x) => x.size.width)).toEqual([192, 512, 512]);
    expect(meta.every((x) => x.contentType === 'image/png')).toBe(true);
  });

  it('apple-icon: 180x180', () => {
    expect(sizeApple).toEqual({ width: 180, height: 180 });
  });

  it('renderizza una risposta png', async () => {
    const { default: Icon } = await import('@/app/icon');
    const res = await Icon({ id: Promise.resolve('192') });
    expect(res.headers.get('content-type')).toBe('image/png');
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(100);
    expect(Array.from(buf.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]);
  });

  it('renderizza anche la versione maskable', async () => {
    const { default: Icon } = await import('@/app/icon');
    const res = await Icon({ id: Promise.resolve('maskable') });
    expect(res.headers.get('content-type')).toBe('image/png');
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(buf.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]);
  });
});
