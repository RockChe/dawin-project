import { pgTable, uuid, varchar, text, boolean, integer, date, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

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
}, (table) => [
  index('sessions_user_id_idx').on(table.userId),
  index('sessions_expires_at_idx').on(table.expiresAt),
]);

// ── Projects ──
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  bannerR2Key: varchar('banner_r2_key', { length: 1000 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  source: varchar('source', { length: 50 }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
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
  source: varchar('source', { length: 50 }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('tasks_project_id_idx').on(table.projectId),
  index('tasks_created_at_idx').on(table.createdAt),
  index('tasks_status_idx').on(table.status),
  index('tasks_created_by_idx').on(table.createdBy),
  index('tasks_sort_order_idx').on(table.sortOrder),
]);

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
}, (table) => [
  index('subtasks_task_id_idx').on(table.taskId),
  index('subtasks_done_idx').on(table.done),
  index('subtasks_sort_order_idx').on(table.sortOrder),
]);

// ── Links ──
export const links = pgTable('links', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  url: text('url').notNull(),
  title: varchar('title', { length: 500 }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('links_task_id_idx').on(table.taskId),
  index('links_created_by_idx').on(table.createdBy),
]);

// ── Config (key-value) ──
export const configTable = pgTable('config', {
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
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('files_task_id_idx').on(table.taskId),
  index('files_created_by_idx').on(table.createdBy),
]);

// ── Audit Log ──
export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  action: varchar('action', { length: 50 }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  resourceType: varchar('resource_type', { length: 50 }),
  resourceId: uuid('resource_id'),
  detail: text('detail'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('audit_log_user_id_idx').on(table.userId),
  index('audit_log_action_idx').on(table.action),
  index('audit_log_created_at_idx').on(table.createdAt),
  index('audit_log_action_created_at_idx').on(table.action, table.createdAt),
]);

// ── Backup History ──
export const backupHistory = pgTable('backup_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  target: varchar('target', { length: 20 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileSize: integer('file_size'),
  status: varchar('status', { length: 20 }).notNull(),
  error: text('error'),
  durationMs: integer('duration_ms'),
  tableCounts: text('table_counts'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('backup_history_status_idx').on(table.status),
  index('backup_history_created_at_idx').on(table.createdAt),
]);

