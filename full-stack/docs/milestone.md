# 版本藍圖

## v0.1.0 — MVP ✅（目前版本）

- 多專案任務管理（CRUD）
- 子任務與進度追蹤
- 甘特圖時間軸
- CSV 匯入匯出
- Session-based 認證
- R2 檔案上傳下載
- 雙主題（明亮 / 深色）
- 拖曳排序
- 骨架屏載入

## v0.2.0 — 程式碼品質

- ✅ Dashboard.jsx 元件拆分重構（945→187 行，6 個 tab 子元件）
- ✅ 主題系統改用 React Context
- ✅ 統一 Server Action 錯誤處理模式
- 清理 `/api/debug` route
- utils.js 函式重新命名

## v0.3.0 — 功能擴展

- 通知系統（任務到期提醒）
- ✅ 活動紀錄 / Audit Log
- 報表 / 統計儀表板
- Settings：上傳公司 Logo + 設定 Dashboard 標題
- Settings：顯示 R2 儲存空間容量
- ✅ 專案卡片：支援上傳 Profile 圖並顯示
- ✅ 專案卡片排序順序可拖曳設定
- ✅ 負責人彩色標籤 + 多人指派 + 建立者追蹤
- ✅ 任務狀態快速切換下拉選單
- ✅ 備份功能增強（完整導出 + 審計日誌搜尋匯出）
- REST API：`/api/mcp/*` endpoints 供外部服務存取（詳見 `docs/api-spec.md`）
- MCP Server：本地 Claude Desktop 專用包裝，呼叫 REST API
- Python Chatbot：LINE + Telegram AI 對話 Bot（詳見 `chatbot/README.md`、`chatbot/docs/architecture.md`）
- 日報 / 週報系統：定時 + 手動觸發，透過 LINE / Telegram 發送

## Wave 1 工單 0531（2026-05-31 合併）

- ✅ BUG01：Projects 拖移排序無法持久化 — orderedIds 改由同步快照計算，不依賴 setState updater 副作用
- ✅ BUG02：任務狀態新增「暫緩」— task_status enum 擴充 + `src/lib/constants.js` 統一 STATUSES 常數（單一真相來源）
- ✅ #03：個人化全站放大設定 — CSS zoom（50–200%，預設 150%），SettingsTab range 控制，持久化於 user_settings
- ✅ T1 設定層：新增 `user_settings` 表 + Server Actions + 獨立 `useUserSettings` hook（樂觀更新 + key-scoped rollback）
- ✅ 測試基建：vitest（config + @/ alias + jsdom），`npm test` 執行，Wave 1 合併後 34 綠

## Wave 2 工單 0531（2026-05-31 合併）

- ✅ #4a Projects 卡片/明細切換 — 明細＝精簡列表（一列一專案 + 拖移把手），卡片⟷列表 switch，per-account（`projectsView`，user_settings）
- ✅ #4b Timeline 隱藏專案 — 每專案眼睛 toggle，隱藏清單存 `hiddenProjects`（project.id 陣列，per-account）；Dashboard 以 props 同時餵 ProjectsTab（眼睛狀態）與 TimelineTab（過濾）
- ✅ #5 重新整理保持頁籤 — active tab 持久化於 localStorage（`dash-activeTab`，per-device）
- ✅ Timeline 增強 — project/task 收折（localStorage `dash-timelineCollapsed`）+ 排序（名稱/進度/手動，`timelineSort` per-account）+ 隱藏過濾（依 project.id）
- ✅ 測試：Wave 2 合併後 89 綠（vitest，已排除 `.worktrees`）
- 🔲 技術債：migration baseline（`scripts/baseline-migrations.mjs` 就緒，待對 prod 執行，gated）

## v0.4.0 — 穩定性

- 加入測試（至少 Server Actions 單元測試）
- middleware session 驗證強化
- ✅ 效能優化（R2 singleton、DB index、前端 re-render 減量 — 14 檔案 18 項優化）

## v1.0.0 — 正式版

- 完整測試覆蓋
- TypeScript 遷移（可選）
- API 文件
