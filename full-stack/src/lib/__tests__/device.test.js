import { describe, it, expect } from 'vitest';
import { detectDevice, HOME, DEVICES, ENABLED_DEVICES } from '@/lib/device';

describe('detectDevice', () => {
  it('手機 UA → mobile', () => {
    expect(detectDevice({ uaType: 'mobile' })).toBe('mobile');
  });
  it('沒有任何線索 → desktop', () => {
    expect(detectDevice({})).toBe('desktop');
  });
  it('平板版未啟用時，平板 UA 退回 desktop', () => {
    expect(ENABLED_DEVICES.includes('tablet')).toBe(false);
    expect(detectDevice({ uaType: 'tablet' })).toBe('desktop');
  });
  it('手動偏好優先於 UA', () => {
    expect(detectDevice({ uaType: 'mobile', pref: 'desktop' })).toBe('desktop');
    expect(detectDevice({ uaType: undefined, pref: 'mobile' })).toBe('mobile');
  });
  it('auto 優先於 UA、低於 pref', () => {
    expect(detectDevice({ uaType: 'mobile', auto: 'desktop' })).toBe('desktop');
    expect(detectDevice({ auto: 'desktop', pref: 'mobile' })).toBe('mobile');
  });
  it('不合法的 cookie 值被忽略', () => {
    expect(detectDevice({ uaType: 'mobile', pref: 'evil' })).toBe('mobile');
  });
  it('HOME 與 DEVICES 一致', () => {
    expect(Object.keys(HOME).sort()).toEqual([...DEVICES].sort());
    expect(HOME.mobile).toBe('/m');
    expect(HOME.desktop).toBe('/dashboard');
  });
});
