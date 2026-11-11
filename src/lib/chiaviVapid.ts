// Le chiavi delle notifiche, lette solo sul server. Vercel non accetta i nomi con PUBLIC e PRIVATE
// per queste variabili, quindi i nomi in uso sono NEXT_P_VAPID_P_KEY (pubblica) e VAPID_PR_KEY
// (privata). I nomi lunghi restano come riserva. La chiave pubblica arriva al telefono come prop.
export interface ChiaviVapid {
  pubblica: string;
  privata: string;
  soggetto: string;
}

export function chiaviVapid(env: Record<string, string | undefined> = process.env): ChiaviVapid | null {
  const pubblica = env.NEXT_P_VAPID_P_KEY ?? env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privata = env.VAPID_PR_KEY ?? env.VAPID_PRIVATE_KEY;
  const soggetto = env.VAPID_SUBJECT;
  if (!pubblica || !privata || !soggetto) return null;
  return { pubblica: pubblica.trim(), privata: privata.trim(), soggetto: soggetto.trim() };
}
