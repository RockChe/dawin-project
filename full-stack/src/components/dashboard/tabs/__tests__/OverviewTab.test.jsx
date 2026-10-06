import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import OverviewTab from '@/components/dashboard/tabs/OverviewTab';

function renderOverview() {
  const props = {
    filtered: [], twp: [], allS: [], isMobile: false, pcMap: {},
    ganttWidths: null, projBanners: {}, stats: {}, configOwners: [],
  };
  return render(
    <ThemeProvider>
      <OverviewTab {...props} />
    </ThemeProvider>
  );
}

describe('OverviewTab 精簡版', () => {
  it('只保留 Timeline / Upcoming / Status 三塊', () => {
    renderOverview();
    for (const h of ['Project Timeline', 'Upcoming Deadlines', 'Status Distribution']) {
      expect(screen.getByText(h)).toBeTruthy();
    }
  });

  it('移除 Overdue / Project Progress / Team Workload / Tasks per Project', () => {
    renderOverview();
    for (const h of ['Overdue Tasks', 'Project Progress', 'Team Workload', 'Tasks per Project']) {
      expect(screen.queryByText(h)).toBeNull();
    }
  });
});
