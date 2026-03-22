'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getBackupSettings,
  saveBackupSettings,
  getBackupHistory,
  triggerBackup,
  testR2ConnectionAction,
  testGDriveConnectionAction,
  getAuditLogs,
} from '@/server/actions/backup';

const FREQUENCY_OPTIONS = [
  { label: '每天 1 次', value: 24 },
  { label: '每天 2 次', value: 12 },
  { label: '每天 3 次', value: 8 },
  { label: '每天 4 次', value: 6 },
  { label: '每天 6 次', value: 4 },
];

export default function BackupPage() {
  // ── State ──
  const [r2, setR2] = useState({ accountId: '', accessKey: '', secretKey: '', bucket: '' });
  const [gdrive, setGDrive] = useState({ email: '', privateKey: '', folderId: '' });
  const [schedule, setSchedule] = useState({
    enabled: false,
    frequency: 8,
    targets: [],
    keepCount: 30,
  });
  const [history, setHistory] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('backup'); // 'backup' | 'audit'
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [testing, setTesting] = useState(null); // 'r2' | 'gdrive' | null
  const [saving, setSaving] = useState(null);   // 'r2' | 'gdrive' | 'schedule' | null
  const [backing, setBacking] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Load ──
  const loadData = useCallback(async () => {
    try {
      const [settingsRes, historyRes, auditRes] = await Promise.all([
        getBackupSettings(),
        getBackupHistory(30),
        getAuditLogs(50),
      ]);

      if (settingsRes.error) { setError(settingsRes.error); return; }
      if (historyRes.error) { setError(historyRes.error); return; }

      const s = settingsRes.data || {};
      setR2({
        accountId: s.backup_r2_account_id || '',
        accessKey: s.backup_r2_access_key || '',
        secretKey: s.backup_r2_secret_key || '',
        bucket: s.backup_r2_bucket || '',
      });
      setGDrive({
        email: s.backup_gdrive_email || '',
        privateKey: s.backup_gdrive_key || '',
        folderId: s.backup_gdrive_folder || '',
      });
      setSchedule({
        enabled: s.backup_enabled || false,
        frequency: s.backup_frequency || 8,
        targets: s.backup_targets || [],
        keepCount: s.backup_keep_count || 30,
      });
      setHistory(historyRes.data || []);
      setAuditLogs(auditRes?.data || []);
    } catch {
      setError('載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!success) return;
    const tid = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(tid);
  }, [success]);

  // ── Handlers ──
  const showMsg = (msg, isError = false) => {
    if (isError) { setError(msg); setSuccess(null); }
    else { setSuccess(msg); setError(null); }
  };

  const handleSaveR2 = async () => {
    setSaving('r2');
    const result = await saveBackupSettings({
      backup_r2_account_id: r2.accountId,
      backup_r2_access_key: r2.accessKey,
      backup_r2_secret_key: r2.secretKey,
      backup_r2_bucket: r2.bucket,
    });
    setSaving(null);
    if (result.error) showMsg(result.error, true);
    else showMsg('R2 設定已儲存');
  };

  const handleSaveGDrive = async () => {
    setSaving('gdrive');
    const result = await saveBackupSettings({
      backup_gdrive_email: gdrive.email,
      backup_gdrive_key: gdrive.privateKey,
      backup_gdrive_folder: gdrive.folderId,
    });
    setSaving(null);
    if (result.error) showMsg(result.error, true);
    else showMsg('Google Drive 設定已儲存');
  };

  const handleSaveSchedule = async () => {
    setSaving('schedule');
    const result = await saveBackupSettings({
      backup_enabled: schedule.enabled,
      backup_frequency: schedule.frequency,
      backup_targets: schedule.targets,
      backup_keep_count: schedule.keepCount,
    });
    setSaving(null);
    if (result.error) showMsg(result.error, true);
    else showMsg('排程設定已儲存');
  };

  const handleTestR2 = async () => {
    setTesting('r2');
    const result = await testR2ConnectionAction({
      accountId: r2.accountId,
      accessKey: r2.accessKey,
      secretKey: r2.secretKey,
      bucket: r2.bucket,
    });
    setTesting(null);
    if (result.error) showMsg(`R2 連線失敗：${result.error}`, true);
    else showMsg('R2 連線成功');
  };

  const handleTestGDrive = async () => {
    setTesting('gdrive');
    const result = await testGDriveConnectionAction({
      email: gdrive.email,
      privateKey: gdrive.privateKey,
      folderId: gdrive.folderId,
    });
    setTesting(null);
    if (result.error) showMsg(`Google Drive 連線失敗：${result.error}`, true);
    else showMsg('Google Drive 連線成功');
  };

  const handleBackupNow = async () => {
    setBacking(true);
    setError(null);
    const result = await triggerBackup();
    setBacking(false);
    if (result.error) {
      showMsg(result.error, true);
    } else {
      const successes = result.results?.filter(r => r.success).length || 0;
      const failures = result.results?.filter(r => !r.success).length || 0;
      if (failures > 0) {
        const errMsgs = result.results.filter(r => !r.success).map(r => `${r.target}: ${r.error}`).join('; ');
        showMsg(`備份完成（成功 ${successes}，失敗 ${failures}）：${errMsgs}`, true);
      } else {
        showMsg(`備份完成，共 ${successes} 個目標`);
      }
      loadData(); // Refresh history
    }
  };

  const toggleTarget = (target) => {
    setSchedule(prev => ({
      ...prev,
      targets: prev.targets.includes(target)
        ? prev.targets.filter(t => t !== target)
        : [...prev.targets, target],
    }));
  };

  // ── Styles ──
  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #E3E2DE',
    fontSize: 14,
    outline: 'none',
    color: '#37352F',
    fontFamily: "'JetBrains Mono', monospace",
  };

  const labelStyle = { fontSize: 12, color: '#6B6B6B', display: 'block', marginBottom: 4 };

  const sectionStyle = {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    border: '1px solid #E3E2DE',
    marginBottom: 24,
  };

  const sectionTitle = { fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#37352F' };

  const btnPrimary = {
    padding: '8px 20px', borderRadius: 20, border: 'none',
    background: '#2383E2', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  };

  const btnSecondary = {
    padding: '8px 20px', borderRadius: 20,
    border: '1px solid #E3E2DE', background: '#fff', color: '#6B6B6B',
    fontSize: 14, cursor: 'pointer',
  };

  const btnDanger = {
    ...btnPrimary,
    background: '#4DAB9A',
  };

  if (loading) {
    return (
      <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ color: '#9B9A97', fontSize: 14 }}>載入中...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#37352F', marginBottom: 16 }}>系統管理</h1>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid #E3E2DE' }}>
        {[{ key: 'backup', label: '資料備份' }, { key: 'audit', label: '操作記錄' }].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 24px', fontSize: 14, fontWeight: activeTab === tab.key ? 600 : 400,
              border: 'none', borderBottom: activeTab === tab.key ? '2px solid #2383E2' : '2px solid transparent',
              background: 'none', color: activeTab === tab.key ? '#2383E2' : '#6B6B6B',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div style={{ padding: 12, borderRadius: 8, background: '#EB575715', color: '#EB5757', fontSize: 14, marginBottom: 16 }}>{error}</div>}
      {success && <div style={{ padding: 12, borderRadius: 8, background: '#4DAB9A15', color: '#4DAB9A', fontSize: 14, marginBottom: 16 }}>{success}</div>}

      {activeTab === 'backup' && <>
      {/* ── R2 Settings ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Cloudflare R2 備份設定</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Account ID</label>
            <input value={r2.accountId} onChange={e => setR2({ ...r2, accountId: e.target.value })} style={inputStyle} placeholder="R2 帳戶 ID" />
          </div>
          <div>
            <label style={labelStyle}>Bucket Name</label>
            <input value={r2.bucket} onChange={e => setR2({ ...r2, bucket: e.target.value })} style={inputStyle} placeholder="Bucket 名稱" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Access Key ID</label>
            <input value={r2.accessKey} onChange={e => setR2({ ...r2, accessKey: e.target.value })} style={inputStyle} placeholder="Access Key" />
          </div>
          <div>
            <label style={labelStyle}>Secret Access Key</label>
            <input type="password" value={r2.secretKey} onChange={e => setR2({ ...r2, secretKey: e.target.value })} style={inputStyle} placeholder="Secret Key" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleTestR2} disabled={testing === 'r2'} style={btnSecondary}>
            {testing === 'r2' ? '測試中...' : '測試連線'}
          </button>
          <button onClick={handleSaveR2} disabled={saving === 'r2'} style={btnPrimary}>
            {saving === 'r2' ? '儲存中...' : '儲存'}
          </button>
        </div>
      </div>

      {/* ── Google Drive Settings ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Google Drive 備份設定</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Service Account Email</label>
          <input value={gdrive.email} onChange={e => setGDrive({ ...gdrive, email: e.target.value })} style={inputStyle} placeholder="backup@project.iam.gserviceaccount.com" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Private Key</label>
          <textarea
            value={gdrive.privateKey}
            onChange={e => setGDrive({ ...gdrive, privateKey: e.target.value })}
            style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
            placeholder="-----BEGIN PRIVATE KEY-----&#10;..."
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>資料夾 ID</label>
          <input value={gdrive.folderId} onChange={e => setGDrive({ ...gdrive, folderId: e.target.value })} style={inputStyle} placeholder="Google Drive 資料夾 ID" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleTestGDrive} disabled={testing === 'gdrive'} style={btnSecondary}>
            {testing === 'gdrive' ? '測試中...' : '測試連線'}
          </button>
          <button onClick={handleSaveGDrive} disabled={saving === 'gdrive'} style={btnPrimary}>
            {saving === 'gdrive' ? '儲存中...' : '儲存'}
          </button>
        </div>
      </div>

      {/* ── Schedule Settings ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>自動備份排程</h3>

        {/* Enable toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <label style={{ fontSize: 14, color: '#37352F' }}>啟用自動備份</label>
          <button
            onClick={() => setSchedule({ ...schedule, enabled: !schedule.enabled })}
            style={{
              width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
              background: schedule.enabled ? '#4DAB9A' : '#E3E2DE',
              position: 'relative', transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: schedule.enabled ? 25 : 3,
              width: 20, height: 20, borderRadius: 10, background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
        </div>

        {/* Frequency */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>備份頻率</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FREQUENCY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSchedule({ ...schedule, frequency: opt.value })}
                style={{
                  padding: '6px 16px', borderRadius: 16, fontSize: 13, cursor: 'pointer',
                  border: schedule.frequency === opt.value ? '2px solid #2383E2' : '1px solid #E3E2DE',
                  background: schedule.frequency === opt.value ? '#2383E210' : '#fff',
                  color: schedule.frequency === opt.value ? '#2383E2' : '#6B6B6B',
                  fontWeight: schedule.frequency === opt.value ? 600 : 400,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Targets */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>備份目標</label>
          <div style={{ display: 'flex', gap: 12 }}>
            {['r2', 'gdrive'].map(target => (
              <label key={target} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, color: '#37352F' }}>
                <input
                  type="checkbox"
                  checked={schedule.targets.includes(target)}
                  onChange={() => toggleTarget(target)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                {target === 'r2' ? 'Cloudflare R2' : 'Google Drive'}
              </label>
            ))}
          </div>
        </div>

        {/* Keep count */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>每個目標保留份數</label>
          <input
            type="number"
            min={1}
            max={100}
            value={schedule.keepCount}
            onChange={e => setSchedule({ ...schedule, keepCount: Number(e.target.value) || 30 })}
            style={{ ...inputStyle, width: 120 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSaveSchedule} disabled={saving === 'schedule'} style={btnPrimary}>
            {saving === 'schedule' ? '儲存中...' : '儲存排程'}
          </button>
          <button
            onClick={handleBackupNow}
            disabled={backing || schedule.targets.length === 0}
            style={{
              ...btnDanger,
              opacity: (backing || schedule.targets.length === 0) ? 0.5 : 1,
              cursor: (backing || schedule.targets.length === 0) ? 'not-allowed' : 'pointer',
            }}
          >
            {backing ? '備份中...' : '立即備份'}
          </button>
        </div>
      </div>

      {/* ── Backup History ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>備份記錄</h3>
        {history.length === 0 ? (
          <div style={{ color: '#9B9A97', fontSize: 14, padding: '20px 0', textAlign: 'center' }}>尚無備份記錄</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E3E2DE', background: '#F5F3EF' }}>
                  <th style={thStyle}>時間</th>
                  <th style={thStyle}>目標</th>
                  <th style={thStyle}>檔案名稱</th>
                  <th style={thStyle}>大小</th>
                  <th style={thStyle}>耗時</th>
                  <th style={thStyle}>狀態</th>
                </tr>
              </thead>
              <tbody>
                {history.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #E3E2DE' }}>
                    <td style={tdStyle}>{formatTime(row.createdAt)}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                        background: row.target === 'r2' ? '#CB912F15' : '#2383E215',
                        color: row.target === 'r2' ? '#CB912F' : '#2383E2',
                      }}>
                        {row.target === 'r2' ? 'R2' : 'GDrive'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{row.fileName}</td>
                    <td style={tdStyle}>{formatSize(row.fileSize)}</td>
                    <td style={tdStyle}>{row.durationMs ? `${(row.durationMs / 1000).toFixed(1)}s` : '-'}</td>
                    <td style={tdStyle}>
                      {row.status === 'success' ? (
                        <span style={{ color: '#4DAB9A', fontWeight: 600 }}>成功</span>
                      ) : (
                        <div>
                          <span style={{ color: '#EB5757', fontWeight: 600 }}>失敗</span>
                          {row.error && (
                            <div style={{ fontSize: 12, color: '#EB5757', marginTop: 4 }}>{row.error}</div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>}

      {activeTab === 'audit' && (
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>操作記錄</h3>
          {auditLogs.length === 0 ? (
            <div style={{ color: '#9B9A97', fontSize: 14, padding: '20px 0', textAlign: 'center' }}>尚無操作記錄</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E3E2DE', background: '#F5F3EF' }}>
                    <th style={thStyle}>時間</th>
                    <th style={thStyle}>操作者</th>
                    <th style={thStyle}>動作</th>
                    <th style={thStyle}>對象</th>
                    <th style={thStyle}>備註</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #E3E2DE' }}>
                      <td style={tdStyle}>{formatTime(row.createdAt)}</td>
                      <td style={tdStyle}>{row.userName || row.userEmail || '-'}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                          background: actionColor(row.action).bg,
                          color: actionColor(row.action).text,
                        }}>
                          {actionLabel(row.action)}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                        {row.resourceType ? `${row.resourceType}` : '-'}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, color: '#6B6B6B', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.detail || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

const ACTION_MAP = {
  PASSWORD_RESET: { label: '密碼重置', bg: '#CB912F15', text: '#CB912F' },
  USER_DELETE: { label: '刪除使用者', bg: '#EB575715', text: '#EB5757' },
  PROJECT_DELETE: { label: '刪除專案', bg: '#EB575715', text: '#EB5757' },
  BACKUP_TRIGGER: { label: '手動備份', bg: '#4DAB9A15', text: '#4DAB9A' },
};

function actionLabel(action) {
  return ACTION_MAP[action]?.label || action;
}

function actionColor(action) {
  return ACTION_MAP[action] || { bg: '#E3E2DE50', text: '#6B6B6B' };
}

const thStyle = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6B6B6B', fontSize: 13 };
const tdStyle = { padding: '10px 12px', color: '#37352F' };

function formatTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
