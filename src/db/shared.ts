import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

// These tables are owned and migrated by the clockin-system Express app on
// the shared database — asset-register only reads accounts and sessions it
// doesn't manage itself, plus two asset-register-only columns on `users`
// (accessAssetRegister, assetRegisterRole) that were added on top of
// clockin's schema. Never run drizzle-kit migrations against these — they're
// excluded from drizzle.config.ts's schema path on purpose.
//
// Unlike petty-cash-tracker and uniform-tracker, this app has no branch
// dimension — the source register it replaces has no per-branch column —
// so `branches` isn't imported here.
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  surname: text("surname").notNull(),
  username: text("username").notNull(),
  email: text("email").notNull(),
  active: integer("active", { mode: "boolean" }).notNull(),
  accessAssetRegister: integer("access_asset_register", { mode: "boolean" }).notNull().default(false),
  assetRegisterRole: text("asset_register_role", { enum: ["admin", "clerk", "viewer"] }),
});

export const sessions = sqliteTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: text("sess").notNull(),
  expiresAt: text("expires_at").notNull(),
});
