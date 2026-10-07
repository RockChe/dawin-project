// /v2 開發預覽用假資料（自 docs/design/ux2/desktop.html 範例資料）。純資料、零副作用：
// 不 import 任何 server／DB 程式碼，不讀系統時間，today 固定 2026-10-07。
export const FIXTURE_TODAY = '2026-10-07';
export const FIXTURE_USER = { name: 'Rock', email: 'rock@dawin.example', role: 'admin' };

export const FIXTURE_PROJECTS = ['TTXC 虎姑婆 駁二', '科教館公益展廳', '虎姑婆和他的朋友', '發行事務', '兒少內容有限合夥', '非非和他的小本子', '27年衛武營', 'Design Ah 展覽', '大雲Youtube Channel', '臨時動議', '2027新年禮盒']
  .map((name, i) => ({ id: 'p' + (i + 1), name, sortOrder: i, createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`, archivedAt: i === 9 ? '2026-09-30' : null }));

// 建立者（設計稿各任務的 by，Data 的 Creator 欄用）
const BY = { t1: 'Rock', t3: 'Oliver', t4: 'Rae', t6: 'Rock', t7: 'Rock', t9: 'Rock', t10: 'Oliver', t12: 'Rock', t13: 'Rae', t14: 'Oliver', t15: '幸真', t17: '幸真', t18: 'Rock', t19: 'Felien 車', t34: 'Rock', t21: 'Rae', t22: 'Oliver', t23: 'Oliver', t24: 'Felien 車', t25: 'Felien 車', t27: 'Rock', t28: 'Oliver', t29: 'Rae', t30: 'Oliver', t31: '幸真', t32: '幸真', t33: 'Rae' };

// T(id, 專案, 名稱, 狀態, 優先度, 分類, 起, 迄, { w:關注人, x:手動執行人, note, subs:['名稱|負責人|1完成|備註'] })
const T = (id, p, task, status, priority, category, startDate, endDate, o = {}) => {
  const watchers = o.w || [];
  const subs = (o.subs || []).map((z, i) => {
    const [name, owner, d, notes] = z.split('|');
    return { id: `${id}s${i}`, taskId: id, name, owner, done: d === '1', notes: notes || '', sortOrder: i };
  });
  const execs = subs.length ? [...new Set(subs.map((s) => s.owner).filter(Boolean))] : (o.x ? o.x.split(',') : []);
  return {
    task: { id, projectId: p, task, status, priority, category, startDate, endDate, owner: [...new Set([...execs, ...watchers])].join(','), watchers: watchers.join(','), notes: o.note || '', creatorName: BY[id] || 'Karen', source: 'manual' },
    subs,
  };
};

const ROWS = [
  T('t1', 'p1', '票務展務相關', '進行中', '高', '活動', '2026/08/20', '2026/09/25', { w: ['幸真'], note: '售票上線前須完成人力與 FAQ', subs: ['售票系統串接|Rock|1|KKTIX 已串好', '展期場次排程|Rock|1', '駁二場租合約簽署|Karen|1|已回簽', '現場人力排班|Oliver|0|待工讀生名單', 'FAQ 準備|Rock|0'] }),
  T('t2', 'p1', '商品合作', '進行中', '高', '商務合作', '2026/08/15', '2026/10/09', { w: ['Felien 車'], subs: ['授權合約確認|Karen|1', '周邊品項清單|Rock|1', '打樣驗收|Rock|0|等第二輪樣品', '包裝設計稿|Rae|0'] }),
  T('t3', 'p1', '駁二場地動線規劃', '待辦', '中', '活動', '2026/09/10', '2026/10/31', { x: 'Oliver' }),
  T('t4', 'p1', '展覽文宣與視覺設計', '進行中', '中', '行銷', '2026/09/01', '2026/10/18', { subs: ['主視覺定稿|Rae|1', '展板文案|Karen|1', '印刷發包|Rae|0|比價中'] }),
  T('t5', 'p1', '開幕記者會', '待確認', '高', '活動', '2026/10/20', '2026/11/20', { w: ['Rock'], subs: ['場地租借|Oliver|0', '媒體邀請名單|Karen|0'] }),
  T('t6', 'p1', '虎姑婆周邊打樣確認', '已完成', '中', '商務合作', '2026/09/20', '2026/10/02', { subs: ['打樣驗收|Rock|1'] }),
  T('t7', 'p1', '新聞稿發送', '已完成', '低', '行銷', '2026/09/28', '2026/10/03', { x: 'Rock' }),
  T('t8', 'p1', '兒童工作坊加場', '暫緩', '低', '活動', '2026/11/01', '2026/11/30', { x: 'Karen' }),
  T('t9', 'p2', '文化部結案報告', '待辦', '高', '活動', '2026/08/01', '2026/10/05', { subs: ['結案文件彙整|Rock|0', '成果影片剪輯|Rae|1', '核銷單據整理|幸真|0'] }),
  T('t10', 'p2', '展廳佈展', '已完成', '中', '活動', '2026/06/15', '2026/08/30', { x: 'Oliver' }),
  T('t11', 'p2', '公益導覽員培訓', '進行中', '中', '活動', '2026/09/15', '2026/11/30', { subs: ['培訓教材編寫|Karen|1', '招募報名|Oliver|0', '實地演練|Karen|0'] }),
  T('t12', 'p3', "Yaya's Band 芽芽樂團", '進行中', '高', '商務合作', '2026/09/20', '2026/10/14', { subs: ['樂團簡介撰寫|Rock|1', '演出合約|Karen|0|法務看過一版', '音檔授權|Rock|0'] }),
  T('t13', 'p3', '角色插畫第二批', '進行中', '中', '發行', '2026/09/01', '2026/11/15', { x: 'Rae' }),
  T('t14', 'p3', '繪本印前檢查', '待辦', '中', '發行', '2026/11/01', '2026/11/20', { x: 'Oliver' }),
  T('t15', 'p4', '整理發行資料-片單', '待確認', '高', '發行', '2026/09/01', '2026/09/30', { w: ['Rock'], subs: ['片單彙整|Felien 車|1', '版權確認|幸真|0|等對方回信'] }),
  T('t16', 'p4', '連連玩境影視展', '待辦', '中', '市場展', '2026/10/01', '2026/10/13', { w: ['Rock'], subs: ['參展報名|Karen|1', '影片檔案轉檔|Oliver|0'] }),
  T('t17', 'p4', '通路合約續約', '進行中', '低', '發行', '2026/09/10', '2026/11/30', { x: '幸真' }),
  T('t18', 'p5', '合夥合約簽署', '已完成', '高', '商務合作', '2026/09/15', '2026/10/01', { x: 'Rock' }),
  T('t19', 'p5', '合夥人月會', '進行中', '中', '活動', '2026/10/01', '2026/10/31', { subs: ['月會議程|Felien 車|1', '會議記錄|Karen|1', '簡報整理|Oliver|1', '追蹤事項|Felien 車|0'] }),
  T('t34', 'p5', '9 月帳務結算', '已完成', '低', '發行', '2026/09/20', '2026/09/28', { x: 'Rock' }),
  T('t21', 'p6', '週邊貼紙打樣', '進行中', '中', '商務合作', '2026/09/25', '2026/10/20', { x: 'Rae' }),
  T('t22', 'p6', '小本子印刷報價', '提案中', '低', '商務合作', '2026/10/10', '2026/10/30', { x: 'Oliver' }),
  T('t23', 'p7', '衛武營場地勘查', '待確認', '中', '活動', '2026/10/10', '2026/10/31', { subs: ['場勘行程安排|Rock|0', '動線草圖|Oliver|0'] }),
  T('t24', 'p7', '節目企劃書', '提案中', '高', '活動', '2026/11/01', '2026/12/15', { x: 'Felien 車' }),
  T('t25', 'p8', '展覽提案簡報', '提案中', '高', '活動', '2026/10/05', '2026/11/15', { w: ['Rock'], subs: ['提案簡報撰寫|Felien 車|0', '預算表|Karen|0'] }),
  T('t26', 'p8', '授權洽談', '待辦', '中', '商務合作', '2026/10/20', '2026/12/10', { x: 'Karen' }),
  T('t27', 'p9', 'Q4 內容企劃', '進行中', '中', '行銷', '2026/10/01', '2026/12/31', { subs: ['主題清單|Rock|1', '腳本大綱|Rock|0', '拍攝排程|Oliver|0'] }),
  T('t28', 'p9', '剪輯排程', '進行中', '低', '行銷', '2026/09/20', '2026/11/10', { x: 'Oliver' }),
  T('t29', 'p9', '縮圖範本更新', '已完成', '低', '行銷', '2026/09/15', '2026/09/28', { x: 'Rae' }),
  T('t30', 'p10', '臨時採購雜項', '已完成', '低', '活動', '2026/07/01', '2026/07/10', { x: 'Oliver' }),
  T('t31', 'p10', '場地臨時調整', '已完成', '低', '活動', '2026/07/05', '2026/07/20', { x: '幸真' }),
  T('t32', 'p11', '包材報價', '暫緩', '中', '商務合作', '2026/11/01', '2026/12/20', { x: '幸真' }),
  T('t33', 'p11', '禮盒概念設計', '暫緩', '中', '行銷', '2026/11/15', '2027/01/31', { x: 'Rae' }),
];

export const FIXTURE_TASKS = ROWS.map((r) => r.task);
export const FIXTURE_SUBTASKS = ROWS.flatMap((r) => r.subs);

export const FIXTURE_OWNERS = ['Felien 車', 'Karen', 'Rae', 'Oliver', '幸真', 'Rock'];

export const fixtureShellProps = () => ({
  tasks: FIXTURE_TASKS,
  subtasks: FIXTURE_SUBTASKS,
  projects: FIXTURE_PROJECTS,
  userName: FIXTURE_USER.name,
  userNames: FIXTURE_OWNERS,
  today: FIXTURE_TODAY,
});
