// One-time setup for pointing asset-register at the shared clockin-system
// database, instead of `npm run db:generate` + `db:migrate`.
//
// Why not the normal migration path: a drizzle migration history that
// tried to also create `users`/`sessions` would fail (or half-apply)
// against the real clockin.db, which already owns those tables in its own
// shape. This script instead creates only what asset-register actually
// needs — two new columns on the existing `users` table, and this app's
// own tables, all as `IF NOT EXISTS`/guarded operations — then marks
// today's migration history as already applied so `db:generate` +
// `db:migrate` work normally for anything added *after* this point.
//
// Usage:
//   DATABASE_URL=file:./local-shared.db node scripts/bootstrap-shared-db.cjs [--seed-test-users]
//
// --seed-test-users is for local development only: it also creates a
// clockin-shaped `users`/`sessions` table (if missing) and a couple of
// fake accounts, so this script can stand in for a copy of the real
// clockin.db when testing on a machine that doesn't have one. Never pass
// it against the real server — clockin-system already owns those tables
// there.

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = path.join(__dirname, "..");
const dbPath = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
const seedTestUsers = process.argv.includes("--seed-test-users");

const db = new Database(path.resolve(projectRoot, dbPath));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function tableExists(name) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(name);
}

function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

// --- 1. clockin-shaped users/sessions, only if genuinely missing (real
// server already has these; local dev needs a stand-in for testing). ---
if (seedTestUsers && !tableExists("users")) {
  console.log("creating local stand-in users table (clockin-system shape)...");
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      surname TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
  `);
}
if (seedTestUsers && !tableExists("sessions")) {
  console.log("creating local stand-in sessions table (clockin-system shape)...");
  db.exec(`
    CREATE TABLE sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
}

if (!tableExists("users")) {
  console.error(
    "No `users` table found. This script only adds asset-register columns to an existing clockin-system " +
      "database — point DATABASE_URL at that database, or pass --seed-test-users for local testing."
  );
  process.exit(1);
}

// --- 2. Asset-register-only columns on the shared users table (additive,
// safe to run against the real clockin.db). ---
if (!columnExists("users", "access_asset_register")) {
  console.log("adding users.access_asset_register...");
  db.exec("ALTER TABLE users ADD COLUMN access_asset_register INTEGER NOT NULL DEFAULT 0");
}
if (!columnExists("users", "asset_register_role")) {
  console.log("adding users.asset_register_role...");
  db.exec("ALTER TABLE users ADD COLUMN asset_register_role TEXT");
}

// --- 3. Asset register's own tables (final shape, matches src/db/schema.ts). ---
console.log("creating asset-register tables (if not already present)...");
db.exec(`
  CREATE TABLE IF NOT EXISTS asset_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    default_useful_life_years REAL NOT NULL,
    created_at TEXT DEFAULT (current_timestamp) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS insurance_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (current_timestamp) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    invoice_number TEXT,
    vin_number TEXT,
    registration TEXT,
    status TEXT DEFAULT 'active' NOT NULL,
    purchase_date TEXT NOT NULL,
    disposal_date TEXT,
    cost REAL NOT NULL,
    useful_life_years REAL NOT NULL,
    category_id INTEGER REFERENCES asset_categories(id) ON DELETE SET NULL,
    insurance_reference TEXT,
    insurance_type_id INTEGER REFERENCES insurance_types(id) ON DELETE SET NULL,
    comments TEXT,
    created_by_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (current_timestamp) NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS asset_cost_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    occurred_at TEXT NOT NULL,
    note TEXT,
    recorded_by_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (current_timestamp) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    currency TEXT DEFAULT 'R' NOT NULL,
    fiscal_year_start_month INTEGER DEFAULT 3 NOT NULL,
    fiscal_year_start_day INTEGER DEFAULT 1 NOT NULL
  );
`);

// --- 4. Mark today's migration history as already applied, so future
// `db:generate` + `db:migrate` runs only apply new, post-merge changes. ---
db.exec(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL,
    created_at NUMERIC
  )
`);
const alreadyMarked = new Set(db.prepare("SELECT hash FROM __drizzle_migrations").all().map((r) => r.hash));
const journalPath = path.join(projectRoot, "drizzle", "meta", "_journal.json");
if (fs.existsSync(journalPath)) {
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  for (const entry of journal.entries) {
    const sql = fs.readFileSync(path.join(projectRoot, "drizzle", `${entry.tag}.sql`), "utf8");
    const hash = crypto.createHash("sha256").update(sql).digest("hex");
    if (!alreadyMarked.has(hash)) {
      db.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run(hash, Date.now());
      console.log(`marked as applied (superseded by this bootstrap): ${entry.tag}`);
    }
  }
}

// --- 5. Local-only fake test accounts, for exercising the SSO flow without
// real clockin data. ---
if (seedTestUsers) {
  const bcrypt = (() => {
    try {
      return require("bcrypt");
    } catch {
      return null;
    }
  })();
  const scrypt = require("crypto");
  function fakeHash(password) {
    // A real deploy never runs this branch — clockin-system owns real
    // password hashes there. This is only so the local stand-in `users`
    // table has *something* in password_hash; asset-register never reads
    // or checks it.
    if (bcrypt) return bcrypt.hashSync(password, 10);
    return "not-a-real-hash:" + scrypt.createHash("sha256").update(password).digest("hex");
  }

  const seedAccounts = [
    { name: "Test", surname: "Admin", username: "test.admin", email: "test.admin@example.local", role: "admin" },
    { name: "Test", surname: "Clerk", username: "test.clerk", email: "test.clerk@example.local", role: "clerk" },
  ];
  const insert = db.prepare(`
    INSERT INTO users (name, surname, username, password_hash, email, active, access_asset_register, asset_register_role)
    VALUES (@name, @surname, @username, @passwordHash, @email, 1, 1, @role)
    ON CONFLICT(username) DO UPDATE SET access_asset_register = 1, asset_register_role = excluded.asset_register_role
  `);
  for (const acc of seedAccounts) {
    insert.run({ ...acc, passwordHash: fakeHash("local-test-only") });
    console.log(`seeded local test account: ${acc.username} (${acc.role})`);
  }
}

console.log("bootstrap complete.");
