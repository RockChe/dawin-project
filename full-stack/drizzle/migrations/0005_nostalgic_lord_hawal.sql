-- 全部語句改為冪等（IF NOT EXISTS）。原因見下：
--
-- 2026-09-09 對正式環境做唯讀盤點，結果：
--   * journal 顯示 0000–0004 已套用、0005 未套用
--   * 但 0005 的 7 個非 enum 物件（2 個 source 欄位 + 5 個 index）**在資料庫裡已經存在**
--     —— 那是先前有人用 db:push 直接推 schema 留下的，push 不會寫 __drizzle_migrations
--   * 唯一真正缺的是 role enum 的 'viewer' 值
--
-- 若照 drizzle 原本產出的版本跑，第 2 句 ADD COLUMN 會撞 "column already exists"，
-- 整支 migration 在 transaction 內 rollback，連 viewer 都加不進去。
--
-- 已逐一比對過既有物件的完整定義（型別、長度、nullable、default、index 的欄位與方法），
-- 與本檔預期建立的完全一致，所以用 IF NOT EXISTS 跳過是安全的
-- （IF NOT EXISTS 只比對名稱、不驗證定義，因此「定義是否一致」由人工盤點確認過）。
--
-- 本檔在任何環境都尚未套用過，故可安全修改（改已套用過的檔會造成 hash 分裂）。
ALTER TYPE "public"."role" ADD VALUE IF NOT EXISTS 'viewer';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "source" varchar(50);--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "source" varchar(50);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_action_created_at_idx" ON "audit_log" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backup_history_status_idx" ON "backup_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backup_history_created_at_idx" ON "backup_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subtasks_sort_order_idx" ON "subtasks" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_sort_order_idx" ON "tasks" USING btree ("sort_order");
