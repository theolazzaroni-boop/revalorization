import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isSupplier = user?.user_metadata?.role === "supplier";

  // Routes publiques : portail (login/register) et API portail et seed dev
  const isPublic =
    pathname.startsWith("/portal") ||
    pathname.startsWith("/api/portal") ||
    pathname.startsWith("/api/dev");

  // Fournisseur connecté qui tente d'accéder aux routes staff → portail
  if (isSupplier && !pathname.startsWith("/portal") && !pathname.startsWith("/api/portal")) {
    return NextResponse.redirect(new URL("/portal/dashboard", request.url));
  }

  // Rediriger vers /login si non authentifié (staff) et sur une route protégée
  if ((!user || isSupplier) && !pathname.startsWith("/login") && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Rediriger vers /dashboard si staff déjà authentifié et sur /login ou /portal/login
  if (user && !isSupplier && (pathname.startsWith("/login") || pathname === "/portal/login" || pathname.startsWith("/portal/register"))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Rediriger vers /portal/dashboard si fournisseur déjà authentifié et sur /portal/login
  if (user && isSupplier && (pathname === "/portal/login" || pathname.startsWith("/portal/register"))) {
    return NextResponse.redirect(new URL("/portal/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
