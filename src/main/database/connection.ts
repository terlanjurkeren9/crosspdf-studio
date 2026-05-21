import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDatabasePath } from '../utils/paths';
import { log } from '../utils/logger';
import { runMigrations } from './migrations/001_initial';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => path.join(__dirname, '../../node_modules/sql.js/dist/', file),
    });
  }

  if (!db) {
    const dbPath = getDatabasePath();
    log.info(`Opening database at ${dbPath}`);

    // Ensure directory exists
    await fs.mkdir(path.dirname(dbPath), { recursive: true });

    // Load existing database or create new
    try {
      const buffer = await fs.readFile(dbPath);
      db = new SQL.Database(buffer);
      log.info('Loaded existing database');
    } catch {
      db = new SQL.Database();
      log.info('Created new database');
    }

    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA busy_timeout = 5000');

    runMigrations(db);
  }
  return db;
}

export function getDbSync(): Database {
  if (!db) throw new Error('Database not initialized. Call getDatabase() first.');
  return db;
}

export async function saveDatabase(): Promise<void> {
  if (!db) return;
  const dbPath = getDatabasePath();
  const data = db.export();
  const buffer = Buffer.from(data);
  await fs.writeFile(dbPath, buffer);
  log.debug('Database saved');
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase().catch((err) => log.error('Failed to save database on close', err));
    db.close();
    db = null;
    log.info('Database closed');
  }
}
