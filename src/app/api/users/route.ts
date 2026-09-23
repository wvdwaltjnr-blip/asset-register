import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/shared";
import { requireRole, isAuthFailure } from "@/lib/auth";
import { fullName } from "@/lib/clockinSession";

// Accounts themselves (name/email/password/active) belong to clockin-system
// — this only lists them alongside the asset-register-specific access
// grant, so an admin can turn access on/off and assign a role without
// leaving this app. See PATCH /api/users/[id] for the write side.
export async function GET() {
  const auth = await requireRole(["admin"]);
  if (isAuthFailure(auth)) return auth;

  const all = await db
    .select({
      id: users.id,
      name: users.name,
      surname: users.surname,
      email: users.email,
      active: users.active,
      accessAssetRegister: users.accessAssetRegister,
      role: users.assetRegisterRole,
    })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name))
    .all();

  const withNames = all.map(({ surname, ...u }) => ({
    ...u,
    name: fullName({ name: u.name, surname }),
  }));

  return NextResponse.json({ users: withNames });
}
