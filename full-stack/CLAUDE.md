# Dawin Dash (Full-Stack) — 專案開發指引

## 專案概述

影視 IP 專案管理儀表板，供內部團隊追蹤多個影視專案的任務進度、時程、檔案與人員分工。
產品顯示名稱為「大雲文創專案管理系統」；程式碼、repo 與專案名稱仍是 Dawin Dash。

本版本使用 **Neon PostgreSQL + Drizzle ORM + Cloudflare R2**，適合企業級部署。

## 技術棧

- **框架**: Next.js 15.3 (App Router) + React 19
- **ORM**: Drizzle ORM 0.39
- **資料庫**: Neon PostgreSQL (Serverless)
- **檔案儲存**: Cloudflare R2 (S3 相容)
- **樣式**: Tailwind CSS 4 + 自訂主題系統
- **拖曳排序**: @dnd-kit/core + @dnd-kit/sortable
- **認證**: 自建 session-based auth (bcryptjs)
- **部署**: Vercel

## 目錄結構

```
src/
├── app/
│   ├── (admin)/users/         # 使用者管理頁（super_admin 限定）
│   ├── (admin)/backup/        # 備份管理頁（admin 限定）
│   ├── (auth)/login/          # 登入頁
│   ├── (auth)/set-password/   # 首次登入設定密碼
│   ├── (dashboard)/dashboard/ # 主儀表板
│   ├── (dashboard)/project/[id]/ # 專案詳情頁
│   ├── (mobile)/m/            # 手機版（單一路由，layout 做登入檢查 + device-width viewport）
│   └── api/                   # API routes (upload, upload-banner, download, backup, fetch-csv, health, device)
├── components/
│   ├── ThemeProvider.jsx      # 主題 Context Provider + useTheme hook
│   ├── PermissionProvider.jsx # role Context + useCan(cap) hook（預設 role=null → 全部 false，fail-closed）
│   ├── dashboard/             # 桌機版：18 個元件 + tabs/ (6 個子元件)
│   └── mobile/                # 手機版畫面（MobileApp、各 Screen、TaskSheet、mobileData.js）
├── hooks/
│   ├── useTaskManager.js      # 核心狀態管理 hook
│   ├── useUserSettings.js     # 個人設定 hook（per-account，獨立於 useTaskManager）；初始值由 getInitialData 帶入（`initial`：有給就 ready=true、掛載不再 fetch）；key 清單見下方「個人設定 key」
│   ├── useForbiddenHandler.js # 收到 { error: 'FORBIDDEN' } 時 toast + router.refresh()（處理被降級成 viewer 但畫面還是舊快照）
│   └── reorderProjects.js     # Projects 拖曳排序的純函式（無 React 依賴）
├── lib/
│   ├── auth.js                # Session 認證（7 天過期）
│   ├── device.js              # 裝置分流純函式：detectDevice、HOME、ENABLED_DEVICES（見「裝置分流與手機版」）
│   ├── constants.js           # 全域常數（STATUSES 狀態順序、STATUS_FILTERS 篩選選項）
│   ├── audit.js               # 審計日誌記錄（logAudit）
│   ├── backup.js              # 備份導出/上傳/清理（R2 + Google Drive）
│   ├── backupRunner.js        # 備份執行核心（server-only）。不做授權，授權由呼叫端負責：
│   │                          #   triggerBackup → withCap('manage')／POST /api/backup → CRON_SECRET
│   ├── crypto.js              # AES-256-GCM 加密解密（敏感設定保護）
│   ├── permissions.js         # 角色權限單一真相源：ROLES、CAPABILITIES（allowlist 制）、can(role, cap)
│   ├── permissionsMatrix.js   # 每支 server action / API route 的 capability 分類 inventory；
│   │                          #   authzCoverage.test.js 拿它跟原始碼比對，未分類的新 export 會讓測試紅
│   ├── withCap.js             # 授權 wrapper：withCap(cap, fn) 給 Server Action、withRouteCap(cap, handler) 給 API route
│   ├── r2.js                  # R2 檔案操作
│   ├── taskOwner.js           # 任務負責人規則：tasks.owner = 執行人（子任務 owner 聯集）∪ 關注人（tasks.watchers）；規則與邊界見檔頭註解，SQL 版（server/actions/tasks.js）須同規則
│   ├── personalSettings.js    # 個人設定純函式：resolveTab / resolveTimeDim / resolveGanttWidths / 舊 localStorage 一次性遷移
│   ├── parseSettingRows.js    # user_settings 列 → { key: value }（getUserSettings 與 getInitialData 共用）
│   ├── myTasks.js             # My Tasks 分頁的分組／KPI／身分徽章（我執行／我關注）
│   ├── statusFilter.js        # 跨專案狀態多選篩選（[] = 不篩）
│   ├── ownerNames.js          # 改姓名同步用：整個 token 完全相等才換
│   ├── tableColumns.js        # DataTab 鍵盤格的欄位設定（與可編輯欄位/DB 欄位的一致性由測試 assert）
│   ├── taskUpdates.js         # 表單欄位名 → DB 欄位名映射
│   ├── theme.js               # 主題常數與工廠函式（THEMES, F, FM, mkSC 等）
│   └── utils.js               # 日期格式化、進度計算（子任務/時間雙模式）、CSV 工具
├── server/
│   ├── actions/               # Server Actions（auth, backup, config, projects, tasks, users, userSettings）
│   └── db/
│       ├── index.js           # Neon 連線
│       └── schema.js          # Drizzle schema 定義
└── middleware.js               # 路由保護

scripts/
├── backup.js                  # CLI 手動備份指令
├── restore.js                 # CLI 恢復指令（transaction + 臨時密碼）
└── backfill-task-owners.js    # 一次性回填：任務 owner 改由子任務推得、被擠掉的人轉成關注人（預設 dry-run，--apply 才寫入）
```

