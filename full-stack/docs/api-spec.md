# Dawin Dash REST API 規格

供外部服務（n8n、Cloudflare Workers、Python Chatbot）存取 Dawin Dash 專案資料的 REST API。
部署在現有 Vercel Next.js app，路徑前綴 `/api/mcp/`。

---

## 架構

```
Python Bot (Railway) ──┐
n8n workflow ───────────┤  HTTP + Bearer Token
CF Workers bot ─────────┤
MCP Server (本地) ──────┘
                        ▼
              ┌──────────────────────────┐
              │  /api/mcp/*  (Vercel)    │
              │  API Key 認證            │
              │  Drizzle ORM → Neon DB  │
              └──────────────────────────┘
```

## 認證

所有請求需帶 `Authorization: Bearer <API_KEY>` header。

```bash
curl -H "Authorization: Bearer YOUR_KEY" https://your-app.vercel.app/api/mcp/projects
```

金鑰儲存在 Vercel 環境變數 `MCP_API_KEY`，用 `openssl rand -hex 32` 產生。

## 回應格式

**成功**：
```json
{ "success": true, "data": { ... } }
```

**錯誤**：
```json
{ "error": "錯誤訊息" }
```

| HTTP Status | 意義 |
|-------------|------|
| 200 | 成功 |
| 201 | 已建立 |
| 400 | 請求格式錯誤 |
| 401 | 未認證（API Key 錯誤或缺少） |
| 404 | 資源不存在 |
| 422 | 驗證失敗（欄位無效） |
| 500 | 伺服器錯誤 |

---

## Endpoints

### Projects

#### `GET /api/mcp/projects`

列出所有專案。

**Response**：
```json
{
  "success": true,
  "data": {
    "projects": [
      { "id": "uuid", "name": "海賊王劇場版", "sortOrder": 1, "createdAt": "...", "updatedAt": "..." }
    ],
    "total": 5
  }
}
```

#### `GET /api/mcp/projects/:id`

取得專案詳情，含所有任務與子任務。

**Response**：
```json
{
  "success": true,
  "data": {
    "project": { "id": "uuid", "name": "...", ... },
    "tasks": [ { "id": "uuid", "task": "聯繫配音演員", "status": "進行中", ... } ],
    "subtasks": [ { "id": "uuid", "taskId": "uuid", "name": "...", "done": false, ... } ]
  }
}
```

#### `POST /api/mcp/projects`

建立新專案。

**Request Body**：
```json
{ "name": "新專案名稱" }
```

**Response** (201)：
```json
{ "success": true, "data": { "project": { "id": "uuid", "name": "新專案名稱", ... } } }
```

**驗證**：name 必填，最長 255 字元。

#### `PATCH /api/mcp/projects/:id`

更新專案。

**Request Body**（部分更新）：
```json
{ "name": "新名稱", "sortOrder": 2 }
```

#### `DELETE /api/mcp/projects/:id`

刪除專案（CASCADE 刪除下屬 tasks/subtasks/links/files）。

---

### Tasks

#### `GET /api/mcp/tasks`

列出任務，支援篩選與分頁。

**Query Parameters**：

| 參數 | 類型 | 說明 |
|------|------|------|
| `projectId` | UUID | 篩選特定專案 |
| `status` | string | `已完成`、`進行中`、`待辦`、`提案中`、`待確認` |
| `owner` | string | 負責人（模糊匹配） |
| `offset` | number | 跳過前 N 筆（預設 0） |
| `limit` | number | 回傳數量上限（預設 50，最大 200） |

**Response**：
```json
{
  "success": true,
  "data": {
    "tasks": [ { "id": "uuid", "projectId": "uuid", "task": "...", "status": "進行中", ... } ],
    "total": 42,
    "offset": 0,
    "limit": 50
  }
}
```

#### `POST /api/mcp/tasks`

建立任務。

**Request Body**：
```json
{
  "projectId": "uuid",       // 必填
  "task": "任務名稱",         // 必填，最長 500 字元
  "status": "待辦",           // 選填，預設 '待辦'
  "category": "行銷",         // 選填
  "startDate": "2026-03-22", // 選填，ISO 格式
  "endDate": "2026-04-01",   // 選填，ISO 格式
  "duration": 10,             // 選填，天數
  "owner": "小王",            // 選填
  "priority": "高",           // 選填，預設 '中'，可選 '高'/'中'/'低'
  "notes": "備註內容"         // 選填
}
```

#### `PATCH /api/mcp/tasks/:id`

部分更新任務（只傳需要修改的欄位）。

```json
{ "status": "已完成", "owner": "小李" }
```

#### `DELETE /api/mcp/tasks/:id`

刪除任務（同時清理 R2 上的附件檔案）。

---

### Subtasks

#### `GET /api/mcp/subtasks?taskId=uuid`

列出指定任務的子任務。`taskId` 為必填參數。

