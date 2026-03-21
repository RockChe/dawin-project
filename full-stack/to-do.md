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
