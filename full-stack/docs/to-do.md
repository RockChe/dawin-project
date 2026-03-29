# 待辦事項

對應版本：v0.2.0（程式碼品質）+ v0.3.0（功能擴展）
更新日期：2026-03-28

---

## 高優先

- [x] Dashboard.jsx 拆分 — 已完成（945→187 行，6 個 tab 子元件於 `tabs/` 目錄）
- [x] 主題系統重構 — 已完成，ThemeProvider（React Context）+ useTheme hook 取代 mutable export（Code Review C8）
- [x] 全站效能優化 — R2 singleton、DB index、re-render 減量（v0.4.0）
- [ ] middleware.js 安全性 — 只檢查 cookie 存在不驗證有效性，有安全隱患

## 中優先

- [ ] utils.js 函式命名改善 — pD, fD, toISO 等縮寫不直觀，應改為完整命名
- [x] Server Action 錯誤處理統一化 — 已統一為 safeRequireAuth + 回傳值模式
- [ ] 手機版甘特圖觸控體驗優化
- [ ] 加入 loading skeleton 到 project detail 頁

## 低優先

- [x] 移除 `/api/debug` route — 已加 `NODE_ENV === 'production'` 回傳 404（Code Review C1）
- [ ] cookies.txt 加入 .gitignore 或刪除
- [ ] ESLint 規則調整

---

## 待開發功能（v0.3.0）

### Feature 1: Settings — 公司 Logo & Dashboard 標題
- [ ] 新增 /api/upload-system route（系統級檔案上傳，不綁 taskId）
- [ ] SettingsTab 新增 Logo 上傳 + Title 輸入 UI
- [ ] DashboardHeader 改為動態顯示 Logo 和標題
- [ ] getInitialData() 擴展載入 dashboard_title, company_logo config

### Feature 2: 專案卡片 Profile 圖 ✅
- [x] schema.js projects 表新增 imageR2Key 欄位（實作為 bannerR2Key）
- [x] 執行 Drizzle migration（0001_certain_ben_grimm.sql）
- [x] ProjectsTab 圖片上傳改為 R2 持久化（/api/upload-banner + deleteProjectBanner）
- [x] 移除 Dashboard.jsx 的 projIcons state（改用 getInitialData 並行解析 bannerUrl）

### Feature 3: Settings — R2 儲存空間容量
- [ ] 新增 storage.js server action（查詢 files 表 SUM + 系統資產）
- [ ] SettingsTab 新增 Storage Usage 區塊（進度條 + 分類明細）
- [ ] utils.js 新增 formatBytes 工具函式

### Feature 4: 專案卡片排序 ✅
- [x] 新增 reorderProjects server action
- [x] useTaskManager 新增 reorderProjects callback（樂觀更新）
- [x] ProjectsTab 加入 @dnd-kit 拖曳排序
- [x] 新增手動排序按鈕（名稱 / 日期 / 進度）

### Feature 5: REST API（詳見 `docs/api-spec.md`）
- [ ] 修改 middleware.js — `/api/mcp` 加入 PUBLIC_PATHS
- [ ] 建立 `_lib/auth.js` — Bearer API Key 驗證（timing-safe compare）
- [ ] 建立 `_lib/response.js` — 統一回應格式（ok / created / err / notFound）
- [ ] 建立 `_lib/validate.js` — UUID、分頁、enum 驗證
- [ ] 建立 `_lib/queries.js` — 純 DB 查詢層（projects / tasks / subtasks）
- [ ] 實作 projects endpoints — GET (list), GET (detail+tasks), POST, PATCH, DELETE
- [ ] 實作 tasks endpoints — GET (list/filter/pagination), POST, PATCH, DELETE
- [ ] 實作 subtasks endpoints — GET (by taskId), POST, PATCH (toggle done), DELETE
- [ ] 實作 dashboard endpoint — GET（統計摘要、逾期任務、最近活動）
- [ ] 實作 search endpoint — GET（ILIKE 搜尋 tasks + subtasks）
- [ ] 實作 reports/daily endpoint — GET（日報數據）
- [ ] 實作 reports/weekly endpoint — GET（週報數據）
- [ ] 設定 MCP_API_KEY 環境變數到 Vercel

### Feature 6: MCP Server（Claude Desktop 用）
- [ ] 建立 mcp-server/ 目錄，初始化專案
- [ ] 實作 api-client.js — fetch wrapper 呼叫 REST API
- [ ] 實作 tools.js — 17 個 MCP tools（對應 REST API endpoints）
- [ ] 實作 index.js — stdio transport 入口
- [ ] 設定 Claude Desktop config 並測試

### Feature 7: Python Chatbot（詳見 `chatbot/README.md`）
- [ ] 初始化 chatbot/ 專案結構 + pyproject.toml
- [ ] 實作 api_client.py — REST API 呼叫封裝（httpx async）
- [ ] 實作 agent/core.py — Claude tool use Agent 主邏輯
- [ ] 實作 agent/tools.py — 13 個 Agent tools 定義
- [ ] 實作 platforms/line.py — LINE Messaging API webhook
- [ ] 實作 platforms/telegram.py — Telegram Bot API webhook
- [ ] 實作 reports/generator.py — 日報/週報內容生成（REST API + Claude 整理）
- [ ] 實作 reports/scheduler.py — APScheduler 定時排程（每日 09:00 / 每週一 09:00）
- [ ] 實作 utils/formatter.py — 訊息格式化（→ LINE Flex / TG Markdown）
- [ ] Dockerfile + Railway 部署
- [ ] 設定 LINE / Telegram webhook URL

### Feature 8: 日報 / 週報系統
- [ ] 設計報告數據結構（日報：進度摘要、完成任務、逾期提醒；週報：趨勢、對比、工作量）
- [ ] REST API reports endpoints（已含在 Feature 5）
- [ ] Chatbot 定時排程發送（已含在 Feature 7）
- [ ] 手動觸發：用戶在 LINE/TG 說「給我日報」即時生成

### Feature 9: 負責人彩色標籤 + 多人指派 ✅
- [x] OwnerTags 元件 — 每位負責人以彩色標籤顯示，自動分配顏色
- [x] Subtask 多人指派 — 子任務支援逗號分隔多人 owner
- [x] 建立者/來源追蹤 — 顯示任務建立者與來源
- [x] Owner 驗證修復 — split 逗號分隔後逐一驗證（BUG-010）

### Feature 10: 任務狀態快速切換 ✅
- [x] Projects Tab 狀態標籤點擊即出現下拉選單
- [x] 支援五種狀態直接切換（已完成/進行中/待辦/提案中/待確認）

### Feature 11: 備份功能增強 ✅
- [x] 完整導出所有表資料
- [x] 審計日誌搜尋匯出功能
