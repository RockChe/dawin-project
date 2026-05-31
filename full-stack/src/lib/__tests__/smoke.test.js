import { describe, it, expect } from 'vitest';
import { F } from '@/lib/theme';

// Proves the test toolchain end-to-end: runner executes, jsdom is present,
// and the `@/` alias resolves app modules.
describe('test infra smoke', () => {
  it('runs assertions', () => {
    expect(1 + 1).toBe(2);
  });

  it('provides a jsdom document', () => {
    expect(document.createElement('div').tagName).toBe('DIV');
  });

  it('resolves the @/ alias to src', () => {
    expect(typeof F).toBe('string');
  });
});
