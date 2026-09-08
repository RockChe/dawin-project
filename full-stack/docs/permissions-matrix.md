# 授權矩陣（Permissions Matrix）

這份文件是 `src/lib/permissionsMatrix.js` 的人類可讀版本，兩者內容必須完全一致。
`src/__tests__/authzCoverage.test.js` 是這份 matrix 的護欄：

- **default-deny**：每一支 server action export、每一支 API route handler，都必須在
  `MATRIX` 中被明確分類，或列進 `EXEMPT`（帶理由）。沒被分類＝測試判紅。
- 判定方式不是「偵測這支函式有沒有副作用」（那種做法會漏掉 `db.execute(sql\`...\`)`
  這類寫法，也擋不住 helper 封裝），而是反過來：**清點所有 export，逐一比對 matrix**，
  漏列即紅。
- 除了「有沒有分類」，護欄還會反查原始碼：**每一支被分類的 action，第一個
  statement 必須就是對應的 `withCap('<cap>', …)`**（route 則是 `withRouteCap`）。
  這防止「matrix 寫對了，但 code 其實沒包」或「cap 寫錯」的假象。

新增一支 action / route 卻忘了：
1. 包 `withCap` / `withRouteCap`，或
2. 把它加進這份 matrix（或加進 EXEMPT 並寫理由），

`npm test` 就會紅。

## Server Actions

| 檔案 | Export | Capability | 為什麼 |
|---|---|---|---|
| `tasks.js` | getAllTasks | read | 讀取任務清單 |
| `tasks.js` | getAllSubtasks | read | 讀取子任務清單 |
| `tasks.js` | getAllLinks | read | 讀取任務關聯連結 |
| `tasks.js` | getAllFiles | read | 讀取任務附件清單 |
| `tasks.js` | getDashboardData | read | 讀取任務看板彙總資料 |
| `tasks.js` | createTask | write | 新增任務 |
| `tasks.js` | updateTask | write | 修改任務 |
| `tasks.js` | deleteTask | write | 刪除單一任務 |
| `tasks.js` | createSubtask | write | 新增子任務 |
| `tasks.js` | updateSubtask | write | 修改子任務 |
| `tasks.js` | deleteSubtask | write | 刪除子任務 |
| `tasks.js` | toggleSubtask | write | 切換子任務完成狀態 |
| `tasks.js` | createLink | write | 新增任務關聯 |
| `tasks.js` | deleteLink | write | 刪除任務關聯 |
| `tasks.js` | createFileRecord | write | 建立附件紀錄（供 `/api/upload` 呼叫） |
| `tasks.js` | deleteFile | write | 刪除附件紀錄 |
| `tasks.js` | upsertTasks | write | 匯入時批次新增/更新任務 |
| `tasks.js` | updateManyTasks | write | 批次修改任務 |
| `tasks.js` | deleteManyTasks | write | 批次刪除任務 |
| `tasks.js` | deleteAllTasks | manage | 清空全部任務，破壞力等同管理操作，只給 super_admin |
| `projects.js` | getProjects | read | 讀取專案清單 |
| `projects.js` | getProjectWithTasks | read | 讀取單一專案含任務 |
| `projects.js` | createProject | write | 新增專案 |
| `projects.js` | updateProject | write | 修改專案 |
| `projects.js` | deleteProject | write | 刪除專案 |
| `projects.js` | deleteProjectBanner | write | 刪除專案 banner |
| `projects.js` | reorderProjects | write | 調整專案排序 |
| `config.js` | getConfig | read | 讀取單一設定值 |
| `config.js` | getConfigs | read | 讀取多個設定值 |
| `config.js` | saveConfig | write | 寫入設定值 |
| `userSettings.js` | getUserSettings | self | 讀取自己的使用者偏好設定 |
| `userSettings.js` | setUserSetting | self | 寫入自己的使用者偏好設定 |
| `dashboard.js` | getInitialData | read | 首頁初始資料，讀取性質 |
| `auth.js` | setPassword | self | 修改自己的密碼；用 `const result = await withCap('self', …)` 形式，因外層要保留「未登入導回登入頁」的行為，但仍必須被 matrix 涵蓋——豁免掉的話日後誤刪 `withCap` 沒人會發現 |
| `users.js` | getUsers | manage | 雖然名字以 `get` 開頭，但回傳全體使用者清單（含 email/role），是管理性質而非一般 read |
| `users.js` | createUser | manage | 建立使用者帳號 |
| `users.js` | updateUser | manage | 修改使用者帳號 |
| `users.js` | deleteUser | manage | 刪除使用者帳號 |
| `users.js` | resetUserPassword | manage | 代重設他人密碼 |
| `backup.js` | getBackupSettings | manage | 名字以 `get` 開頭，但備份設定屬管理範疇 |
| `backup.js` | saveBackupSettings | manage | 寫入備份設定 |
| `backup.js` | getBackupHistory | manage | 名字以 `get` 開頭，但備份歷史屬管理範疇 |
| `backup.js` | getAuditLogs | manage | 名字以 `get` 開頭，但稽核紀錄屬管理範疇 |
| `backup.js` | testR2ConnectionAction | manage | 測試 R2 連線設定 |
| `backup.js` | testGDriveConnectionAction | manage | 測試 GDrive 連線設定 |
| `backup.js` | triggerBackup | manage | 手動觸發整庫備份 |

