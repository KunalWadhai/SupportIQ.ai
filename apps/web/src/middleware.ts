import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't need authentication
const PUBLIC_PATHS = [
  "/login",
  "/widget",       // embeddable widget pages are public
  "/api/widget",   // widget config API is public
  "/_next",
  "/favicon.ico",
  "/widget.js",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // For dashboard routes: check for the presence of a token cookie
  // (We store JWT in localStorage client-side, so server-side we use a
  //  session cookie set on login — or fall back to client-side redirect
  //  handled by the AuthProvider).
  const token = request.cookies.get("supportiq_token")?.value;

  if (!token && !pathname.startsWith("/api/")) {
    // Redirect unauthenticated users to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