## 資料庫 Schema

### Enums

| Enum | 名稱 | 值 |
|------|------|-----|
| roleEnum | `'role'` | `'super_admin'`, `'admin'`, `'viewer'`（2026-09-08 新增；viewer 只有 read/self/己方 user_settings，無 write/export/manage，見下方「授權層」） |
| statusEnum | `'task_status'` | `'已完成'`, `'進行中'`, `'待辦'`, `'暫緩'`, `'提案中'`, `'待確認'` |
| priorityEnum | `'priority'` | `'高'`, `'中'`, `'低'` |

### Tables（11 張）

| 表 | 用途 | 關鍵欄位 |
|----|------|---------|
| users | 使用者帳號 | id, email, passwordHash, role, name, mustChangePassword |
| sessions | 登入 session | id, userId→users, token, expiresAt |
| projects | 專案 | id, name, sortOrder, bannerR2Key, createdBy→users |
| tasks | 任務 | id, projectId→projects, task, status, category, startDate, endDate, duration, owner（= 執行人 ∪ 關注人，見「負責人模型」）, watchers（關注人，Migration 0006）, priority, notes, sortOrder（`reorderTasks` 寫入） |
| subtasks | 子任務 | id, taskId→tasks, name, owner, done, doneDate, notes, sortOrder |
| links | 連結 | id, taskId→tasks, url, title, createdBy→users |
| configTable | 系統設定 | id, key(unique), value |
| files | 檔案記錄 | id, taskId→tasks, name, size, mimeType, r2Key, createdBy→users |
| audit_log | 操作審計 | id, action, userId→users, resourceType, resourceId, detail, createdAt |
| backup_history | 備份記錄 | id, target, fileName, fileSize, status, error, durationMs, tableCounts, createdAt |
| user_settings | 個人設定（per-account） | id, userId→users(cascade), key(varchar100), value(JSON text), updatedAt；UNIQUE(userId, key)。Migration 0003 已於 production apply（2026-09-09 唯讀盤點確認：表與 7 個 index 全在） |

定義在 `src/server/db/schema.js`（Drizzle schema）。

### 負責人模型（2026-10-06：執行人／關注人）

- **執行人**：任一子任務有負責人 → 子任務 owner 的聯集（依 `sort_order`→`created_at`、去重）；否則為手動設定的執行人
- **關注人**（`tasks.watchers`）：掛名關注、不執行子任務的人（例：專案跟進人）；須為既有使用者
- `tasks.owner` = 執行人 ∪ 關注人（執行人在前），是 API／chatbot 讀的相容欄位；有子任務負責人時，手動傳入的 owner 會被忽略
- 邊界：沒有子任務負責人時以 `owner − watchers` 復原手動執行人，「既是手動執行人又是關注人」只會顯示為關注人
- JS 版 `src/lib/taskOwner.js` 與 SQL 版 `src/server/actions/tasks.js`（`DERIVED_OWNER_SQL`）必須維持同規則；子任務變更與父任務重算放同一個 `db.batch`
- 改姓名（`updateUser`）會同步 `tasks.owner`／`tasks.watchers`／`subtasks.owner`／config `owners`，同一個 `db.batch`
- My Tasks 分頁顯示登入者名下未完成任務；經子任務執行 →「我執行」徽章，關注人 →「我關注」徽章

