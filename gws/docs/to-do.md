# 待辦事項

對應版本：v0.2.0（程式碼品質）
更新日期：2026-03-21

---

## 高優先

- [x] Dashboard.jsx 拆分 — 已拆為獨立 tab 元件（DataTableTab, OverviewTab, ProjectsTab, SettingsTab, TimelineTab）
- [ ] 主題系統重構 — mutable export 模式已導致 dark mode bug，考慮改用 React Context
- [ ] middleware.js 安全性 — 只檢查 cookie 存在不驗證有效性，有安全隱患

## 中優先

- [ ] utils.js 函式命名改善 — pD, fD, toISO 等縮寫不直觀，應改為完整命名
- [ ] Server Action 錯誤處理統一化 — 部分用 throw、部分用回傳值，應統一為回傳值模式
- [ ] 手機版甘特圖觸控體驗優化
- [ ] sheets-dal.js 效能優化 — 減少不必要的全表讀取，改用局部更新
- [ ] Google API 配額監控 — 加入 API 呼叫計數與限流機制

## 低優先

- [ ] ESLint 規則調整
- [ ] 加入 loading skeleton 到 project detail 頁
