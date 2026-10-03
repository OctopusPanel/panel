import { pgTable, serial, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { servers } from './servers.js';

export const blueprints = pgTable('blueprints', {
  id: serial('id').primaryKey(),
  uuid: uuid('uuid').defaultRandom().notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  author: varchar('author', { length: 128 }).default('OctopusPanel').notNull(),
  description: text('description'),
  dockerImage: varchar('docker_image', { length: 255 }).notNull(),
  dockerImages: jsonb('docker_images').$type<Record<string, string>>().default({}),
  startupCommand: text('startup_command').notNull(),
  stopCommand: varchar('stop_command', { length: 255 }).default('^C').notNull(),
  configFiles: jsonb('config_files').$type<Record<string, unknown>>().default({}).notNull(),
  variables: jsonb('variables').$type<Array<unknown>>().default([]).notNull(),
  installScript: text('install_script'),
  installContainer: varchar('install_container', { length: 255 }),
  installEntrypoint: varchar('install_entrypoint', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const blueprintsRelations = relations(blueprints, ({ many }) => ({
  servers: many(servers),
}));

export type BlueprintEntity = typeof blueprints.$inferSelect;
export type NewBlueprintEntity = typeof blueprints.$inferInsert;
