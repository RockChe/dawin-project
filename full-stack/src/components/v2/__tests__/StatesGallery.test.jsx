import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CloudLevelProvider } from '@/components/CloudLevelContext';
import { V2SettingsProvider } from '@/components/v2/SettingsContext';
import StatesGallery from '@/components/v2/StatesGallery';
import { LoadingState, ErrorState, EmptyNone, EmptyFiltered, EmptyProject, Toast } from '@/components/v2/StateViews';

// 狀態集驗收案例（R9：只在 /v2/preview/states，不是產品頁）。
const gallery = (level = 'full', settings = {}) => render(
  <CloudLevelProvider level={level}><V2SettingsProvider value={{ settings, updateSetting: vi.fn(), ready: true }}><StatesGallery /></V2SettingsProvider></CloudLevelProvider>
);
const cards = (c) => [...c.querySelectorAll('.scard')];
const panes = (card) => [...card.querySelectorAll('.pane')];
const cloudCount = (el) => el.querySelectorAll('.cl').length;
const txt = (el) => { const c = el.cloneNode(true); c.querySelectorAll('svg').forEach((v) => v.remove()); c.querySelectorAll('i').forEach((v) => { if (v.parentElement.classList.contains('pane')) v.remove(); }); return c.textContent; };

describe('狀態集：五種狀態＋提示條，每格左右並排「有雲／無雲」', () => {
  it('六張卡片，標題同設計稿', () => {
    const { container } = gallery();
    expect(cards(container).map((c) => c.querySelector('h3').textContent)).toEqual([
      '載入中（白雲上下飄；減少動態時靜止）', '載入失敗（烏雲，帶文字與重試）', '空狀態：沒有待辦（筋斗雲）', '篩選後沒結果（淡紫雲）', '專案內尚無任務（白雲）', '提示條 toast（成功／逾期／小提示）']);
  });

  it('每個狀態：有雲格有雲、無雲格沒有雲，且兩邊文字完全相同（雲只是輔助）', () => {
    const { container } = gallery();
    for (const card of cards(container).slice(0, 5)) {
      const [on, off] = panes(card);
      expect(on.querySelector('i').textContent).toBe('有雲朵');
      expect(off.querySelector('i').textContent).toBe('無雲朵（fallback）');
      expect(cloudCount(on)).toBe(1);
      expect(cloudCount(off)).toBe(0);
      const t = (p) => txt(p.querySelector('.emp'));
      expect(t(on)).toBe(t(off));
    }
  });

  it('不受使用者的顯示程度影響：關閉／精簡時「有雲朵」格仍然有雲、「無雲朵」格仍然沒有', () => {
    for (const level of ['off', 'lite']) {
      const { container, unmount } = gallery(level);
      for (const card of cards(container)) {
        const [on, off] = panes(card);
        expect(cloudCount(on)).toBeGreaterThan(0);
        expect(cloudCount(off)).toBe(0);
      }
      unmount();
    }
  });

  it('載入中：白雲上下飄（bob），role=status；無雲時改成骨架線', () => {
    const { container } = gallery();
    const [on, off] = panes(cards(container)[0]);
    expect(on.querySelector('[role="status"][aria-label="載入中"] .cl.bob')).not.toBeNull();
    expect(on.querySelector('.skls')).toBeNull();
    expect(off.querySelector('.skls i').parentElement.children).toHaveLength(3);
    expect(on.textContent).toContain('載入中…');
    expect(on.textContent).toContain('正在整理你的任務');
  });

  it('載入失敗：烏雲＋文字＋重新整理；無雲時退回紅色條；role=alert', () => {
    const { container } = gallery();
    const [on, off] = panes(cards(container)[1]);
    expect(on.querySelector('[role="alert"]')).not.toBeNull();
    expect(on.textContent).toContain('載入失敗');
    expect(on.textContent).toContain('資料暫時讀不到，請重新整理再試一次');
    expect(within(on).getByRole('button', { name: '重新整理' })).toBeTruthy();
    expect(off.querySelector('.fb.tbar')).not.toBeNull();
    expect(on.querySelector('.fb')).toBeNull();
  });

  it('空狀態三種：沒有待辦／篩選後沒結果（清除篩選）／專案內尚無任務（+ Create）', () => {
    const { container } = gallery();
    const [none, filt, proj] = cards(container).slice(2, 5).map((c) => panes(c)[0]);
    expect(none.textContent).toContain('沒有待辦！');
    expect(none.textContent).toContain('今天可以喘口氣了');
    expect(filt.textContent).toContain('沒有符合篩選的任務');
    expect(within(filt).getByRole('button', { name: '清除篩選' })).toBeTruthy();
    expect(proj.textContent).toContain('這個專案還沒有任務');
    expect(within(proj).getByRole('button', { name: '+ Create' })).toBeTruthy();
  });

  it('提示條三種：完成了！（筋斗雲飛過）／逾期（數字取自 fixtures）／小提示；無雲時退回色條，文字不變', () => {
    const { container } = gallery();
    const toastCard = cards(container)[5];
    const pairs = [...toastCard.querySelectorAll('.pair')];
    expect(pairs).toHaveLength(3);
    const [ok, warn, tip] = pairs;
    expect(ok.querySelector('.pane .toast .cl.fly')).not.toBeNull();
    expect(ok.textContent).toContain('完成了！');
    expect(warn.textContent).toMatch(/有 \d+ 件任務逾期/);
    expect(warn.textContent).toContain('先處理最久的：');
    expect(tip.textContent).toContain('在子任務加上負責人，任務的執行人會自動帶出喔');
    for (const p of pairs) {
      const [on, off] = p.querySelectorAll('.pane');
      expect(cloudCount(on)).toBe(1);
      expect(cloudCount(off)).toBe(0);
      expect(off.querySelector('.toast .fb.tbar')).not.toBeNull();
      expect(txt(on.querySelector('.toast'))).toBe(txt(off.querySelector('.toast')));
    }
  });

  it('個人設定 cloudMotion=false：載入中與提示條的動態也停止（取交集）', () => {
    const { container } = gallery('full', { cloudMotion: false });
    expect(container.querySelector('.bob,.fly')).toBeNull();
    expect(cloudCount(container)).toBeGreaterThan(0);
  });

  it('不出現「雲寶寶」；雲都只是輔助（每個雲旁邊都有文字）', () => {
    const { container } = gallery();
    expect(container.textContent).not.toContain('雲寶寶');
    for (const c of container.querySelectorAll('.cl')) expect(c.closest('.emp,.toast').textContent.trim().length).toBeGreaterThan(4);
  });
});

describe('StateViews 元件（可重用）', () => {
  const wrap = (ui, level = 'full') => render(<CloudLevelProvider level={level}>{ui}</CloudLevelProvider>);
  it('重試、清除篩選、建立任務的回呼', () => {
    const retry = vi.fn(), clear = vi.fn(), create = vi.fn();
    wrap(<><ErrorState onRetry={retry} /><EmptyFiltered onClear={clear} /><EmptyProject onCreate={create} /><EmptyNone /><LoadingState /></>);
    fireEvent.click(screen.getByRole('button', { name: '重新整理' }));
    fireEvent.click(screen.getByRole('button', { name: '清除篩選' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Create' }));
    expect([retry, clear, create].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });
  it('Toast 可帶動作按鈕與 float 定位', () => {
    const act = vi.fn();
    const { container } = wrap(<Toast kind="warn" title="標題" sub="說明" action="查看" onAction={act} float />);
    expect(container.querySelector('.toast.float')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '查看' }));
    expect(act).toHaveBeenCalled();
  });
});
