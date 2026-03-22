# 快速開始

## 前置需求

- Node.js 18+
- npm
- Google Cloud 專案（已啟用 Sheets API + Drive API）
- Google Service Account 金鑰 JSON
- 一個 Google Sheets 試算表
- 一個 Google Drive 資料夾（用於檔案上傳）

## Clone & Install

```bash
git clone <repo-url>
cd dawin-dash/gws
npm install
```

## 環境變數

在 `gws/` 目錄下建立 `.env` 檔案：

| 變數名稱 | 說明 |
|----------|------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Service Account 金鑰 JSON（完整 JSON 字串） |
| `GOOGLE_SPREADSHEET_ID` | Google Sheets 試算表 ID |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Google Drive 檔案上傳根目錄 ID |
| `SESSION_SECRET` | Session 加密金鑰（選填） |

## Google Sheets 初始化

```bash
# 自動建立 8 個 sheet tabs、寫入欄位標頭、建立預設帳號與範例資料
npm run setup:sheets
```

## 啟動

```bash
npm run dev
```

開啟 http://localhost:3001

## 預設登入帳號

預設帳號資訊請查看 `scripts/seed.js`。首次登入後系統會要求設定新密碼。

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 啟動開發伺服器（port 3001） |
| `npm run build` | 建置正式版 |
| `npm run start` | 啟動正式版 |
| `npm run setup:sheets` | 初始化 Google Sheets（建表 + 範例資料） |

## 部署

專案部署在 Vercel，推送到 `master` 分支後自動部署。

部署時需在 Vercel 專案設定中配置上述所有環境變數。

## 與 Full-Stack 版差異

| 項目 | Full-Stack 版 (`full-stack/`) | GWS 版 (`gws/`) |
|------|------------------------------|-----------------|
| 資料庫 | Neon PostgreSQL + Drizzle ORM | Google Sheets |
| 檔案儲存 | Cloudflare R2 | Google Drive |
| 初始化 | `npm run db:push` + `npm run seed` | `npm run setup:sheets` |
| 開發 Port | 3000 | 3001 |