### Exempt（server actions）

| 檔案 | Export | 為什麼豁免 |
|---|---|---|
| `auth.js` | login | 未登入時才會被呼叫，此時沒有 session 可供授權判斷 |
| `auth.js` | logout | 登出動作不需要任何能力即可執行 |
| `auth.js` | getSessionInfo | 只回傳呼叫者自己的 session 資訊，無跨使用者風險 |

## API Routes

| 檔案 | Method | Capability | 為什麼 |
|---|---|---|---|
| `api/upload/route.js` | POST | write | 上傳任務附件到 R2 並寫入紀錄 |
| `api/upload-banner/route.js` | POST | write | 上傳專案 banner 圖片到 R2 |
| `api/fetch-csv/route.js` | POST | write | 代抓遠端 CSV，供匯入流程使用 |
| `api/download/route.js` | GET | export | 產生附件下載連結；Rock 2026-09-08 重裁：viewer 不得開附件 |
| `api/backup/route.js` | GET | manage | 手動下載整庫備份，內含 users 表與密碼雜湊，原本就是 super_admin only；用 export 會讓一般 admin 也拿得到，等於權限放寬 |
| `api/debug/route.js` | GET | manage | debug 端點回傳 session/DB 內部狀態；業務邏輯委派給 `withRouteCap('manage', …)` 包的 `debugHandler`，正式環境的 404 判斷跑在授權判斷之前（見下方「委派形狀」） |

### Exempt（API routes）

| 檔案 | Method | 為什麼豁免 |
|---|---|---|
| `api/health/route.js` | GET | 公開健康檢查，只回傳 status/timestamp/db/cronSecret 布林，無敏感資料 |
| `api/backup/route.js` | POST | Vercel Cron 觸發，走 `CRON_SECRET` 而非 session 授權（見 Task 6） |

## `/api/debug` 的委派形狀

`/api/debug` 的 `GET` 不是直接 `export const GET = withRouteCap(...)`，而是：

```js
export async function GET(request, ctx) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  return debugHandler(request, ctx);
}

const debugHandler = withRouteCap('manage', async () => { ... });
```

原因：正式環境要「一律回 404」而不是「未登入回 401」，否則就等於承認這個端點存在。
NODE_ENV 判斷不是 session 授權，必須跑在 `withRouteCap` 之前；但業務邏輯仍然完全在
`withRouteCap` 的 callback 裡執行。`authzCoverage.test.js` 的 `routeAssignmentOf` 會
辨識這種「委派給另一個識別字」的形狀，回頭找到 `debugHandler` 的定義再驗證。

## 護欄如何運作（`authzCoverage.test.js`）

1. **清點**：掃描 `src/server/actions/*.js` 與 `src/app/api/**/route.js`，抓出所有
   `export async function NAME`、`export const NAME = ...`、`export { NAME }` 形式的
   export，以及 route 的 `GET/POST/PUT/PATCH/DELETE`。
2. **比對**：每一項要嘛在 `MATRIX` 裡有分類，要嘛在 `EXEMPT` 裡有名字——兩邊都沒有
   就判紅（default-deny）。
3. **反查**：對 `MATRIX` 裡列出的每一項，回頭讀原始碼，確認**函式 body 的第一個
   statement**就是 `withCap('<cap>', …)`（或 `const x = await withCap('<cap>', …)`）；
   route 則確認賦值來源是 `withRouteCap('<cap>', …)`。只看第一個 statement 是為了擋掉
   `if (false) { return withCap(...) }` 這種死分支假裝有包的情況。
4. **自我驗證（負向 fixture）**：測試檔內建一段刻意寫錯的 fixture 原始碼（未分類、
   沒包、死分支、cap 錯、arrow function、`export { name }` 等各種繞過形式），用
   **跟正式檢查完全同一組 helper** 去驗證這些壞例子真的會被抓到。這是護欄的護欄——
   如果 fixture 改用另一套 regex，测试可能綠但正式邏輯其實沒在驗證。

新增 action / route 時：
1. 用 `withCap('<cap>', ...)` 或 `withRouteCap('<cap>', ...)` 包起來，且必須是
   函式的第一個 statement / 唯一賦值來源。
2. 把它加進 `src/lib/permissionsMatrix.js` 的 `MATRIX`（連同這份文件的表格）。
3. 如果它刻意不需要授權（例如未登入才會呼叫），加進 `EXEMPT` 並寫清楚理由——
   這樣加新例外的動作會出現在 code review 裡，不會被默默放過。
