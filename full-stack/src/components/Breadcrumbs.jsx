"use client";
import { useTheme } from "@/components/ThemeProvider";

// items: [{ label, onClick?, href? }]；最後一項是當前頁（純文字、aria-current）。
// size="mobile"：可點項目 minHeight 44、標籤縮短，給手機版用。
export default function Breadcrumbs({ items = [], size = "desktop" }) {
  const { X } = useTheme();
  if (!items.length) return null;
  const mobile = size === "mobile";
  const label = { display: "inline-block", maxWidth: mobile ? 140 : 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" };
  const clickable = { ...label, font: "inherit", color: X.textSec, background: "transparent", border: "none", padding: 0, cursor: "pointer", textDecoration: "none",
    ...(mobile && { minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 2px" }) };
  const last = items.length - 1;
  return (
    <nav aria-label="breadcrumb" style={{ marginBottom: mobile ? 0 : 16, padding: mobile ? "0 14px" : 0, fontSize: mobile ? 13 : 14 }}>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", alignItems: "center", flexWrap: "wrap", gap: mobile ? 2 : 6 }}>
        {items.map((it, i) => (
          <li key={i} style={{ display: "inline-flex", alignItems: "center", gap: mobile ? 2 : 6, minWidth: 0 }}>
            {i === last
              ? <span aria-current="page" title={it.label} style={{ ...label, color: X.text, fontWeight: 600 }}>{it.label}</span>
              : it.href
                ? <a href={it.href} title={it.label} style={clickable}>{it.label}</a>
                : it.onClick
                  ? <button type="button" onClick={it.onClick} title={it.label} style={clickable}>{it.label}</button>
                  : <span title={it.label} style={{ ...label, color: X.textSec }}>{it.label}</span>}
            {i !== last && <span aria-hidden="true" style={{ color: X.textDim }}>›</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
