import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function hasSupabaseConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes('your-project'));
}

const limitedRoutes = [
  '/portal/analises',
  '/portal/calendario/cliente',
  '/portal/sobre-mim',
  '/portal/politicas',
];

function isLimitedRouteAllowed(pathname: string) {
  return limitedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function proxy(request: NextRequest) {
  const portalRequest = request.nextUrl.pathname.startsWith('/portal');

  if (!hasSupabaseConfiguration()) {
    // O protótipo continua acessível apenas no desenvolvimento local. Uma
    // implantação sem autenticação configurada falha fechada.
    if (process.env.NODE_ENV === 'production' && portalRequest) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    const prototypeResponse = NextResponse.next();
    prototypeResponse.headers.set('x-nalie-security-mode', 'local-prototype');
    return prototypeResponse;
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const authenticated = !error && Boolean(data?.claims);

  if (portalRequest && !authenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (portalRequest && authenticated) {
    const { data: portalAllowed, error: portalAccessError } =
      await supabase.rpc('can_access_portal');
    if (portalAccessError || !portalAllowed) {
      return NextResponse.redirect(
        new URL('/login?reason=blocked', request.url),
      );
    }
    const { data: superAdmin } = await supabase.rpc('is_super_admin');
    if (!superAdmin) {
      const userId = String(data?.claims?.sub ?? '');
      const { data: memberships, error: membershipError } = await supabase
        .from('company_users')
        .select('access_level')
        .eq('profile_id', userId)
        .eq('status', 'ACTIVE');
      if (membershipError) {
        return NextResponse.redirect(
          new URL('/login?reason=blocked', request.url),
        );
      }
      const hasCompleteAccess = (memberships ?? []).some(
        (membership) => membership.access_level === 'COMPLETE',
      );
      const hasLimitedAccess = (memberships ?? []).some(
        (membership) => membership.access_level === 'LIMITED',
      );
      if (
        !hasCompleteAccess &&
        hasLimitedAccess &&
        !isLimitedRouteAllowed(request.nextUrl.pathname)
      ) {
        return NextResponse.redirect(
          new URL('/portal/analises?tab=conteudos', request.url),
        );
      }
    }
  }
  if (
    request.nextUrl.pathname === '/login' &&
    authenticated &&
    request.nextUrl.searchParams.get('reason') !== 'blocked'
  ) {
    return NextResponse.redirect(new URL('/portal', request.url));
  }
  return response;
}

export const config = {
  matcher: ['/portal/:path*', '/login'],
};
