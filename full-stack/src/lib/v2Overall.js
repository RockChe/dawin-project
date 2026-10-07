// /v2 頁首 Overall：全部任務進度的平均。today 由呼叫端傳入（"YYYY-MM-DD"，營業日快照），
// 不讀系統時間，SSR／client 才會一致、測試才能固定。規則同 computeAllProgress：
// 已完成 100；有子任務看完成率；否則看 start～end 的時間進度。
const day = (s) => {
  const [y, m, d] = String(s).replace(/-/g, '/').split(' ')[0].split('/').map(Number);
  return Date.UTC(y, m - 1, d) / 864e5;
};

export function timeProgress(startDate, endDate, today) {
  if (!startDate || !endDate) return 0;
  const s = day(startDate), e = day(endDate), t = day(today);
  if (t < s) return 0;
  if (t >= e) return 100;
  return Math.round(((t - s) / (e - s)) * 100);
}

export function overallProgress(tasks, subtasks, today) {
  if (!tasks.length) return 0;
  const subs = new Map();
  for (const s of subtasks) {
    const a = subs.get(s.taskId) || { n: 0, done: 0 };
    a.n++; if (s.done) a.done++;
    subs.set(s.taskId, a);
  }
  const sum = tasks.reduce((acc, t) => {
    if (t.status === '已完成') return acc + 100;
    const a = subs.get(t.id);
    return acc + (a ? Math.round((a.done / a.n) * 100) : timeProgress(t.startDate, t.endDate, today));
  }, 0);
  return Math.round(sum / tasks.length);
}
