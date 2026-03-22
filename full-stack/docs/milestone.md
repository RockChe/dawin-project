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
- 主題系統改用 React Context
- 統一 Server Action 錯誤處理模式
- 清理 `/api/debug` route
- utils.js 函式重新命名

## v0.3.0 — 功能擴展

- 通知系統（任務到期提醒）
- 活動紀錄 / Audit Log
- 報表 / 統計儀表板
- Settings：上傳公司 Logo + 設定 Dashboard 標題
- Settings：顯示 R2 儲存空間容量
- 專案卡片：支援上傳 Profile 圖並顯示
- 專案卡片排序順序可拖曳設定
- REST API：`/api/mcp/*` endpoints 供外部服務存取（詳見 `docs/api-spec.md`）
- MCP Server：本地 Claude Desktop 專用包裝，呼叫 REST API
- Python Chatbot：LINE + Telegram AI 對話 Bot（詳見 `chatbot/README.md`、`chatbot/docs/architecture.md`）
- 日報 / 週報系統：定時 + 手動觸發，透過 LINE / Telegram 發送

## v0.4.0 — 穩定性

- 加入測試（至少 Server Actions 單元測試）
- middleware session 驗證強化
- 效能優化（大量任務渲染）

## v1.0.0 — 正式版

- 完整測試覆蓋
- TypeScript 遷移（可選）
- API 文件
