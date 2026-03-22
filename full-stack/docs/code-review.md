# Full-Stack 版本 Code Review 報告

> 審查日期：2026-03-22
> 範圍：`full-stack/` 整個版本，涵蓋元件層、Server Actions、資料庫 Schema、Lib 工具、API Routes、Hooks、Pages 與設定檔。共審查 40+ 個檔案。

---

## 🔴 CRITICAL（8 項，需優先修正）

### C1. `/api/debug` 端點不應存在於 Production
- **檔案**: `src/app/api/debug/route.js`
- **問題**: 暴露 session token 前綴、使用者數量、DB 狀態等敏感資訊。雖有 super_admin 檢查，但此端點本身不應部署到生產環境
- **修正**: 加環境檢查 `if (process.env.NODE_ENV === 'production') return 404`，或直接刪除

### C2. XHR 上傳未在元件卸載時 abort
- **檔案**: `src/components/dashboard/TaskModal.jsx:92-114`、`FileManagerModal.jsx:63-86`
- **問題**: 上傳進行中若元件卸載，xhr 回調仍嘗試 setState → 記憶體洩漏
- **修正**: 用 ref 追蹤 mounted 狀態，useEffect cleanup 中呼叫 `xhr.abort()`

### C3. `updateTask` 未白名單過濾欄位
- **檔案**: `src/server/actions/tasks.js:59-72`
- **問題**: `data` 物件直接傳入 `.set(data)`，客戶端可篡改 `createdAt`、`createdBy` 等欄位
- **修正**: 只允許 `['task', 'status', 'category', 'startDate', 'endDate', 'duration', 'owner', 'priority', 'notes', 'sortOrder']`

### C4. 缺少專案/檔案的權限驗證
- **檔案**: `src/server/actions/projects.js:42-70`、`src/app/api/download/route.js:29-32`
- **問題**: 任何已認證用戶可修改/刪除任何專案、下載任何檔案，無所有權檢查
- **修正**: 驗證 `createdBy === session.userId` 或 role === admin

### C5. 專案 sortOrder 競態條件
- **檔案**: `src/server/actions/projects.js:26-27`
- **問題**: `SELECT max(sortOrder)` 後 +1 插入，並行請求可產生重複值
- **修正**: 使用 DB 層級的 `DEFAULT` 或 `COALESCE` 子查詢寫在 INSERT 中

### C6. `reorderProjects` 邏輯錯誤
- **檔案**: `src/hooks/useTaskManager.js:415-441`
- **問題**: 對 `prev` 陣列先排序再取索引，導致重複排序，可能產生錯誤的排序結果
- **修正**: 檢查並簡化 reorder 邏輯，確保 arrayMove 只執行一次

### C7. 所有 Tab 同時掛載
- **檔案**: `src/components/dashboard/Dashboard.jsx:165-177`
- **問題**: 5 個 tab（含 DataTab 400+ 行）全部渲染，隱藏的 tab 仍消耗記憶體與計算
- **修正**: 使用 `React.lazy` + `Suspense` 或條件渲染（只渲染 activeTab）

### C8. Theme 使用 mutable global export
- **檔案**: `src/lib/theme.js`
- **問題**: `applyTheme()` 直接修改 module export（X, SC, PC, CC, PJC），React 無法偵測變更，依賴 `window.dispatchEvent('theme-change')` 強制 re-render
- **修正**: 遷移至 React Context + useContext，或 Zustand store

---

## 🟠 WARNING（15 項，應該修正）

### W1. 多步操作缺少 DB Transaction
- **檔案**: `tasks.js:82-86`（deleteTask）、`tasks.js:381-388`（deleteManyTasks）、`upload/route.js:82-90`
- **問題**: 檔案上傳 R2 後才寫 DB，失敗會產生孤立檔案；刪除任務時多表刪除無 transaction

### W2. 缺少登入速率限制
- **檔案**: `middleware.js`、`actions/auth.js`
- **問題**: 無暴力破解防護，login 端點可無限嘗試

### W3. Middleware 只檢查 cookie 是否存在
- **檔案**: `src/middleware.js:19`
- **問題**: 不驗證 session 有效性，偽造 cookie 可進入頁面（Server Action 會擋，但 UX 差）

### W4. Search debounce timer 未清理
- **檔案**: `Dashboard.jsx:41-46`
- **問題**: useCallback 中的 setTimeout 在元件卸載時仍可能觸發

### W5. useEffect 依賴不完整
- **檔案**: `EditableCell.jsx:18-27`（缺 `initialTypedChar`）、`InlineNote.jsx:10`（缺 `value`）、`users/page.jsx:23`（缺 `loadUsers`）

