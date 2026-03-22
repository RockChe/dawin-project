# Dawin Dash

影視 IP 專案管理儀表板 — 追蹤多個影視專案的任務進度、時程與檔案。

## 功能

- 多專案管理與切換
- 任務建立、編輯、刪除
- 五種任務狀態（已完成 / 進行中 / 待辦 / 提案中 / 待確認）
- 三級優先級（高 / 中 / 低）
- 子任務管理與進度追蹤
- 甘特圖時間軸
- 任務分類標籤（商務合作、活動、播出/開始、行銷、發行、市場展）
- 負責人指派
- 檔案上傳 / 下載（Cloudflare R2）
- CSV 匯入匯出
- 拖曳排序
- 深色 / 淺色主題切換

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | Next.js 15.3, React 19, Tailwind CSS 4, @dnd-kit |
| 後端 | Next.js Server Actions, Drizzle ORM |
| 資料庫 | Neon PostgreSQL (Serverless) |
| 檔案儲存 | Cloudflare R2 |
| 認證 | Session-based (bcryptjs) |
| 部署 | Vercel |

## 文檔導覽

| 文檔 | 說明 | 適合誰看 |
|------|------|---------|
| [CLAUDE.md](./CLAUDE.md) | AI 開發指引 — 架構、Schema、開發慣例 | AI / 開發者 |
| [milestone.md](./docs/milestone.md) | 版本藍圖 — 功能規劃與完成狀態 | 產品 & 開發 |
| [SDD.md](./docs/SDD.md) | 架構設計 — 為什麼這樣設計 | 開發 & 架構師 |
| [TDD.md](./docs/TDD.md) | 技術實作 — 複雜功能怎麼做的 | 開發者 |
| [BUGFIX-LOG.md](./docs/BUGFIX-LOG.md) | 踩坑知識庫 — 避免重複犯錯 | 開發者 & AI |
| [to-do.md](./docs/to-do.md) | 待辦清單 — 當前優先工作項 | 開發團隊 |
| [專案進度.md](./docs/專案進度.md) | 開發日誌 — 按日期倒序的變更紀錄 | 開發 & 審查 |
| [api-spec.md](./docs/api-spec.md) | REST API 規格 — 17 個 endpoints 定義 | 開發者 |
| [code-review.md](./docs/code-review.md) | Code Review 報告 — 安全性與效能修正紀錄 | 開發者 |
| [quickstart.md](./docs/quickstart.md) | 快速開始 — .env 配置 + CLI 指令集 | 新加入開發者 |
| [guide.md](./docs/guide.md) | 使用手冊 — 功能教學 | 行銷 / 終端使用者 |
