import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Fast, cookie-presence-only redirect for UX — NOT the real security
// boundary. The actual enforcement (a valid, unexpired session belonging to
// an active user with asset-register access, plus role checks) happens
// server-side in requireUser()/requireRole() inside every Route Handler,
// and in the root layout for page loads. Avoiding a DB read here also keeps
// this cheap to run on every request. Sign-in is clockin-system's, at
// `/login` outside this app's basePath — this app has no login page of its
// own.
const SESSION_COOKIE = "connect.sid";

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next internals, and any static asset (public/ files —
  // logo, icons, etc.) identified by a file extension in the last segment.
  matcher: ["/((?!api|_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