**Response**：
```json
{
  "success": true,
  "data": {
    "subtasks": [
      { "id": "uuid", "taskId": "uuid", "name": "確認場地", "owner": "小王", "done": false, "doneDate": null, ... }
    ],
    "total": 3
  }
}
```

#### `POST /api/mcp/subtasks`

建立子任務。

```json
{ "taskId": "uuid", "name": "子任務名稱", "owner": "小王", "notes": "備註" }
```

#### `PATCH /api/mcp/subtasks/:id`

更新子任務。設定 `done: true` 時自動填入 `doneDate`，設定 `done: false` 時清除。

```json
{ "done": true }
```

#### `DELETE /api/mcp/subtasks/:id`

刪除子任務。

---

### Dashboard

#### `GET /api/mcp/dashboard`

全域儀表板統計摘要。

**Response**：
```json
{
  "success": true,
  "data": {
    "projectCount": 5,
    "taskCounts": {
      "total": 42,
      "已完成": 15,
      "進行中": 12,
      "待辦": 10,
      "提案中": 3,
      "待確認": 2
    },
    "overallProgress": 65,
    "overdueTasks": [
      { "id": "uuid", "task": "逾期任務名", "endDate": "2026-03-15", "status": "進行中", ... }
    ],
    "recentActivity": [
      { "id": "uuid", "task": "最近更新的任務", "updatedAt": "...", ... }
    ]
  }
}
```

---

### Reports

#### `GET /api/mcp/reports/daily?date=2026-03-22`

日報數據。`date` 預設今天，格式 `YYYY-MM-DD`。

**Response**：
```json
{
  "success": true,
  "data": {
    "date": "2026-03-22",
    "summary": { "projectCount": 5, "taskCounts": {...}, "overallProgress": 65 },
    "completedToday": [ { "subtask_name": "...", "taskName": "...", "projectName": "..." } ],
    "tasksUpdatedToday": [ { "task": "...", "status": "...", "updatedAt": "..." } ],
    "overdueTasks": [ { "task": "...", "endDate": "...", "owner": "..." } ],
    "upcomingDeadlines": [ { "task": "...", "endDate": "...", "daysLeft": 3 } ]
  }
}
```

#### `GET /api/mcp/reports/weekly?weekStart=2026-03-17`

週報數據。`weekStart` 預設本週一，格式 `YYYY-MM-DD`。

**Response**：
```json
{
  "success": true,
  "data": {
    "weekStart": "2026-03-17",
    "weekEnd": "2026-03-23",
    "summary": { "projectCount": 5, "taskCounts": {...}, "overallProgress": 65 },
    "completedThisWeek": [ ... ],
    "tasksCreatedThisWeek": [ ... ],
    "progressByProject": [
      { "projectId": "uuid", "projectName": "海賊王劇場版", "taskTotal": 10, "taskDone": 6, "pct": 60 }
    ],
    "overdueTasks": [ ... ]
  }
}
```

---

### Search

#### `GET /api/mcp/search?q=keyword&projectId=uuid`

全文搜尋任務與子任務。`q` 為必填，`projectId` 選填（限縮範圍）。

搜尋欄位：`tasks.task`、`tasks.notes`、`tasks.owner`、`tasks.category`、`subtasks.name`、`subtasks.notes`（ILIKE）。

**Response**：
```json
{
  "success": true,
  "data": {
    "results": [
      { "type": "task", "item": { "id": "uuid", "task": "...", ... }, "projectName": "..." },
      { "type": "subtask", "item": { "id": "uuid", "name": "...", ... }, "taskName": "...", "projectName": "..." }
    ],
    "total": 7
  }
}
```

---

## 檔案結構

```
src/app/api/mcp/
├── _lib/
│   ├── auth.js        ← API Key 驗證（Bearer token, timing-safe compare）
│   ├── response.js    ← 統一回應格式：ok(), created(), err(), notFound()
│   ├── validate.js    ← UUID 驗證、分頁解析、enum 白名單
│   └── queries.js     ← 純 DB 查詢層（直接用 Drizzle，不走 Server Action）
├── projects/
│   ├── route.js       ← GET (list), POST (create)
│   └── [id]/route.js  ← GET (detail), PATCH, DELETE
├── tasks/
│   ├── route.js       ← GET (list/filter), POST (create)
│   └── [id]/route.js  ← PATCH, DELETE
├── subtasks/
│   ├── route.js       ← GET (list), POST (create)
│   └── [id]/route.js  ← PATCH, DELETE
├── dashboard/
│   └── route.js       ← GET
├── reports/
│   ├── daily/route.js ← GET
│   └── weekly/route.js← GET
└── search/
    └── route.js       ← GET
```

## 資料模型參考

詳見 `src/server/db/schema.js`：

- **status enum**：`'已完成'`, `'進行中'`, `'待辦'`, `'提案中'`, `'待確認'`
- **priority enum**：`'高'`, `'中'`, `'低'`
- **UUID 格式**：所有 ID 皆為 UUID v4
- **日期格式**：`YYYY-MM-DD`（ISO 8601）
