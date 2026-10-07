import { redirect } from 'next/navigation';
import { getInitialData } from '@/server/actions/dashboard';
import { toBusinessDateString } from '@/lib/utils';
import LiveSettings from '@/components/v2/LiveSettings';
import LiveShell from '@/components/v2/LiveShell';

export const dynamic = 'force-dynamic';

export default async function V2Page() {
  const data = await getInitialData();
  if (data?.error) redirect('/v2/login');
  // today：營業日（Asia/Taipei）快照，server 取一次、以可序列化字串往下傳，內容區共用。
  const today = toBusinessDateString();

  return (
    <LiveSettings initial={data.settings}>
      <LiveShell data={data} today={today} />
    </LiveSettings>
  );
}
