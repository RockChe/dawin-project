import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assertWriteAllowed } from '../_guard.js';

// _guard.js is the fail-closed gate every prod-writing script (seed/
// update-accounts/restore/cleanup-old-admin) must call before touching the
// DB. The confirm value binds BOTH the operation name AND the resolved
// DATABASE_URL host (`<operation>@<host>`), so a leftover env var can't
// silently authorize a different script or a different database.

const ORIGINAL_ENV = { ...process.env };

describe('assertWriteAllowed', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.DATABASE_URL;
    delete process.env.DB_WRITE_CONFIRM;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits 1 when DATABASE_URL is not set', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    assertWriteAllowed({ operation: 'seed' });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when DATABASE_URL cannot be parsed as a URL', () => {
    process.env.DATABASE_URL = 'not-a-valid-url';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    assertWriteAllowed({ operation: 'seed' });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when DB_WRITE_CONFIRM is missing', () => {
    process.env.DATABASE_URL = 'postgresql://user:pw@my-db-host.neon.tech/dbname?sslmode=require';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    assertWriteAllowed({ operation: 'seed' });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when DB_WRITE_CONFIRM targets a different host', () => {
    process.env.DATABASE_URL = 'postgresql://user:pw@my-db-host.neon.tech/dbname?sslmode=require';
    process.env.DB_WRITE_CONFIRM = 'seed@another-host.neon.tech';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    assertWriteAllowed({ operation: 'seed' });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when DB_WRITE_CONFIRM is valid for a different operation on the same host (no cross-op leak)', () => {
    process.env.DATABASE_URL = 'postgresql://user:pw@my-db-host.neon.tech/dbname?sslmode=require';
    process.env.DB_WRITE_CONFIRM = 'restore@my-db-host.neon.tech';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    assertWriteAllowed({ operation: 'seed' });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('never prints the full DATABASE_URL (credentials) in error output, only the hostname', () => {
    process.env.DATABASE_URL = 'postgresql://secretuser:secretpass@my-db-host.neon.tech/dbname?sslmode=require';
    vi.spyOn(process, 'exit').mockImplementation(() => {});
    assertWriteAllowed({ operation: 'seed' });
    const allOutput = console.error.mock.calls.flat().join('\n');
    expect(allOutput).not.toContain('secretuser');
    expect(allOutput).not.toContain('secretpass');
    expect(allOutput).toContain('my-db-host.neon.tech');
  });

  it('passes through (no exit) when DB_WRITE_CONFIRM exactly matches operation@host', () => {
    process.env.DATABASE_URL = 'postgresql://user:pw@my-db-host.neon.tech/dbname?sslmode=require';
    process.env.DB_WRITE_CONFIRM = 'seed@my-db-host.neon.tech';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    expect(() => assertWriteAllowed({ operation: 'seed' })).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('correctly resolves the hostname when DATABASE_URL has query params (?sslmode=require)', () => {
    process.env.DATABASE_URL = 'postgresql://user:pw@ep-cool-name-123456.us-east-2.aws.neon.tech/dbname?sslmode=require';
    process.env.DB_WRITE_CONFIRM = 'restore@ep-cool-name-123456.us-east-2.aws.neon.tech';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    assertWriteAllowed({ operation: 'restore' });
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
