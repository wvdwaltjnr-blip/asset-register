import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/shared";
import { requireRole, isAuthFailure } from "@/lib/auth";

async function activeAdminCount(excludingId?: number) {
  const conditions = [eq(users.assetRegisterRole, "admin"), eq(users.accessAssetRegister, true), eq(users.active, true)];
  if (excludingId) conditions.push(ne(users.id, excludingId));
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(...conditions))
    .get();
  return row?.count ?? 0;
}

// Grants or revokes asset-register access and sets the role for an existing
// clockin-system account. Name/email/password/active are owned by
// clockin-system and aren't editable from here.
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  const auth = await requireRole(["admin"]);
  if (isAuthFailure(auth)) return auth;

  const { id } = await ctx.params;
  const userId = Number(id);
  const body = await request.json().catch(() => null);

  const target = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const updates: Partial<typeof users.$inferInsert> = {};

  if (typeof body?.accessAssetRegister === "boolean") {
    if (
      target.accessAssetRegister &&
      target.assetRegisterRole === "admin" &&
      body.accessAssetRegister === false &&
      (await activeAdminCount(userId)) === 0
    ) {
      return NextResponse.json(
        { error: "There must be at least one Asset Register Admin — promote someone else first." },
        { status: 400 }
      );
    }
    updates.accessAssetRegister = body.accessAssetRegister;
    if (body.accessAssetRegister === false) updates.assetRegisterRole = null;
  }

  if (typeof body?.role === "string") {
    if (!["admin", "clerk", "viewer"].includes(body.role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }
    if (
      target.accessAssetRegister &&
      target.assetRegisterRole === "admin" &&
      body.role !== "admin" &&
      (await activeAdminCount(userId)) === 0
    ) {
      return NextResponse.json(
        { error: "There must be at least one Asset Register Admin — promote someone else first." },
        { status: 400 }
      );
    }
    updates.assetRegisterRole = body.role;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await db.update(users).set(updates).where(eq(users.id, userId)).returning().all();
  return NextResponse.json({ user: updated[0] });
}
