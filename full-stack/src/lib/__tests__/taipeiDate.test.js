import { describe, it, expect } from 'vitest';
import { toBusinessDateString, BUSINESS_TIME_ZONE } from '@/lib/utils';

// `doneDate` used to be computed as `new Date().toISOString().split('T')[0]`,
// which is the UTC calendar day. The product's day boundary is Taipei
// (UTC+8), so anything completed between 00:00 and 07:59 local time was
// recorded as the PREVIOUS day — roughly a third of every day, off by one.
//
// Switching to the runtime's local day is NOT a fix: the browser uses the
// user's device zone and the Vercel server runtime is UTC, so the two would
// disagree and the server (source of truth) would still be wrong. The zone has
// to be pinned explicitly, which is what these tests lock in — note they pass
// regardless of the zone the test runner itself happens to be in.

describe('toBusinessDateString', () => {
  it('pins the business day to Taipei', () => {
    expect(BUSINESS_TIME_ZONE).toBe('Asia/Taipei');
  });

  it('rolls to the next day once Taipei passes midnight', () => {
    // 16:30Z == 00:30 next day in Taipei
    expect(toBusinessDateString(new Date('2026-08-14T16:30:00Z'))).toBe('2026-08-15');
  });

  it('stays on the same day just before Taipei midnight', () => {
    // 15:59:59Z == 23:59:59 same day in Taipei
    expect(toBusinessDateString(new Date('2026-08-14T15:59:59Z'))).toBe('2026-08-14');
  });

  it('handles the UTC midnight case (08:00 in Taipei)', () => {
    expect(toBusinessDateString(new Date('2026-08-14T00:00:00Z'))).toBe('2026-08-14');
  });

  it('zero-pads month and day', () => {
    expect(toBusinessDateString(new Date('2026-01-05T02:00:00Z'))).toBe('2026-01-05');
  });

  it('rolls the year over correctly', () => {
    // 2026-12-31T16:30Z == 2027-01-01 00:30 Taipei
    expect(toBusinessDateString(new Date('2026-12-31T16:30:00Z'))).toBe('2027-01-01');
  });

  it('defaults to now when called with no argument', () => {
    const out = toBusinessDateString();
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
