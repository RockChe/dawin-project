// 裝置分流：純函式，middleware 與測試共用。不依賴 DOM、不依賴 next。
export const DEVICES = ['mobile', 'tablet', 'desktop'];
// 平板版完成後把 'tablet' 加進來；在那之前平板一律當桌機。
export const ENABLED_DEVICES = ['desktop', 'mobile'];
export const HOME = { desktop: '/dashboard', mobile: '/m', tablet: '/t' };

const pick = d => (ENABLED_DEVICES.includes(d) ? d : 'desktop');

/**
 * @param {{ uaType?: string, pref?: string, auto?: string }} input
 *   uaType: Next `userAgent(request).device.type`（'mobile' | 'tablet' | undefined）
 *   pref:   cookie device_pref（使用者手動選的，最高優先）
 *   auto:   cookie device_auto（客戶端偵測結果，平板計畫才會寫入）
 */
export function detectDevice({ uaType, pref, auto } = {}) {
  if (DEVICES.includes(pref)) return pick(pref);
  if (DEVICES.includes(auto)) return pick(auto);
  if (uaType === 'mobile') return pick('mobile');
  if (uaType === 'tablet') return pick('tablet');
  return 'desktop';
}
