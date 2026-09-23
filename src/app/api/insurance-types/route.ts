import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { insuranceTypes } from "@/db/schema";
import { requireUser, requireRole, isAuthFailure } from "@/lib/auth";

// Insurance types are read by anyone with access (needed to populate the
// dropdown on the asset form), but only admins can manage the list itself
// — see PATCH/DELETE in [id]/route.ts.
export async function GET() {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth;

  const types = await db.select().from(insuranceTypes).orderBy(asc(insuranceTypes.name)).all();
  return NextResponse.json({ insuranceTypes: types });
}

export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);
  if (isAuthFailure(auth)) return auth;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  let inserted;
  try {
    inserted = await db.insert(insuranceTypes).values({ name }).returning().all();
  } catch {
    return NextResponse.json({ error: "An insurance type with that name already exists." }, { status: 400 });
  }

  return NextResponse.json({ insuranceType: inserted[0] }, { status: 201 });
}
