import { describe, it, expect } from 'vitest';
import { STATUSES, STATUS_FILTERS } from '@/lib/constants';

describe('constants', () => {
  describe('STATUSES', () => {
    it('has exactly 6 statuses', () => {
      expect(STATUSES.length).toBe(6);
    });

    it('includes 暫緩', () => {
      expect(STATUSES).toContain('暫緩');
    });

    it('places 暫緩 between 待辦 and 提案中', () => {
      const idxPending = STATUSES.indexOf('待辦');
      const idxOnHold  = STATUSES.indexOf('暫緩');
      const idxProp    = STATUSES.indexOf('提案中');
      expect(idxPending).toBeGreaterThanOrEqual(0);
      expect(idxOnHold).toBe(idxPending + 1);
      expect(idxProp).toBe(idxOnHold + 1);
    });

    it('has exact array order', () => {
      expect(STATUSES).toEqual(['已完成', '進行中', '待辦', '暫緩', '提案中', '待確認']);
    });
  });

  describe('STATUS_FILTERS', () => {
    it('starts with 全部', () => {
      expect(STATUS_FILTERS[0]).toBe('全部');
    });

    it('includes 暫緩', () => {
      expect(STATUS_FILTERS).toContain('暫緩');
    });

    it('has exact array order', () => {
      expect(STATUS_FILTERS).toEqual(['全部', '進行中', '待辦', '已完成', '暫緩', '提案中', '待確認']);
    });

    it('contains every STATUSES value (membership invariant)', () => {
      expect(STATUS_FILTERS).toEqual(expect.arrayContaining(STATUSES));
    });
  });
});
