import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_FILE = join(ROOT, 'data', 'ecdo.db');
const SCHEMA = join(ROOT, 'db', 'schema.sql');

let db;

export function getDb() {
  if (!db) {
    mkdirSync(dirname(DB_FILE), { recursive: true });
    db = new Database(DB_FILE);
    db.pragma('journal_mode = WAL');
    db.exec(readFileSync(SCHEMA, 'utf8'));
  }
  return db;
}

export function logIngest(source, rowCount, notes = '') {
  getDb()
    .prepare(
      `INSERT INTO ingest_log (source, completed_at, row_count, notes)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(source) DO UPDATE SET
         completed_at = excluded.completed_at,
         row_count = excluded.row_count,
         notes = excluded.notes`
    )
    .run(source, new Date().toISOString(), rowCount, notes);
}

export function wasIngested(source) {
  const row = getDb().prepare('SELECT source FROM ingest_log WHERE source = ?').get(source);
  return !!row;
}

export function dbPath() {
  return DB_FILE;
}