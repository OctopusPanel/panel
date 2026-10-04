import { defineConfig } from 'drizzle-kit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distSchema = path.resolve(__dirname, './dist/schema/index.js');
const schemaPath = fs.existsSync(distSchema) ? './dist/schema/index.js' : './src/schema/index.ts';

export default defineConfig({
  schema: schemaPath,
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://octopus:octopus@localhost:5432/octopuspanel',
  },
});
