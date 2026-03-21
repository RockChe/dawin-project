import { NextResponse } from 'next/server';
import { countUsers } from '@/lib/sheets-dal';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = { sheets: false, timestamp: new Date().toISOString() };
  try {
    const count = await countUsers();
    checks.sheets = true;
    checks.userCount = count;
  } catch (err) {
    checks.sheetsError = err.message;
  }
  return NextResponse.json({ status: checks.sheets ? 'ok' : 'degraded', sheets: checks.sheets, timestamp: checks.timestamp });
}
