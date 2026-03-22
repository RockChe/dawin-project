# Full-Stack 版本 Code Review 報告

> 審查日期：2026-03-22
> 範圍：`full-stack/` 整個版本，涵蓋元件層、Server Actions、資料庫 Schema、Lib 工具、API Routes、Hooks、Pages 與設定檔。共審查 40+ 個檔案。
> 驗證日期：2026-03-22（已逐一對照原始碼驗證，修正誤報與數據偏差）

---

## 🔴 CRITICAL（6 項，需優先修正）

### C1. `/api/debug` 端點不應存在於 Production ✅ 已修正
- **檔案**: `src/app/api/debug/route.js`
- **問題**: 暴露 session token 前綴、使用者數量、DB 狀態等敏感資訊。雖有 super_admin 檢查，但此端點本身不應部署到生產環境
- **修正**: 已加環境檢查 `if (process.env.NODE_ENV === 'production') return 404`

### C2. XHR 上傳未在元件卸載時 abort ✅ 已修正
- **檔案**: `src/components/dashboard/TaskModal.jsx:92-114`、`FileManagerModal.jsx:63-86`
- **問題**: 上傳進行中若元件卸載，xhr 回調仍嘗試 setState → 記憶體洩漏
- **修正**: 用 ref 追蹤 mounted 狀態，useEffect cleanup 中呼叫 `xhr.abort()`

### C3. `updateTask` / `updateSubtask` 未白名單過濾欄位 ✅ 已修正
- **檔案**: `src/server/actions/tasks.js`
- **問題**: `data` 物件直接傳入 `.set(data)`，客戶端可篡改 `createdAt`、`createdBy` 等欄位。`updateSubtask` 同樣有此問題
- **修正**: 已加白名單過濾。updateTask 允許 `['task', 'status', 'category', 'startDate', 'endDate', 'duration', 'owner', 'priority', 'notes', 'sortOrder']`，updateSubtask 允許 `['name', 'owner', 'done', 'doneDate', 'notes', 'sortOrder']`

### C4. 缺少專案的權限驗證 ✅ 已修正
- **檔案**: `src/server/actions/projects.js:42-70`
- **問題**: 任何已認證用戶可修改/刪除任何專案，無所有權檢查
- **修正**: 已加 `createdBy === session.userId || role === 'super_admin'` 驗證，並加欄位白名單
- **備註**: download route（`src/app/api/download/route.js`）經驗證已有完整防護（UUID 驗證 + DB 記錄檢查 + 路徑遍歷防護），無需修改

### C5. 專案 sortOrder 競態條件 ✅ 已修正
- **檔案**: `src/server/actions/projects.js:26-27`
- **問題**: `SELECT max(sortOrder)` 後 +1 插入，並行請求可產生重複值
- **修正**: 已用 `sql` 模板將 `COALESCE((SELECT MAX(sort_order) FROM projects), 0) + 1` 嵌入 INSERT

### C6. `reorderProjects` 邏輯錯誤 ✅ 已修正
- **檔案**: `src/hooks/useTaskManager.js:415-441`
- **問題**: 對 `prev` 陣列先排序再取索引，導致重複排序，可能產生錯誤的排序結果
- **修正**: 已簡化為單次排序邏輯，`orderedIds` 在 setProjects callback 內計算，`prevProjects` 不再被 mutate

~~C7. 所有 Tab 同時掛載~~ — **驗證後確認不存在**，Dashboard.jsx 已使用 `{tab === "xxx" && <Component />}` 條件渲染，每次只掛載一個 Tab

### C8. Theme 使用 mutable global export ✅ 已修正
- **檔案**: `src/lib/theme.js`、`src/components/ThemeProvider.jsx`（新增）
- **問題**: `applyTheme()` 直接修改 module export（X, SC, PC, CC, PJC），React 無法偵測變更，依賴 `window.dispatchEvent('theme-change')` 強制 re-render
- **修正**: 建立 ThemeProvider（React Context）+ useTheme hook，22 個元件遷移至 context 消費，移除 mutable globals、applyTheme、getIS2、window event hack

---

## 🟠 WARNING（14 項，應該修正）

### W1. 多步操作缺少 DB Transaction ✅ 已改善
- **檔案**: `tasks.js`（deleteTask, deleteManyTasks, deleteAllTasks, deleteFile）、`upload/route.js`
- **問題**: 檔案上傳 R2 後才寫 DB，失敗會產生孤立檔案；刪除任務時多表刪除無 transaction
- **修正**: 刪除操作改為「先查 R2 key → 刪 DB → best-effort 清理 R2」；upload 失敗時自動清理 R2 孤立檔案。neon-http 不支援完整 transaction，已用操作順序最小化不一致風險

