"use client";
import { useTheme } from "@/components/ThemeProvider";
import { getOwnerColor } from "@/lib/theme";

export default function OwnerTags({ value, configOwners = [] }) {
  const { X } = useTheme();
  const tags = (value && value !== "—") ? value.split(",").map(s => s.trim()).filter(Boolean) : [value || "—"];
  return (<span style={{ display: "inline-flex", gap: 3, flexWrap: "wrap" }}>{tags.map((t, i) => {
    const oc = (t && t !== "—") ? getOwnerColor(X, t, configOwners) : { color: X.textSec, bg: `${X.accent}15` };
    return <span key={i} style={{ fontSize: 12, padding: "1px 6px", borderRadius: 8, background: oc.bg, color: oc.color, fontWeight: 500 }}>{t}</span>;
  })}</span>);
}
