# 技術實作文檔 (TDD)

記錄複雜功能的「怎麼做的」，每個功能含實作方案、程式碼結構、關鍵檔案、效能考量與邊界處理。

---

### 功能：拖曳排序（專案卡片 + 子任務）

- **套件**：`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
- **實作**：

**專案卡片排序**（ProjectsTab）：
```
DndContext (sensors, closestCenter, onDragEnd)
  └── SortableContext (items=projectIds, strategy=rectSortingStrategy)
       └── SortableProjectCard × N
            └── useSortable({ id: project.id })
```
- `PointerSensor` 設定 `activationConstraint: { distance: 5 }` 防止點擊誤觸拖曳
- `rectSortingStrategy` 用於網格佈局（非垂直列表）
- 拖曳模式：只在 `sortMode === "manual"` 時啟用，其他排序模式禁用拖曳
- Drag handle（⠿ 圖示）透過 `e.stopPropagation()` 防止事件冒泡

**子任務排序**（ProjectDetail）：
```
DndContext (onDragEnd)
  └── SortableContext (items=subtaskIds, strategy=verticalListSortingStrategy)
       └── SortableSubItem × N
```
- `verticalListSortingStrategy` 用於垂直列表

**排序後端邏輯**（useTaskManager）：
- `reorderProjects(activeId, overId)` — 樂觀更新 + `reorderProjectsAction(orderedIds)` Server Action
- `reorderSubs(taskId, activeId, overId)` — 本地陣列 splice + sortOrder 重新計算（1-based）
- Server Action 接收 `orderedIds` 陣列，批次更新每個 project 的 `sortOrder`

**條件排序按鈕**：
- 名稱排序：`localeCompare` 中文排序
- 日期排序：依最近任務的 `endDate`
- 進度排序：依已完成任務百分比

- **關鍵檔案**：
  - `src/components/dashboard/SortableProjectCard.jsx` — 可拖曳專案卡片
  - `src/components/dashboard/SortableSubItem.jsx` — 可拖曳子任務
  - `src/components/dashboard/tabs/ProjectsTab.jsx:30,110-128` — DndContext + SortableContext 設定
  - `src/hooks/useTaskManager.js:400-437` — reorderProjects, reorderSubs
  - `src/server/actions/projects.js` — reorderProjectsAction

- **效能考量**：
  - `useMemo` 計算 `sortedProjList`（依 sortMode 篩選排序）
  - `closestCenter` collision detection 避免大量 DOM 計算
  - 樂觀更新避免等待 server 回應

- **邊界處理**：
  - 拖曳前後位置相同時不觸發更新（`activeId === overId` 檢查）
  - `oldIdx` / `newIdx` 不存在時提前 return
  - Server error 時 rollback 到 `prevProjects` 完整副本

---

### 功能：檔案上傳下載

- **套件**：`@aws-sdk/client-s3`（Cloudflare R2 S3 相容）+ 原生 `XMLHttpRequest`
- **實作**：

**上傳流程**：
```
前端 FileManagerModal/TaskModal
  → XHR POST /api/upload (FormData: file + taskId)
  → API Route 驗證 (auth + UUID + MIME + size + filename)
  → uploadToR2(key, buffer, contentType)
  → createFileRecord() Server Action
  → 失敗時 deleteFromR2(key) 清理
```

**驗證層**（upload route）：
- 認證：`getSession()` 檢查
- taskId：`isValidUUID()` 驗證
- 檔案大小：最大 100 MB
- MIME 白名單：`image/`, `video/`, `audio/`, `application/pdf`, Office 格式, CSV, JSON, ZIP
- 檔名消毒：移除 `/ \ ..` 路徑遍歷字元 + 控制字元

**R2 Key 格式**：`tasks/{taskId}/{Date.now()}-{sanitizedName}`

**XHR 進度追蹤**（FileManagerModal）：
```javascript
xhr.upload.onprogress = (ev) => {
  if (ev.lengthComputable && mountedRef.current)
    setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
};
```

**卸載安全**：
- `mountedRef` 追蹤元件是否仍掛載
- `useEffect` cleanup 呼叫 `xhr.abort()`

**下載流程**：
```
前端 FileManagerModal
  → fetch GET /api/download?key=xxx
  → API Route 驗證 (auth + key 格式 + DB 記錄存在)
  → getDownloadUrl(key) — R2_PUBLIC_URL 直接 URL 或 presigned URL (1小時)
  → 前端 <a>.click() 觸發下載
