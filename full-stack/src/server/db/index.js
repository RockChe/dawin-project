import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

let _db;

export function getDb() {
  if (!_db) {
    const sql = neon(process.env.DATABASE_URL, {
      fetchOptions: { cache: 'no-store' },
    });
    _db = drizzle(sql, { schema });
  }
  return _db;
}

// For convenience — lazy getter
export const db = new Proxy({}, {
  get(_, prop) {
    return getDb()[prop];
  }
});
