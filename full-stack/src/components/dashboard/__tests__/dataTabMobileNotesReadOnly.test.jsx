/**
 * fix-wave finding: DataTab's mobile expanded-row subtask notes (InlineNote)
 * had no canWrite gate, unlike the desktop table row a few lines below
 * (already swapped to ReadOnlyCell) and unlike the sibling `name` field two
 * lines above it in the SAME mobile row. A viewer could click the note and
 * get an editable textbox.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import DataTab from '@/components/dashboard/tabs/DataTab';

const TASK = {
  id: 't1', task: 'T1', status: '待辦', priority: '中', category: '活動',
  start: '2026-08-01', end: '2026-08-10', project: 'P1', progress: 0, sDone: 0, sTotal: 1,
};
const SUB = { id: 's1', taskId: 't1', name: 'Sub 1', notes: 'a note', owner: null, done: false };

function renderMobileAs(role) {
  const props = {
    filtered: [TASK], allS: [SUB], allT: [TASK], twp: [TASK], projects: [{ id: 'p1', name: 'P1' }],
    updateTask: () => {}, deleteTask: () => {}, addTask: async () => ({ success: true }),
    toggleSub: () => {}, updateSub: () => {}, addSub: async () => {}, deleteSub: () => {},
    configCats: [], configOwners: [],
    isMobile: true, userRole: role, pcMap: { P1: '#123456' },
    importTasks: () => {}, deleteManyTasks: () => {}, updateManyTasks: () => {}, deleteAllTasks: () => {},
    showToast: () => {}, setModalTask: () => {},
  };
  return render(
    <ThemeProvider>
      <PermissionProvider role={role}>
        <DataTab {...props} />
      </PermissionProvider>
    </ThemeProvider>
  );
}

describe('DataTab mobile 展開列的子任務備註對 viewer 唯讀', () => {
  it('viewer 展開後點備註不會出現可編輯的 input', () => {
    renderMobileAs('viewer');
    fireEvent.click(screen.getByText('T1'));
    fireEvent.click(screen.getByText('a note'));
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('admin 展開後點備註仍會進入編輯模式（input 出現）', () => {
    renderMobileAs('admin');
    fireEvent.click(screen.getByText('T1'));
    fireEvent.click(screen.getByText('a note'));
    expect(screen.getByRole('textbox')).toBeTruthy();
  });
});
