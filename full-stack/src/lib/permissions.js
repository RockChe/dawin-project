// 角色權限的單一真相源。前後端共用——前端用來決定畫面，後端用來決定授權。
// allowlist 制：沒被列進來的角色一律沒有該能力（fail-closed）。

export const ROLES = ['viewer', 'admin', 'super_admin'];

export const CAPABILITIES = {
  read:   ['viewer', 'admin', 'super_admin'], // 讀資料
  self:   ['viewer', 'admin', 'super_admin'], // 改自己的密碼／自己的 UI 偏好
  export: ['admin', 'super_admin'],           // 匯出全量資料（Rock 2026-09-08 裁定：不給 viewer）
  write:  ['admin', 'super_admin'],           // 新增／修改／刪除共享資料
  manage: ['super_admin'],                    // 使用者管理、備份設定、破壞性操作
};

export function can(role, cap) {
  return CAPABILITIES[cap]?.includes(role) ?? false;
}
