"use client";
import { CloudLevelProvider } from "@/components/CloudLevelContext";
import { dayIndex } from "@/lib/dayIndex";
import { FIXTURE_TASKS, FIXTURE_TODAY } from "./fixtures";
import { LoadingState, ErrorState, EmptyNone, EmptyFiltered, EmptyProject, Toast } from "./StateViews";

// 狀態集驗收案例（計畫 R9：不是產品頁，只掛在 /v2/preview/states）。
// 每格左右並排「有雲／無雲」：兩邊各自強制成 full／off，不受使用者的顯示程度影響。
const Pair = ({ children }) => (
  <div className="pair">
    <div className="pane"><i>有雲朵</i><CloudLevelProvider level="full">{children}</CloudLevelProvider></div>
    <div className="pane"><i>無雲朵（fallback）</i><CloudLevelProvider level="off">{children}</CloudLevelProvider></div>
  </div>
);

export const STATE_CARDS = [
  ["載入中（白雲上下飄；減少動態時靜止）", <LoadingState key="l" />],
  ["載入失敗（烏雲，帶文字與重試）", <ErrorState key="e" />],
  ["空狀態：沒有待辦（筋斗雲）", <EmptyNone key="n" />],
  ["篩選後沒結果（淡紫雲）", <EmptyFiltered key="f" />],
  ["專案內尚無任務（白雲）", <EmptyProject key="p" />],
];
// 逾期提示條的數字取自 fixtures（今天固定 2026-10-07）：未完成且到期日早於今天的任務，最久的那一件
const overdue = FIXTURE_TASKS.filter((t) => t.status !== "已完成" && dayIndex(t.endDate) < dayIndex(FIXTURE_TODAY)).sort((a, b) => dayIndex(a.endDate) - dayIndex(b.endDate));
export const STATE_TOASTS = [
  <Toast key="ok" kind="ok" title="完成了！" sub="「票務展務相關」已標示完成，本專案已完成 3 / 8" />,
  <Toast key="warn" kind="warn" title={`有 ${overdue.length} 件任務逾期`} sub={`先處理最久的：${overdue[0].task}（${dayIndex(FIXTURE_TODAY) - dayIndex(overdue[0].endDate)} 天）`} />,
  <Toast key="tip" kind="tip" title="小提示" sub="在子任務加上負責人，任務的執行人會自動帶出喔" />,
];

export default function StatesGallery() {
  return (
    <div className="wrap" data-testid="v2-states">
      <div className="hd2"><h2 style={{ fontSize: 23 }}>狀態集 · 載入／錯誤／空狀態／提示條</h2><span className="hint">每格左右並排「有雲 ／ 無雲」，不受上方開關影響</span></div>
      <div className="sgal">
        {STATE_CARDS.map(([t, el]) => <section key={t} className="scard"><h3>{t}</h3><Pair>{el}</Pair></section>)}
        <section className="scard"><h3>提示條 toast（成功／逾期／小提示）</h3>
          <div className="stoasts">{STATE_TOASTS.map((t) => <Pair key={t.key}>{t}</Pair>)}</div>
        </section>
      </div>
    </div>
  );
}
