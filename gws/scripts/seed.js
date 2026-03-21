import { google } from 'googleapis';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Sheet tab definitions with headers
const SHEET_DEFS = {
  users: ['id', 'email', 'passwordHash', 'role', 'name', 'mustChangePassword', 'createdAt', 'updatedAt'],
  sessions: ['id', 'userId', 'token', 'expiresAt', 'createdAt'],
  projects: ['id', 'name', 'sortOrder', 'createdBy', 'createdAt', 'updatedAt'],
  tasks: ['id', 'projectId', 'task', 'status', 'category', 'startDate', 'endDate', 'duration', 'owner', 'priority', 'notes', 'sortOrder', 'createdBy', 'createdAt', 'updatedAt'],
  subtasks: ['id', 'taskId', 'name', 'owner', 'done', 'doneDate', 'notes', 'sortOrder', 'createdAt'],
  links: ['id', 'taskId', 'url', 'title', 'createdBy', 'createdAt'],
  config: ['id', 'key', 'value', 'updatedAt'],
  files: ['id', 'taskId', 'name', 'size', 'mimeType', 'r2Key', 'createdBy', 'createdAt'],
};

const SEED_TASKS = [
  { id:"T01",project:"虎姑婆和他的朋友",task:"MOMO上架",status:"已完成",category:"商務合作",start:"2025-11-24",duration:158,end:"2026-04-30",notes:"",owner:"林佳穎",priority:"高",sort_order:1 },
  { id:"T02",project:"虎姑婆和他的朋友",task:"MOMO紙箱、DM",status:"待辦",category:"商務合作",start:"2026-04-30",duration:63,end:"2026-07-01",notes:"2026/4月開始",owner:"陳柏翰",priority:"中",sort_order:2 },
  { id:"T03",project:"虎姑婆和他的朋友",task:"MO select 濕紙巾、衛生紙",status:"已完成",category:"商務合作",start:"2025-11-10",duration:94,end:"2026-02-11",notes:"視覺設計4稿",owner:"林佳穎",priority:"高",sort_order:3 },
  { id:"T04",project:"虎姑婆和他的朋友",task:"高雄兒藝節",status:"進行中",category:"活動",start:"2026-04-03",duration:4,end:"2026-04-06",notes:"舞台活動、畫畫、市集",owner:"王思涵",priority:"高",sort_order:4 },
  { id:"T05",project:"虎姑婆和他的朋友",task:"虎姑婆舞台表演2場（3/4確認）",status:"進行中",category:"活動",start:"2026-04-06",duration:1,end:"2026-04-06",notes:"暫定4/5 or 4/6",owner:"王思涵",priority:"高",sort_order:5 },
  { id:"T06",project:"虎姑婆和他的朋友",task:"新北兒藝節",status:"提案中",category:"活動",start:"2026-07-01",duration:31,end:"2026-07-31",notes:"新北藝文中心展覽+見面會回饋",owner:"張育瑄",priority:"中",sort_order:6 },
  { id:"T07",project:"虎姑婆和他的朋友",task:"9月前要播出",status:"待辦",category:"播出/開始",start:"2026-09-01",duration:61,end:"2026-10-31",notes:"台語結案需要9月播出",owner:"李宗霖",priority:"高",sort_order:7 },
  { id:"T08",project:"虎姑婆和他的朋友",task:"TTXC 展覽",status:"待辦",category:"活動",start:"2026-09-26",duration:138,end:"2027-02-10",notes:"",owner:"張育瑄",priority:"中",sort_order:8 },
  { id:"T09",project:"眼鏡熊波波",task:"預計暑假播出",status:"待辦",category:"播出/開始",start:"2026-07-01",duration:62,end:"2026-08-31",notes:"",owner:"李宗霖",priority:"高",sort_order:9 },
  { id:"T10",project:"眼鏡熊波波",task:"2026聖誕節提案",status:"待辦",category:"行銷",start:"2026-04-01",duration:91,end:"2026-06-30",notes:"林口Outlet &青埔Outlet 提案",owner:"陳柏翰",priority:"中",sort_order:10 },
  { id:"T11",project:"眼鏡熊波波",task:"2027展覽規劃",status:"待辦",category:"活動",start:null,duration:null,end:null,notes:"2027暑假展覽提案",owner:"吳欣妤",priority:"低",sort_order:11 },
  { id:"T12",project:"Mogu & Perol",task:"3/12 記者會 – 項目啟動",status:"進行中",category:"行銷",start:"2026-03-12",duration:1,end:"2026-03-12",notes:"",owner:"林佳穎",priority:"高",sort_order:12 },
  { id:"T13",project:"今天誰代課",task:"MIFA 安錫動畫影展",status:"進行中",category:"發行",start:"2026-06-23",duration:4,end:"2026-06-26",notes:"",owner:"吳欣妤",priority:"高",sort_order:13 },
  { id:"T14",project:"登山總動員S2",task:"活動規劃",status:"待辦",category:"活動",start:"2026-04-06",duration:86,end:"2026-06-30",notes:"場地場勘、活動廠商討論",owner:"王思涵",priority:"中",sort_order:14 },
  { id:"T15",project:"登山總動員S2",task:"預計2026年底播出",status:"待辦",category:"活動",start:"2026-12-01",duration:151,end:"2027-04-30",notes:"2026/8月完成全部拍攝、10月底完成後製",owner:"李宗霖",priority:"中",sort_order:15 },
  { id:"T16",project:"科教館公益展廳",task:"進場",status:"待辦",category:"活動",start:"2027-01-03",duration:12,end:"2027-01-14",notes:"",owner:"陳柏翰",priority:"中",sort_order:16 },
  { id:"T17",project:"科教館公益展廳",task:"開展",status:"待辦",category:"活動",start:"2027-01-15",duration:352,end:"2028-01-01",notes:"",owner:"張育瑄",priority:"中",sort_order:17 },
  { id:"T18",project:"科教館公益展廳",task:"撤場",status:"待辦",category:"活動",start:"2028-01-02",duration:14,end:"2028-01-15",notes:"",owner:"陳柏翰",priority:"低",sort_order:18 },
  { id:"T19",project:"科教館公益展廳",task:"交還場地",status:"待辦",category:"活動",start:"2028-01-15",duration:1,end:"2028-01-15",notes:"",owner:"陳柏翰",priority:"低",sort_order:19 },
  { id:"T20",project:"2026市場展",task:"Kidscreen Summit 2026",status:"已完成",category:"市場展",start:"2026-02-14",duration:4,end:"2026-02-17",notes:"",owner:"吳欣妤",priority:"高",sort_order:20 },
  { id:"T21",project:"2026市場展",task:"MIPCOM 坎城影視節",status:"待辦",category:"市場展",start:"2026-10-10",duration:6,end:"2026-10-15",notes:"mipjunior 10/10, 11",owner:"林佳穎",priority:"中",sort_order:21 },
];

