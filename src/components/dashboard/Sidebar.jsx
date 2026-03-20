'use client';

import { useState } from 'react';
import { logout } from '@/server/actions/auth';

export default function Sidebar({ user }) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <aside
      className="flex flex-col border-r transition-all duration-200"
      style={{
        width: collapsed ? 60 : 220,
        background: '#FFFFFF',
        borderColor: '#E3E2DE',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E3E2DE' }}>
        {!collapsed && (
          <span className="text-sm font-semibold truncate" style={{ color: '#37352F' }}>
            專案管理
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-100 text-xs"
          style={{ color: '#6B6B6B' }}
        >
          {collapsed ? '▸' : '◂'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        <NavItem href="/dashboard" icon="◻" label="儀表板" collapsed={collapsed} />
        {user.role === 'super_admin' && (
          <NavItem href="/users" icon="◎" label="帳號管理" collapsed={collapsed} />
        )}
      </nav>

      {/* User info */}
      <div className="p-3 border-t" style={{ borderColor: '#E3E2DE' }}>
        {!collapsed && (
          <div className="mb-2">
            <div className="text-xs font-medium truncate" style={{ color: '#37352F' }}>{user.name}</div>
            <div className="text-xs truncate" style={{ color: '#9B9A97' }}>{user.email}</div>
          </div>
        )}
        <form action={logout}>
          <button
            type="submit"
            className="w-full text-xs py-1.5 px-2 rounded hover:bg-gray-100 text-left"
            style={{ color: '#EB5757' }}
          >
            {collapsed ? '⏻' : '登出'}
          </button>
        </form>
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label, collapsed }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
      style={{ color: '#37352F' }}
    >
      <span className="text-base">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </a>
  );
}
