"use client";
import { useState, memo } from "react";
import { useTheme } from "@/components/ThemeProvider";
import useUserSettings from "@/hooks/useUserSettings";
import GanttTimeline, { TimeScaleToggle } from "../GanttTimeline";

function TimelineTab({ twp, allS, fpSet, fs, fpr, isMobile, ganttWidths, timelineHeight, configOwners = [], hiddenProjects = [], projects = [] }) {
  const [timeDim, setTimeDim] = useState("月");
  const { X } = useTheme();
  const { settings, updateSetting } = useUserSettings({ timelineSort: "manual" });
  const timelineSort = settings.timelineSort;

  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <select
          aria-label="排序方式"
          value={timelineSort}
          onChange={e => updateSetting("timelineSort", e.target.value)}
          style={{ background: X.surface, color: X.text, border: `1px solid ${X.border}`, borderRadius: 20, padding: "6px 12px", fontSize: 14, cursor: "pointer", outline: "none" }}
        >
          <option value="manual">手動</option>
          <option value="name">名稱</option>
          <option value="progress">進度</option>
        </select>
        <TimeScaleToggle value={timeDim} onChange={setTimeDim} />
      </div>
      <GanttTimeline tasks={twp} subtasks={allS} fp={fpSet} fs={fs} fpr={fpr} isMobile={isMobile} timeDim={timeDim} ganttWidths={ganttWidths} timelineHeight={timelineHeight} configOwners={configOwners} hiddenProjects={hiddenProjects} timelineSort={timelineSort} projects={projects} />
    </>
  );
}

export default memo(TimelineTab);
