// Applies pending drizzle migrations directly, one statement at a time,
// outside of a wrapping transaction.
//
// Why this exists instead of `drizzle-kit migrate`: drizzle-orm's built-in
// SQLite migrator wraps every migration in a single transaction. SQLite
// silently ignores `PRAGMA foreign_keys=OFF` when it's run inside a
// transaction, so any migration that recreates a table referenced by a
// foreign key elsewhere (e.g. changing a column to NOT NULL) fails with
// "FOREIGN KEY constraint failed" when it tries to drop the old table.
// Running each statement outside a transaction avoids that.
//
// This stays compatible with drizzle-kit's own migration tracking: it
// reads drizzle/meta/_journal.json for the list of migrations and uses the
// same sha256-of-file-contents hash drizzle-kit itself uses in the
// __drizzle_migrations table, so migrations already applied via
// `drizzle-kit migrate` are correctly recognized and skipped.

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = path.join(__dirname, "..");
const dbPath = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
const migrationsDir = path.join(projectRoot, "drizzle");

const db = new Database(path.resolve(projectRoot, dbPath));

db.exec(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL,
    created_at NUMERIC
  )
`);

const applied = new Set(
  db.prepare("SELECT hash FROM __drizzle_migrations").all().map((r) => r.hash)
);

const journal = JSON.parse(
  fs.readFileSync(path.join(migrationsDir, "meta", "_journal.json"), "utf8")
);

let appliedAny = false;

for (const entry of journal.entries) {
  const filePath = path.join(migrationsDir, `${entry.tag}.sql`);
  const sql = fs.readFileSync(filePath, "utf8");
  const hash = crypto.createHash("sha256").update(sql).digest("hex");

  if (applied.has(hash)) {
    console.log(`skip (already applied): ${entry.tag}`);
    continue;
  }

  console.log(`applying: ${entry.tag}`);
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    db.exec(statement);
  }

  db.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run(
    hash,
    Date.now()
  );
  console.log(`done: ${entry.tag}`);
  appliedAny = true;
}

console.log(appliedAny ? "all pending migrations applied." : "already up to date.");
