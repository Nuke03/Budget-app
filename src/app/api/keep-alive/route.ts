import { createClient } from '@supabase/supabase-js';
import { isAuthorizedCron, pingDatabase } from '@/lib/data/keepAlive';

export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const result = await pingDatabase(supabase);
  return Response.json(result, { status: result.ok ? 200 : 503 });
}
