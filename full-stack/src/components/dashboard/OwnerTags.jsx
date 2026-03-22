"use client";
import { useTheme } from "@/components/ThemeProvider";

export default function OwnerTags({ value }) {
  const { X } = useTheme();
  const tags = (value && value !== "—") ? value.split(",").map(s => s.trim()).filter(Boolean) : [value || "—"];
  return (<span style={{ display: "inline-flex", gap: 3, flexWrap: "wrap" }}>{tags.map((t, i) => <span key={i} style={{ fontSize: 12, padding: "1px 6px", borderRadius: 8, background: `${X.accent}15`, color: X.textSec }}>{t}</span>)}</span>);
}
