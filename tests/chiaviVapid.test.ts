import { describe, it, expect } from 'vitest';
import { chiaviVapid } from '@/lib/chiaviVapid';

describe('chiaviVapid', () => {
  it('legge i nomi in uso su Vercel', () => {
    expect(
      chiaviVapid({ NEXT_P_VAPID_P_KEY: 'pub ', VAPID_PR_KEY: 'priv', VAPID_SUBJECT: 'mailto:a@b.it' })
    ).toEqual({ pubblica: 'pub', privata: 'priv', soggetto: 'mailto:a@b.it' });
  });

  it('accetta anche i nomi lunghi', () => {
    expect(
      chiaviVapid({
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'pub',
        VAPID_PRIVATE_KEY: 'priv',
        VAPID_SUBJECT: 'mailto:a@b.it',
      })
    ).toEqual({ pubblica: 'pub', privata: 'priv', soggetto: 'mailto:a@b.it' });
  });

  it('senza una delle tre restituisce null', () => {
    expect(chiaviVapid({ NEXT_P_VAPID_P_KEY: 'pub', VAPID_SUBJECT: 'mailto:a@b.it' })).toBeNull();
  });
});