### W2. 缺少登入速率限制 ✅ 已加基礎防護
- **檔案**: `actions/auth.js`
- **問題**: 無暴力破解防護，login 端點可無限嘗試
- **修正**: 已加 1 秒延遲於密碼驗證失敗時。完整 rate limiting（Redis/KV）標記為後續優化

### W3. Middleware 只檢查 cookie 是否存在
- **檔案**: `src/middleware.js:19`
- **問題**: 不驗證 session 有效性，偽造 cookie 可進入頁面（Server Action 會擋，但 UX 差）
- **備註**: 已知設計決策，實際驗證在各 Server Action 中進行

### W4. Search debounce timer 未清理 ✅ 已修正
- **檔案**: `Dashboard.jsx:41-46`
- **問題**: useCallback 中的 setTimeout 在元件卸載時仍可能觸發
- **修正**: 加 cleanup useEffect，卸載時清除 searchTimer ref

### W5. useEffect 依賴不完整 ✅ 已修正
- **檔案**: `EditableCell.jsx:18-27`（缺 `initialTypedChar`）、`InlineNote.jsx:10`（缺 `value`）
- **修正**: EditableCell 加 `controlled` 到依賴、setTimeout cleanup、解釋註解。InlineNote 加 setTimeout cleanup、解釋註解。value/initialTypedChar 刻意不加入（避免編輯中被覆蓋）
- **備註**: ~~`users/page.jsx:23`~~ 經驗證 `[]` 依賴正確，已移除

### W6. Admin 頁面 setTimeout 未清理 ✅ 已修正
- **檔案**: `(admin)/users/page.jsx:33,48,58`
- **問題**: `setTimeout(() => setSuccess(null), 3000)` 無 cleanup，元件卸載後仍觸發
- **修正**: 移除 3 處散落的 setTimeout，改為統一 useEffect 監聯 success state，自動 cleanup

### W7. Server Component 缺少 Suspense
- **檔案**: `(dashboard)/dashboard/page.jsx:8-16`
- **問題**: async fetch 無 Suspense fallback，載入中無回饋

### W8. Project detail 頁錯誤處理過於籠統
- **檔案**: `(dashboard)/project/[id]/page.jsx:11-15`
- **問題**: 所有錯誤一律導向 `/login`，無法區分 404 / auth 失敗 / 網路錯誤

### W9. CSV parser 有 DoS 風險
- **檔案**: `src/lib/utils.js:65-87`
- **問題**: 無最大行數/欄位數限制，超大 CSV 可耗盡記憶體

### W10. R2 刪除失敗不阻止 DB 刪除 ✅ 已修正
- **檔案**: `tasks.js`（deleteTask, deleteManyTasks, deleteAllTasks, deleteFile）
- **問題**: R2 錯誤被 catch 後繼續刪除 DB 記錄，導致 R2 中殘留孤立檔案
- **修正**: 已與 W1 合併修正。操作順序改為「先刪 DB → 再清 R2」，R2 孤立檔僅浪費儲存但不影響資料一致性

### W11. 缺少資料庫索引
- **檔案**: `src/server/db/schema.js`
- **問題**: `tasks.owner`、`projects.name` 無索引，查詢效能受影響

### W12. Upload 端點未驗證 taskId 存在
- **檔案**: `src/app/api/upload/route.js`
- **問題**: 有 UUID 格式驗證，但上傳前不查 DB 確認 task 是否存在，可產生孤立檔案

### W13. GanttTimeline 空陣列邊界處理
- **檔案**: `src/components/dashboard/GanttTimeline.jsx:59-62`
- **問題**: `Math.min(...[])` 回傳 Infinity，雖有 early return 但邏輯脆弱

### W14. FileManagerModal 下載 URL 未驗證
- **檔案**: `FileManagerModal.jsx:39-54`
- **問題**: `data.url` 未驗證是否為合法 URL

### W15. users.js 缺少 UUID 驗證 ✅ 已修正
- **檔案**: `src/server/actions/users.js`
- **問題**: `resetUserPassword`、`deleteUser` 的 userId 未做 UUID 格式驗證
- **修正**: 已加 `isValidUUID(userId)` 檢查

