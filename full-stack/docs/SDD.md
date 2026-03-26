# 架構設計文檔 (SDD)

記錄架構決策的「為什麼這樣設計」，每個決策含背景、選項比較、決策與理由。

---

### 決策：ThemeProvider React Context 取代 Mutable Export

- **背景**：原主題系統用 `export let X = {...}` + `applyTheme()` 直接修改 module export，導致 React 無法偵測變更（BUG-002）
- **選項**：
  - A) CSS Variables — 純 CSS 方案，無法與 JS 動態計算整合
  - B) Zustand/Jotai — 輕量狀態庫，但增加外部依賴
  - C) React Context + useTheme hook — 原生 React 方案，零依賴
- **決策**：C — `ThemeProvider.jsx` 提供 Context，`theme.js` 保留純常數/工廠函式
- **理由**：零外部依賴、React 原生支援、工廠函式（`mkSC`, `mkPC`, `mkCC`, `mkPJC`）可根據 theme key 動態生成色彩。Context 與 localStorage 同步，SSR 環境用 try-catch 防護

---

### 決策：樂觀更新 + Rollback 模式

- **背景**：使用者在 Dashboard 頻繁操作（編輯欄位、切換狀態、拖曳排序），若等待 server 回應才更新 UI，體驗遲滯
- **選項**：
  - A) 悲觀更新 — 等 server 成功再更新 UI
  - B) 樂觀更新 + rollback — 先更新 UI，失敗時回滾
  - C) 樂觀更新 + 自動重試 — 失敗後背景重試
- **決策**：B — 所有 CRUD 在 `useTaskManager` 中遵循 `prev = state → setState → server call → rollback on error`
- **理由**：即時回饋提升 UX，rollback 確保 UI 與 DB 一致。自動重試增加複雜度且不一定適用（如權限錯誤不應重試）。Toast 通知告知用戶失敗原因

---

### 決策：sessionStorage 快取（5 分鐘 TTL）

- **背景**：Dashboard 頁面重新載入時，需從 server 取得全部資料（projects, tasks, subtasks, links, files, config），每次約 6 個 Server Action 呼叫
- **選項**：
  - A) 無快取 — 每次 reload 都 fetch
  - B) localStorage — 跨 tab 共用，長期持久
  - C) sessionStorage — 單 tab 生命週期，關閉即清
- **決策**：C — key `'dash_cache'`，TTL 5 分鐘，4 MB 上限
- **理由**：sessionStorage 不跨 tab（避免 stale 資料在多 tab 間不一致）、關閉 tab 即清除（無持久化隱私風險）。5 分鐘 TTL 平衡即時性與 API 負載。Force refresh 參數允許 import 後立即同步

---

### 決策：safeRequireAuth 不 throw

- **背景**：原 `requireAuth()` 在 session 無效時 throw Error，但 Next.js Server Action 拋出的 Error 在客戶端反序列化時偶爾觸發 "digest mismatch" 錯誤
- **選項**：
  - A) 繼續 throw + try-catch — 需在每個 Server Action 加 try-catch
  - B) 返回 `{ session, error }` tuple — 不 throw，用條件判斷
  - C) 自訂 Error class — 讓 Next.js 正確序列化
- **決策**：B — `safeRequireAuth()` 返回 `{ session: null, error: 'UNAUTHORIZED' }` 或 `{ session, error: null }`
- **理由**：避免 Next.js digest error，統一所有 Server Action 的錯誤處理模式（`if (error) return { error }`），與 hook 層的 `checkAuthError()` 搭配實現自動跳轉

---

### 決策：欄位白名單模式（Server Action 輸入驗證）

- **背景**：`updateTask(id, data)` 的 `data` 來自客戶端，直接 `.set(data)` 允許篡改 `createdBy`、`projectId` 等系統欄位（BUG-003）
- **選項**：
  - A) Zod schema 驗證 — 完整型別驗證 + 轉換
  - B) 白名單陣列 — 簡單列舉允許欄位
  - C) 黑名單排除 — 列舉禁止欄位
- **決策**：B — 每個 update function 定義 `const ALLOWED = [...]`，迴圈只取允許欄位
- **理由**：白名單比黑名單安全（新增欄位預設被排除），比 Zod 簡單（此專案無 TypeScript，Zod 效益有限）。意圖明確，未來維護者一眼就能看出允許範圍

