# 踩坑知識庫

收錄具診斷與教學價值的 bug 修復紀錄。每筆包含根因分析與教訓，避免重複犯錯。

---

### [BUG-001] configTable 與 Next.js 保留名衝突

- **日期**：2026-03-20
- **Commit**：`ad09ab1`
- **症狀**：`import { config } from '@/server/db/schema'` 導致 Next.js 路由行為異常，編譯錯誤或運行時未預期行為
- **根因**：Next.js 將 `config` 視為 route config export（與 `metadata`、`generateMetadata` 同級保留名），Drizzle schema 的 `export const config` 命名與之衝突
- **解法**：schema 中 export 改名為 `configTable`，使用處用 `import { configTable as config }` 別名
- **教訓**：在框架專案中避免使用保留名稱作為 export。Next.js 保留名包括：`config`、`metadata`、`generateMetadata`、`generateStaticParams`、`revalidate` 等。遇到詭異的「未定義」或「衝突」錯誤時，優先檢查命名衝突

---

### [BUG-002] Theme mutable export 無法被 React 偵測變更

- **日期**：2026-03-22
- **Commit**：`f553c83`（Code Review C8）
- **症狀**：Dashboard 切換主題時，部分元件不更新。依賴 `window.dispatchEvent('theme-change')` 強制 re-render（不可靠）
- **根因**：`theme.js` 使用 mutable global export（`export let X = {...}`），`applyTheme()` 直接修改 `X = newTheme`。React 無法偵測 module export 的變更（與 state/context 無關），22 個元件寫死了 `import { X }` 無法反應動態變更
- **解法**：建立 `ThemeProvider.jsx`（React Context）+ `useTheme()` hook。22 個元件改為 `const { X } = useTheme()`，移除 mutable globals、`applyTheme()`、`getIS2()`、window event hack
- **教訓**：不要用 mutable module exports 管理應動態變更的狀態。即使只是「單一全域物件」，也應使用 Context/Redux/Zustand，讓 React 能正確追蹤訂閱者

---

### [BUG-003] Server Action 欄位白名單缺失

- **日期**：2026-03-22
- **Commit**：`736e09e`（Code Review C3）
- **症狀**：客戶端可篡改 `createdBy`、`createdAt` 等系統欄位，`data` 物件直接傳入 `.set(data)`
- **根因**：`updateTask` / `updateSubtask` 完全信任客戶端傳入的 `data` 物件，未過濾可寫欄位。攻擊者可在 data 中加入 `createdBy: attacker_id` 等欄位
- **解法**：加入白名單過濾。`updateTask` 允許 `['task', 'status', 'category', 'startDate', 'endDate', 'duration', 'owner', 'priority', 'notes', 'sortOrder']`，`updateSubtask` 允許 `['name', 'owner', 'done', 'doneDate', 'notes', 'sortOrder']`
- **教訓**：Server 端永遠要白名單檢查可寫欄位，不要相信客戶端輸入。即使看似「不太可能被篡改」的字段，也要明確列舉允許清單

---

### [BUG-004] 專案權限驗證缺失

- **日期**：2026-03-22
- **Commit**：`736e09e`（Code Review C4）
- **症狀**：任何已認證用戶可修改/刪除任何專案，無所有權檢查
- **根因**：`updateProject` / `deleteProject` 只驗證用戶是否已登入（`safeRequireAuth`），未檢查操作者是否為專案建立者
- **解法**：加入 `createdBy === session.userId || role === 'super_admin'` 驗證，並在 updateProject 加入欄位白名單 `['name', 'sortOrder']`
- **教訓**：認證（你是誰）和授權（你能做什麼）是兩個獨立檢查。每個修改/刪除操作都要驗證操作者是否有權限，不能只靠「已登入」

---

### [BUG-005] sortOrder 競態條件

- **日期**：2026-03-22
- **Commit**：`736e09e`（Code Review C5）
- **症狀**：並行的 `createProject` 請求產生相同的 `sortOrder`，導致排序重複
- **根因**：`SELECT MAX(sort_order)` 後 `+1` 插入，兩個並行請求在 SELECT 與 INSERT 之間的時間窗口都讀到相同的 max 值
- **解法**：將 MAX 邏輯嵌入 INSERT 的 SQL，使用 `sql\`COALESCE((SELECT MAX(sort_order) FROM projects), 0) + 1\`` 作為 sortOrder 值，避免 read-then-write 的往返
- **教訓**：序列化操作（尤其是 incremental ID/order）容易有競態。若 SELECT + INSERT 分開，在併發負載下會出現重複。改用 SQL atomic operation 或 transaction

