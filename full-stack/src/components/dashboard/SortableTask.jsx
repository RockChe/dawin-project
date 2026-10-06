"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTheme } from "@/components/ThemeProvider";

// 只允許垂直拖移（Gantt 左欄與 Tasks 列表都是單欄清單）。不引入 @dnd-kit/modifiers，一行就夠。
export const lockHorizontal = ({ transform }) => ({ ...transform, x: 0 });

/**
 * One sortable task row/card. Renders nothing itself — hands `{ setNodeRef, style, handle }`
 * to the caller so the existing card/row markup stays where it is.
 * The handle is the ONLY drag activator, and it swallows its own click, so the header's
 * click-to-edit (setModalTask) keeps working everywhere else on the block.
 * Viewers never mount this (callers render the plain markup without a DndContext).
 */
export default function SortableTask({ id, children }) {
  const { X } = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, ...(isDragging ? { position: "relative", zIndex: 20, opacity: 0.85 } : null) };
  const handle = (
    <span className="dash-tap" aria-label="拖移任務" title="拖移排序" {...attributes} {...listeners}
      onClick={e => e.stopPropagation()}
      style={{ cursor: "grab", fontSize: 16, color: X.textDim, userSelect: "none", flexShrink: 0, padding: "2px 2px", touchAction: "none" }}>⠿</span>
  );
  return children({ setNodeRef, style, handle });
}
