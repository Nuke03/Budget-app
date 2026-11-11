import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { ProvaNotifiche } from './ProvaNotifiche';

export default async function ProvaNotifichePage() {
  const supabase = await createClient();
  await utenteOLogin(supabase);
  const chiave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
  const configurata = Boolean(
    chiave && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT
  );
  return <ProvaNotifiche chiavePubblica={chiave} configurata={configurata} />;
}