```

**下載安全**：
- key 必須以 `tasks/` 開頭
- 不允許 `..` 路徑遍歷
- DB 查詢確認檔案記錄存在

- **關鍵檔案**：
  - `src/app/api/upload/route.js` — 上傳 API（驗證 + R2 + DB）
  - `src/app/api/download/route.js` — 下載 API（驗證 + presigned URL）
  - `src/lib/r2.js` — R2 操作封裝（upload, download URL, delete）
  - `src/components/dashboard/FileManagerModal.jsx` — 檔案管理 UI + XHR 上傳
  - `src/components/dashboard/TaskModal.jsx` — 任務建立時的檔案上傳

- **效能考量**：
  - XHR 而非 fetch 以取得上傳進度事件
  - Presigned URL 避免 server 中繼串流
  - 檔案分類顯示（`getFileCategory()`）使用 utils 工具函式

- **邊界處理**：
  - 上傳失敗時自動清理 R2 孤立檔案
  - R2 cleanup 失敗僅 console.error（不阻擋流程）
  - 元件卸載時 abort XHR 防止記憶體洩漏
  - 4 MB sessionStorage 上限防止快取溢出

---

### 功能：CSV 匯入匯出

- **套件**：無外部依賴，純 JavaScript 實作
- **實作**：

**匯出**（`tasksToCSV()`）：
- 11 欄標準格式：`id, project, task, status, category, start, duration, end, owner, priority, notes`
- 值以雙引號包裹，內含引號用 `""` 轉義
- 換行分隔行

**匯入**（`parseCSV()`）：
- Header 多語言映射（中文/英文）：`"專案"/"project" → project`
- 支援欄位：`專案/project`, `任務/task`, `狀態/status`, `分類/category`, `開始/start`, `工期/duration`, `結束/end`, `負責人/owner`, `優先/priority`, `備註/notes`
- CSV parser 處理引號內逗號（`inQ` 狀態追蹤）
- `duration` 自動轉整數，空日期轉 `null`
- 大小寫不敏感

**匯入來源**：
1. 本地檔案上傳 — `FileReader.readAsText(file)`
2. URL 匯入 — `POST /api/fetch-csv` 代理取得

**Server Action**（`upsertTasksAction`）：
- 批次 upsert（有 id 則更新，無則插入）
- 回傳 `{ updated, inserted }` 計數
- 匯入後 `loadData(true)` 強制刷新快取

**範本匯出**（`getTemplate()`）：
- 提供帶範例資料的 CSV 範本，方便用戶理解格式

- **關鍵檔案**：
  - `src/lib/utils.js:39-102` — tasksToCSV, parseCSV, getTemplate
  - `src/components/dashboard/tabs/DataTab.jsx:62-86` — CSV 匯入 UI
  - `src/server/actions/tasks.js` — upsertTasksAction

- **效能考量**：
  - 無最大行數限制（已知 DoS 風險，列入 code-review W9）
  - 匯入後強制刷新避免快取不一致

- **邊界處理**：
  - 空 CSV 顯示錯誤 toast
  - 引號內逗號正確解析
  - 未知欄位靜默忽略

---

### 功能：Dashboard Tab 架構

- **套件**：React 19 條件渲染（無路由切換）
- **實作**：

**Tab 切換**：
```javascript
const [tab, setTab] = useState("overview");
// 條件渲染，每次只掛載一個 Tab
{tab === "overview" && <OverviewTab ... />}
{tab === "projects" && <ProjectsTab ... />}
{tab === "data" && <DataTab ... />}
{tab === "timeline" && <TimelineTab ... />}
{tab === "settings" && <SettingsTab ... />}
```

**資料流**：
```
Dashboard.jsx
  └── useTaskManager() — 載入全部資料 + 提供 CRUD 函式
  └── useMemo(filtered) — 依篩選條件計算可見任務
  └── 各 Tab 元件 — 接收 props（資料 + callback）
```

**篩選系統**：
- `fpSet`：專案篩選（Set）
- `fs`：狀態篩選（"全部" / "已完成" / "進行中" / ...）
- `fpr`：優先級篩選
- `searchQ`：搜尋關鍵字（300ms debounce）
- 所有篩選以 AND 邏輯組合，結果透過 `useMemo` 計算

**OverviewTab SVG 圓餅圖**：
- 手繪 SVG donut chart（無圖表庫依賴）
- Center `(100, 100)`，外半徑 90，內半徑 58
- 弧形計算：`(count / total) * 2π - gap`
- 大弧旗標：角度 > π 時 `la = 1`
- 段間距 `g = 0.04` radians
- 資料透過 `useMemo` 計算，依賴 `[SC, stats]`

**Loading Skeleton**：
- CSS `@keyframes shimmer` 動畫
- 模擬 header、卡片、篩選器、列表的佔位元素
- `loading === true` 時顯示

**甘特圖寬度持久化**：
- `localStorage` key `"dash-ganttWidths"`
- 結構：`{ overview: { day, week, month, quarter }, project: {...}, timeline: {...} }`
- 驗證：`Math.max(1, value)` 防止無效值

- **關鍵檔案**：
  - `src/components/dashboard/Dashboard.jsx` — 主元件（條件渲染 + 篩選 + loading）
  - `src/components/dashboard/tabs/OverviewTab.jsx` — 統計圓餅圖（useMemo + SVG）
  - `src/components/dashboard/tabs/DataTab.jsx` — 資料表格 + CSV
  - `src/components/dashboard/tabs/ProjectsTab.jsx` — 專案卡片 + 排序
  - `src/components/dashboard/tabs/SettingsTab.jsx` — 系統設定
  - `src/hooks/useTaskManager.js` — 資料層

- **效能考量**：
  - 條件渲染確保每次只有 1 個 Tab 掛載（節省記憶體）
  - `useMemo` 避免每次 render 重新計算篩選結果和圓餅圖
  - Debounced search（300ms）減少不必要的過濾
  - Gantt 寬度 localStorage 持久化避免重複調整

- **邊界處理**：
  - 空資料：各 Tab 顯示 placeholder
  - 行動版（768px breakpoint）：甘特圖切換為列表模式
  - localStorage 損壞：fallback 預設值
  - 搜尋跨多欄位（task, project, owner, notes）大小寫不敏感
