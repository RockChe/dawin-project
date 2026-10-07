import { notFound } from 'next/navigation';
import PreviewClient from '@/components/v2/PreviewClient';

export const dynamic = 'force-dynamic';

const SCREENS = ['shell', 'login', 'overview', 'mytasks', 'projects', 'timeline', 'project', 'taskmodal', 'data', 'settings', 'states'];

// 開發預覽：在載入任何東西之前先擋 production（有／無 session 皆 404）。
// 放在 (v2-public)：截圖用的 headless 瀏覽器沒有 session，且這裡只有假資料。
export default async function PreviewPage({ params, searchParams }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { screen } = await params;
  if (!SCREENS.includes(screen)) notFound();
  const sp = (await searchParams) || {};
  return (
    <PreviewClient
      screen={screen}
      theme={sp.theme === 'dark' || sp.theme === 'light' ? sp.theme : undefined}
      clouds={sp.clouds === 'off' || sp.clouds === 'lite' ? sp.clouds : 'full'}
      view={sp.view === 'list' ? 'list' : 'card'}
      arch={sp.arch === '1'}
      pj={{ id: /^p\d+$/.test(sp.pid || '') ? sp.pid : 'p1', empty: sp.empty === '1', expanded: String(sp.exp || '').split(',').filter((x) => /^t\d+$/.test(x)), alldone: /^t\d+$/.test(sp.alldone || '') ? sp.alldone : undefined }}
      q={String(sp.q || '').slice(0, 60)}
      tm={{ mode: sp.mode === 'new' ? 'new' : 'edit', tid: /^t\d+$/.test(sp.tid || '') ? sp.tid : undefined, pid: /^p\d+$/.test(sp.pid || '') ? sp.pid : undefined, role: sp.role === 'viewer' ? 'viewer' : undefined }}
      st={{ csel: ['white', 'pink', 'purple', 'dark', 'nimbus'].includes(sp.csel) ? sp.csel : undefined, sub: sp.set === 'cloud' ? 'cloud' : undefined, motion: sp.motion === 'off' ? 'off' : undefined, role: sp.role === 'viewer' ? 'viewer' : undefined }}
      tl={{ view: sp.tlview === 'card' ? 'card' : 'gantt', expanded: sp.tlexp === '1', fo: sp.tlfo === '1', sel: /^p\d+$/.test(sp.tlsel || '') ? sp.tlsel : undefined, scale: ['日', '週', '月', '季'].includes(sp.tlscale) ? sp.tlscale : undefined }}
    />
  );
}
