import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions } from "@/db/shared";

// LOCAL DEV ONLY. Sets a valid, signed `connect.sid` cookie for a seeded
// test account (from `bootstrap-shared-db.cjs --seed-test-users`), then
// redirects to the register. There is no real login page in this app (see
// src/proxy.ts) — sign-in belongs to clockin-system — so visiting a page
// here with no session cookie bounces to `/login`, which doesn't exist
// either, and (locally, with no nginx/basePath to route it elsewhere)
// bounces right back, forever. Hitting this route once first avoids that:
// it's a plain HTTP response, not a page render, so it can set the cookie
// and redirect before the browser ever hits that loop.
//
// Usage: http://localhost:PORT/api/dev-login?user=test.admin
// (also seeded: test.clerk)

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 404 });
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SESSION_SECRET is not set." }, { status: 500 });
  }

  const { searchParams, origin } = new URL(request.url);
  const username = searchParams.get("user") ?? "test.admin";

  const user = await db.select().from(users).where(eq(users.username, username)).get();
  if (!user) {
    return NextResponse.json(
      { error: `No user "${username}" found. Run bootstrap-shared-db.cjs --seed-test-users first.` },
      { status: 404 }
    );
  }

  const sid = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  await db.insert(sessions).values({ sid, sess: JSON.stringify({ user: { id: user.id } }), expiresAt }).run();

  const signature = createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/, "");
  const cookieValue = `s:${sid}.${signature}`;

  const res = NextResponse.redirect(new URL("/", origin));
  res.cookies.set("connect.sid", cookieValue, { path: "/", httpOnly: true, sameSite: "lax" });
  return res;
}
