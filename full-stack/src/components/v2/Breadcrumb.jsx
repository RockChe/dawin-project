"use client";
import { Fragment } from "react";

// items: [{ l: 文字, go?: 目標 }]；最後一項是目前位置（粗體、不可點）。
export default function Breadcrumb({ items, onGo }) {
  return (
    <nav className="crumbs" aria-label="麵包屑">
      {items.map((c, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="s" aria-hidden="true">›</span>}
          {i === items.length - 1
            ? <b aria-current="page">{c.l}</b>
            : <button type="button" className="lnk" onClick={() => onGo(c.go)}>{c.l}</button>}
        </Fragment>
      ))}
    </nav>
  );
}