### W6. Admin 頁面 setTimeout 未清理
- **檔案**: `(admin)/users/page.jsx:33,48,58`
- **問題**: `setTimeout(() => setSuccess(null), 3000)` 無 cleanup，元件卸載後仍觸發

### W7. Server Component 缺少 Suspense
- **檔案**: `(dashboard)/dashboard/page.jsx:8-16`
- **問題**: async fetch 無 Suspense fallback，載入中無回饋

### W8. Project detail 頁錯誤處理過於籠統
- **檔案**: `(dashboard)/project/[id]/page.jsx:11-15`
- **問題**: 所有錯誤一律導向 `/login`，無法區分 404 / auth 失敗 / 網路錯誤

### W9. CSV parser 有 DoS 風險
- **檔案**: `src/lib/utils.js:65-87`
- **問題**: 無最大行數/欄位數限制，超大 CSV 可耗盡記憶體

### W10. R2 刪除失敗不阻止 DB 刪除
- **檔案**: `tasks.js:85-86`
- **問題**: R2 錯誤被 catch 後繼續刪除 DB 記錄，導致 R2 中殘留孤立檔案

### W11. 缺少資料庫索引
- **檔案**: `src/server/db/schema.js`
- **問題**: `tasks.owner`、`projects.name` 無索引，查詢效能受影響

### W12. Upload 端點未驗證 taskId 存在
- **檔案**: `src/app/api/upload/route.js`
- **問題**: 上傳前不檢查 task 是否存在，可產生孤立檔案

### W13. GanttTimeline 空陣列邊界處理
- **檔案**: `src/components/dashboard/GanttTimeline.jsx:59-62`
- **問題**: `Math.min(...[])` 回傳 Infinity，雖有 early return 但邏輯脆弱

### W14. FileManagerModal 下載 URL 未驗證
- **檔案**: `FileManagerModal.jsx:39-54`
- **問題**: `data.url` 未驗證是否為合法 URL

### W15. users.js 缺少 UUID 驗證
- **檔案**: `src/server/actions/users.js:68,85,90,99`
- **問題**: `resetUserPassword`、`deleteUser` 的 userId 未做 UUID 格式驗證

---

## 🟡 SUGGESTION（12 項，建議改善）

| # | 問題 | 檔案 |
|---|------|------|
| S1 | DataTab.jsx 超過 400 行，應拆分 | `tabs/DataTab.jsx` |
| S2 | ProjectsTab 接收 22 個 props，考慮 Context | `tabs/ProjectsTab.jsx` |
| S3 | 無 TypeScript，大型專案應遷移 | 全域 |
| S4 | 無任何測試（unit / E2E） | 全域 |
| S5 | 上傳進度缺少 aria 無障礙標籤 | `TaskModal.jsx:218-220` |
| S6 | EditableCell 缺少語義 HTML / ARIA | `EditableCell.jsx:58-63` |
| S7 | External Google Fonts 阻塞首次渲染 | `layout.jsx:12-15` |
| S8 | OverviewTab 圓餅圖計算未 useMemo | `OverviewTab.jsx:133-156` |
| S9 | GanttTimeline 位置計算未 memoize | `GanttTimeline.jsx:70-73` |
| S10 | UUID regex 重複定義，應提取共用 | `projects.js`, `tasks.js`, `upload/route.js` |
| S11 | Sidebar 用 dummy state 強制 re-render | `Sidebar.jsx:9-14` |
| S12 | Session 7 天無 refresh token 機制 | `auth.js:8` |

---

## 建議修正順序

### Phase 1 — 安全性（C1, C3, C4, W2, W15）
1. 移除或限制 debug endpoint
2. 為 updateTask 加欄位白名單
3. 為 updateProject / deleteProject / download 加權限檢查
4. 為 users.js 加 UUID 驗證
5. 考慮加入 rate limiting

### Phase 2 — 穩定性（C2, C5, C6, W1, W10）
1. XHR upload 加 abort cleanup
2. 修正 sortOrder 競態條件
3. 修正 reorderProjects 邏輯
4. 關鍵操作加 transaction
5. R2 刪除失敗處理

### Phase 3 — 效能（C7, C8, W4, W5, W6）
1. Tab 改為條件渲染或 lazy load
2. Theme 遷移至 Context
3. 修正 useEffect 依賴與清理

### Phase 4 — 程式碼品質（S1-S12）
1. 拆分大型元件
2. 減少 prop drilling
3. 加無障礙屬性
4. 效能最佳化（useMemo）

---

## 驗證方式
- 每個修正後執行 `npm run build` 確認無編譯錯誤
- 手動測試：登入→儀表板→專案詳情→上傳檔案→刪除→切換 Tab
- 檢查 console 無 React 警告（missing key, setState on unmounted）
- 用 DevTools Network 確認 lazy loading 生效
