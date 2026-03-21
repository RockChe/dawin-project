"use client";
import GanttTimeline, { TimeScaleToggle } from "./GanttTimeline";

export default function TimelineTab({ twp, allS, fpSet, fs, fpr, isMobile, timeDim, setTimeDim, ganttWidths }) {
  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
        <TimeScaleToggle value={timeDim} onChange={setTimeDim} />
      </div>
      <GanttTimeline tasks={twp} subtasks={allS} fp={fpSet} fs={fs} fpr={fpr} isMobile={isMobile} timeDim={timeDim} ganttWidths={ganttWidths} />
    </>
  );
}
