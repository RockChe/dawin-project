# 快速開始

## 前置需求

- Node.js 18+
- npm
- [Neon](https://neon.tech/) PostgreSQL 帳號
- [Cloudflare R2](https://www.cloudflare.com/products/r2/) 帳號

## Clone & Install

```bash
git clone <repo-url>
cd dawin-dash/full-stack
npm install
```

## 環境變數

在專案根目錄建立 `.env` 檔案：

| 變數名稱 | 說明 |
|----------|------|
| `DATABASE_URL` | Neon PostgreSQL 連線字串 |
| `R2_ACCOUNT_ID` | Cloudflare 帳號 ID |
| `R2_ACCESS_KEY_ID` | R2 Access Key |
| `R2_SECRET_ACCESS_KEY` | R2 Secret Key |
| `R2_BUCKET_NAME` | R2 Bucket 名稱 |
| `R2_PUBLIC_URL` | R2 公開存取 URL（選填） |
| `NEXT_PUBLIC_BASE_URL` | 應用程式 URL（如 `http://localhost:3000`） |

## 資料庫初始化

```bash
# 將 schema 推送到 Neon 資料庫
npm run db:push

# 建立預設帳號
npm run seed
```

## 啟動

```bash
npm run dev
```

開啟 http://localhost:3000

## 預設登入帳號

預設帳號資訊請查看 `scripts/seed.js`。首次登入後系統會要求設定新密碼。

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 啟動開發伺服器（port 3000） |
| `npm run build` | 建置正式版 |
| `npm run start` | 啟動正式版（port 3000） |
| `npm run db:generate` | 產生 Drizzle migration 檔案 |
| `npm run db:migrate` | 執行 migration |
| `npm run db:push` | 直接推送 schema 到資料庫（開發用） |
| `npm run db:studio` | 開啟 Drizzle Studio（資料庫 GUI） |
| `npm run seed` | 執行 seed 腳本建立預設帳號 |

## 部署

專案部署在 Vercel，推送到 `master` 分支後自動部署。

部署時需在 Vercel 專案設定中配置上述所有環境變數。
