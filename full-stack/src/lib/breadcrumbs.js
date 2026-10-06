// 麵包屑項目組裝：純函式，無 React 依賴。item = { label, onClick?, href? }；最後一項是當前頁。
export const HOME_LABEL = "首頁";

const DESKTOP_TABS = { overview: "Overview", mytasks: "My Tasks", projects: "Projects", timeline: "Timeline", table: "Data", settings: "Settings" };
const MOBILE_TABS = { mytasks: "我的任務", overview: "總覽", projects: "專案", timeline: "時程", more: "更多" };

const link = ({ onClick, href }) => ({ ...(onClick && { onClick }), ...(href && { href }) });

/** 分頁層級：桌機首頁 = Overview；手機首頁 = 我的任務。首頁本身只顯示「首頁」。 */
export function tabCrumbs(tabKey, { onHome, homeHref, mobile = false } = {}) {
  const label = (mobile ? MOBILE_TABS : DESKTOP_TABS)[tabKey];
  const isHome = tabKey === (mobile ? "mytasks" : "overview");
  if (!label || isHome) return [{ label: HOME_LABEL }];
  return [{ label: HOME_LABEL, ...link({ onClick: onHome, href: homeHref }) }, { label }];
}

/** 詳情層級：首頁 › 分頁 › 名稱。onTab／tabHref 讓中間那層可點回清單。 */
export function detailCrumbs(tabKey, name, { onTab, tabHref, ...rest } = {}) {
  const [home, tab] = tabCrumbs(tabKey, rest);
  return [home, { ...tab, ...link({ onClick: onTab, href: tabHref }) }, { label: name }];
}