### 個人設定 key（`user_settings`，per-account）

`zoom`、`projectsView`、`hiddenProjects`、`timelineSort`、`timelineDefaultCollapsed`（預設 true）、`projectTaskView`（含 `hideDoneSubs`）、
`activeTab`、`ganttWidths`、`timelineHeight`、`upcomingDays`、`upcomingLimit`、`timeDimOverview`／`timeDimTimeline`／`timeDimProject`。
首次載入由 `getInitialData` 一併帶回（8 個並行查詢，第 8 個是目前使用者的設定；該查詢失敗降級為空設定）。
`activeTab`／`timelineHeight`／`upcomingDays`／`upcomingLimit`／`ganttWidths` 有舊 localStorage 一次性遷移（不刪舊 key）。
仍在 localStorage（per-device）：Timeline 逐專案收折（`dash-timelineCollapsed`）、主題。

### 授權層（2026-09-08 新增，viewer 角色）

capability 制，allowlist、fail-closed（沒被列進 `CAPABILITIES` 的角色一律沒有該能力）：

| Capability | 角色 | 用途 |
|---|---|---|
| `read` | viewer, admin, super_admin | 讀資料 |
| `self` | viewer, admin, super_admin | 改自己的密碼／自己的 `user_settings` |
| `export` | admin, super_admin | 匯出全量資料（`/api/download`、備份 GET） |
| `write` | admin, super_admin | 新增／修改／刪除共享資料 |
| `manage` | super_admin | 使用者管理、備份設定、破壞性操作 |

- `src/lib/permissions.js`：`can(role, cap)`，單一真相源，前後端共用
- `src/lib/withCap.js`：`withCap(cap, fn)`（Server Action 用，回傳 `{ error: 'FORBIDDEN' }`）／
  `withRouteCap(cap, handler)`（API route 用，回傳 403 `NextResponse`）
- `src/lib/permissionsMatrix.js`：每支對外入口（server action + API route）的 capability 分類 inventory，
  `src/__tests__/authzCoverage.test.js` 拿它跟原始碼比對，default-deny——新 export 沒分類就紅
- `src/components/PermissionProvider.jsx` + `useCan(cap)`：前端依 role 藏編輯 UI（純 UI policy，見下方注意事項）
- `src/hooks/useForbiddenHandler.js`：收到 `{ error: 'FORBIDDEN' }` 統一 toast + `router.refresh()`

## 開發慣例

### Server Actions 模式
所有 Server Action 統一包一層 `withCap`（結構上不可能忘記授權——callback 只有授權通過才會被呼叫）：
```javascript
export async function actionName(params) {
  return withCap('write', async (session) => {
    try {
      // DB 操作
      return { success: true, data: result };
    } catch (err) {
      console.error("[actionName] error:", err);
      return { error: err.message || "預設錯誤訊息" };
    }
  });
}
```
- `withCap` 內部用 `safeRequireAuth()` 而非 `requireAuth()`（避免 digest error）
- 回傳 `{ error }` 或 `{ success, data }`，不使用 throw
- cap 依動作性質選：讀資料 `read`、改自己的東西 `self`、匯出全量 `export`、寫共享資料 `write`、破壞性/管理 `manage`

### useTaskManager Hook
- 集中管理所有 CRUD 操作（tasks, subtasks, links, files, projects, config）
- **樂觀更新**：先更新本地狀態，失敗時 rollback
- **sessionStorage 快取**：key = `'dash_cache'`
- **Auth 錯誤處理**：偵測到未授權時自動跳轉 `/login`
- **Owner 來源**：純粹以 Users 表為唯一來源，UI 使用下拉選單（非自由輸入）。支援逗號分隔多人格式，驗證時 split 後逐一查詢 Users 表（`inArray` 批次查詢）。任務層 owner 在有子任務負責人時唯讀（由子任務自動帶出），另有「關注人」欄位，見「負責人模型」
- **進度計算**（`twp`）：有子任務 → 完成率；無子任務 → 時間進度（`computeTimeProgress`）；`timeBased` 旗標區分顯示模式
- 預設分類：`['商務合作', '活動', '播出/開始', '行銷', '發行', '市場展']`

