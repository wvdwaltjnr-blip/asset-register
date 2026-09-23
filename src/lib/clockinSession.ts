import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions } from "@/db/shared";

// Single sign-on with clockin-system: it issues a `connect.sid` cookie via
// express-session, signed with the `cookie-signature` scheme (HMAC-SHA256,
// base64, padding stripped). We verify the same cookie here instead of
// running our own login, so anyone already signed into the main site is
// automatically recognized here too.
const COOKIE_NAME = "connect.sid";

function signValue(value: string, secret: string): string {
  return value + "." + createHmac("sha256", secret).update(value).digest("base64").replace(/=+$/, "");
}

function unsignValue(signed: string, secret: string): string | null {
  const value = signed.slice(0, signed.lastIndexOf("."));
  const expected = signValue(value, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signed);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

function decodeSid(rawCookieValue: string, secret: string): string | null {
  let value: string;
  try {
    value = decodeURIComponent(rawCookieValue);
  } catch {
    return null;
  }
  if (!value.startsWith("s:")) return null;
  return unsignValue(value.slice(2), secret);
}

export function fullName(user: { name: string; surname: string }): string {
  return `${user.name} ${user.surname}`.trim();
}

export type ClockinUser = {
  id: number;
  name: string;
  surname: string;
  username: string;
  email: string;
  active: boolean;
  accessAssetRegister: boolean;
  assetRegisterRole: "admin" | "clerk" | "viewer" | null;
};

/** The raw, ungated session lookup — callers decide what to do about access. */
export async function getSessionUser(): Promise<ClockinUser | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is required.");
  }

  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const sid = decodeSid(raw, secret);
  if (!sid) return null;

  const row = await db.select().from(sessions).where(eq(sessions.sid, sid)).get();
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) return null;

  let parsed: { user?: { id?: number } };
  try {
    parsed = JSON.parse(row.sess);
  } catch {
    return null;
  }
  const userId = parsed.user?.id;
  if (!userId) return null;

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || !user.active) return null;

  return user;
}
