import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }), getSession: async () => ({ data: { session: null } }) },
  }),
}));
vi.mock('@/lib/data/notifiche', () => ({
  leggiPromemoriaUtente: async () => ({ notificheAttive: true, nessunaSpesaFinoAl: null }),
}));
vi.mock('@/app/altro/Notifiche', () => ({
  Notifiche: ({ notificheAttive }: { notificheAttive: boolean | null }) => (
    <section id="notifiche">stato:{String(notificheAttive)}</section>
  ),
}));

import AltroPage from '@/app/altro/page';

describe('pagina Altro', () => {
  it('ha cinque link con gli href previsti', async () => {
    render(await AltroPage());
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
    expect(screen.getByRole('link', { name: /Obiettivi/ })).toHaveAttribute('href', '/goals');
    expect(screen.getByRole('link', { name: /Conti/ })).toHaveAttribute('href', '/accounts');
    expect(screen.getByRole('link', { name: /Categorie/ })).toHaveAttribute('href', '/categories');
    expect(screen.getByRole('link', { name: /P\.IVA/ })).toHaveAttribute('href', '/piva');
    expect(screen.getByRole('link', { name: /Notifiche/ })).toHaveAttribute('href', '/altro#notifiche');
  });

  it('porta la sezione notifiche con lo stato dell utente', async () => {
    const { container } = render(await AltroPage());
    expect(container.querySelector('#notifiche')).toHaveTextContent('stato:true');
  });
  it('senza sessione porta al login', async () => {
    vi.resetModules();
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }), getSession: async () => ({ data: { session: null } }) } }),
    }));
    const { default: Pagina } = await import('@/app/altro/page');
    await expect(Pagina()).rejects.toThrow('REDIRECT:/login');
  });
});
