import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './db.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const candidateFolders = [
    path.resolve(__dirname, '../drizzle'),
    path.resolve(__dirname, '../../drizzle'),
    path.resolve(process.cwd(), 'packages/database/drizzle'),
    path.resolve(process.cwd(), 'drizzle'),
  ];
  const migrationsFolder = candidateFolders.find((dir) => fs.existsSync(dir));
  if (!migrationsFolder) {
    throw new Error(`Drizzle migrations folder not found! Searched: ${candidateFolders.join(', ')}`);
  }
  console.log(`Running database migrations from ${migrationsFolder}...`);
  await migrate(db, { migrationsFolder });
  console.log('Migrations completed successfully.');
}

if (process.argv[1] === __filename) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
