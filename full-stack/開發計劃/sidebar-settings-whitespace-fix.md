# Plan: Sidebar 帳號位置 + Settings 新增設定 + 留白修復

## Context
用戶反映三個 UI 問題：
1. Sidebar 帳號資訊 & 登出在最底部，需要拉到底才看得到 → 移到頂部
2. GanttTimeline 的行高度硬編碼、Upcoming Deadlines 的天數硬編碼 → 加入 Settings 可配置
3. Upcoming Deadlines 和 Status Distribution 區塊留白太多 → 修復 grid 對齊

---

## Change 1: Sidebar 帳號資訊移到頂部

**檔案**: `src/components/dashboard/Sidebar.jsx`

將 User info 區塊（目前在 nav 之後，底部）移到 Header 之後、nav 之前，`border-t` 改為 `border-b`。

結構變更：
```
Before: Header → Nav(flex-1) → UserInfo(border-t)
After:  Header → UserInfo(border-b) → Nav(flex-1)
```

---

## Change 2: Settings 新增 Display Settings

### 2a. Dashboard.jsx — 新增 state 與 prop 傳遞

新增兩組 localStorage state（跟隨既有 `ganttWidths` 模式）：

- `ganttHeights` / `ganttHeightsDraft` — key: `dash-ganttHeights`，default: `{ header: 48, projectRow: 32, taskRow: 40, taskBarHeight: 20, taskBarTop: 10 }`
- `upcomingDays` — key: `dash-upcomingDays`，default: `30`
- `upcomingLimit` — key: `dash-upcomingLimit`，default: `5`

Prop 傳遞：
- `OverviewTab` 加傳 `upcomingDays`, `upcomingLimit`
- `ProjectsTab` 加傳 `ganttHeights`
- `TimelineTab` 加傳 `ganttHeights`
- `SettingsTab` 加傳 `ganttHeightsDraft`, `setGanttHeightsDraft`, `saveGanttHeights`, `upcomingDays`, `upcomingLimit`, `saveUpcomingSettings`

### 2b. GanttTimeline.jsx — 接收 ganttHeights prop

Props 加入 `ganttHeights`，定義 fallback：
```js
const gh = ganttHeights || { header: 48, projectRow: 32, taskRow: 40, taskBarHeight: 20, taskBarTop: 10 };
```

替換所有硬編碼高度：
| 原始值 | 替換為 |
|--------|--------|
| `height: 48` (header) | `height: gh.header` |
| `height: 32` (project row) | `height: gh.projectRow` |
| `height: 40` (task row) | `height: gh.taskRow` |
| `top: 10, height: 20` (task bar) | `top: gh.taskBarTop, height: gh.taskBarHeight` |
| `top: 13` (progress text) | `top: gh.taskBarTop + 3` |

### 2c. OverviewTab.jsx — 接收 upcomingDays + upcomingLimit props

- Props 加入 `upcomingDays = 30`, `upcomingLimit = 5`
- 第 108 行：`30 * 864e5` → `upcomingDays * 864e5`
- 第 109 行：`.slice(0, 5)` → `.slice(0, upcomingLimit)`
- 第 112 行：「No upcoming deadlines in next 30 days」→ 動態顯示天數

### 2d. TimelineTab.jsx — 透傳 ganttHeights

- Props 加入 `ganttHeights`
- 傳給 `<GanttTimeline ganttHeights={ganttHeights} />`

### 2e. ProjectsTab.jsx — 透傳 ganttHeights

- Props 加入 `ganttHeights`（第 16 行）
- 第 164 行傳給 `<GanttTimeline ganttHeights={ganttHeights} />`

### 2f. SettingsTab.jsx — 新增 Display Settings 卡片

新增一張設定卡片，包含：
1. **Timeline Row Height** — 4 個 number input (Header / Project Row / Task Row / Task Bar Height)
2. **Upcoming Deadlines** — 2 個 number input (Days ahead + 顯示筆數)

跟隨既有 Timeline Width 卡片的 UI 風格（2x2 grid + Save 按鈕）。

---

## Change 3: 修復 Upcoming & Status 留白

**檔案**: `src/app/globals.css`

第 24 行 `.dash-grid-2col` 加入 `align-items: start`：
```css
.dash-grid-2col { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; align-items: start; }
```

效果：grid 子元素不再拉伸到同行最高高度，各自保持內容高度。

---

## 修改檔案清單

| 檔案 | 變更 |
|------|------|
| `src/components/dashboard/Sidebar.jsx` | 帳號區塊移到頂部 |
| `src/components/dashboard/Dashboard.jsx` | 新增 ganttHeights + upcomingDays + upcomingLimit state，傳遞 props |
| `src/components/dashboard/GanttTimeline.jsx` | 接收 ganttHeights，替換硬編碼高度 |
| `src/components/dashboard/tabs/OverviewTab.jsx` | 接收 upcomingDays + upcomingLimit，動態過濾與限制筆數 |
| `src/components/dashboard/tabs/TimelineTab.jsx` | 透傳 ganttHeights |
| `src/components/dashboard/tabs/ProjectsTab.jsx` | 透傳 ganttHeights |
| `src/components/dashboard/tabs/SettingsTab.jsx` | 新增 Display Settings UI |
| `src/app/globals.css` | dash-grid-2col 加 align-items: start |

## 驗證方式

1. 啟動 dev server (`npm run dev`)
2. 登入後確認 Sidebar 帳號資訊在頂部（Header 下方）
3. Overview tab 確認 Upcoming / Status 卡片不再有多餘留白
4. Settings tab 確認新增的 Display Settings 卡片正常顯示
5. 修改 Timeline Row Height 值 → Save → 切到 Timeline tab 確認高度變化
6. 修改 Upcoming Days 值 → Save → 切到 Overview tab 確認過濾天數變化
7. 修改顯示筆數 → Save → 確認 Upcoming Deadlines 列表筆數對應變化
8. 重新整理頁面確認 localStorage 持久化正常
