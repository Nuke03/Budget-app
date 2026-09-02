import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Controllo ottimistico: legge la sessione dai cookie senza contattare i
  // server di Supabase Auth (getUser() farebbe invece una richiesta di rete
  // ad ogni singola navigazione, rallentando ogni pagina e trasformando ogni
  // rallentamento/timeout verso Supabase in un errore 500 per tutto il sito,
  // dato che qui non c'era alcun try/catch). La vera protezione dei dati resta
  // comunque alle policy RLS sulle tabelle, non a questo redirect.
  let hasSession = false;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    hasSession = session !== null;
  } catch {
    hasSession = false;
  }

  const isLoginPage = request.nextUrl.pathname.startsWith('/login');
  const isResetPasswordPage = request.nextUrl.pathname.startsWith('/reset-password');
  const isForgotPasswordPage = request.nextUrl.pathname.startsWith('/forgot-password');

  if (!hasSession && !isLoginPage && !isResetPasswordPage && !isForgotPasswordPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
};
