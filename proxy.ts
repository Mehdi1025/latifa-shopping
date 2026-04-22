import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/login";
const VENDEUSE_HOME = "/vendeuse";

/** Routes accessibles sans session (hors assets exclus par le matcher). */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === LOGIN_PATH ||
    pathname === "/sw.js" ||
    pathname === "/manifest.json"
  );
}

function normalizeRole(role: string | null | undefined): "admin" | "vendeuse" {
  const r = role?.toLowerCase().trim();
  return r === "admin" ? "admin" : "vendeuse";
}

/**
 * Next.js 16 : le fichier attendu à la racine est `proxy.ts` (équivalent du middleware).
 * Ne pas ajouter `middleware.ts` en parallèle : le build échoue si les deux existent.
 *
 * Session : tout utilisateur authentifié peut ouvrir les pages du dashboard (/, /produits,
 * /import, /vendeuse, etc.). On ne force plus la redirection « vendeuse → caisse » sur les
 * routes hors /vendeuse : accès métier (import, stock, objectifs…) et contrôle d’accès
 * données côté Supabase (RLS).
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { pathname } = request.nextUrl;

  if (pathname === "/sw.js" || pathname === "/manifest.json") {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (!isPublicPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      if (!isPublicPath(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = LOGIN_PATH;
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = normalizeRole(
      (profile as { role?: string } | null)?.role ?? null
    );

    if (pathname === LOGIN_PATH) {
      const url = request.nextUrl.clone();
      url.pathname = role === "admin" ? "/" : VENDEUSE_HOME;
      url.searchParams.delete("next");
      return NextResponse.redirect(url);
    }
  } catch {
    if (!isPublicPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
