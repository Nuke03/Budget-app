import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { chiaviVapid } from '@/lib/chiaviVapid';
import { ProvaNotifiche } from './ProvaNotifiche';

export default async function ProvaNotifichePage() {
  const supabase = await createClient();
  await utenteOLogin(supabase);
  const chiavi = chiaviVapid();
  return <ProvaNotifiche chiavePubblica={chiavi?.pubblica ?? ''} configurata={chiavi !== null} />;
}