---

### 決策：DB 先刪 → R2 後清（檔案刪除順序）

- **背景**：刪除檔案需同時操作 DB 和 R2，若其中一方失敗，會產生不一致
- **選項**：
  - A) R2 先刪 → DB 後刪 — R2 成功但 DB 失敗時，DB 記錄指向不存在的檔案
  - B) DB 先刪 → R2 後清 — DB 成功但 R2 失敗時，R2 殘留孤立檔案
  - C) Transaction — 兩者原子操作
- **決策**：B — 先查 R2 key → 刪 DB → best-effort 清理 R2
- **理由**：neon-http driver 不支援完整 transaction。選項 A 更糟（UI 顯示檔案存在但下載 404）。選項 B 的孤立檔僅浪費儲存空間，不影響使用者體驗，可日後批次清理

---

### 決策：R2 上傳順序（先 R2 → DB 失敗時清 R2）

- **背景**：上傳檔案需先存到 R2 再建 DB 記錄，若順序反過來會更糟
- **選項**：
  - A) 先 DB → 後 R2 — DB 記錄存在但檔案不存在（下載 404）
  - B) 先 R2 → 後 DB — 若 DB 失敗，清理 R2 孤檔
- **決策**：B — 上傳 R2 → 呼叫 `createFileRecord()` → 失敗時 `deleteFromR2(key)`
- **理由**：選項 A 更危險（用戶看到檔案但無法下載）。選項 B 若 cleanup 也失敗，僅浪費儲存（已 log 記錄，可日後清理）

---

### 決策：Middleware 只查 Cookie 存在（不驗證 Session）

- **背景**：`middleware.js` 需決定是否放行請求到 Dashboard 頁面
- **選項**：
  - A) 完整 session 驗證 — 每個請求查 DB 驗證 token + 過期
  - B) 只查 cookie 存在 — 有 `session_token` cookie 即放行
- **決策**：B — cookie 存在即放行，實際驗證在各 Server Action 的 `safeRequireAuth()` 中
- **理由**：Middleware 在每個請求都執行，DB 查詢有延遲成本（尤其 Neon 冷啟動）。Cookie 存在檢查幾乎零成本。若 cookie 存在但 session 已過期，Server Action 會返回 `UNAUTHORIZED`，hook 層自動跳轉 `/login`

---

### 決策：Session 7 天過期（無 Refresh Token）

- **背景**：Dashboard 是內部工具，使用者為行銷團隊，非高安全性系統
- **選項**：
  - A) 短期 session（24 小時）+ refresh token
  - B) 中期 session（7 天）無 refresh
  - C) 長期 session（30 天）
- **決策**：B — `SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000`，HTTP-only cookie
- **理由**：7 天足夠一般工作週使用，避免頻繁重新登入。HTTP-only 防止 XSS 竊取。無 refresh token 簡化架構。DB 儲存 session 允許伺服器端撤銷（登出時刪除）。React `cache()` 避免同一請求多次查詢

---

### 決策：專案權限模型（createdBy + super_admin）

- **背景**：多用戶環境中，需防止用戶修改/刪除他人的專案（BUG-004）
- **選項**：
  - A) 所有人可編輯所有專案 — 簡單但無控管
  - B) 只有建立者可編輯 — 安全但管理員無法介入
  - C) 建立者 + super_admin 可編輯 — 用戶自治 + 管理員覆寫
- **決策**：C — `createdBy === session.userId || role === 'super_admin'`
- **理由**：用戶對自己的專案有完整控制權，super_admin 可在必要時介入（如員工離職後接管專案）

---

### 決策：sortOrder 原子化 SQL

- **背景**：新建專案的 `sortOrder` 需要是目前最大值 + 1，但 SELECT → INSERT 有競態風險（BUG-005）
- **選項**：
  - A) 應用層 SELECT MAX → +1 → INSERT（有競態）
  - B) SQL 層 `COALESCE((SELECT MAX(...)), 0) + 1` 嵌入 INSERT（原子）
  - C) UUID 或時間戳作為排序值（無衝突但不精確）
- **決策**：B — 單一 SQL 語句完成讀取最大值並插入
- **理由**：原子操作消除併發請求間的時間窗口。SQL subquery 在 Neon PostgreSQL 上效能足夠。比 application-level lock 簡單

