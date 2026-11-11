// Il server manda la notifica all'indirizzo scelto dal telefono: va accettato solo se è di un
// servizio push noto, altrimenti si potrebbe far chiamare al server un indirizzo qualsiasi.
const HOST_ESATTI = ['fcm.googleapis.com'];
const SUFFISSI = ['.push.apple.com', '.mozilla.com', '.notify.windows.com'];

export function endpointAmmesso(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
  const host = u.hostname.toLowerCase();
  return HOST_ESATTI.includes(host) || SUFFISSI.some((s) => host.endsWith(s));
}
