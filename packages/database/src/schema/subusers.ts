import { pgTable, serial, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { servers } from './servers.js';
import { users } from './users.js';

export const subusers = pgTable('subusers', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id')
    .notNull()
    .references(() => servers.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  permissions: jsonb('permissions').$type<string[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const subusersRelations = relations(subusers, ({ one }) => ({
  server: one(servers, {
    fields: [subusers.serverId],
    references: [servers.id],
  }),
  user: one(users, {
    fields: [subusers.userId],
    references: [users.id],
  }),
}));

export type SubuserEntity = typeof subusers.$inferSelect;
export type NewSubuserEntity = typeof subusers.$inferInsert;
