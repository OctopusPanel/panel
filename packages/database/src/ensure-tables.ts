import pg from 'pg';

export async function ensureCockpitTables(connectionString?: string): Promise<void> {
  const rawUrl = connectionString || process.env.DATABASE_URL;
  const connection =
    rawUrl && rawUrl.trim().length > 0
      ? rawUrl.trim()
      : 'postgresql://octopus:octopus@localhost:5432/octopuspanel';

  const client = new pg.Client({ connectionString: connection });
  try {
    await client.connect();

    // 1. Ensure allocations has note column
    await client.query(`
      ALTER TABLE allocations ADD COLUMN IF NOT EXISTS note VARCHAR(255);
    `);

    // 2. Ensure server_backups table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS server_backups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        bytes BIGINT NOT NULL DEFAULT 0,
        is_locked BOOLEAN NOT NULL DEFAULT FALSE,
        is_successful BOOLEAN NOT NULL DEFAULT TRUE,
        checksum VARCHAR(255),
        ignored_files JSONB NOT NULL DEFAULT '[]'::jsonb,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3. Ensure server_databases table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS server_databases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        name VARCHAR(64) NOT NULL,
        username VARCHAR(64) NOT NULL,
        password VARCHAR(255) NOT NULL,
        host VARCHAR(255) NOT NULL DEFAULT '127.0.0.1',
        port INTEGER NOT NULL DEFAULT 3306,
        database_type VARCHAR(32) NOT NULL DEFAULT 'mysql',
        max_connections INTEGER NOT NULL DEFAULT 10,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 4. Ensure server_schedules table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS server_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        cron VARCHAR(64) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
        last_run_at TIMESTAMPTZ,
        next_run_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 5. Ensure subusers table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS subusers (
        id SERIAL PRIMARY KEY,
        server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } catch (err: any) {
    console.warn('[Database] Failed to auto-verify cockpit tables (continuing):', err?.message || err);
  } finally {
    try {
      await client.end();
    } catch {}
  }
}