---

### [BUG-006] reorderProjects 陣列 mutate 導致排序錯誤

- **日期**：2026-03-22
- **Commit**：`736e09e`（Code Review C6）
- **症狀**：拖曳重新排序專案時，順序錯誤或排序多次；rollback 時無法正確恢復
- **根因**：在 `setProjects` callback 中，對 `prev` 陣列先 `.sort()` 再 `.splice()`，mutate 了同一個陣列。若有並行狀態更新，會共享被修改的陣列。rollback 用的 `prevProjects` 也已被 mutate，無法正確恢復原始狀態
- **解法**：簡化為單次排序邏輯，在 `setProjects` callback 前保存完整副本（`prevProjects = [...p]`），排序後用 `.map()` 返回全新陣列
- **教訓**：React `setState` 回調內部不要 mutate 臨時變數，特別是陣列。即使只是排序，也應使用 `.map()` 返回新陣列。若需回滾，在 setState 前保存完整副本

---

### [BUG-007] XHR 上傳未在元件卸載時 abort

- **日期**：2026-03-22
- **Commit**：`736e09e`（Code Review C2）
- **症狀**：上傳進行中若用戶切換頁面，xhr callback 仍嘗試 `setState` → React 警告 + 記憶體洩漏
- **根因**：`TaskModal.jsx` 和 `FileManagerModal.jsx` 的 XHR 上傳沒有在 `useEffect` cleanup 中 abort，也沒有追蹤元件 mounted 狀態
- **解法**：用 `mountedRef` 追蹤 mounted 狀態，`useEffect` cleanup 中呼叫 `xhr.abort()`。progress callback 內檢查 `mountedRef.current` 再 setState
- **教訓**：非 Promise API（XMLHttpRequest、WebSocket 等）需手動清理。`useEffect` cleanup 應明確 abort/close 這些連線，並追蹤 mounted 狀態以防止卸載後的 setState

---

### [BUG-008] Sidebar NavItem 漏掉 useTheme() 導致崩潰

- **日期**：2026-03-22
- **Commit**：`b0410c9`
- **症狀**：登入後 Dashboard 崩潰，`ReferenceError: X is not defined` 在 NavItem 元件中
- **根因**：BUG-002 的 ThemeProvider 遷移中，主元件 `Sidebar` 有加 `useTheme()`，但子元件 `NavItem`（同一個檔案中的另一個 function component）被遺漏。NavItem 仍直接引用全域 `X`，但 mutable export 已被移除
- **解法**：在 `NavItem` function component 開頭加入 `const { X } = useTheme()`
- **教訓**：大規模重構時，用 `grep` 檢查所有使用位置（如 `grep -r "X\." src/`）。特別注意同一檔案中的多個 function component — 容易只改主元件而遺漏子元件。測試時要覆蓋所有路徑，不只測主路徑

---

### [BUG-010] 多人負責人 owner 驗證失敗

- **日期**：2026-03-27
- **Commit**：`b30f38a`
- **症狀**：指派多人負責人（如「張三, 李四」）時，Server Action 回傳驗證錯誤
- **根因**：`createTask` / `updateTask` 的 owner 驗證邏輯未考慮逗號分隔的多人格式，將整個字串作為單一名稱查詢 users 表
- **解法**：owner 字串以逗號 split 後逐一驗證：`data.owner.split(',').map(s => s.trim()).filter(Boolean)`，使用 `inArray()` 批次查詢
- **教訓**：欄位支援多值格式時，驗證邏輯也必須配合拆分。新增功能（多人指派）後要回頭檢查所有使用該欄位的驗證/查詢邏輯

---

### [BUG-009] GanttTimeline gw 變數作用域錯誤導致 webpack crash

- **日期**：2026-03-22
- **Commit**：`edbd2ca`
- **症狀**：Dashboard 載入時 webpack 編譯失敗，GanttTimeline 元件 crash
- **根因**：`gw` 變數定義在 `useMemo()` 回呼函式內部，但在 JSX return 中直接引用 `gw`，超出 `useMemo` 的區域作用域。webpack 在靜態分析時偵測到未定義的變數，導致編譯中斷
- **解法**：移除 `useMemo` 內部的 `gw` 中間變數，改用 `ganttWidths` prop 直接存取（搭配 fallback 預設值）
- **教訓**：`useMemo` / `useCallback` 內部的 `const` / `let` 變數只存在於回呼函式作用域中，不會暴露到元件的 JSX。若需要在 JSX 中使用計算結果，應作為 `useMemo` 的回傳值，或直接使用 props/state
