// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
  })),
}));

import { proxy } from '@/proxy';

describe('proxy', () => {
  it('/api/calendario/<token> passa senza redirect', async () => {
    const res = await proxy(new NextRequest(`http://localhost/api/calendario/${'a'.repeat(43)}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('/goals senza sessione reindirizza a /login', async () => {
    const res = await proxy(new NextRequest('http://localhost/goals'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });
});
