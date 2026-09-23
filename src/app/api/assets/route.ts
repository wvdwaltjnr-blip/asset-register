import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, assetCategories } from "@/db/schema";
import { requireUser, requireRole, isAuthFailure } from "@/lib/auth";
import { listAssetsWithFigures } from "@/lib/assets";

export async function GET() {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth;

  const withFigures = await listAssetsWithFigures();
  return NextResponse.json({ assets: withFigures });
}

export async function POST(request: Request) {
  const auth = await requireRole(["admin", "clerk"]);
  if (isAuthFailure(auth)) return auth;

  const body = await request.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const purchaseDate = typeof body?.purchaseDate === "string" ? body.purchaseDate : "";
  const cost = Number(body?.cost);

  if (!description) return NextResponse.json({ error: "Description is required." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
    return NextResponse.json({ error: "Purchase date must be YYYY-MM-DD." }, { status: 400 });
  }
  if (!Number.isFinite(cost) || cost <= 0) {
    return NextResponse.json({ error: "Cost must be a positive number." }, { status: 400 });
  }
  // Useful life is never taken from the request directly — it's fixed by
  // the chosen category's current default (see Settings > Vehicle
  // Categories), so a category is required for every new asset.
  const categoryId = Number(body?.categoryId);
  if (!Number.isFinite(categoryId) || !categoryId) {
    return NextResponse.json({ error: "A category is required." }, { status: 400 });
  }
  const category = await db.select().from(assetCategories).where(eq(assetCategories.id, categoryId)).get();
  if (!category) return NextResponse.json({ error: "Category not found." }, { status: 400 });

  const inserted = await db
    .insert(assets)
    .values({
      description,
      invoiceNumber: typeof body?.invoiceNumber === "string" ? body.invoiceNumber.trim() || null : null,
      vinNumber: typeof body?.vinNumber === "string" ? body.vinNumber.trim() || null : null,
      registration: typeof body?.registration === "string" ? body.registration.trim() || null : null,
      purchaseDate,
      cost,
      usefulLifeYears: category.defaultUsefulLifeYears,
      categoryId: category.id,
      insuranceReference: typeof body?.insuranceReference === "string" ? body.insuranceReference.trim() || null : null,
      insuranceTypeId: Number.isFinite(Number(body?.insuranceTypeId)) && body?.insuranceTypeId ? Number(body.insuranceTypeId) : null,
      comments: typeof body?.comments === "string" ? body.comments.trim() || null : null,
      createdById: auth.id,
    })
    .returning()
    .all();

  return NextResponse.json({ asset: inserted[0] }, { status: 201 });
}
