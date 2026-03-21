# 待辦事項

對應版本：v0.2.0（程式碼品質）
更新日期：2026-03-21

---

## 高優先

- [x] Dashboard.jsx 拆分 — 已完成（945→187 行，6 個 tab 子元件於 `tabs/` 目錄）
- [ ] 主題系統重構 — mutable export 模式已導致 dark mode bug，考慮改用 React Context
- [ ] middleware.js 安全性 — 只檢查 cookie 存在不驗證有效性，有安全隱患

## 中優先

- [ ] utils.js 函式命名改善 — pD, fD, toISO 等縮寫不直觀，應改為完整命名
- [x] Server Action 錯誤處理統一化 — 已統一為 safeRequireAuth + 回傳值模式
- [ ] 手機版甘特圖觸控體驗優化
- [ ] 加入 loading skeleton 到 project detail 頁

## 低優先

- [ ] 移除 `/api/debug` route — 不應存在於正式環境
- [ ] cookies.txt 加入 .gitignore 或刪除
- [ ] ESLint 規則調整

---

## 待開發功能（v0.3.0）

### Feature 1: Settings — 公司 Logo & Dashboard 標題
- [ ] 新增 /api/upload-system route（系統級檔案上傳，不綁 taskId）
- [ ] SettingsTab 新增 Logo 上傳 + Title 輸入 UI
- [ ] DashboardHeader 改為動態顯示 Logo 和標題
- [ ] getInitialData() 擴展載入 dashboard_title, company_logo config

### Feature 2: 專案卡片 Profile 圖
- [ ] schema.js projects 表新增 imageR2Key 欄位
- [ ] 執行 Drizzle migration
- [ ] ProjectsTab 圖片上傳改為 R2 持久化（取代現有 data URL）
- [ ] 移除 Dashboard.jsx 的 projIcons state

### Feature 3: Settings — R2 儲存空間容量
- [ ] 新增 storage.js server action（查詢 files 表 SUM + 系統資產）
- [ ] SettingsTab 新增 Storage Usage 區塊（進度條 + 分類明細）
- [ ] utils.js 新增 formatBytes 工具函式

### Feature 4: 專案卡片排序
- [ ] 新增 reorderProjects server action
- [ ] useTaskManager 新增 reorderProjects callback（樂觀更新）
- [ ] ProjectsTab 加入 @dnd-kit 拖曳排序
- [ ] 新增手動排序按鈕（名稱 / 日期 / 進度）

### Feature 5: MCP Server
- [ ] 建立 mcp-server/ 目錄，初始化專案
- [ ] 實作 tools：list/create/update projects, tasks, subtasks
- [ ] 實作 tools：get_dashboard_summary, search_tasks
- [ ] 實作 resources：dashboard://overview, project:///{id}
- [ ] 撰寫 README 與使用說明

### Feature 6: 日報 / 週報系統
- [ ] 設計報告數據結構（日報：進度摘要、完成任務、逾期提醒；週報：趨勢、對比、工作量）
- [ ] 新增 report server actions（生成報告數據）
- [ ] MCP Server 新增 generate_daily_report / generate_weekly_report tools
- [ ] 整合 Gmail API 寄送報告（透過 gws MCP）
- [ ] 預留 LINE / Telegram webhook 整合介面
- [ ] SettingsTab 新增報告設定（收件人、發送時間、頻率）
