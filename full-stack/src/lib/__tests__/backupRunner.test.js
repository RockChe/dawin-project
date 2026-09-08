import { describe, it, expect } from 'vitest';
import { shouldRunScheduledBackup } from '@/lib/backupRunner';

const HOUR = 3600_000;

describe('shouldRunScheduledBackup（只給 cron 用的跳過判斷）', () => {
  const now = new Date('2026-09-08T12:00:00Z');

  it('未啟用自動備份 → 不跑', () => {
    const r = shouldRunScheduledBackup({ settings: { backup_enabled: false }, lastSuccessAt: null, now });
    expect(r.run).toBe(false);
    expect(r.reason).toContain('未啟用');
  });

  it('沒有備份目標 → 不跑', () => {
    const r = shouldRunScheduledBackup({
      settings: { backup_enabled: true, backup_targets: [] }, lastSuccessAt: null, now });
    expect(r.run).toBe(false);
    expect(r.reason).toContain('未設定備份目標');
  });

  it('距上次成功不到設定的時數 → 不跑', () => {
    const r = shouldRunScheduledBackup({
      settings: { backup_enabled: true, backup_targets: ['r2'], backup_frequency: 8 },
      lastSuccessAt: new Date(now.getTime() - 3 * HOUR), now });
    expect(r.run).toBe(false);
    expect(r.reason).toContain('小時');
  });

  it('距上次成功已超過時數 → 跑', () => {
    const r = shouldRunScheduledBackup({
      settings: { backup_enabled: true, backup_targets: ['r2'], backup_frequency: 8 },
      lastSuccessAt: new Date(now.getTime() - 9 * HOUR), now });
    expect(r.run).toBe(true);
  });

  it('從未成功過 → 跑', () => {
    const r = shouldRunScheduledBackup({
      settings: { backup_enabled: true, backup_targets: ['r2'], backup_frequency: 8 },
      lastSuccessAt: null, now });
    expect(r.run).toBe(true);
  });

  it('沒設 frequency 時預設 8 小時', () => {
    const r = shouldRunScheduledBackup({
      settings: { backup_enabled: true, backup_targets: ['r2'] },
      lastSuccessAt: new Date(now.getTime() - 7 * HOUR), now });
    expect(r.run).toBe(false);
  });
});
