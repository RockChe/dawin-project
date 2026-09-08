ALTER TYPE "public"."role" ADD VALUE 'viewer';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "source" varchar(50);--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "source" varchar(50);--> statement-breakpoint
CREATE INDEX "audit_log_action_created_at_idx" ON "audit_log" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "backup_history_status_idx" ON "backup_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "backup_history_created_at_idx" ON "backup_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "subtasks_sort_order_idx" ON "subtasks" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "tasks_sort_order_idx" ON "tasks" USING btree ("sort_order");