import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB

function isPrivateUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    // Only allow https
    if (parsed.protocol !== 'https:') return true;
    const hostname = parsed.hostname;
    // Block private/internal hostnames
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
    // Block metadata endpoints
    if (hostname === '169.254.169.254') return true;
    // Block private IP ranges
    const parts = hostname.split('.').map(Number);
    if (parts.length === 4 && parts.every(p => !isNaN(p))) {
      if (parts[0] === 10) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 169 && parts[1] === 254) return true;
      if (parts[0] === 0) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
    }

    if (isPrivateUrl(url)) {
      return NextResponse.json({ error: '不允許存取內部網路位址' }, { status: 403 });
    }

    const res = await fetch(url, {
      headers: { 'Accept': 'text/csv,text/plain,*/*' },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_RESPONSE_SIZE) {
      return NextResponse.json({ error: '檔案過大，上限 10MB' }, { status: 413 });
    }

    const text = await res.text();
    if (text.length > MAX_RESPONSE_SIZE) {
      return NextResponse.json({ error: '檔案過大，上限 10MB' }, { status: 413 });
    }

    return NextResponse.json({ csv: text });
  } catch (err) {
    console.error('Fetch CSV error:', err);
    return NextResponse.json(
      { error: '取得 CSV 失敗' },
      { status: 500 }
    );
  }
}
