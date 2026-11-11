import { describe, it, expect } from 'vitest';
import { endpointAmmesso } from '@/lib/pushEndpoint';

describe('endpointAmmesso', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://web.push.apple.com/QWxs',
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://wns2-par02p.notify.windows.com/w/?token=x',
  ])('accetta %s', (u) => expect(endpointAmmesso(u)).toBe(true));

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://evil.example.com/',
    'https://fcm.googleapis.com.evil.com/',
    'https://evilpush.apple.com.evil.io/',
    'https://xmozilla.com/',
    'https://user@fcm.googleapis.com/',
    'https://fcm.googleapis.com:8443/',
    'https://127.0.0.1/',
    'https://push.apple.com/',
    'non un url',
    '',
  ])('rifiuta %s', (u) => expect(endpointAmmesso(u)).toBe(false));
});
