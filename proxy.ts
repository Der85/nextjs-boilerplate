import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 calls this file `proxy.ts` and requires the exported function to
// be named `proxy` (not `middleware`), or the build fails.
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/push/");

  // Redirect while carrying over any cookies Supabase set on `response`
  // (e.g. a refreshed session, or cleared cookies after signOut) — otherwise
  // the not-allowed path would loop, re-reading the stale session cookie.
  const redirectTo = (pathname: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // Defense-in-depth: only the allowed email may use the app.
  const allowedEmail = process.env.ALLOWED_EMAIL;
  if (user && allowedEmail && user.email !== allowedEmail) {
    await supabase.auth.signOut();
    return redirectTo("/login", "?error=not_allowed");
  }

  if (!user && !isPublic) {
    return redirectTo("/login");
  }

  // Already logged in and visiting an auth page → send to the dashboard.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return redirectTo("/dashboard");
  }

  return response;
}

export const config = {
  // Run on everything except static assets, the service worker, manifest,
  // icons and favicon.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)",
  ],
};
