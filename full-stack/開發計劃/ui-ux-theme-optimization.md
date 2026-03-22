# UI/UX 配色優化方案 — Dawin Dash

## Context

Dawin Dash 是**兒少內容 IP 專案管理儀表板**，供內部團隊追蹤多個兒少 IP 專案的任務進度、時程、檔案與人員分工。目前雙主題系統功能完整但視覺偏 generic（暖色像 Notion、深色像 GitHub），缺乏兒少內容產業的辨識度與活力感。

此外有多個頁面完全不支援深色模式、深色主題中 pink === red 導致狀態無法區分、Toast/Spin 動畫已被引用但 keyframes 從未定義等問題。

**設計方向：** 專業但有溫度 — 兒少 IP 團隊每天使用的工具應該是**明亮、友善、帶點活力**的，同時保持專業可讀性。不是兒童向的卡通風，而是「做兒少內容的大人用的」精緻工具感。

---

## Phase 1: 核心主題升級 — `src/lib/theme.js`

### 1A. Warm 主題 → "Daylight"（日光）

概念：陽光灑進工作室的感覺 — 乾淨明亮，accent 用有活力的藍綠色取代冷硬的藍

| Token | 舊值 | 新值 | 改動理由 |
|-------|------|------|---------|
| label | "Warm Neutral" | "Daylight" | 明亮概念 |
| icon | 📄 | ☀️ | 日光感 |
| bg | #F5F3EF | #F5F3EF | **保持不變** — 護眼暖米色，不改亮 |
| surface | #FFFFFF | #FFFFFF | 保持純白卡片 |
| surfaceHover | #EEECE8 | #EEEBE5 | 微調更暖 |
| surfaceLight | #EEECE8 | #EEEBE5 | 同 surfaceHover |
| **accent** | #2383E2 | **#2B8FBF** | 偏 teal 的藍 — 更溫暖親和，不那麼「企業」 |
| **accentDark** | #1B6EC2 | **#1F7AA6** | 配合新 accent |
| text | #37352F | #2C2A25 | 稍深，提升對比度 |
| textSec | #6B6B6B | #6B6560 | 更暖 |
| textDim | #9B9A97 | #A09B93 | 微調 |
| border | #E3E2DE | #E2DED6 | 微調 |
| borderLight | #EEECE8 | #EEEBE4 | 微調 |
| **red** | #EB5757 | **#E54D4D** | 微調更乾淨 |
| **amber** | #CB912F | **#E5A118** | 更明亮的金黃色，去除灰感，更有活力 |
| **green** | #4DAB9A | **#27AE7A** | 更鮮明的綠 — 「完成」應該令人開心 |
| **purple** | #9065B0 | **#8B5CC6** | 更飽和 |
| pink | #D44C8E | #D94B86 | 微調 |
| shadow | rgba(0,0,0,0.06) | rgba(0,0,0,0.07) | 稍更明顯 |
| shadowHeavy | rgba(0,0,0,0.10) | rgba(0,0,0,0.12) | 更有層次 |
| selectionBg | #2383E230 | #2B8FBF30 | 跟隨 accent |

### 1B. Dimmed 主題 → "Nightshift"（夜班）

概念：晚上加班的柔和暗色 — 不是冰冷的深黑，而是帶暖調的深色

| Token | 舊值 | 新值 | 改動理由 |
|-------|------|------|---------|
| label | "Soft Dark" | "Nightshift" | 夜班概念 |
| bg | #1C2128 | #1A1E26 | 微調 |
| surface | #2D333B | #242A34 | 更暗表面，拉開對比 |
| surfaceHover | #373E47 | #303842 | 配合 |
| surfaceLight | #262C36 | #1E242E | 配合 |
| accent | #539BF5 | #50B5D6 | 偏 teal，與 warm 主題呼應 |
| accentDark | #4184E4 | #3DA0C0 | 配合 |
| **text** | #ADBAC7 | **#C2CDD8** | 更亮，提升可讀性 |
| **textSec** | #768390 | **#8A95A4** | 更亮 |
| textDim | #545D68 | #5A6474 | 微亮 |
| border | #373E47 | #323A45 | 微調 |
| borderLight | #2D333B | #242A34 | 同 surface |
| red | #F47067 | #F06860 | 微調 |
| **amber** | #DAAA3F | **#F0BC3A** | 更亮金黃 |
| **green** | #57AB5A | **#3DC07A** | 更鮮明 |
| **purple** | #B083F0 | **#BD8DF0** | 更亮 |
| **pink** | **#F47067 (=red!)** | **#E86CA8** | **關鍵修復：pink 不再等於 red** |
| shadow | rgba(0,0,0,0.3) | rgba(0,0,0,0.35) | 微調 |
| shadowHeavy | rgba(0,0,0,0.4) | rgba(0,0,0,0.50) | 更有層次 |
| selectionBg | #539BF530 | #50B5D630 | 跟隨 accent |

