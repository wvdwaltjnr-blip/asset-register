import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assetCategories } from "@/db/schema";
import { requireRole, isAuthFailure } from "@/lib/auth";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/categories/[id]">) {
  const auth = await requireRole(["admin"]);
  if (isAuthFailure(auth)) return auth;

  const { id } = await ctx.params;
  const categoryId = Number(id);
  const existing = await db.select().from(assetCategories).where(eq(assetCategories.id, categoryId)).get();
  if (!existing) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const updates: Partial<typeof assetCategories.$inferInsert> = {};

  if (typeof body?.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (body?.defaultUsefulLifeYears !== undefined) {
    const val = Number(body.defaultUsefulLifeYears);
    if (!Number.isFinite(val) || val <= 0) {
      return NextResponse.json({ error: "Default useful life must be a positive number of years." }, { status: 400 });
    }
    updates.defaultUsefulLifeYears = val;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  let updated;
  try {
    updated = await db.update(assetCategories).set(updates).where(eq(assetCategories.id, categoryId)).returning().all();
  } catch {
    return NextResponse.json({ error: "A category with that name already exists." }, { status: 400 });
  }

  return NextResponse.json({ category: updated[0] });
}

// Deleting a category just clears categoryId on any asset that had it
// (ON DELETE SET NULL) — it never touches usefulLifeYears, which each
// asset already has its own copy of.
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/categories/[id]">) {
  const auth = await requireRole(["admin"]);
  if (isAuthFailure(auth)) return auth;

  const { id } = await ctx.params;
  const categoryId = Number(id);
  const existing = await db.select().from(assetCategories).where(eq(assetCategories.id, categoryId)).get();
  if (!existing) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  await db.delete(assetCategories).where(eq(assetCategories.id, categoryId)).run();
  return NextResponse.json({ ok: true });
}
