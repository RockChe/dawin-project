# Dawin Dash — 專案開發指引

## 專案概述

影視 IP 專案管理儀表板，供內部團隊追蹤多個影視專案的任務進度、時程、檔案與人員分工。

專案採**雙版本架構**，共用相同的 UI 層與業務邏輯，但資料層不同：

| 版本 | 目錄 | 資料層 | 檔案儲存 | 適用場景 |
|------|------|--------|---------|---------|
| **Full-Stack** | `full-stack/` | Neon PostgreSQL + Drizzle ORM | Cloudflare R2 | 企業級部署 |
| **GWS** | `gws/` | Google Sheets + Custom DAL | Google Drive | 小團隊 / 快速部署 |

## 技術棧

| 層級 | Full-Stack 版 | GWS 版 |
|------|--------------|--------|
| 框架 | Next.js 15.3 (App Router) + React 19 | 同左 |
| 資料庫 | Neon PostgreSQL (Serverless) | Google Sheets API v4 |
| ORM / DAL | Drizzle ORM 0.39 | `sheets-dal.js`（自建 DAL） |
| 檔案儲存 | Cloudflare R2 (S3 相容) | Google Drive API v3 |
| 樣式 | Tailwind CSS 4 + 自訂主題系統 | 同左 |
| 拖曳排序 | @dnd-kit/core + @dnd-kit/sortable | 同左 |
| 認證 | 自建 session-based auth (bcryptjs) | 同左 |
| 部署 | Vercel | 同左 |

## 目錄結構

```
dawin-dash/
├── CLAUDE.md              # 本檔案（AI 開發指引）
├── full-stack/            # PostgreSQL + R2 版本
│   └── src/
│       ├── app/           # Next.js App Router
│       ├── components/dashboard/  # 17 個元件 + tabs/ (6 個子元件)
│       ├── hooks/useTaskManager.js
│       ├── lib/           # auth.js, r2.js, theme.js, utils.js
│       ├── server/actions/ # Server Actions (5 個)
│       ├── server/db/     # schema.js, index.js (Drizzle + Neon)
│       └── middleware.js
└── gws/                   # Google Sheets + Drive 版本
    └── src/
        ├── app/           # Next.js App Router（同 full-stack 路由結構）
        ├── components/dashboard/  # 20 個元件（含獨立 tab 元件）
        ├── hooks/useTaskManager.js
        ├── lib/           # auth.js, sheets-dal.js, google.js, drive.js, cache.js, theme.js, utils.js
        ├── server/actions/ # Server Actions (5 個)
        └── middleware.js
```

### 共用路由結構（兩個版本相同）

```
src/app/
├── (admin)/users/            # 使用者管理頁（super_admin 限定）
├── (auth)/login/             # 登入頁
├── (auth)/set-password/      # 首次登入設定密碼
├── (dashboard)/dashboard/    # 主儀表板
├── (dashboard)/project/[id]/ # 專案詳情頁
└── api/                      # API routes (upload, download, fetch-csv, health)
```

## 資料庫 Schema

### Enums（兩版本共用）

| Enum | 名稱 | 值 |
|------|------|-----|
| roleEnum | `'role'` | `'super_admin'`, `'admin'` |
| statusEnum | `'task_status'` | `'已完成'`, `'進行中'`, `'待辦'`, `'提案中'`, `'待確認'` |
| priorityEnum | `'priority'` | `'高'`, `'中'`, `'低'` |

### Tables（8 張，兩版本欄位相同）

| 表 | 用途 | 關鍵欄位 |
|----|------|---------|
| users | 使用者帳號 | id, email, passwordHash, role, name, mustChangePassword |
| sessions | 登入 session | id, userId→users, token, expiresAt |
| projects | 專案 | id, name, sortOrder, createdBy→users |
| tasks | 任務 | id, projectId→projects, task, status, category, startDate, endDate, duration, owner, priority, notes, sortOrder |
| subtasks | 子任務 | id, taskId→tasks, name, owner, done, doneDate, notes, sortOrder |
| links | 連結 | id, taskId→tasks, url, title, createdBy→users |
| configTable | 系統設定 | id, key(unique), value |
| files | 檔案記錄 | id, taskId→tasks, name, size, mimeType, r2Key, createdBy→users |

- **Full-Stack**：定義在 `full-stack/src/server/db/schema.js`（Drizzle schema）
- **GWS**：定義在 `gws/src/lib/sheets-dal.js` 頂部的 `COLUMNS` 物件（對應 8 個 Google Sheet tabs）

## 開發慣例

