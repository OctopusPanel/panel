import { pgTable, uuid, varchar, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { servers } from './servers.js';

export interface ScheduleTaskItem {
  id: string;
  action: 'command' | 'power' | 'backup';
  payload: string;
  delaySeconds: number;
}

export const serverSchedules = pgTable('server_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  serverId: integer('server_id')
    .notNull()
    .references(() => servers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  cron: varchar('cron', { length: 64 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  tasks: jsonb('tasks').$type<ScheduleTaskItem[]>().default([]).notNull(),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const serverSchedulesRelations = relations(serverSchedules, ({ one }) => ({
  server: one(servers, {
    fields: [serverSchedules.serverId],
    references: [servers.id],
  }),
}));

export type ServerScheduleEntity = typeof serverSchedules.$inferSelect;
export type NewServerScheduleEntity = typeof serverSchedules.$inferInsert;
