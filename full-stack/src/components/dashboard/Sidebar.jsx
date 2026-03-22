'use client';

import { useState, useCallback } from 'react';
import { logout } from '@/server/actions/auth';
import { useTheme } from '@/components/ThemeProvider';

export default function Sidebar({ user }) {
  const { X } = useTheme();
  const [collapsed, setCollapsed] = useState(true);
  const [hoverToggle, setHoverToggle] = useState(false);
  const [hoverLogout, setHoverLogout] = useState(false);
  const [hoverNav, setHoverNav] = useState(null);

  return (
    <aside
      className="flex flex-col border-r transition-all duration-200"
      style={{
        width: collapsed ? 60 : 220,
        background: X.surface,
        borderColor: X.border,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: X.border }}>
        {!collapsed && (
          <span className="text-sm font-semibold truncate" style={{ color: X.text }}>
            專案管理
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded text-xs"
          style={{ color: X.textSec, background: hoverToggle ? X.surfaceHover : 'transparent' }}
          onMouseEnter={() => setHoverToggle(true)}
          onMouseLeave={() => setHoverToggle(false)}
        >
          {collapsed ? '▸' : '◂'}
        </button>
      </div>

      {/* User info */}
      <div className="p-3 border-b" style={{ borderColor: X.border }}>
        {!collapsed && (
          <div className="mb-2">
            <div className="text-xs font-medium truncate" style={{ color: X.text }}>{user.name}</div>
            <div className="text-xs truncate" style={{ color: X.textDim }}>{user.email}</div>
          </div>
        )}
        <form action={logout}>
          <button
            type="submit"
            className="w-full text-xs py-1.5 px-2 rounded text-left"
            style={{ color: X.red, background: hoverLogout ? X.surfaceHover : 'transparent' }}
            onMouseEnter={() => setHoverLogout(true)}
            onMouseLeave={() => setHoverLogout(false)}
          >
            {collapsed ? '⏻' : '登出'}
          </button>
        </form>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        <NavItem href="/dashboard" icon="◻" label="儀表板" collapsed={collapsed} hoverNav={hoverNav} setHoverNav={setHoverNav} />
        {user.role === 'super_admin' && (
          <>
            <NavItem href="/users" icon="◎" label="帳號管理" collapsed={collapsed} hoverNav={hoverNav} setHoverNav={setHoverNav} />
            <NavItem href="/backup" icon="⟳" label="資料備份" collapsed={collapsed} hoverNav={hoverNav} setHoverNav={setHoverNav} />
          </>
        )}
      </nav>
    </aside>
  );
}

function NavItem({ href, icon, label, collapsed, hoverNav, setHoverNav }) {
  const { X } = useTheme();
  const isHover = hoverNav === href;
  return (
    <a
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
      style={{ color: X.text, background: isHover ? X.surfaceHover : 'transparent' }}
      onMouseEnter={() => setHoverNav(href)}
      onMouseLeave={() => setHoverNav(null)}
    >
      <span className="text-base">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </a>
  );
}
