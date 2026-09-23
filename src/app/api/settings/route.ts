import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireUser, requireRole, isAuthFailure } from "@/lib/auth";

async function getOrCreateSettings() {
  const row = await db.select().from(settings).limit(1).get();
  if (row) return row;
  const inserted = await db.insert(settings).values({}).returning().all();
  return inserted[0];
}

export async function GET() {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth;

  const row = await getOrCreateSettings();
  return NextResponse.json({ settings: row });
}

export async function PATCH(request: Request) {
  const auth = await requireRole(["admin"]);
  if (isAuthFailure(auth)) return auth;

  const row = await getOrCreateSettings();
  const body = await request.json().catch(() => null);

  const updates: Partial<typeof settings.$inferInsert> = {};
  if (typeof body?.currency === "string" && body.currency.trim()) {
    updates.currency = body.currency.trim();
  }
  if (body?.fiscalYearStartMonth !== undefined) {
    const val = Number(body.fiscalYearStartMonth);
    if (!Number.isInteger(val) || val < 1 || val > 12) {
      return NextResponse.json({ error: "fiscalYearStartMonth must be 1-12." }, { status: 400 });
    }
    updates.fiscalYearStartMonth = val;
  }
  if (body?.fiscalYearStartDay !== undefined) {
    const val = Number(body.fiscalYearStartDay);
    if (!Number.isInteger(val) || val < 1 || val > 31) {
      return NextResponse.json({ error: "fiscalYearStartDay must be 1-31." }, { status: 400 });
    }
    updates.fiscalYearStartDay = val;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await db.update(settings).set(updates).where(eq(settings.id, row.id)).returning().all();
  return NextResponse.json({ settings: updated[0] });
}