### 1C. 新增 Token

兩個主題都新增：

```javascript
// warm:
cyan: "#0891B2",              // 「行銷」類別色（取代硬編碼 #06B6D4）
surfaceShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
surfaceShadowHover: "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
modalShadow: "0 24px 64px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)",

// dimmed:
cyan: "#22D3EE",
surfaceShadow: "0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.15)",
surfaceShadowHover: "0 4px 12px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)",
modalShadow: "0 24px 64px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3)",
```

### 1D. 修復 mkCC / mkPJC 硬編碼 cyan

```javascript
// mkCC: "行銷":"#06B6D4" → "行銷": t.cyan
// mkPJC: "#06B6D4" → t.cyan
```

### 1E. 新增 FD_STYLE

```javascript
export const FD_STYLE = { fontWeight: 800, letterSpacing: "-0.02em" };
```

---

## Phase 2: CSS 修復 — `src/app/globals.css`

### 2A. 新增缺失的 @keyframes（現有 bug 修復）

Dashboard.jsx:179 引用 `toastIn`/`toastOut`，TaskModal 引用 `spin`，但 keyframes 從未定義：

```css
@keyframes toastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(16px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
@keyframes toastOut {
  from { opacity: 1; transform: translateX(-50%) translateY(0); }
  to   { opacity: 0; transform: translateX(-50%) translateY(16px); }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### 2B. 移除失效的靜態 scrollbar 色

`.dark ::-webkit-scrollbar-thumb` 永遠不觸發。移除靜態 scrollbar 顏色，已由 Dashboard.jsx 的動態 `<style>` 處理。

---

## Phase 3: 未主題化頁面修復

### 3A. `src/app/(auth)/login/page.jsx`

- 加入 `useTheme()` + `F`
- 所有硬編碼色替換為 `X.*` token
- 背景加微妙漸層：`linear-gradient(160deg, ${X.bg}, ${X.isDark ? '#141820' : '#EDE9E0'})`

### 3B. `src/app/(auth)/set-password/page.jsx`

同 login 的修復模式。

### 3C. `src/app/(admin)/users/page.jsx`

最大的未主題化頁面，約 20 個硬編碼色值，全部替換為 `X.*`。

---

## Phase 4: 深度層級與微互動

### 4A. 卡片陰影 — `Dashboard.jsx`
Status cards: 加 `boxShadow: X.surfaceShadow`

### 4B. 專案卡片 hover — `SortableProjectCard.jsx`
加 `transition: "border-color 0.2s, box-shadow 0.2s"`，hover 切換到 `surfaceShadowHover`

### 4C. Modal 陰影 — `TaskModal.jsx` + `FileManagerModal.jsx`
替換為 `X.modalShadow`

### 4D. Header 標題 — `DashboardHeader.jsx`
主標題套用 `FD_STYLE`

### 4E. Tab 過渡
Tab buttons 加 `transition: "color 0.2s, border-color 0.2s"`

---

## Phase 5: 字體權重 — `src/app/layout.jsx`

Noto Sans TC 加入 weight `'800'`。

---

## 修改檔案總覽

| # | 檔案 | 類型 | 影響範圍 |
|---|------|------|---------|
| 1 | `src/lib/theme.js` | 核心配色更新 | 高 |
| 2 | `src/app/globals.css` | Bug 修復 + 清理 | 中 |
| 3 | `src/app/layout.jsx` | 字體權重 | 低 |
| 4 | `src/app/(auth)/login/page.jsx` | 主題整合 | 中 |
| 5 | `src/app/(auth)/set-password/page.jsx` | 主題整合 | 中 |
| 6 | `src/app/(admin)/users/page.jsx` | 主題整合 | 高 |
| 7 | `src/components/dashboard/Dashboard.jsx` | 陰影 + 過渡 | 低 |
| 8 | `src/components/dashboard/SortableProjectCard.jsx` | Hover 陰影 | 低 |
| 9 | `src/components/dashboard/TaskModal.jsx` | Modal 陰影 | 低 |
| 10 | `src/components/dashboard/FileManagerModal.jsx` | Modal 陰影 | 低 |
| 11 | `src/components/dashboard/tabs/DashboardHeader.jsx` | 標題字體 + 陰影 | 低 |

---

## 驗證方式

1. `npm run dev` 啟動開發伺服器
2. 切換 Daylight / Nightshift 主題，確認所有顏色正確
3. Login 頁面在兩個主題下的外觀
4. 確認「提案中」(pink) 和「市場展」(red) 在深色模式下顏色不同
5. Toast 通知有進場/退場動畫
6. 卡片有微陰影，hover 時有提升效果
7. Modal 有更明顯的陰影層次
