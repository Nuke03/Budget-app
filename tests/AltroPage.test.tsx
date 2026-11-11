import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AltroPage from '@/app/altro/page';

describe('pagina Altro', () => {
  it('ha cinque link con gli href previsti', () => {
    render(<AltroPage />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
    expect(screen.getByRole('link', { name: /Obiettivi/ })).toHaveAttribute('href', '/goals');
    expect(screen.getByRole('link', { name: /Conti/ })).toHaveAttribute('href', '/accounts');
    expect(screen.getByRole('link', { name: /Categorie/ })).toHaveAttribute('href', '/categories');
    expect(screen.getByRole('link', { name: /P\.IVA/ })).toHaveAttribute('href', '/piva');
    expect(screen.getByRole('link', { name: /Notifiche/ })).toHaveAttribute('href', '/altro#notifiche');
  });
});
