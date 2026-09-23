// Prints a valid, signed `connect.sid` cookie for a local test account, so
// you can paste it into the browser and exercise the SSO-gated pages
// without a real clockin-system running on your laptop to log in through.
//
// clockinSession.ts verifies this exact cookie-signature scheme
// (express-session's default): the cookie value is `s:<sid>.<hmac>`, where
// <hmac> is HMAC-SHA256(SESSION_SECRET) of <sid>, base64-encoded with
// trailing `=` padding stripped. The session itself is a row in the shared
// `sessions` table: sid -> a JSON blob shaped like express-session stores
// it (`{ "user": { "id": ... } }`), which is all getSessionUser() reads.
//
// Usage:
//   DATABASE_URL=file:./local-shared.db SESSION_SECRET=... node scripts/make-local-session.cjs [username]
//
// Defaults to "test.admin" (seeded by bootstrap-shared-db.cjs --seed-test-users).

const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const dbPath = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
const secret = process.env.SESSION_SECRET;
const username = process.argv[2] ?? "test.admin";

if (!secret) {
  console.error("SESSION_SECRET environment variable is required (must match your .env.local value).");
  process.exit(1);
}

const db = new Database(path.resolve(projectRoot, dbPath));

const user = db.prepare("SELECT id, name, surname, username FROM users WHERE username = ?").get(username);
if (!user) {
  console.error(`No user "${username}" found in ${dbPath}. Run bootstrap-shared-db.cjs --seed-test-users first.`);
  process.exit(1);
}

const sid = crypto.randomBytes(24).toString("hex");
const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(); // 7 days
const sess = JSON.stringify({ user: { id: user.id } });

db.prepare("INSERT OR REPLACE INTO sessions (sid, sess, expires_at) VALUES (?, ?, ?)").run(sid, sess, expiresAt);

const signature = crypto.createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/, "");
const cookieValue = `s:${sid}.${signature}`;

console.log(`Session created for ${user.name} ${user.surname} (${user.username}), expires ${expiresAt}\n`);
console.log("Paste this in the browser console on your local asset-register tab:\n");
console.log(`  document.cookie = "connect.sid=${encodeURIComponent(cookieValue)}; path=/";\n`);
console.log("...then reload the page.");