### UI 慣例
- 主題透過 `ThemeProvider`（React Context）管理，元件使用 `useTheme()` hook 取得 `X`, `SC`, `PC`, `CC`, `PJC`, `inputStyle`
- 字體：`'Noto Sans TC'` (內文)、`'JetBrains Mono'` (等寬)
- Toast 通知透過 `useTaskManager` 的 `showToast(msg, type)` 顯示
- 拖曳排序使用 `@dnd-kit`，需設定 sensors 和 sortable context
- **桌機固定版（2026-10-06）**：已移除 RWD（無 `isMobile`、`globals.css` 無 `@media`）；`(dashboard)`／`(admin)` layout 固定 `viewport` 寬 1280 + `min-width: 1280`，登入頁維持 device-width。手機版已完成（見下方「裝置分流與手機版」），平板版尚未做

### 裝置分流與手機版（2026-10-06）

| 路徑 | 版本 | 備註 |
|------|------|------|
| `/dashboard` | 桌機（固定 1280） | 預設入口，唯一會被自動導向的路徑 |
| `/m` | 手機 | `(mobile)` 路由群組，單一路由，client state 切分頁 |
| `/t` | 平板（規劃中） | 尚未建立；`HOME` 已預留 |
| `/api/device?to=desktop\|mobile` | 手動切換 | 寫 `device_pref` cookie 後導向該版首頁；`to` 不在 `ENABLED_DEVICES` → 400；無 `next` 參數 |

- 判斷在 `src/lib/device.js` 的 `detectDevice`：`device_pref`（手動）> `device_auto`（客戶端偵測，平板計畫才會寫）> UA > 桌機；結果不在 `ENABLED_DEVICES` 一律退回桌機
- `src/middleware.js` 只攔 `GET /dashboard`（且已通過登入 cookie 檢查）；直接開 `/m` 永遠尊重。桌機縮窄視窗不會被導走（只看 UA，不看寬度）
- Cookie：`device_pref`（1 年、httpOnly、sameSite=lax、production 加 secure）；`device_auto` 目前沒有任何程式寫入
- 手機版畫面在 `src/components/mobile/`：我的任務、總覽、專案（清單＋詳情）、任務抽屜、簡化時程、更多；**刻意不做**資料表、設定、帳號管理、備份、批次、拖移。viewer 唯讀
- 三個版本共用 `getInitialData`／`useTaskManager`／`useUserSettings` 與所有 server action；不碰 DB
- **日後加平板版**：建 `/t` 路由群組與畫面 → 把 `'tablet'` 加進 `ENABLED_DEVICES`（`src/lib/device.js`）→ 補 iPad 客戶端偵測寫 `device_auto` → 桌機側欄與手機「更多」補平板入口
- 桌機側欄頁尾有「手機版」連結（`/api/device?to=mobile`）；手機「更多」有「切到桌機版」

### 檔案上傳流程
1. 前端 → `POST /api/upload`（FormData，含 taskId）
2. API route → R2 `PutObjectCommand`
3. 成功後呼叫 `createFileRecord()` Server Action 寫入 DB
4. 下載透過 `GET /api/download?key=xxx`（R2 presigned URL 或直接串流），走 `withRouteCap('export', ...)`——viewer 打這支一律 403

## 注意事項

