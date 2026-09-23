import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, assetCostAdjustments, settings } from "@/db/schema";
import { getCurrentYearFigures, getFullSchedule, type FiscalYearConfig } from "@/lib/depreciation";

export async function getFiscalYearConfig(): Promise<FiscalYearConfig> {
  const row = await db.select().from(settings).limit(1).get();
  return {
    startMonth: row?.fiscalYearStartMonth ?? 3,
    startDay: row?.fiscalYearStartDay ?? 1,
  };
}

export async function listAssetsWithFigures() {
  const cfg = await getFiscalYearConfig();
  const allAssets = await db.select().from(assets).all();
  const allAdjustments = await db.select().from(assetCostAdjustments).all();

  const adjustmentsByAsset = new Map<number, typeof allAdjustments>();
  for (const adj of allAdjustments) {
    if (!adjustmentsByAsset.has(adj.assetId)) adjustmentsByAsset.set(adj.assetId, []);
    adjustmentsByAsset.get(adj.assetId)!.push(adj);
  }

  return allAssets.map((asset) => {
    const adjustments = adjustmentsByAsset.get(asset.id) ?? [];
    const figures = getCurrentYearFigures(asset, adjustments, cfg);
    return { ...asset, figures };
  });
}

export async function getAssetWithSchedule(assetId: number) {
  const cfg = await getFiscalYearConfig();
  const asset = await db.select().from(assets).where(eq(assets.id, assetId)).get();
  if (!asset) return null;

  const adjustments = await db
    .select()
    .from(assetCostAdjustments)
    .where(eq(assetCostAdjustments.assetId, assetId))
    .all();

  const schedule = getFullSchedule(asset, adjustments, undefined, cfg);
  return { asset, adjustments, schedule };
}
