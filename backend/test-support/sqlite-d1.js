import { DatabaseSync } from 'node:sqlite';

// Real SQLite semantics for the D1 calls used here, including transactional batch and RETURNING.
export class SQLiteD1 {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); }
  exec(sql) { this.sqlite.exec(sql); }
  prepare(sql) {
    const db = this.sqlite;
    const statement = values => ({
      bind(...bound) { return statement(bound); },
      async first() { return db.prepare(sql).get(...values) || null; },
      async all() { const results=db.prepare(sql).all(...values);const pages=db.prepare('PRAGMA page_count').get().page_count;const pageSize=db.prepare('PRAGMA page_size').get().page_size;return { results,meta:{size_after:pages*pageSize} }; },
      runSync() { const result = db.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; },
      async run() { return this.runSync(); }
    });
    return statement([]);
  }
  async batch(statements) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => statement.runSync());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
  close() { this.sqlite.close(); }
}
