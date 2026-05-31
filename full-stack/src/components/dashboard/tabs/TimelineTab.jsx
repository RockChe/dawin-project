"use client";
import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useTheme } from "@/components/ThemeProvider";
import useUserSettings from "@/hooks/useUserSettings";
import GanttTimeline, { TimeScaleToggle, toggleCollapsed, uniqueProjectIds } from "../GanttTimeline";

const LS_KEY = "dash-timelineCollapsed";

function readCollapsedFromLS() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function TimelineTab({
  twp,
  allS,
  fpSet,
  fs,
  fpr,
  isMobile,
  ganttWidths,
  timelineHeight,
  configOwners = [],
  hiddenProjects = [],
  projects = [],
  timelineDefaultCollapsed = false,
  setTimelineDefaultCollapsed,
}) {
  const [timeDim, setTimeDim] = useState("月");
  const { X } = useTheme();
  const { settings, updateSetting } = useUserSettings({ timelineSort: "manual" });
  const timelineSort = settings.timelineSort;

  // ── Collapse state (lifted from GanttTimeline) ────────────────────────────
  // Initialise from localStorage; if no record, start with [].
  const [collapsed, setCollapsed] = useState(() => {
    const fromLS = readCollapsedFromLS();
    return fromLS !== null ? fromLS : [];
  });

  // Track whether a localStorage record existed at mount time.
  const hadLocalRecordRef = useRef(
    typeof window !== "undefined" && localStorage.getItem(LS_KEY) !== null
  );
  // Track whether the default has already been applied once (or the user clicked the button).
  const defaultAppliedRef = useRef(false);

  // Persist collapse state to localStorage on every change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(LS_KEY, JSON.stringify(collapsed)); } catch { /* ignore */ }
  }, [collapsed]);

  const onToggleCollapse = useCallback(id => {
    setCollapsed(prev => toggleCollapsed(prev, id));
  }, []);

  // All project ids visible on this timeline (excludes hidden projects).
  const allProjectIds = useMemo(
    () => uniqueProjectIds(twp, hiddenProjects),
    [twp, hiddenProjects]
  );

  // Apply server-persisted default once — only when no localStorage record exists.
  useEffect(() => {
    if (defaultAppliedRef.current || hadLocalRecordRef.current) return;
    if (!allProjectIds.length) return;
    defaultAppliedRef.current = true;
    if (timelineDefaultCollapsed) setCollapsed(allProjectIds);
  }, [timelineDefaultCollapsed, allProjectIds]);

  // ── Collapse-all / Expand-all button ──────────────────────────────────────
  const handleCollapseExpandAll = useCallback(() => {
    defaultAppliedRef.current = true;
    if (timelineDefaultCollapsed) {
      // Currently the default is "collapsed" → button label is "全部展開" → click expands all
      setCollapsed([]);
      if (setTimelineDefaultCollapsed) setTimelineDefaultCollapsed(false);
    } else {
      // Currently the default is "expanded" → button label is "全部收折" → click collapses all
      setCollapsed(allProjectIds);
      if (setTimelineDefaultCollapsed) setTimelineDefaultCollapsed(true);
    }
  }, [timelineDefaultCollapsed, setTimelineDefaultCollapsed, allProjectIds]);

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
            onChange={e => updateSetting("timelineSort", e.target.value)}
            style={pillStyle}
          >
            <option value="manual">手動</option>
            <option value="name">名稱</option>
            <option value="progress">進度</option>
          </select>
          <button onClick={handleCollapseExpandAll} style={pillStyle}>
            {timelineDefaultCollapsed ? "全部展開" : "全部收折"}
          </button>
        </div>
        <TimeScaleToggle value={timeDim} onChange={setTimeDim} />
      </div>
      <GanttTimeline
        tasks={twp}
        subtasks={allS}
        fp={fpSet}
        fs={fs}
        fpr={fpr}
        isMobile={isMobile}
        timeDim={timeDim}
        ganttWidths={ganttWidths}
        timelineHeight={timelineHeight}
        configOwners={configOwners}
        hiddenProjects={hiddenProjects}
        timelineSort={timelineSort}
        projects={projects}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
      />
    </>
  );
}

export default memo(TimelineTab);
