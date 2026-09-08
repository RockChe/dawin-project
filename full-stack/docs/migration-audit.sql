-- ============================================================================
-- viewer 角色上線前的正式環境盤點
--
-- 全部唯讀，不改任何東西。整份貼進 Neon SQL Editor 跑，或一段一段跑都可以。
-- 目的：搞清楚正式環境的真實狀態，因為 CLAUDE.md 已被證實過期，不能當依據。
--
-- 跑完把結果貼回來，我對照 0003/0004/0005 的每一個物件逐項打勾。
-- ============================================================================


-- ── 0. 環境基本資訊 ────────────────────────────────────────────────────────
-- 為什麼要查：codex 明確要求不要只憑「Neon 應該是 PG16」推定。
-- ALTER TYPE ADD VALUE 能否在 transaction 內執行，PG11 與 PG12+ 的行為不同。
SELECT
  version()                                   AS pg_version,
  current_database()                          AS db_name,
  current_setting('server_version_num')::int  AS version_num,
  CASE WHEN current_setting('server_version_num')::int >= 120000
       THEN 'OK — ADD VALUE 可在 transaction 內執行'
       ELSE '⚠ PG11 以前 — ADD VALUE 不能在 transaction 內，需另行處理'
  END AS enum_in_tx_verdict;


-- ── 1. drizzle 以為套用了哪些 migration ───────────────────────────────────
-- 為什麼要查：這是 drizzle 的認知。它可能與資料庫實況不符——
-- db:push 只改 schema，完全不會寫這張表。
SELECT id, hash, to_timestamp(created_at / 1000) AS applied_at
FROM drizzle.__drizzle_migrations
ORDER BY created_at;

-- 若上一句報「schema drizzle 不存在」，改跑這句找出它到底在哪：
-- SELECT table_schema, table_name FROM information_schema.tables
-- WHERE table_name LIKE '%drizzle%';


-- ── 2. enum 實況（含排序） ────────────────────────────────────────────────
-- 期望：role 目前應只有 super_admin / admin（沒有 viewer）
--       task_status 若已有「暫緩」代表 0004 已套用過
SELECT t.typname AS enum_type, e.enumlabel AS value, e.enumsortorder AS sort_order
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typname IN ('role', 'task_status')
ORDER BY t.typname, e.enumsortorder;


-- ── 3. 0003 的九個物件在不在 ──────────────────────────────────────────────
-- CLAUDE.md 說 0003 正式環境未套用，但該文件已被證實過期，要親自確認。
SELECT 'user_settings 表' AS object,
       CASE WHEN to_regclass('public.user_settings') IS NULL THEN '不存在' ELSE '存在' END AS status;

SELECT c.conname AS fk_name, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.conname = 'user_settings_user_id_users_id_fk';

-- 0003 的七個 index。codex 提醒：只看名字不夠，同名 index 可能欄位順序或方法不同，
-- 所以連完整定義一起撈出來比對。
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND indexname IN (
  'user_settings_user_id_idx',
  'user_settings_user_key_idx',
  'files_created_by_idx',
  'links_created_by_idx',
  'subtasks_done_idx',
  'tasks_status_idx',
  'tasks_created_by_idx'
)
ORDER BY indexname;


-- ── 4. 0005 的物件在不在 ──────────────────────────────────────────────────
-- 這是最關鍵的一段。這七個物件的 schema.js 定義早就存在（先前 commit 加的），
-- 若有人用過 db:push，它們可能已經在資料庫裡了 —— 那樣原樣跑 migrate 會撞
-- 「column already exists」而中止整支。

-- 兩個 source 欄位（連型別、nullable、default 一起看，不只看在不在）
SELECT table_name, column_name, data_type, character_maximum_length,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('projects', 'tasks')
  AND column_name = 'source'
ORDER BY table_name;

-- 五個 index（同樣連定義一起看）
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND indexname IN (
  'audit_log_action_created_at_idx',
  'backup_history_status_idx',
  'backup_history_created_at_idx',
  'subtasks_sort_order_idx',
  'tasks_sort_order_idx'
)
ORDER BY indexname;


-- ── 5. 表有多大（決定 CREATE INDEX 會鎖多久） ─────────────────────────────
-- 為什麼要查：0005 的五個 CREATE INDEX 沒帶 CONCURRENTLY，建置期間會阻擋該表的寫入。
-- codex 說對小型內部看板通常可接受，但不能只憑「內部看板」四個字認定，要看實際數字。
SELECT
  c.relname AS table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  c.reltuples::bigint AS approx_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('audit_log', 'backup_history', 'subtasks', 'tasks', 'projects', 'user_settings')
  AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC;


-- ── 6. 有沒有卡住的長交易（migrate 會被它擋住） ───────────────────────────
SELECT pid, state, now() - xact_start AS xact_age, left(query, 80) AS query
FROM pg_stat_activity
WHERE datname = current_database()
  AND state <> 'idle'
  AND xact_start IS NOT NULL
  AND now() - xact_start > interval '1 minute'
ORDER BY xact_start;


-- ============================================================================
-- 怎麼讀結果
--
--   狀態 A · journal 停在 0002，且第 3、4 段的物件都「不存在」
--            → 真的落後三支。開 Neon branch 演練過就可以原樣 db:migrate。
--
--   狀態 B · journal 停在 0002，但第 3 或 4 段有物件「已存在」
--            → 有人用過 db:push 或手動改過。原樣跑必爆。
--              要改走「只補缺的語句 + 對齊 journal」，而且要逐物件比對定義。
--
--   狀態 C · journal 有 0003/0004 紀錄，但對應物件缺
--            → 曾套用失敗或被人工刪過。不要重跑舊檔，要新增一支修復用的 migration。
--
--   任何一段的 enum 已經有 viewer 或 暫緩
--            → 對應的 ADD VALUE 絕對不能原樣再跑。
-- ============================================================================