- **configTable 命名**：schema 中 export 名為 `configTable`（非 `config`），因為 `config` 與 Next.js 保留名衝突。在 `actions/config.js` 中用 `import { configTable as config }` 別名使用
- **bcryptjs**：必須在 `next.config.js` 設定 `serverExternalPackages: ['bcryptjs']`，防止打包到 client
- **middleware 限制**：`middleware.js` 只檢查 cookie 是否存在，不驗證 session 有效性。實際驗證在各 Server Action 中進行
- **SESSION_SECRET**：用於 AES-256-GCM 加密 configTable 中的敏感設定（備份 API Key 等），至少 32 字元隨機字串
- **CRON_SECRET**：Vercel Cron 觸發 `/api/backup` POST 時的 Bearer token 驗證，防止未授權存取。需在 Vercel 環境變數中設定
- **Migration 0003/0004**：Wave 1 新增 `user_settings` 表（0003）及 `task_status` enum 新增「暫緩」值（0004）**已於 production apply**（2026-09-09 對正式環境唯讀盤點確認：`__drizzle_migrations` journal 有 5 筆、`user_settings` 表與 7 個 index 全在）
- **Migration 0005**：`roleEnum` 新增 `'viewer'` 值，已套用至正式環境（2026-09-09）。
  **全部語句改寫成冪等（`IF NOT EXISTS`）**，包含 `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'viewer'`——
  該寫法在 PG12+ 於 transaction 內合法（本專案是 PG 17.0011），實測通過。
  **為什麼要改寫**：drizzle 產出的原版會失敗。0005 的 7 個非 enum 物件（`projects.source`／`tasks.source`
  兩個欄位 + 5 個 index）**在資料庫裡早就存在**——先前有人用 `db:push` 推過 schema，
  而 `db:push` 不會寫 `__drizzle_migrations`，所以 journal 顯示未套用、物件卻已存在。
  照原版跑會在第二句 `ADD COLUMN` 撞 `column already exists`，整支 transaction rollback，連 viewer 都加不進去。
  **教訓**：這個 repo 有 `db:push` 造成的 drift，動 migration 前先用 `docs/migration-audit.sql`
  對正式環境做唯讀盤點，不要相信文件或 journal 單方面的說法
- **Migration 0006**：`tasks.watchers varchar(500)`（僅 `ADD COLUMN`，可為 NULL），2026-10-06 **已手動在正式庫執行，沒有走 `drizzle migrate`**，所以 `__drizzle_migrations` 沒有 0006 的紀錄。
  0006 不是冪等寫法：日後對正式庫跑 `db:migrate` 會撞 `column already exists`——跑之前先補 journal 紀錄，或把該句改成 `ADD COLUMN IF NOT EXISTS`（同 0005 的教訓）
- **上線順序（含 schema 變更時）**：欄位（migration）→ 資料整理（`node scripts/backfill-task-owners.js` 先 dry-run、看過再 `--apply`，需 `DB_WRITE_CONFIRM=backfill-task-owners@<db-host>`）→ 部署程式。新程式的 SELECT 會讀 `watchers`，欄位沒先加會直接報錯。Vercel Function Region 設為 sin1（與 Neon ap-southeast-1 同區；Vercel 專案設定，不在 repo）
- **新增 server action / API route 必須包 `withCap` / `withRouteCap`**，並登記進 `src/lib/permissionsMatrix.js`——沒登記或漏包，`src/__tests__/authzCoverage.test.js` 會紅（default-deny 護欄）
- **前端隱藏編輯按鈕只是 UI policy，不是安全邊界**：`getInitialData()` 會把全量任務資料送進任何登入者的瀏覽器（`useTaskManager` 的 `allT` state），DataTab 的 Export CSV 是純前端從 `allT` 產生——藏按鈕擋不住 DevTools。真正的牆是後端的 `withCap` / `withRouteCap`；前端隱藏只是避免使用者對著點不動的按鈕困惑
- **Migration baseline（技術債，已解決）**：曾用一支臨時 idempotent 腳本把 0000–0004 標記為「已套用」到 `__drizzle_migrations`（讀 `drizzle/migrations/meta/_journal.json`，對每個 tag 算 `sha256(<tag>.sql)` 寫入，已存在則跳過），已對 prod 執行並驗證、**腳本已刪除，不在 repo 中**；之後 `db:migrate` 只會套 0005+
- **Wave 2 個人化（工單 0531）**：Projects 卡片/明細（精簡列表）切換（`projectsView`，user_settings）、Timeline 隱藏專案眼睛 toggle（`hiddenProjects`=project.id 陣列，user_settings；**Dashboard 掛 `useUserSettings` 為單一真相**，以 props 同時傳 ProjectsTab 顯示眼睛狀態 + TimelineTab 過濾，W2-2 不自呼叫 hook）、Timeline 排序（`timelineSort`，user_settings）。ephemeral UI state 走 localStorage：Timeline 逐專案收折（`dash-timelineCollapsed`）。（2026-10-06 起 active tab 與欄寬／高度／Upcoming／時間尺度都改存 user_settings，見「個人設定 key」）
- **測試**：`npm test` 執行 vitest（`vitest.config.js`，含 `@/` alias + jsdom，**已排除 `.worktrees`** 避免掃到 fleet 隔離 worktree 內的測試副本），2026-10-06 手機版落地後共 **736 個測試 / 77 個檔**全綠

