import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { assetCategories } from "@/db/schema";
import { requireUser, requireRole, isAuthFailure } from "@/lib/auth";

// Vehicle categories are read by anyone with access (needed to populate the
// dropdown on the asset form), but only admins can manage the list itself
// — see PATCH/DELETE in [id]/route.ts.
export async function GET() {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth;

  const categories = await db.select().from(assetCategories).orderBy(asc(assetCategories.name)).all();
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);
  if (isAuthFailure(auth)) return auth;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const defaultUsefulLifeYears = Number(body?.defaultUsefulLifeYears);

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!Number.isFinite(defaultUsefulLifeYears) || defaultUsefulLifeYears <= 0) {
    return NextResponse.json({ error: "Default useful life must be a positive number of years." }, { status: 400 });
  }

  let inserted;
  try {
    inserted = await db.insert(assetCategories).values({ name, defaultUsefulLifeYears }).returning().all();
  } catch {
    return NextResponse.json({ error: "A category with that name already exists." }, { status: 400 });
  }

  return NextResponse.json({ category: inserted[0] }, { status: 201 });
}
