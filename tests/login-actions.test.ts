import { describe, it, expect } from 'vitest';
import { validateLoginInput } from '@/app/login/actions';

describe('validateLoginInput', () => {
  it('accetta email e password non vuote', () => {
    expect(validateLoginInput('me@example.com', 'password123')).toEqual({ valid: true });
  });

  it('rifiuta email vuota', () => {
    expect(validateLoginInput('', 'password123')).toEqual({
      valid: false,
      error: 'Email obbligatoria',
    });
  });

  it('rifiuta password vuota', () => {
    expect(validateLoginInput('me@example.com', '')).toEqual({
      valid: false,
      error: 'Password obbligatoria',
    });
  });
});