### Server Actions 模式
所有 Server Action 遵循統一模式：
```javascript
export async function actionName(params) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };
  try {
    // DB 操作
    return { success: true, data: result };
  } catch (err) {
    console.error("[actionName] error:", err);
    return { error: err.message || "預設錯誤訊息" };
  }
}
```
- 使用 `safeRequireAuth()` 而非 `requireAuth()`（避免 digest error）
- 回傳 `{ error }` 或 `{ success, data }`，不使用 throw

### useTaskManager Hook
- 集中管理所有 CRUD 操作（tasks, subtasks, links, files, projects, config）
- **樂觀更新**：先更新本地狀態，失敗時 rollback
- **sessionStorage 快取**：key = `'dash_cache'`
- **Auth 錯誤處理**：偵測到未授權時自動跳轉 `/login`
- 預設分類：`['商務合作', '活動', '播出/開始', '行銷', '發行', '市場展']`

### UI 慣例
- 主題透過 `lib/theme.js` 的 mutable export 切換（`X`, `SC`, `PC`, `CC`, `PJC`）
- 字體：`'Noto Sans TC'` (內文)、`'JetBrains Mono'` (等寬)
- Toast 通知透過 `useTaskManager` 的 `showToast(msg, type)` 顯示
- 拖曳排序使用 `@dnd-kit`，需設定 sensors 和 sortable context

### 檔案上傳流程

**Full-Stack 版**：
1. 前端 → `POST /api/upload`（FormData，含 taskId）
2. API route → R2 `PutObjectCommand`
3. 成功後呼叫 `createFileRecord()` Server Action 寫入 DB
4. 下載透過 `GET /api/download?key=xxx`（R2 presigned URL 或直接串流）

**GWS 版**：
1. 前端 → `POST /api/upload`（FormData，含 taskId）
2. API route → Google Drive `uploadToDrive(taskId, buffer, fileName, mimeType)`
3. 成功後呼叫 `createFileRecord()` Server Action 寫入 Google Sheets
4. 下載透過 `GET /api/download?key=xxx`（key = Drive 檔案 ID）

## 注意事項

### 共通
- **configTable 命名**：schema 中 export 名為 `configTable`（非 `config`），因為 `config` 與 Next.js 保留名衝突。在 `actions/config.js` 中用 `import { configTable as config }` 別名使用
- **bcryptjs**：必須在 `next.config.js` 設定 `serverExternalPackages: ['bcryptjs']`，防止打包到 client
- **middleware 限制**：`middleware.js` 只檢查 cookie 是否存在，不驗證 session 有效性。實際驗證在各 Server Action 中進行

### GWS 版特有
- **r2Key 欄位**：在 GWS 版中實際存儲 Google Drive 檔案 ID（欄位名沿用以保持兩版本 schema 一致）
- **記憶體快取**：`cache.js` 提供 30 秒 TTL 快取，減少 Google API 呼叫。所有 DAL 寫入操作後自動失效對應快取
- **Google API 配額**：注意 Google Sheets API 配額限制（每分鐘 300 次讀取），高併發場景不適用
- **級聯刪除**：GWS 版的級聯刪除在 Application-level 實現（`sheets-dal.js` 中的 `deleteTaskById`），非資料庫層級

## 關鍵參考檔案

### Full-Stack 版
- `full-stack/src/server/db/schema.js` — Drizzle Schema 定義
- `full-stack/src/hooks/useTaskManager.js` — 核心 hook
- `full-stack/src/lib/auth.js` — 認證機制
- `full-stack/src/server/actions/tasks.js` — Server Action 標準範例
- `full-stack/src/lib/theme.js` — 主題系統
- `full-stack/src/components/dashboard/Dashboard.jsx` — 主元件（187 行）
- `full-stack/src/components/dashboard/tabs/` — 6 個 tab 子元件

### GWS 版
- `gws/src/lib/sheets-dal.js` — Google Sheets 資料存取層（551 行，核心）
- `gws/src/lib/google.js` — Google API 客戶端初始化
- `gws/src/lib/drive.js` — Google Drive 檔案操作
- `gws/src/lib/cache.js` — 記憶體快取（30 秒 TTL）
- `gws/src/hooks/useTaskManager.js` — 核心 hook
- `gws/src/components/dashboard/Dashboard.jsx` — 主元件（229 行）
- `gws/scripts/seed.js` — Google Sheets 初始化腳本

---

# AI 工具指示

## Agent Team 分工規則

| Agent 類型 | 使用時機 |
|-----------|---------|
| **Explore** | 查找元件、追蹤資料流、理解既有模式。探索前先讀本 CLAUDE.md 避免重複搜尋 |
| **Plan** | 涉及多檔案修改、架構變動、新功能設計。必須參考 `milestone.md` 確認方向一致 |
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
