# Dawin Dash (Full-Stack) — 專案開發指引

## 專案概述

影視 IP 專案管理儀表板，供內部團隊追蹤多個影視專案的任務進度、時程、檔案與人員分工。

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
│   ├── (auth)/login/          # 登入頁
│   ├── (auth)/set-password/   # 首次登入設定密碼
│   ├── (dashboard)/dashboard/ # 主儀表板
│   ├── (dashboard)/project/[id]/ # 專案詳情頁
│   └── api/                   # API routes (upload, download, fetch-csv, health)
├── components/
│   ├── ThemeProvider.jsx      # 主題 Context Provider + useTheme hook
│   └── dashboard/             # 17 個元件 + tabs/ (6 個子元件)
├── hooks/useTaskManager.js    # 核心狀態管理 hook
├── lib/
│   ├── auth.js                # Session 認證（7 天過期）
│   ├── r2.js                  # R2 檔案操作
│   ├── theme.js               # 主題常數與工廠函式（THEMES, F, FM, mkSC 等）
│   └── utils.js               # 日期格式化、進度計算、CSV 工具
├── server/
│   ├── actions/               # Server Actions（auth, config, projects, tasks, users）
│   └── db/
│       ├── index.js           # Neon 連線
│       └── schema.js          # Drizzle schema 定義
└── middleware.js               # 路由保護
```

## 資料庫 Schema

### Enums

| Enum | 名稱 | 值 |
|------|------|-----|
| roleEnum | `'role'` | `'super_admin'`, `'admin'` |
| statusEnum | `'task_status'` | `'已完成'`, `'進行中'`, `'待辦'`, `'提案中'`, `'待確認'` |
| priorityEnum | `'priority'` | `'高'`, `'中'`, `'低'` |

### Tables（8 張）

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

定義在 `src/server/db/schema.js`（Drizzle schema）。

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
- 主題透過 `ThemeProvider`（React Context）管理，元件使用 `useTheme()` hook 取得 `X`, `SC`, `PC`, `CC`, `PJC`, `inputStyle`
- 字體：`'Noto Sans TC'` (內文)、`'JetBrains Mono'` (等寬)
- Toast 通知透過 `useTaskManager` 的 `showToast(msg, type)` 顯示
- 拖曳排序使用 `@dnd-kit`，需設定 sensors 和 sortable context

### 檔案上傳流程
1. 前端 → `POST /api/upload`（FormData，含 taskId）
2. API route → R2 `PutObjectCommand`
3. 成功後呼叫 `createFileRecord()` Server Action 寫入 DB
4. 下載透過 `GET /api/download?key=xxx`（R2 presigned URL 或直接串流）

## 注意事項

- **configTable 命名**：schema 中 export 名為 `configTable`（非 `config`），因為 `config` 與 Next.js 保留名衝突。在 `actions/config.js` 中用 `import { configTable as config }` 別名使用
- **bcryptjs**：必須在 `next.config.js` 設定 `serverExternalPackages: ['bcryptjs']`，防止打包到 client
- **middleware 限制**：`middleware.js` 只檢查 cookie 是否存在，不驗證 session 有效性。實際驗證在各 Server Action 中進行

## 關鍵參考檔案

- `src/server/db/schema.js` — Drizzle Schema 定義
- `src/hooks/useTaskManager.js` — 核心 hook
- `src/lib/auth.js` — 認證機制
- `src/server/actions/tasks.js` — Server Action 標準範例
- `src/components/ThemeProvider.jsx` — 主題 Context（ThemeProvider + useTheme hook）
- `src/lib/theme.js` — 主題常數與工廠函式
- `src/components/dashboard/Dashboard.jsx` — 主元件（187 行）
- `src/components/dashboard/tabs/` — 6 個 tab 子元件

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
