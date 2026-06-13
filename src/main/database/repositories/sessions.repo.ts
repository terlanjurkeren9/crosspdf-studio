import type { Database } from 'sql.js';
import type { TabState } from '../../../renderer/stores/document.store';

export class SessionsRepository {
  constructor(private db: Database) {}

  saveSession(tabs: TabState[], activeTabId: string | null): void {
    const tabsJson = JSON.stringify({ tabs, activeTabId });
    // Upsert the session (we only keep one session for now)
    this.db.run(
      `INSERT INTO sessions (id, tabs_json, updated_at) 
       VALUES (1, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET tabs_json = excluded.tabs_json, updated_at = datetime('now')`,
      [tabsJson]
    );
  }

  loadSession(): { tabs: TabState[]; activeTabId: string | null } | null {
    const stmt = this.db.prepare('SELECT tabs_json FROM sessions WHERE id = 1');
    if (stmt.step()) {
      const row = stmt.getAsObject();
      if (row.tabs_json) {
        try {
          return JSON.parse(row.tabs_json as string);
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  clearSession(): void {
    this.db.run('DELETE FROM sessions WHERE id = 1');
  }
}
