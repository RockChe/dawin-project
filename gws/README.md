# Dawin Dash — GWS 版

影視 IP 專案管理儀表板 — 追蹤多個影視專案的任務進度、時程與檔案。

本版本使用 **Google Sheets 作為資料層**、**Google Drive 作為檔案儲存**，適合小團隊快速部署。

## 功能

- 多專案管理與切換
- 任務建立、編輯、刪除
- 五種任務狀態（已完成 / 進行中 / 待辦 / 提案中 / 待確認）
- 三級優先級（高 / 中 / 低）
- 子任務管理與進度追蹤
- 甘特圖時間軸
- 任務分類標籤（商務合作、活動、播出/開始、行銷、發行、市場展）
- 負責人指派
- 檔案上傳 / 下載（Google Drive）
- CSV 匯入匯出
- 拖曳排序
- 深色 / 淺色主題切換

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | Next.js 15.3, React 19, Tailwind CSS 4, @dnd-kit |
| 後端 | Next.js Server Actions, Custom DAL (sheets-dal.js) |
| 資料層 | Google Sheets API v4 |
| 檔案儲存 | Google Drive API v3 |
| 認證 | Session-based (bcryptjs) |
| 部署 | Vercel |

## 相關文件

| 文件 | 說明 |
|------|------|
| [quickstart.md](./quickstart.md) | 安裝與啟動步驟 |
| [guide.md](./guide.md) | 行銷人員操作指南 |
| [milestone.md](./milestone.md) | 版本藍圖 |
| [to-do.md](./to-do.md) | 當前待辦事項 |
| [專案進度.md](./專案進度.md) | 開發歷史紀錄 |
