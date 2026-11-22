import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./lib/auth-cookies";
import {
  devRoutesEnabled,
  isDevOnlyPath,
  panelHomePath,
} from "./lib/panel-routes";

const PUBLIC_PATHS = new Set(["/login", "/health"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const home = panelHomePath();
  const devRouteBlocked = !devRoutesEnabled() && isDevOnlyPath(pathname);
  const hasSession =
    Boolean(request.cookies.get(ACCESS_COOKIE)?.value) ||
    Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  if (PUBLIC_PATHS.has(pathname)) {
    if (hasSession) {
      return NextResponse.redirect(new URL(home, request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const login = new URL("/login", request.url);
    const next = `${pathname}${request.nextUrl.search}`;
    if (!devRouteBlocked && next && next !== home) {
      login.searchParams.set("next", next);
    }
    return NextResponse.redirect(login);
  }

  if (devRouteBlocked) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|logos/|health|backend(?:/|$)|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
