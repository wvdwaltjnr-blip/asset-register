import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, assetCostAdjustments } from "@/db/schema";
import { requireRole, isAuthFailure } from "@/lib/auth";

// Records an addition (cost-basis increase, e.g. a fitted upgrade) or a
// disposal (partial write-down) against an asset. A full disposal is a
// status change on the asset itself (PATCH /api/assets/[id]), not a row
// here — see src/lib/depreciation.ts for how these feed the schedule.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/assets/[id]/adjustments">) {
  const auth = await requireRole(["admin", "clerk"]);
  if (isAuthFailure(auth)) return auth;

  const { id } = await ctx.params;
  const assetId = Number(id);
  const asset = await db.select().from(assets).where(eq(assets.id, assetId)).get();
  if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const type = body?.type;
  const amount = Number(body?.amount);
  const occurredAt = body?.occurredAt;

  if (!["addition", "disposal"].includes(type)) {
    return NextResponse.json({ error: "type must be 'addition' or 'disposal'." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number." }, { status: 400 });
  }
  if (typeof occurredAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(occurredAt)) {
    return NextResponse.json({ error: "occurredAt must be YYYY-MM-DD." }, { status: 400 });
  }

  const inserted = await db
    .insert(assetCostAdjustments)
    .values({
      assetId,
      type,
      amount,
      occurredAt,
      note: typeof body?.note === "string" ? body.note.trim() || null : null,
      recordedById: auth.id,
    })
    .returning()
    .all();

  return NextResponse.json({ adjustment: inserted[0] }, { status: 201 });
}
