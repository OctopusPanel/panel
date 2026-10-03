import { pgTable, varchar, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const modules = pgTable('modules', {
  id: varchar('id', { length: 128 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  version: varchar('version', { length: 32 }).notNull(),
  description: text('description'),
  isEnabled: boolean('is_enabled').default(false).notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().default({}).notNull(),
  installedAt: timestamp('installed_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ModuleEntity = typeof modules.$inferSelect;
export type NewModuleEntity = typeof modules.$inferInsert;