const SEED_SUBTASKS = [
  {taskKey:"T01",name:"合約簽訂",owner:"林佳穎",done:true,done_date:"2025-12-05",sort_order:1},
  {taskKey:"T01",name:"商品資料建檔",owner:"陳柏翰",done:true,done_date:"2025-12-20",sort_order:2},
  {taskKey:"T01",name:"上架頁面設計",owner:"林佳穎",done:true,done_date:"2026-01-15",sort_order:3},
  {taskKey:"T01",name:"正式上架",owner:"林佳穎",done:true,done_date:"2026-02-01",sort_order:4},
  {taskKey:"T02",name:"紙箱設計定稿",owner:"陳柏翰",done:true,done_date:"2026-03-15",sort_order:1},
  {taskKey:"T02",name:"DM 內容撰寫",owner:"林佳穎",done:false,done_date:null,sort_order:2},
  {taskKey:"T02",name:"印刷送廠",owner:"陳柏翰",done:false,done_date:null,sort_order:3},
  {taskKey:"T02",name:"寄送到通路",owner:"陳柏翰",done:false,done_date:null,sort_order:4},
  {taskKey:"T03",name:"合作洽談",owner:"林佳穎",done:true,done_date:"2025-11-15",sort_order:1},
  {taskKey:"T03",name:"視覺設計（4稿）",owner:"張育瑄",done:true,done_date:"2025-12-20",sort_order:2},
  {taskKey:"T03",name:"打樣確認",owner:"林佳穎",done:true,done_date:"2026-01-10",sort_order:3},
  {taskKey:"T03",name:"量產出貨",owner:"陳柏翰",done:true,done_date:"2026-02-01",sort_order:4},
  {taskKey:"T04",name:"場地確認與合約簽訂",owner:"王思涵",done:true,done_date:"2026-03-20",sort_order:1},
  {taskKey:"T04",name:"舞台企劃+佈置",owner:"張育瑄",done:true,done_date:"2026-03-28",sort_order:2},
  {taskKey:"T04",name:"市集招商+當日執行",owner:"王思涵",done:false,done_date:null,sort_order:3},
  {taskKey:"T05",name:"場地與檔期確認",owner:"王思涵",done:true,done_date:"2026-03-04",sort_order:1},
  {taskKey:"T05",name:"演出內容排練",owner:"王思涵",done:false,done_date:null,sort_order:2},
  {taskKey:"T05",name:"現場執行",owner:"王思涵",done:false,done_date:null,sort_order:3},
  {taskKey:"T06",name:"提案企劃書",owner:"張育瑄",done:true,done_date:"2026-03-10",sort_order:1},
  {taskKey:"T06",name:"場地勘查",owner:"張育瑄",done:false,done_date:null,sort_order:2},
  {taskKey:"T06",name:"提案簡報",owner:"張育瑄",done:false,done_date:null,sort_order:3},
  {taskKey:"T06",name:"展覽設計規劃",owner:"張育瑄",done:false,done_date:null,sort_order:4},
  {taskKey:"T07",name:"台語配音",owner:"李宗霖",done:false,done_date:null,sort_order:1},
  {taskKey:"T07",name:"後製剪輯",owner:"李宗霖",done:false,done_date:null,sort_order:2},
  {taskKey:"T07",name:"審片送播",owner:"李宗霖",done:false,done_date:null,sort_order:3},
  {taskKey:"T12",name:"場地租借",owner:"林佳穎",done:true,done_date:"2026-02-20",sort_order:1},
  {taskKey:"T12",name:"媒體邀請名單",owner:"林佳穎",done:true,done_date:"2026-03-01",sort_order:2},
  {taskKey:"T12",name:"新聞稿撰寫",owner:"林佳穎",done:true,done_date:"2026-03-08",sort_order:3},
  {taskKey:"T12",name:"當日執行",owner:"林佳穎",done:false,done_date:null,sort_order:4},
  {taskKey:"T13",name:"報名素材準備",owner:"吳欣妤",done:true,done_date:"2026-03-15",sort_order:1},
  {taskKey:"T13",name:"字幕翻譯",owner:"吳欣妤",done:false,done_date:null,sort_order:2},
  {taskKey:"T13",name:"參展人員安排",owner:"林佳穎",done:false,done_date:null,sort_order:3},
  {taskKey:"T13",name:"展後報告",owner:"吳欣妤",done:false,done_date:null,sort_order:4},
  {taskKey:"T20",name:"展位設計+物料",owner:"吳欣妤",done:true,done_date:"2026-02-10",sort_order:1},
  {taskKey:"T20",name:"人員行程安排",owner:"林佳穎",done:true,done_date:"2026-02-12",sort_order:2},
  {taskKey:"T20",name:"展後報告",owner:"吳欣妤",done:true,done_date:"2026-02-24",sort_order:3},
];

