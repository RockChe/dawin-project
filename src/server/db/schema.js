import { pgTable, uuid, varchar, text, boolean, integer, date, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['super_admin', 'admin']);
export const statusEnum = pgEnum('task_status', ['已完成', '進行中', '待辦', '提案中', '待確認']);
export const priorityEnum = pgEnum('priority', ['高', '中', '低']);

// ── Users ──
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: roleEnum('role').default('admin').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  mustChangePassword: boolean('must_change_password').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Sessions ──
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: varchar('token', { length: 255 }).unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Projects ──
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Tasks ──
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  task: varchar('task', { length: 500 }).notNull(),
  status: statusEnum('status').default('待辦').notNull(),
  category: varchar('category', { length: 100 }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  duration: integer('duration'),
  owner: varchar('owner', { length: 500 }),
  priority: priorityEnum('priority').default('中').notNull(),
  notes: text('notes'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Subtasks ──
export const subtasks = pgTable('subtasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 500 }).notNull(),
  owner: varchar('owner', { length: 255 }),
  done: boolean('done').default(false).notNull(),
  doneDate: date('done_date'),
  notes: text('notes'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Links ──
export const links = pgTable('links', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  url: text('url').notNull(),
  title: varchar('title', { length: 500 }),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Config (key-value) ──
export const config = pgTable('config', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 255 }).unique().notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Files ──
export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 500 }).notNull(),
  size: integer('size'),
  mimeType: varchar('mime_type', { length: 255 }),
  r2Key: varchar('r2_key', { length: 1000 }).notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Config (key-value store) ──
export const config = pgTable('config', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 100 }).unique().notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
