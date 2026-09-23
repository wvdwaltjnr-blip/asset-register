import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { insuranceTypes } from "@/db/schema";
import { requireRole, isAuthFailure } from "@/lib/auth";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/insurance-types/[id]">) {
  const auth = await requireRole(["admin"]);
  if (isAuthFailure(auth)) return auth;

  const { id } = await ctx.params;
  const typeId = Number(id);
  const existing = await db.select().from(insuranceTypes).where(eq(insuranceTypes.id, typeId)).get();
  if (!existing) return NextResponse.json({ error: "Insurance type not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  let updated;
  try {
    updated = await db.update(insuranceTypes).set({ name }).where(eq(insuranceTypes.id, typeId)).returning().all();
  } catch {
    return NextResponse.json({ error: "An insurance type with that name already exists." }, { status: 400 });
  }

  return NextResponse.json({ insuranceType: updated[0] });
}

// Deleting a type just clears insuranceTypeId on any asset that had it
// (ON DELETE SET NULL).
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/insurance-types/[id]">) {
  const auth = await requireRole(["admin"]);
  if (isAuthFailure(auth)) return auth;

  const { id } = await ctx.params;
  const typeId = Number(id);
  const existing = await db.select().from(insuranceTypes).where(eq(insuranceTypes.id, typeId)).get();
  if (!existing) return NextResponse.json({ error: "Insurance type not found." }, { status: 404 });

  await db.delete(insuranceTypes).where(eq(insuranceTypes.id, typeId)).run();
  return NextResponse.json({ ok: true });
}
