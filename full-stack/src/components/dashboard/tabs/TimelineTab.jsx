"use client";
import { useState } from "react";
import GanttTimeline, { TimeScaleToggle } from "../GanttTimeline";

export default function TimelineTab({ twp, allS, fpSet, fs, fpr, isMobile, ganttWidths }) {
  const [timeDim, setTimeDim] = useState("月");

  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}><TimeScaleToggle value={timeDim} onChange={setTimeDim} /></div>
      <GanttTimeline tasks={twp} subtasks={allS} fp={fpSet} fs={fs} fpr={fpr} isMobile={isMobile} timeDim={timeDim} ganttWidths={ganttWidths} />
    </>
  );
}
