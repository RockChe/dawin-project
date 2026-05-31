/**
 * TDD tests for SettingsTab — zoom control (#03).
 *
 * SettingsTab calls useTheme() from ThemeProvider, so we wrap the rendered
 * component in ThemeProvider. All other props are simple stubs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import SettingsTab from '@/components/dashboard/tabs/SettingsTab';

// ── Stub props ────────────────────────────────────────────────────────────────
function makeProps(overrides = {}) {
  return {
    configCats: [],
    saveConfigCats: () => {},
    configOwners: [],
    ganttDraft: { overview: {}, project: {}, timeline: {} },
    setGanttDraft: () => {},
    saveGanttWidths: () => {},
    timelineHeight: 100,
    saveTimelineHeight: () => {},
    upcomingDays: 30,
    upcomingLimit: 5,
    saveUpcomingSettings: () => {},
    isMobile: false,
    showToast: () => {},
    zoom: 150,
    onZoomChange: vi.fn(),
    ...overrides,
  };
}

// ── Helper: render inside ThemeProvider ──────────────────────────────────────
function renderWithTheme(props) {
  return render(
    <ThemeProvider>
      <SettingsTab {...props} />
    </ThemeProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('SettingsTab zoom control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a range input with value 150', () => {
    renderWithTheme(makeProps({ zoom: 150 }));

    const slider = screen.getByRole('slider', { name: /全站放大/ });
    expect(slider).toBeDefined();
    expect(Number(slider.value)).toBe(150);
  });

  it('displays the zoom percentage label (150%)', () => {
    renderWithTheme(makeProps({ zoom: 150 }));

    // Label should show "150%" somewhere in the document
    expect(screen.getByText(/150%/)).toBeDefined();
  });

  it('calls onZoomChange with a NUMBER when the slider changes to 80', () => {
    const onZoomChange = vi.fn();
    renderWithTheme(makeProps({ zoom: 150, onZoomChange }));

    const slider = screen.getByRole('slider', { name: /全站放大/ });
    fireEvent.change(slider, { target: { value: '80' } });

    expect(onZoomChange).toHaveBeenCalledTimes(1);
    // Must receive a number, not the string "80"
    expect(onZoomChange).toHaveBeenCalledWith(80);
    expect(typeof onZoomChange.mock.calls[0][0]).toBe('number');
  });

  it('reflects the passed zoom prop value on the slider', () => {
    renderWithTheme(makeProps({ zoom: 120 }));

    const slider = screen.getByRole('slider', { name: /全站放大/ });
    expect(Number(slider.value)).toBe(120);
  });
});
