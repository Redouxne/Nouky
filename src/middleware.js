import { NextResponse } from "next/server";

export function middleware(request) {
  const userId = request.cookies.get("userId")?.value;
  const pathname = request.nextUrl.pathname;

  const publicRoutes = ["/landing", "/auth/signin", "/auth/signup"];
  const isPublicRoute = publicRoutes.includes(pathname);

  const protectedRoutes = ["/dashboard", "/api/case", "/api/chat", "/api/evaluate"];
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !userId) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  if (userId && (pathname === "/" || pathname === "/landing")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|Leoard.png|usericon.png).*)"],
};
