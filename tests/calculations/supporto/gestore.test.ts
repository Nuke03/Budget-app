import { describe, it, expect } from 'vitest';
import { chiGestisce } from '@/lib/calculations/supporto/gestore';
import type { HouseholdMember } from '@/lib/types';

const membro = (userId: string, joinedAt: string, attivo = true): HouseholdMember => ({
  householdId: 'casa-1',
  userId,
  displayName: userId,
  joinedAt,
  slot: 1,
  attivo,
});

describe('chiGestisce', () => {
  it('il creatore attivo gestisce', () => {
    const members = [membro('fabio', '2026-01-01T00:00:00Z'), membro('giulia', '2026-02-01T00:00:00Z')];
    expect(chiGestisce({ createdBy: 'fabio' }, members)).toBe('fabio');
  });

  it('creatore uscito → il primo entrato fra gli attivi', () => {
    const members = [
      membro('fabio', '2026-01-01T00:00:00Z', false),
      membro('giulia', '2026-03-01T00:00:00Z'),
      membro('marco', '2026-02-01T00:00:00Z'),
    ];
    expect(chiGestisce({ createdBy: 'fabio' }, members)).toBe('marco');
  });

  it('tre membri → uno solo gestisce', () => {
    const members = [
      membro('giulia', '2026-02-01T00:00:00Z'),
      membro('marco', '2026-03-01T00:00:00Z'),
      membro('fabio', '2026-01-01T00:00:00Z'),
    ];
    const chi = chiGestisce({ createdBy: 'ospite' }, members);
    expect(chi).toBe('fabio');
  });

  it('nessun attivo → null', () => {
    const members = [membro('fabio', '2026-01-01T00:00:00Z', false)];
    expect(chiGestisce({ createdBy: 'fabio' }, members)).toBeNull();
    expect(chiGestisce({ createdBy: 'fabio' }, [])).toBeNull();
  });
});
