import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ADMIN_ONLY_PREFIXES = ["/logs", "/api/logs", "/masters", "/customers"];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const isAdminRoute = ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
    if (isAdminRoute && !req.nextauth.token?.isAdmin) {
      return NextResponse.redirect(new URL("/quotes", req.url));
    }
    return NextResponse.next();
  },
  { pages: { signIn: "/login" } }
);

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
