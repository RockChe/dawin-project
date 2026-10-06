"use client";
import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useTheme } from "@/components/ThemeProvider";
import GanttTimeline, {
  TimeScaleToggle,
  toggleCollapsed,
  uniqueProjectIds,
  collapseAllIds,
  resolveInitialCollapsed,
  readCollapsedLS,
} from "../GanttTimeline";

const LS_KEY = "dash-timelineCollapsed";

function TimelineTab({
  twp,
  allS,
  fpSet,
  fs,
  fpr,
  ganttWidths,
  timelineHeight,
  configOwners = [],
  hiddenProjects = [],
  projects = [],
  timelineDefaultCollapsed = true,
  setTimelineDefaultCollapsed,
  timeDim = "月",
  onTimeDimChange,
  timelineSort = "manual",
  onTimelineSortChange,
}) {
  const { X } = useTheme();

  // All project ids visible on this timeline (excludes hidden projects).
  const allProjectIds = useMemo(
    () => uniqueProjectIds(twp, hiddenProjects),
    [twp, hiddenProjects]
  );

  // ── Collapse state (lifted from GanttTimeline, controlled parent) ─────────
  // Initialise from localStorage, else from the default (system default = all
  // collapsed) so the very first render is already collapsed — no expanded flash.
  const [collapsed, setCollapsed] = useState(() =>
    resolveInitialCollapsed(readCollapsedLS(), timelineDefaultCollapsed, allProjectIds));

  // Track whether user has intentionally interacted with collapse state
  // (either via LS record at mount, or by clicking toggle/button).
  const userTouchedRef = useRef(
    typeof window !== "undefined" && localStorage.getItem(LS_KEY) !== null
  );

  // NOTE: no blanket persist effect — writing LS on mount would freeze a record
  // even without user interaction, defeating the per-account default fallback.
  // localStorage is written explicitly only inside onToggleCollapse / handleCollapseExpandAll.

  // Apply server-persisted default — only when no localStorage record exists and
  // the user hasn't touched the state. `timelineDefaultCollapsed` arrives async
  // from the server (Dashboard → useUserSettings), so this re-fires when it flips
  // false → true and collapses all then. When the default is falsy there is
  // nothing to apply, so we early-return without touching state — the initial `[]`
  // already represents "all expanded", and skipping the write avoids a redundant
  // re-render on every `allProjectIds` change.
  useEffect(() => {
    if (userTouchedRef.current) return;
    if (!allProjectIds.length) return;
    if (!timelineDefaultCollapsed) return;
    const next = resolveInitialCollapsed(null, timelineDefaultCollapsed, allProjectIds);
    // keep prev when unchanged — an unstable `hiddenProjects` default ([]) would otherwise loop
    setCollapsed(prev => (prev.length === next.length && next.every((id, i) => prev[i] === id) ? prev : next));
  }, [timelineDefaultCollapsed, allProjectIds]);

  const effectiveCollapsed = collapsed ?? [];

  // Individual project toggle (per-device via localStorage).
  const onToggleCollapse = useCallback(id => {
    userTouchedRef.current = true;
    setCollapsed(prev => {
      const next = toggleCollapsed(prev ?? [], id);
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Derive allCollapsed from actual state (not from the default setting).
  const allCollapsed = allProjectIds.length > 0 &&
    allProjectIds.every(id => effectiveCollapsed.includes(id));

  // ── Collapse-all / Expand-all button ──────────────────────────────────────
  const handleCollapseExpandAll = useCallback(() => {
    userTouchedRef.current = true;
    const next = collapseAllIds(allProjectIds, !allCollapsed);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setCollapsed(next);
    if (setTimelineDefaultCollapsed) setTimelineDefaultCollapsed(!allCollapsed);
  }, [allCollapsed, allProjectIds, setTimelineDefaultCollapsed]);

  const pillStyle = {
    background: X.surface,
    color: X.textSec,
    border: `1px solid ${X.border}`,
    borderRadius: 20,
    padding: "6px 14px",
    fontSize: 14,
    cursor: "pointer",
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            aria-label="排序方式"
            value={timelineSort}
            onChange={e => onTimelineSortChange?.(e.target.value)}
            style={pillStyle}
          >
            <option value="manual">手動</option>
            <option value="name">名稱</option>
            <option value="progress">進度</option>
          </select>
          <button
            onClick={handleCollapseExpandAll}
            aria-label={allCollapsed ? "全部展開 Timeline 專案" : "全部收折 Timeline 專案"}
            style={pillStyle}
          >
            {allCollapsed ? "全部展開" : "全部收折"}
          </button>
        </div>
        <TimeScaleToggle value={timeDim} onChange={onTimeDimChange} />
      </div>
      <GanttTimeline
        tasks={twp}
        subtasks={allS}
        fp={fpSet}
        fs={fs}
        fpr={fpr}
        timeDim={timeDim}
        ganttWidths={ganttWidths}
        timelineHeight={timelineHeight}
        configOwners={configOwners}
        hiddenProjects={hiddenProjects}
        timelineSort={timelineSort}
        projects={projects}
        collapsed={effectiveCollapsed}
        onToggleCollapse={onToggleCollapse}
      />
    </>
  );
}

export default memo(TimelineTab);
