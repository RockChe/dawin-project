import { describe, it, expect } from 'vitest';
import { ROLES, CAPABILITIES, can } from '@/lib/permissions';

describe('permissions capability table', () => {
  it('恰好三個角色', () => {
    expect(ROLES).toEqual(['viewer', 'admin', 'super_admin']);
  });

  it('viewer 可讀、可改自己的東西', () => {
    expect(can('viewer', 'read')).toBe(true);
    expect(can('viewer', 'self')).toBe(true);
  });

  it('viewer 不能寫、不能管理、不能匯出', () => {
    expect(can('viewer', 'write')).toBe(false);
    expect(can('viewer', 'manage')).toBe(false);
    expect(can('viewer', 'export')).toBe(false); // Rock 裁定：擋掉匯出
  });

  it('admin 可寫可匯出，但不能管理', () => {
    expect(can('admin', 'write')).toBe(true);
    expect(can('admin', 'export')).toBe(true);
    expect(can('admin', 'manage')).toBe(false);
  });

  it('super_admin 全部可以', () => {
    for (const cap of Object.keys(CAPABILITIES)) {
      expect(can('super_admin', cap)).toBe(true);
    }
  });

  // fail-closed：這五個 case 是這張表存在的理由
  it('未知角色一律拒絕（不是黑名單）', () => {
    expect(can('auditor', 'write')).toBe(false);
    expect(can('guest', 'read')).toBe(false);
  });

  it('role 缺失一律拒絕', () => {
    expect(can(undefined, 'read')).toBe(false);
    expect(can(null, 'write')).toBe(false);
    expect(can('', 'read')).toBe(false);
  });

  it('未知 capability 一律拒絕', () => {
    expect(can('super_admin', 'nonexistent')).toBe(false);
  });
});
