import { NextResponse } from "next/server";

export function proxy(request) {
  const userId = request.cookies.get("userId")?.value;
  const pathname = request.nextUrl.pathname;

  const protectedRoutes = ["/dashboard"];
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
  matcher: ["/", "/landing", "/dashboard/:path*"],
};
