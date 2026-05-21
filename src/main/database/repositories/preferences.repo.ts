import { getDbSync } from '../connection';

export function getPreference(key: string): unknown {
  const db = getDbSync();
  const stmt = db.prepare('SELECT value FROM preferences WHERE key = ?');
  stmt.bind([key]);
  if (!stmt.step()) {
    stmt.free();
    return undefined;
  }
  const row = stmt.getAsObject() as { value: string };
  stmt.free();

  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export function setPreference(key: string, value: unknown): void {
  const db = getDbSync();
  const json = JSON.stringify(value);
  db.run(
    'INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, json]
  );
}
