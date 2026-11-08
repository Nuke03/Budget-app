import { describe, it, expect } from 'vitest';
import { messaggioErroreLogin } from '@/app/login/errors';

describe('messaggioErroreLogin', () => {
  it('traduce un errore di rete in un messaggio sul database', () => {
    expect(messaggioErroreLogin('fetch failed')).toMatch(/database/);
    expect(messaggioErroreLogin('TypeError: Failed to fetch')).toMatch(/database/);
  });

  it('traduce le credenziali errate', () => {
    expect(messaggioErroreLogin('Invalid login credentials')).toBe('Email o password errati.');
  });

  it('lascia passare gli altri messaggi', () => {
    expect(messaggioErroreLogin('Email not confirmed')).toBe('Email not confirmed');
  });
});
