import { getDbSync } from '../connection';

export interface RecentDocument {
  id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  page_count: number;
  pinned: number;
  last_opened: string;
}

export function getAllRecent(limit = 10): RecentDocument[] {
  const db = getDbSync();
  const stmt = db.prepare(
    'SELECT id, file_path, file_name, file_size, page_count, pinned, last_opened FROM recent_documents ORDER BY last_opened DESC LIMIT ?'
  );
  stmt.bind([limit]);

  const rows: RecentDocument[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as RecentDocument);
  }
  stmt.free();
  return rows;
}

export function upsertRecent(
  filePath: string,
  fileName: string,
  fileSize = 0,
  pageCount = 0
): void {
  const db = getDbSync();
  db.run(
    `INSERT INTO recent_documents (file_path, file_name, file_size, page_count, last_opened)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(file_path) DO UPDATE SET
       file_name = excluded.file_name,
       file_size = excluded.file_size,
       page_count = excluded.page_count,
       last_opened = datetime('now')`,
    [filePath, fileName, fileSize, pageCount]
  );
}
