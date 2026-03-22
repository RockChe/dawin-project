# 版本藍圖

## v0.1.0 — MVP ✅（目前版本）

- 多專案任務管理（CRUD）
- 子任務與進度追蹤
- 甘特圖時間軸
- CSV 匯入匯出
- Session-based 認證
- Google Sheets 資料層（自建 DAL）
- Google Drive 檔案上傳下載
- 雙主題（明亮 / 深色）
- 拖曳排序
- 記憶體快取（30 秒 TTL）

## v0.2.0 — 程式碼品質

- ✅ Dashboard.jsx 元件拆分（已拆為獨立 tab 元件）
- 主題系統改用 React Context
- 統一 Server Action 錯誤處理模式
- utils.js 函式重新命名
- sheets-dal.js 效能優化

## v0.3.0 — 功能擴展

- 通知系統（任務到期提醒）
- 活動紀錄 / Audit Log
- 報表 / 統計儀表板

## v0.4.0 — 穩定性

- 加入測試（至少 Server Actions 單元測試）
- middleware session 驗證強化
- 效能優化（大量任務渲染）
- Google API 配額監控與限流

## v1.0.0 — 正式版

- 完整測試覆蓋
- TypeScript 遷移（可選）
- API 文件
