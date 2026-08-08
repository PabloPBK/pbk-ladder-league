import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value }) => {
              request.cookies.set(name, value);
            },
          );

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options,
              );
            },
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const protectedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/walking") ||
    pathname.startsWith("/setup");

  if (protectedRoute && !user) {
    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname = "/login";

    loginUrl.searchParams.set(
      "next",
      pathname,
    );

    return NextResponse.redirect(
      loginUrl,
    );
  }

  /*
   * If someone is already logged in and
   * visits /login, send them to Admin.
   */
  if (
    pathname === "/login" &&
    user
  ) {
    const adminUrl =
      request.nextUrl.clone();

    adminUrl.pathname = "/admin";
    adminUrl.search = "";

    return NextResponse.redirect(
      adminUrl,
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run Proxy on application routes,
     * but skip static files and images.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};