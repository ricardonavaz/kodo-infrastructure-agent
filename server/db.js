import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { readdirSync, copyFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'kodo.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migration system
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT DEFAULT (datetime('now'))
  );
`);

// Auto-backup before applying new migrations
function backupDatabase() {
  const dbPath = join(__dirname, 'kodo.db');
  if (!existsSync(dbPath)) return;

  const backupDir = join(__dirname, 'backups');
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = join(backupDir, `kodo-${timestamp}.db`);

  try {
    // Checkpoint WAL before backup to ensure consistency
    db.pragma('wal_checkpoint(TRUNCATE)');
    copyFileSync(dbPath, backupPath);
    console.log(`  Backup created: ${basename(backupPath)}`);

    // Keep only last 5 backups
    const backups = readdirSync(backupDir)
      .filter((f) => f.startsWith('kodo-') && f.endsWith('.db'))
      .sort()
      .reverse();
    for (const old of backups.slice(5)) {
      try { unlinkSync(join(backupDir, old)); } catch { /* ignore */ }
    }
  } catch (e) {
    console.warn('  Backup warning:', e.message);
  }
}

// Migrations are loaded and applied synchronously at startup
// Each migration file exports an `up(db)` function
async function runMigrations() {
  const migrationsDir = join(__dirname, 'migrations');
  let files;
  try {
    files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.js'))
      .sort();
  } catch {
    return;
  }

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version)
  );

  const pending = files.filter((f) => {
    const v = parseInt(f.split('_')[0], 10);
    return !isNaN(v) && !applied.has(v);
  });

  // Backup before applying new migrations
  if (pending.length > 0) {
    backupDatabase();
  }

  for (const file of pending) {
    const version = parseInt(file.split('_')[0], 10);
    const mod = await import(join(migrationsDir, file));
    const transaction = db.transaction(() => {
      mod.up(db);
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
        version, basename(file, '.js')
      );
    });
    transaction();
    console.log(`  Migration ${file} applied`);
  }
}

await runMigrations();

// Graceful shutdown - checkpoint WAL
process.on('SIGINT', () => {
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
  process.exit(0);
});

export default db;
