'use client';

import { useState, useEffect } from 'react';
import { getUsers, createUser, resetUserPassword, deleteUser } from '@/server/actions/users';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPw, setResetPw] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      setError('載入失敗');
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async (formData) => {
    setError(null);
    const result = await createUser(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess('帳號已建立');
      setShowCreate(false);
      loadUsers();
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleReset = async () => {
    if (!resetTarget || !resetPw) return;
    setError(null);
    const result = await resetUserPassword(resetTarget, resetPw);
    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess('密碼已重置');
      setResetTarget(null);
      setResetPw('');
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`確定要刪除 ${name} 嗎？`)) return;
    const result = await deleteUser(id);
    if (result?.error) {
      setError(result.error);
    } else {
      loadUsers();
      setSuccess('帳號已刪除');
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #E3E2DE',
    fontSize: 14,
    outline: 'none',
    color: '#37352F',
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#37352F' }}>帳號管理</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{ padding: '8px 20px', borderRadius: 20, border: 'none', background: '#2383E2', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          {showCreate ? '取消' : '+ 新增帳號'}
        </button>
      </div>

      {error && <div style={{ padding: 12, borderRadius: 8, background: '#EB575715', color: '#EB5757', fontSize: 14, marginBottom: 16 }}>{error}</div>}
      {success && <div style={{ padding: 12, borderRadius: 8, background: '#4DAB9A15', color: '#4DAB9A', fontSize: 14, marginBottom: 16 }}>{success}</div>}

      {/* Create Form */}
      {showCreate && (
        <form action={handleCreate} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #E3E2DE', marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#37352F' }}>新增帳號</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#6B6B6B', display: 'block', marginBottom: 4 }}>姓名 *</label>
              <input name="name" required style={inputStyle} placeholder="輸入姓名" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6B6B6B', display: 'block', marginBottom: 4 }}>Email *</label>
              <input name="email" type="email" required style={inputStyle} placeholder="user@email.com" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#6B6B6B', display: 'block', marginBottom: 4 }}>臨時密碼 *</label>
              <input name="password" type="password" required minLength={8} style={inputStyle} placeholder="至少 8 個字元" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6B6B6B', display: 'block', marginBottom: 4 }}>角色</label>
              <select name="role" style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>
          <button type="submit" style={{ padding: '8px 24px', borderRadius: 20, border: 'none', background: '#2383E2', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            建立帳號
          </button>
        </form>
      )}

      {/* Users Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E3E2DE', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E3E2DE', background: '#F5F3EF' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#6B6B6B' }}>姓名</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#6B6B6B' }}>Email</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#6B6B6B' }}>角色</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#6B6B6B' }}>狀態</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#6B6B6B' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid #E3E2DE' }}>
                <td style={{ padding: '12px 16px', color: '#37352F', fontWeight: 500 }}>{user.name}</td>
                <td style={{ padding: '12px 16px', color: '#6B6B6B' }}>{user.email}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                    background: user.role === 'super_admin' ? '#9065B015' : '#2383E215',
                    color: user.role === 'super_admin' ? '#9065B0' : '#2383E2',
                  }}>
                    {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {user.mustChangePassword && (
                    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: '#CB912F15', color: '#CB912F' }}>
                      需更改密碼
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setResetTarget(user.id); setResetPw(''); }}
                      style={{ padding: '4px 12px', borderRadius: 16, border: '1px solid #E3E2DE', background: '#fff', color: '#6B6B6B', fontSize: 12, cursor: 'pointer' }}
                    >
                      重置密碼
                    </button>
                    <button
                      onClick={() => handleDelete(user.id, user.name)}
                      style={{ padding: '4px 12px', borderRadius: 16, border: '1px solid #EB575730', background: '#fff', color: '#EB5757', fontSize: 12, cursor: 'pointer' }}
                    >
                      刪除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reset Password Modal */}
      {resetTarget && (
        <div onClick={() => setResetTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, width: 400, boxShadow: '0 16px 48px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#37352F' }}>重置密碼</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#6B6B6B', display: 'block', marginBottom: 4 }}>新臨時密碼</label>
              <input
                type="password"
                value={resetPw}
                onChange={e => setResetPw(e.target.value)}
                placeholder="至少 8 個字元"
                minLength={8}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setResetTarget(null)} style={{ padding: '8px 20px', borderRadius: 20, border: '1px solid #E3E2DE', background: '#fff', color: '#6B6B6B', fontSize: 14, cursor: 'pointer' }}>取消</button>
              <button onClick={handleReset} disabled={resetPw.length < 8} style={{ padding: '8px 20px', borderRadius: 20, border: 'none', background: resetPw.length >= 8 ? '#2383E2' : '#E3E2DE', color: '#fff', fontSize: 14, fontWeight: 600, cursor: resetPw.length >= 8 ? 'pointer' : 'not-allowed' }}>確認重置</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
