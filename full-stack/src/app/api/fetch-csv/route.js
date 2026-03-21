import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT = 15000; // 15 seconds

function isAllowedUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    // Block private/internal IPs
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.') ||
      hostname === '[::1]' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
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

    if (!isAllowedUrl(url)) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'text/csv,text/plain,*/*' },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to fetch: ${res.status} ${res.statusText}` },
          { status: 502 }
        );
      }

      // Check content-length if available
      const contentLength = res.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
        return NextResponse.json(
          { error: `Response too large (max ${MAX_RESPONSE_SIZE / 1024 / 1024}MB)` },
          { status: 413 }
        );
      }

      const text = await res.text();

      // Check actual size
      if (text.length > MAX_RESPONSE_SIZE) {
        return NextResponse.json(
          { error: `Response too large (max ${MAX_RESPONSE_SIZE / 1024 / 1024}MB)` },
          { status: 413 }
        );
      }

      return NextResponse.json({ csv: text });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
    }
    console.error('Fetch CSV error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch CSV' },
      { status: 500 }
    );
  }
}
