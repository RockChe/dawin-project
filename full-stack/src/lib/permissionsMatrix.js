// 每一支對外入口的 capability 分類。authzCoverage 測試會拿這份跟原始碼比對——
// 新增 export 卻沒列進來，CI 就紅。這是 default-deny：沒被分類 = 不合法。
export const MATRIX = {
  'src/server/actions/tasks.js': {
    getAllTasks: 'read', getAllSubtasks: 'read', getAllLinks: 'read',
    getAllFiles: 'read', getDashboardData: 'read',
    createTask: 'write', updateTask: 'write', deleteTask: 'write',
    createSubtask: 'write', updateSubtask: 'write', deleteSubtask: 'write',
    toggleSubtask: 'write', createLink: 'write', deleteLink: 'write',
    createFileRecord: 'write', deleteFile: 'write', upsertTasks: 'write',
    updateManyTasks: 'write', deleteManyTasks: 'write',
    deleteAllTasks: 'manage',
  },
  'src/server/actions/projects.js': {
    getProjects: 'read', getProjectWithTasks: 'read',
    createProject: 'write', updateProject: 'write', deleteProject: 'write',
    deleteProjectBanner: 'write', reorderProjects: 'write',
  },
  'src/server/actions/config.js': {
    getConfig: 'read', getConfigs: 'read', saveConfig: 'write',
  },
  'src/server/actions/userSettings.js': {
    getUserSettings: 'self', setUserSetting: 'self',
  },
  'src/server/actions/dashboard.js': {
    getInitialData: 'read',
  },
  // setPassword 用「const result = await withCap('self', …)」形式（外層要保留導回登入頁的行為）。
  // 它必須被 matrix 涵蓋——豁免掉的話，日後誤刪 withCap 不會有人發現。
  'src/server/actions/auth.js': {
    setPassword: 'self',
  },
  'src/server/actions/users.js': {
    getUsers: 'manage', createUser: 'manage', updateUser: 'manage',
    deleteUser: 'manage', resetUserPassword: 'manage',
  },
  'src/server/actions/backup.js': {
    getBackupSettings: 'manage', saveBackupSettings: 'manage',
    getBackupHistory: 'manage', getAuditLogs: 'manage',
    testR2ConnectionAction: 'manage', testGDriveConnectionAction: 'manage',
    triggerBackup: 'manage',
  },

  // ── API routes ──
  // codex 指出 v1 只收 server actions，等於未來新增 route 忘了包 withRouteCap
  // 也不會讓 CI 紅。護欄要涵蓋所有對外入口才叫 default-deny。
  'src/app/api/upload/route.js':        { POST: 'write' },
  'src/app/api/upload-banner/route.js': { POST: 'write' },
  'src/app/api/fetch-csv/route.js':     { POST: 'write' },
  'src/app/api/download/route.js':      { GET: 'export' },  // Rock 2026-09-08 重裁：viewer 不得開附件
  'src/app/api/backup/route.js':        { GET: 'manage' },  // 整庫傾印（含 users 表），原本就是 super_admin only
  'src/app/api/debug/route.js':         { GET: 'manage' },
};

// 經審核的例外：這些入口刻意不走 capability 授權。
// 想加新的例外就得改這個檔案，會出現在 code review 裡。
export const EXEMPT = [
  'src/server/actions/auth.js#login',          // 未登入才會呼叫
  'src/server/actions/auth.js#logout',         // 登出不需要能力
  'src/server/actions/auth.js#getSessionInfo', // 只回自己的 session
  'src/app/api/health/route.js#GET',           // 公開健康檢查，只回 status/timestamp/db/cronSecret 布林
  'src/app/api/backup/route.js#POST',          // Vercel Cron，走 CRON_SECRET 而非 session（見 Task 6）
];