---

### 決策：資料庫備份雙目標架構（R2 + Google Drive）

- **背景**：系統需要自動備份機制，防止資料遺失。備份目標需考慮可靠性和存取便利性
- **選項**：
  - A) 單一目標（僅 R2）— 簡單，但與主儲存同平台，有單點故障風險
  - B) 單一目標（僅 Google Drive）— 異地備份，但依賴外部服務
  - C) 雙目標（R2 + Google Drive）— 異地冗餘，任一目標失敗仍有備份
- **決策**：C — R2 用 S3 API（`@aws-sdk/client-s3`），Google Drive 用 JWT Service Account（`googleapis`）
- **理由**：R2 與主儲存同技術棧（複用經驗），Google Drive 提供異地冗餘且團隊成員可直接從 Google Drive 下載備份。雙目標並行上傳，互不影響。自動清理策略（保留 N 份）防止儲存膨脹

---

### 決策：審計日誌（Audit Log）非阻斷模式

- **背景**：敏感操作（密碼重設、用戶刪除、專案刪除、備份觸發）需要記錄以便事後追查
- **選項**：
  - A) 同步記錄 + throw on failure — 確保每筆操作都記錄，但 audit 故障會阻斷正常操作
  - B) 非同步記錄 + catch error — 記錄失敗不影響主流程，但可能遺漏部分記錄
  - C) 訊息佇列 — 可靠但架構複雜
- **決策**：B — `logAudit()` 內部 try-catch，失敗僅 `console.error`，不 throw
- **理由**：審計日誌是輔助功能，不應影響核心業務流程。若 audit 表暫時不可用，用戶操作不應被中斷。console.error 確保問題可追蹤。對內部工具而言，偶爾遺漏一筆 audit 記錄的風險遠低於阻斷操作的代價

---

### 決策：AES-256-GCM 加密敏感設定（configTable）

- **背景**：備份功能需要儲存 R2 API Key 和 Google Drive Private Key 等敏感資訊，需決定儲存方式
- **選項**：
  - A) 環境變數 — 最安全，但每次修改需重新部署
  - B) configTable 明文儲存 — 方便 UI 管理，但資料庫洩漏時敏感資訊暴露
  - C) configTable 加密儲存 — UI 可管理，且加密保護
- **決策**：C — 使用 AES-256-GCM（隨機 salt + IV + authTag），以 `SESSION_SECRET` 為金鑰
- **理由**：管理員可透過 UI 設定備份認證，無需每次改設定都重新部署。AES-256-GCM 提供認證加密（防篡改）。隨機 salt 確保相同明文產生不同密文。向下相容舊格式（固定 salt → 隨機 salt）平滑遷移

---

### 決策：Owner 來源統一為 Users 表

- **背景**：原 Owner 欄位允許自由輸入文字，同時 configTable 儲存一份 `owners` 清單。兩份來源容易不一致（改名後、刪除用戶後），且自由輸入導致拼寫不統一
- **選項**：
  - A) 維持自由輸入 + configTable 清單 — 彈性高但資料不一致
  - B) 純 Users 表下拉選單 — 強制一致，移除 configOwners
  - C) 獨立 owners 表 — 最正規化，但增加額外表和維護成本
- **決策**：B — Owner 來源純粹以 Users 表為唯一來源，UI 改為下拉選單，支援批次指派
- **理由**：Users 表已包含所有團隊成員，無需重複維護。下拉選單消除拼寫錯誤。帳號改名時 Owner 自動同步（顯示名稱 = users.name）。批次指派功能提升效率。移除 configOwners 簡化資料流

---

### 決策：Auth 錯誤自動跳轉 /login

- **背景**：用戶在操作途中 session 可能過期（7 天到期、管理員撤銷），需統一處理
- **選項**：
  - A) 每個操作手動檢查並跳轉
  - B) 集中式 `checkAuthError(result)` 工具函式
  - C) Axios interceptor 或 middleware 自動處理
- **決策**：B — `useTaskManager` 中定義 `checkAuthError()`，所有 Server Action 呼叫後統一檢查
- **理由**：統一入口，不遺漏任何操作。使用 `window.location.href`（hard redirect）而非 `useRouter().push()`，確保完整清除客戶端狀態。error code 統一為 `'UNAUTHORIZED'` / `'FORBIDDEN'`