async function seed() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SPREADSHEET_ID) {
    console.error('Missing GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SPREADSHEET_ID in .env');
    process.exit(1);
  }

  const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  console.log('Seeding Google Sheets...');

  // 1. Create sheet tabs (if they don't exist)
  const existing = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const existingTitles = existing.data.sheets.map(s => s.properties.title);

  const sheetsToCreate = Object.keys(SHEET_DEFS).filter(name => !existingTitles.includes(name));
  if (sheetsToCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: sheetsToCreate.map(title => ({
          addSheet: { properties: { title } },
        })),
      },
    });
    console.log(`Created sheet tabs: ${sheetsToCreate.join(', ')}`);
  }

  // 2. Write headers to all sheets
  for (const [sheetName, headers] of Object.entries(SHEET_DEFS)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
  console.log('Headers written to all sheets');

  // 3. Create Super Admins
  const accounts = [
    { email: 'rock0923@gmail.com', password: '750921', name: 'Rock' },
    { email: '950201@gmail.com', password: '770214', name: '姐姐' },
  ];

  const now = new Date().toISOString();
  const userRows = [];
  let superAdminId;

  for (const acc of accounts) {
    const id = crypto.randomUUID();
    if (!superAdminId) superAdminId = id;
    const hash = await bcrypt.hash(acc.password, 12);
    userRows.push([id, acc.email, hash, 'super_admin', acc.name, 'false', now, now]);
    console.log(`Super Admin: ${acc.email} (${acc.name})`);
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'users!A:A',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: userRows },
  });

  // 4. Create Projects
  const projectNames = [...new Set(SEED_TASKS.map(t => t.project))];
  const projectMap = {};
  const projectRows = [];

  for (let i = 0; i < projectNames.length; i++) {
    const id = crypto.randomUUID();
    projectMap[projectNames[i]] = id;
    projectRows.push([id, projectNames[i], String(i + 1), superAdminId, now, now]);
    console.log(`  Project: ${projectNames[i]}`);
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'projects!A:A',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: projectRows },
  });

  // 5. Create Tasks
  const taskIdMap = {};
  const taskRows = [];

  for (const t of SEED_TASKS) {
    const id = crypto.randomUUID();
    taskIdMap[t.id] = id;
    taskRows.push([
      id, projectMap[t.project], t.task, t.status, t.category,
      t.start || '', t.end || '', t.duration != null ? String(t.duration) : '',
      t.owner, t.priority, t.notes || '', String(t.sort_order),
      superAdminId, now, now,
    ]);
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'tasks!A:A',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: taskRows },
  });
  console.log(`${SEED_TASKS.length} tasks created`);

  // 6. Create Subtasks
  const subtaskRows = [];
  for (const s of SEED_SUBTASKS) {
    const taskId = taskIdMap[s.taskKey];
    if (!taskId) continue;
    subtaskRows.push([
      crypto.randomUUID(), taskId, s.name, s.owner,
      String(s.done), s.done_date || '', '', String(s.sort_order), now,
    ]);
  }

  if (subtaskRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'subtasks!A:A',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: subtaskRows },
    });
  }
  console.log(`${subtaskRows.length} subtasks created`);

  console.log('\nSeed complete!');
  console.log('\nLogin credentials:');
  for (const acc of accounts) {
    console.log(`   ${acc.email} / ${acc.password} (${acc.name})`);
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