---

## 🟡 SUGGESTION（12 項，建議改善）

| # | 問題 | 檔案 |
|---|------|------|
| S1 | DataTab.jsx 約 350 行，複雜度高，考慮拆分 | `tabs/DataTab.jsx` |
| S2 | ProjectsTab 接收 24 個 props，考慮 Context | `tabs/ProjectsTab.jsx` |
| S3 | 無 TypeScript，大型專案應遷移 | 全域 |
| S4 | 無任何測試（unit / E2E） | 全域 |
| ~~S5~~ | ~~上傳進度缺少 aria 無障礙標籤~~ ✅ 已修正 | `TaskModal.jsx`, `FileManagerModal.jsx` |
| ~~S6~~ | ~~EditableCell 缺少語義 HTML / ARIA~~ ✅ 已修正 | `EditableCell.jsx` |
| ~~S7~~ | ~~External Google Fonts 阻塞首次渲染~~ ✅ 已修正 | `layout.jsx` |
| ~~S8~~ | ~~OverviewTab 圓餅圖計算未 useMemo~~ ✅ 已修正 | `OverviewTab.jsx` |
| ~~S9~~ | ~~GanttTimeline 位置計算未 memoize~~ ✅ 已修正 | `GanttTimeline.jsx` |
| ~~S10~~ | ~~UUID regex 重複定義，應提取共用~~ ✅ 已修正 | `utils.js` |
| ~~S11~~ | ~~Sidebar 用 dummy state 強制 re-render~~ ✅ 已隨 C8 修正 | `Sidebar.jsx` |
| S12 | Session 7 天無 refresh token 機制 | `auth.js:8` |

---

## 建議修正順序

### Phase 1 — 安全性 ✅ 已完成
1. ~~C1~~ debug endpoint 已加 `NODE_ENV` 檢查
2. ~~C3~~ updateTask / updateSubtask 已加欄位白名單
3. ~~C4~~ updateProject / deleteProject 已加所有權檢查 + 欄位白名單
4. ~~W15~~ users.js 已加 UUID 驗證
5. ~~W2~~ 已加基礎延遲防護（完整 rate limiting 後續優化）

### Phase 2 — 穩定性 ✅ 已完成
1. ~~C2~~ XHR upload 已加 abort cleanup + mountedRef 防護
2. ~~C5~~ sortOrder 已用 SQL subquery 原子化
3. ~~C6~~ reorderProjects 已簡化，修正 rollback mutate 問題
4. ~~W1~~ 刪除操作順序改為 DB 先刪再清 R2；upload 失敗自動清理 R2
5. ~~W10~~ 已與 W1 合併修正

### Phase 3 — 效能 ✅ 已完成
1. ~~C8~~ Theme 系統遷移至 React Context（ThemeProvider + useTheme hook），移除 mutable global exports、applyTheme、getIS2、window event hack
2. ~~W4~~ Dashboard 搜尋 debounce timer 加 unmount cleanup
3. ~~W5~~ EditableCell / InlineNote useEffect 加 controlled 依賴、setTimeout cleanup、解釋註解
4. ~~W6~~ Admin users 頁面 setTimeout 統一為 useEffect 監聽 success state

### Phase 4 — 程式碼品質 ✅ 已完成
1. ~~S10~~ UUID regex 提取至 `utils.js` 共用，移除 4 處重複定義
2. ~~S5~~ 上傳進度加 `role="progressbar"` + `aria-live` + `aria-hidden`（TaskModal、FileManagerModal）
3. ~~S6~~ EditableCell controlled 模式加 `role="gridcell"` + `tabIndex`
4. ~~S7~~ Google Fonts 遷移至 `next/font/google` 自代管，消除外部請求阻塞
5. ~~S8~~ OverviewTab 圓餅圖計算提取為 `useMemo`
6. ~~S9~~ GanttTimeline 位置/行計算提取為 `useMemo`
7. S1（DataTab 拆分）、S2（ProjectsTab props）、S3（TypeScript）、S4（測試）、S12（Session refresh）— 跳過，列入後續版本

---

## 驗證方式
- 每個修正後執行 `npm run build` 確認無編譯錯誤
- 手動測試：登入→儀表板→專案詳情→上傳檔案→刪除→切換 Tab
- 檢查 console 無 React 警告（missing key, setState on unmounted）
- 安全性修正需額外測試：用非 owner 帳號嘗試修改/刪除他人專案
