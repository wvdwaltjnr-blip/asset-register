import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
// `users` lives on the shared clockin-system database and is imported from
// "@/db/shared" rather than declared or re-exported here — drizzle-kit's
// migration generation scans every exported table in this file, and this
// must never be part of that (it's owned by the clockin-system Express
// app). See "@/db/shared" for details.
import { users } from "./shared";

// A vehicle category (e.g. "Truck", "Trailer", "Bakkie") — managed from
// Settings. defaultUsefulLifeYears prefills an asset's own usefulLifeYears
// when its category is set/changed (see the category select on the asset
// detail page and the "Add asset" form); it's a default to copy at that
// moment, not a live join, so changing a category's years later doesn't
// retroactively alter any asset's already-computed depreciation schedule.
export const assetCategories = sqliteTable("asset_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  defaultUsefulLifeYears: real("default_useful_life_years").notNull(),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// Insurance types (e.g. "Comp", "3rd Party", "TPFT") — managed from
// Settings, same way as assetCategories, instead of a fixed enum.
export const insuranceTypes = sqliteTable("insurance_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// One physical asset (vehicle, trailer, or otherwise). `cost` is the
// original acquisition cost — the basis straight-line depreciation is
// calculated from, together with any additions/disposals recorded in
// assetCostAdjustments below. See src/lib/depreciation.ts for how the full
// year-by-year schedule (opening/closing balance, depreciation, accumulated
// depreciation, carrying value) is derived from these on read — there's no
// stored per-year column, unlike the spreadsheet this replaces.
export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(),
  invoiceNumber: text("invoice_number"),
  vinNumber: text("vin_number"),
  registration: text("registration"),
  status: text("status", { enum: ["active", "sold", "written_off"] }).notNull().default("active"),
  purchaseDate: text("purchase_date").notNull(), // YYYY-MM-DD
  // Set when status moves to 'sold'/'written_off' — the fiscal year this
  // falls in is the last one depreciation accrues for (see
  // src/lib/depreciation.ts). Null while status is 'active'.
  disposalDate: text("disposal_date"),
  cost: real("cost").notNull(),
  usefulLifeYears: real("useful_life_years").notNull(),
  categoryId: integer("category_id").references(() => assetCategories.id, { onDelete: "set null" }),
  insuranceReference: text("insurance_reference"),
  insuranceTypeId: integer("insurance_type_id").references(() => insuranceTypes.id, { onDelete: "set null" }),
  comments: text("comments"),
  createdById: integer("created_by_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at"),
});

// Append-only ledger of value changes to an asset after acquisition — an
// improvement/upgrade that increases its cost basis, or a partial
// write-down. quantity is always a positive magnitude; direction is implied
// by type. A full disposal is a status change on the asset itself (see
// assets.status), not a row here.
export const assetCostAdjustments = sqliteTable("asset_cost_adjustments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetId: integer("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["addition", "disposal"] }).notNull(),
  amount: real("amount").notNull(),
  occurredAt: text("occurred_at").notNull(), // YYYY-MM-DD
  note: text("note"),
  recordedById: integer("recorded_by_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  currency: text("currency").notNull().default("R"),
  // Fiscal year runs fiscalYearStartMonth/Day through the day before that
  // date the following year — default 1 March, matching the SA tax year
  // ("Year Start"/"Year End" in the source spreadsheet).
  fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(3),
  fiscalYearStartDay: integer("fiscal_year_start_day").notNull().default(1),
});
