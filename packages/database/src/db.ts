import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

const { Pool } = pg;

export type DatabaseInstance = ReturnType<typeof createDatabase>;

export function createDatabase(connectionString?: string) {
  const connection = connectionString || process.env.DATABASE_URL || 'postgresql://octopus:octopus@localhost:5432/octopuspanel';
  const pool = new Pool({
    connectionString: connection,
  });

  return drizzle(pool, { schema });
}

let _db: DatabaseInstance | null = null;

export function getDb(): DatabaseInstance {
  if (!_db) {
    _db = createDatabase();
  }
  return _db;
}

export const db = getDb();
