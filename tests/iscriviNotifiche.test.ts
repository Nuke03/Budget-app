import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ordine = vi.hoisted(() => ({ passi: [] as string[] }));
const salva = vi.hoisted(() => vi.fn());
const rispondi = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }));
vi.mock('@/lib/data/notifiche', () => ({
  salvaIscrizione: (...a: unknown[]) => salva(...a),
  rispondiNotifiche: (...a: unknown[]) => rispondi(...a),
}));

import { ambienteNotifiche, chiaveInBytes, iscriviNotifiche } from '@/lib/iscriviNotifiche';

const CHIAVE = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const sub = { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'a', auth: 'b' } };

function preparaBrowser(permesso: NotificationPermission | 'assente' = 'granted') {
  const subscribe = vi.fn(async (opts: PushSubscriptionOptionsInit) => {
    ordine.passi.push('iscrizione');
    void opts;
    return { toJSON: () => sub };
  });
  const register = vi.fn(async () => ({}));
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register, ready: Promise.resolve({ pushManager: { subscribe } }) },
  });
  vi.stubGlobal('PushManager', class {});
  if (permesso === 'assente') {
    vi.stubGlobal('Notification', undefined);
  } else {
    vi.stubGlobal('Notification', {
      requestPermission: vi.fn(async () => {
        ordine.passi.push('permesso');
        return permesso;
      }),
    });
  }
  return { subscribe, register };
}

beforeEach(() => {
  ordine.passi = [];
  salva.mockReset().mockImplementation(async () => void ordine.passi.push('salva'));
  rispondi.mockReset().mockImplementation(async (_s: unknown, v: boolean) => void ordine.passi.push(`rispondi:${v}`));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'serviceWorker');
  Reflect.deleteProperty(navigator, 'standalone');
});

describe('chiaveInBytes', () => {
  it('converte base64url in byte', () => {
    const b = chiaveInBytes(CHIAVE);
    expect(b).toBeInstanceOf(Uint8Array);
    expect(b.length).toBe(65);
    expect(b[0]).toBe(4);
  });
});

describe('iscriviNotifiche', () => {
  it('permesso, iscrizione, salvataggio e risposta true, in questo ordine', async () => {
    const { subscribe, register } = preparaBrowser('granted');
    expect(await iscriviNotifiche(CHIAVE)).toBe('attive');
    expect(ordine.passi).toEqual(['permesso', 'iscrizione', 'salva', 'rispondi:true']);
    expect(register).toHaveBeenCalledWith('/sw.js');
    expect(subscribe.mock.calls[0][0].userVisibleOnly).toBe(true);
    expect(salva).toHaveBeenCalledWith({ client: true }, sub);
  });

  it('con il permesso negato risponde false e non si iscrive', async () => {
    const { subscribe } = preparaBrowser('denied');
    expect(await iscriviNotifiche(CHIAVE)).toBe('negate');
    expect(ordine.passi).toEqual(['permesso', 'rispondi:false']);
    expect(subscribe).not.toHaveBeenCalled();
    expect(salva).not.toHaveBeenCalled();
  });

  it('con il prompt chiuso (default) non salva niente e rimanda', async () => {
    const { subscribe } = preparaBrowser('default');
    expect(await iscriviNotifiche(CHIAVE)).toBe('rimandata');
    expect(rispondi).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('se salvare il no fallisce, l esito resta negate', async () => {
    preparaBrowser('denied');
    rispondi.mockRejectedValueOnce(new Error('rete'));
    expect(await iscriviNotifiche(CHIAVE)).toBe('negate');
  });

  it('senza supporto non chiede niente', async () => {
    preparaBrowser('assente');
    expect(await iscriviNotifiche(CHIAVE)).toBe('non_supportate');
    expect(rispondi).not.toHaveBeenCalled();
  });

  it('se il salvataggio fallisce non risponde true', async () => {
    preparaBrowser('granted');
    salva.mockRejectedValueOnce(new Error('iscrizione non valida'));
    await expect(iscriviNotifiche(CHIAVE)).rejects.toThrow('iscrizione non valida');
    expect(rispondi).not.toHaveBeenCalled();
  });
});

describe('ambienteNotifiche', () => {
  const finto = (standalone: boolean, ua: string, navStandalone?: boolean) => {
    vi.stubGlobal('matchMedia', () => ({ matches: standalone }));
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: navStandalone });
  };
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';

  it('installata con display-mode standalone', () => {
    finto(true, IPHONE);
    expect(ambienteNotifiche()).toBe('installata');
  });
  it('installata con navigator.standalone', () => {
    finto(false, IPHONE, true);
    expect(ambienteNotifiche()).toBe('installata');
  });
  it('iPhone in Safari non installata', () => {
    finto(false, IPHONE, false);
    expect(ambienteNotifiche()).toBe('ios_da_installare');
  });
  it('altro browser con il supporto', () => {
    preparaBrowser();
    finto(false, 'Mozilla/5.0 (Windows NT 10.0) Chrome/120');
    expect(ambienteNotifiche()).toBe('browser');
  });
  it('senza supporto', () => {
    finto(false, 'Mozilla/5.0 (Windows NT 10.0) Chrome/120');
    expect(ambienteNotifiche()).toBe('non_supportate');
  });
});
