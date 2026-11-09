import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const redirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (p: string) => redirect(p),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'fabio@x.it' } } }) } }),
}));
vi.mock('@/lib/data/households', () => ({ getMyHousehold: async () => null }));

import InizioCasaPage from '@/app/casa/inizia/page';

describe('/casa/inizia page', () => {
  it('modo=entra passa modoIniziale entra', async () => {
    const el = (await InizioCasaPage({ searchParams: Promise.resolve({ modo: 'entra' }) })) as { props: Record<string, string> };
    expect(el.props.modoIniziale).toBe('entra');
    expect(el.props.defaultDisplayName).toBe('fabio');
  });

  it('senza parametro il modo è crea', async () => {
    const el = (await InizioCasaPage({ searchParams: Promise.resolve({}) })) as { props: Record<string, string> };
    expect(el.props.modoIniziale).toBe('crea');
  });

  it('il render della pagina non contiene parole vietate', async () => {
    const el = await InizioCasaPage({ searchParams: Promise.resolve({}) });
    const { container } = render(el as React.ReactElement);
    assertNessunaParolaVietata(container);
  });
});