## 關鍵參考檔案

- `src/server/db/schema.js` — Drizzle Schema 定義
- `src/hooks/useTaskManager.js` — 核心 hook
- `src/lib/auth.js` — 認證機制
- `src/server/actions/tasks.js` — Server Action 標準範例
- `src/components/ThemeProvider.jsx` — 主題 Context（ThemeProvider + useTheme hook）
- `src/lib/theme.js` — 主題常數與工廠函式
- `src/components/dashboard/Dashboard.jsx` — 主元件（187 行）
- `src/components/dashboard/tabs/` — tab 子元件（Overview / MyTasks / Projects / Timeline / Data / Settings + DashboardHeader）
- `src/lib/device.js` — 裝置分流（`detectDevice`、`ENABLED_DEVICES`）
- `src/middleware.js` — 路由保護 + `/dashboard` 裝置導向
- `src/lib/taskOwner.js` — 執行人／關注人規則（單一真相源，SQL 版須同步）
- `src/lib/personalSettings.js` — 個人設定純函式與舊 localStorage 遷移
- `scripts/backfill-task-owners.js` — owner／watchers 一次性回填（預設 dry-run）
- `src/lib/backup.js` — 備份核心函式庫（導出/上傳/清理）
- `src/lib/backupRunner.js` — 備份執行核心（server-only，不含授權）
- `src/server/actions/backup.js` — 備份 Server Actions（設定/觸發/歷史/審計）
- `src/app/(admin)/backup/page.jsx` — 備份管理 UI
- `src/lib/permissions.js` — 角色權限單一真相源（`can(role, cap)`）
- `src/lib/withCap.js` — 授權 wrapper（`withCap` / `withRouteCap`）
- `src/lib/permissionsMatrix.js` — 對外入口 capability 分類 inventory
- `src/__tests__/authzCoverage.test.js` — default-deny 護欄測試

---

# AI 工具指示

## Agent Team 分工規則

| Agent 類型 | 使用時機 |
|-----------|---------|
| **Explore** | 查找元件、追蹤資料流、理解既有模式。探索前先讀本 CLAUDE.md 避免重複搜尋 |
| **Plan** | 涉及多檔案修改、架構變動、新功能設計。必須參考 `docs/milestone.md` 確認方向一致 |
| **general-purpose** | 複雜多步任務、跨多目錄搜索 |

- **並行原則**：獨立的探索任務應並行啟動多個 agent，但不超過 3 個
- **不使用 agent 的情境**：單檔修改、已知路徑的讀取、簡單 grep 搜尋

## Skill 使用規則

| Skill | 使用時機 |
|-------|---------|
| `/commit` | 每次有意義的變更後使用，commit message 用中文，格式：`fix:` / `feat:` / `ui:` / `refactor:` / `chore:` |
| `/simplify` | 完成功能開發後，對變更的檔案執行一次 |
| `/frontend-design` | 建立新 UI 元件時使用 |
| `/react-best-practices` | 撰寫或重構 React 元件時使用 |

**不主動使用**：ads 相關 skill、audit 相關 skill（與本專案無關）

## MCP Server 整合

| MCP | 用途 |
|-----|------|
| **context7** | 查詢 Next.js、Drizzle ORM、Tailwind CSS 等套件的最新文件，開發時優先使用 |
| **gws** | 存取 Google Drive/Sheets/Calendar/Gmail，用於匯入匯出專案資料或查詢行程 |
| **tavily** | 網路搜尋與爬取，用於查找技術解決方案、bug 排查 |
| **exa** | 程式碼搜尋與網路搜尋，用於查找類似實作範例 |
| **sequential-thinking** | 複雜問題的逐步推理，用於架構決策或 debug 困難問題 |

## 記憶系統規則

**該存的**：
- 用戶偏好（如 commit 風格、溝通語言）
- 踩過的坑（如 configTable 衝突）
- 專案決策理由
- 外部資源位置

**不該存的**：
- 程式碼結構（讀本 CLAUDE.md）
- Git 歷史（用 `git log`）
- 暫時性 debug 資訊

**命名慣例**：記憶檔用英文命名，如 `feedback_commit_style.md`、`project_theme_decision.md`

**更新時機**：發現記憶與程式碼現狀不符時立即更新或刪除
