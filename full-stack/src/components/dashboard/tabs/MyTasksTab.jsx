"use client";
import { useMemo, useState, memo } from "react";
import { FM } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import { fD, toBusinessDateString } from "@/lib/utils";
import { STATUS_FILTERS } from "@/lib/constants";
import { toggleStatus } from "@/lib/statusFilter";
import { groupMyTasks, myTaskKpis, daysLeft, roleBadge } from "@/lib/myTasks";

// 唯讀清單：登入者（userName）名下、尚未完成的任務，依到期日分三組。
// 「今天」一律取 Asia/Taipei 日界（toBusinessDateString），不直接 new Date()——理由見 OverviewTab 的 computeTodayPct。
function MyTasksTab({ twp, userName, pcMap, setModalTask, today: todayProp }) {
  const { X, SC } = useTheme();
  const today = todayProp || toBusinessDateString();
  const [sel, setSel] = useState([]); // 狀態多選，[] = 不篩；不持久化
  const groups = useMemo(() => groupMyTasks(twp, userName, today, sel), [twp, userName, today, sel]);
  const kpis = useMemo(() => myTaskKpis(twp, userName, today), [twp, userName, today]);
  const total = groups.overdue.length + groups.soon.length + groups.later.length + (groups.done?.length || 0);

  const cards = [
    { l: "已逾期", n: kpis.overdue, c: X.red },
    { l: "7 天內到期", n: kpis.soon, c: X.amber },
    { l: "進行中", n: kpis.inProgress, c: X.text },
    { l: "本月已完成", n: kpis.doneThisMonth, c: X.green },
  ];
  const sections = [
    { k: "overdue", l: "逾期", c: X.red },
    { k: "soon", l: "7 天內", c: X.amber },
    { k: "later", l: "之後", c: X.textDim },
    { k: "done", l: "已完成", c: X.green },
  ];

  return (<>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
      {cards.map(c => (
        <div key={c.l} style={{ background: X.surface, borderRadius: 12, padding: "16px 18px", border: `1px solid ${X.border}`, boxShadow: X.surfaceShadow }}>
          <div style={{ fontFamily: FM, fontSize: 24, fontWeight: 700, lineHeight: 1, color: c.c }}>{c.n}</div>
          <div style={{ fontSize: 13, color: X.textSec, marginTop: 6 }}>{c.l}</div>
        </div>
      ))}
    </div>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {STATUS_FILTERS.map(s => { const a = s === "全部" ? sel.length === 0 : sel.includes(s), c = SC[s]; return (
        <button key={s} type="button" aria-pressed={a} onClick={() => setSel(v => toggleStatus(v, s))}
          style={{ padding: "6px 16px", borderRadius: 20, border: a ? "none" : `1px solid ${X.border}`, background: a ? (c?.color || X.textDim) : X.surface, color: a ? "#fff" : X.textSec, fontSize: 14, fontWeight: a ? 700 : 400, cursor: "pointer" }}>{s}</button>); })}
    </div>

    {total === 0 && (
      <div style={{ background: X.surface, borderRadius: 12, padding: 40, border: `1px solid ${X.border}`, textAlign: "center", color: X.textDim, fontSize: 14 }}>
        {sel.length ? "沒有符合篩選的任務" : "沒有指派給你的任務 🎉"}
      </div>
    )}

    {sections.map(s => groups[s.k]?.length > 0 && (
      <div key={s.k} style={{ background: X.surface, borderRadius: 12, border: `1px solid ${X.border}`, marginBottom: 12, overflow: "hidden" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${X.border}` }}>
          <span style={{ width: 3, height: 14, background: s.c, borderRadius: 2 }} />{s.l}
          <span style={{ marginLeft: "auto", fontFamily: FM, fontSize: 12, fontWeight: 400, color: X.textDim }}>{groups[s.k].length}</span>
        </h3>
        {groups[s.k].map(t => {
          const d = daysLeft(t.end, today);
          const sc = SC[t.status]?.color || X.textDim;
          const role = roleBadge(t, userName);
          return (
            <div key={t.id} onClick={() => setModalTask(t)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: `1px solid ${X.border}22`, cursor: "pointer" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: pcMap[t.project] || X.accent, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="dash-name-1line" style={{ fontSize: 14, fontWeight: 500 }}>{t.task}{role && <span style={{ fontSize: 11, borderRadius: 6, padding: "0 6px", marginLeft: 6, background: `${X.accent}22`, color: X.accent, fontWeight: 500 }}>{role}</span>}</div>
                <div style={{ fontSize: 12, color: X.textSec }}>{t.project}</div>
              </div>
              <span style={{ fontSize: 12, padding: "1px 8px", borderRadius: 6, background: `${sc}22`, color: sc, flexShrink: 0 }}>{t.status}</span>
              <div title={`${t.progress}%`} style={{ width: 70, height: 5, background: X.border, borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
                <div style={{ width: `${t.progress}%`, height: "100%", background: X.accent }} />
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, minWidth: 52 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FM, color: s.c }}>{d === null ? "—" : `${d}d`}</div>
                <div style={{ fontSize: 11, color: X.textSec, fontFamily: FM }}>{fD(t.end)}</div>
              </div>
            </div>
          );
        })}
      </div>
    ))}
  </>);
}

export default memo(MyTasksTab);
