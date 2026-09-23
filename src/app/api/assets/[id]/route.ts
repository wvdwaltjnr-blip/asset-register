import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, assetCategories } from "@/db/schema";
import { requireUser, requireRole, isAuthFailure } from "@/lib/auth";
import { getAssetWithSchedule } from "@/lib/assets";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/assets/[id]">) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth;

  const { id } = await ctx.params;
  const result = await getAssetWithSchedule(Number(id));
  if (!result) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/assets/[id]">) {
  const auth = await requireRole(["admin", "clerk"]);
  if (isAuthFailure(auth)) return auth;

  const { id } = await ctx.params;
  const assetId = Number(id);
  const existing = await db.select().from(assets).where(eq(assets.id, assetId)).get();
  if (!existing) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const updates: Partial<typeof assets.$inferInsert> = {};

  if (typeof body?.description === "string" && body.description.trim()) {
    updates.description = body.description.trim();
  }
  if ("invoiceNumber" in (body ?? {})) {
    updates.invoiceNumber = typeof body.invoiceNumber === "string" ? body.invoiceNumber.trim() || null : null;
  }
  if ("vinNumber" in (body ?? {})) {
    updates.vinNumber = typeof body.vinNumber === "string" ? body.vinNumber.trim() || null : null;
  }
  if ("registration" in (body ?? {})) {
    updates.registration = typeof body.registration === "string" ? body.registration.trim() || null : null;
  }
  if ("comments" in (body ?? {})) {
    updates.comments = typeof body.comments === "string" ? body.comments.trim() || null : null;
  }
  if ("insuranceReference" in (body ?? {})) {
    updates.insuranceReference = typeof body.insuranceReference === "string" ? body.insuranceReference.trim() || null : null;
  }
  if ("insuranceTypeId" in (body ?? {})) {
    updates.insuranceTypeId = body.insuranceTypeId ? Number(body.insuranceTypeId) : null;
  }
  if (typeof body?.purchaseDate === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.purchaseDate)) {
      return NextResponse.json({ error: "Purchase date must be YYYY-MM-DD." }, { status: 400 });
    }
    updates.purchaseDate = body.purchaseDate;
  }
  if (body?.cost !== undefined) {
    const val = Number(body.cost);
    if (!Number.isFinite(val) || val <= 0) {
      return NextResponse.json({ error: "Cost must be a positive number." }, { status: 400 });
    }
    updates.cost = val;
  }
  // Useful life is never accepted directly — it's fixed by category (see
  // Settings > Vehicle Categories). Changing categoryId copies that
  // category's current default in; clearing categoryId leaves the asset's
  // existing useful life untouched (it still needs a valid value for
  // depreciation, so there's nothing sensible to fall back to).
  if ("categoryId" in (body ?? {})) {
    if (body.categoryId) {
      const category = await db.select().from(assetCategories).where(eq(assetCategories.id, Number(body.categoryId))).get();
      if (!category) return NextResponse.json({ error: "Category not found." }, { status: 400 });
      updates.categoryId = category.id;
      updates.usefulLifeYears = category.defaultUsefulLifeYears;
    } else {
      updates.categoryId = null;
    }
  }
  if (typeof body?.status === "string") {
    if (!["active", "sold", "written_off"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    updates.status = body.status;
    if (body.status === "active") {
      updates.disposalDate = null;
    } else {
      const disposalDate = typeof body.disposalDate === "string" ? body.disposalDate : null;
      if (!disposalDate || !/^\d{4}-\d{2}-\d{2}$/.test(disposalDate)) {
        return NextResponse.json(
          { error: "disposalDate (YYYY-MM-DD) is required when marking an asset sold or written off." },
          { status: 400 }
        );
      }
      updates.disposalDate = disposalDate;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  updates.updatedAt = new Date().toISOString();

  const updated = await db.update(assets).set(updates).where(eq(assets.id, assetId)).returning().all();
  return NextResponse.json({ asset: updated[0] });
}
