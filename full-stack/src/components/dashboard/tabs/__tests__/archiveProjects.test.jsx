/**
 * 專案封存（projects.archived_at，全團隊共享）：ProjectsTab 的封存狀態來自 props（project.archivedAt），
 * 不再是元件內的 useState(Set)——所以切分頁（unmount／remount）、重新整理後都不會消失。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import ProjectsTab from '@/components/dashboard/tabs/ProjectsTab';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const AT = '2026-10-01T00:00:00.000Z';
const baseProjects = () => [
  { id: 'p1', name: 'Alpha', sortOrder: 1, archivedAt: null },
  { id: 'p2', name: 'Bravo', sortOrder: 2, archivedAt: AT },   // 已封存、有任務
  { id: 'p3', name: 'Charlie', sortOrder: 3, archivedAt: AT }, // 已封存、沒有任務（也必須能被還原）
];
const twp = [{ id: 't2', project: 'Bravo', progress: 0, status: '待辦', task: 'x' }];

const showToast = vi.fn();
const archiveProject = vi.fn();
const unarchiveProject = vi.fn();

// 模擬 useTaskManager：樂觀更新 projects[].archivedAt
function Harness({ role = 'admin', initial = baseProjects() }) {
  const [projects, setProjects] = useState(initial);
  const set = (id, archivedAt) => setProjects(ps => ps.map(p => (p.id === id ? { ...p, archivedAt } : p)));
  return (
    <ThemeProvider>
      <PermissionProvider role={role}>
        <ProjectsTab
          twp={twp} allS={[]} projects={projects} configOwners={[]} pcMap={{}} allProjNames={projects.map(p => p.name)}
          setModalTask={() => {}} setShowFileManager={() => {}} ganttWidths={{}} timelineHeight={100} showToast={showToast}
          renameProject={() => {}} addProject={() => {}} deleteProject={() => {}}
          updateTask={() => {}} deleteTask={() => {}} toggleSub={() => {}} updateSub={() => {}}
          addSub={() => {}} deleteSub={() => {}} reorderSubs={() => {}} reorderProjects={() => {}}
          projBanners={{}} setProjBanners={() => {}} onProjectRenamed={() => {}} onProjectDeleted={() => {}}
          archiveProject={async (id) => { archiveProject(id); set(id, AT); return { success: true }; }}
          unarchiveProject={async (id) => { unarchiveProject(id); set(id, null); return { success: true }; }}
        />
      </PermissionProvider>
    </ThemeProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ProjectsTab 封存（來自 project.archivedAt）', () => {
  it('已封存專案不在主列表；Archived 計數 = 封存專案數（含沒有任務的）', () => {
    render(<Harness />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Bravo')).toBeNull();
    expect(screen.queryByText('Charlie')).toBeNull();
    expect(screen.getByText('Archived (2)')).toBeTruthy();
  });

  it('展開 Archived 區塊 → 列出所有已封存專案（含 0 任務）', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Archived (2)'));
    expect(screen.getByText('Bravo')).toBeTruthy();
    expect(screen.getByText('Charlie')).toBeTruthy();
  });

  it('Unarchive → 呼叫 hook 的 unarchiveProject(id)、toast、專案回到主列表', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Archived (2)'));
    fireEvent.click(screen.getAllByText('Unarchive')[0]); // Bravo
    expect(unarchiveProject).toHaveBeenCalledWith('p2');
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Project unarchived', 'success'));
    await waitFor(() => expect(screen.getByText('Archived (1)')).toBeTruthy());
    expect(screen.getByText('Bravo')).toBeTruthy(); // 現在在主列表
  });

  it('卡片上的 Archive → 呼叫 archiveProject(id)、toast，專案離開主列表', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Archive'));
    expect(archiveProject).toHaveBeenCalledWith('p1');
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Project archived', 'warn'));
    await waitFor(() => expect(screen.getByText('Archived (3)')).toBeTruthy());
    expect(screen.queryByText('Alpha')).toBeNull();
  });

  it('伺服器失敗（result.error）→ 不顯示成功 toast', async () => {
    const p = baseProjects();
    render(
      <ThemeProvider><PermissionProvider role="admin">
        <ProjectsTab
          twp={[]} allS={[]} projects={p} configOwners={[]} pcMap={{}} allProjNames={[]}
          setModalTask={() => {}} setShowFileManager={() => {}} ganttWidths={{}} timelineHeight={100} showToast={showToast}
          renameProject={() => {}} addProject={() => {}} deleteProject={() => {}}
          updateTask={() => {}} deleteTask={() => {}} toggleSub={() => {}} updateSub={() => {}}
          addSub={() => {}} deleteSub={() => {}} reorderSubs={() => {}} reorderProjects={() => {}}
          projBanners={{}} setProjBanners={() => {}} onProjectRenamed={() => {}} onProjectDeleted={() => {}}
          archiveProject={async () => ({ error: '封存失敗' })} unarchiveProject={async () => ({ error: 'x' })}
        />
      </PermissionProvider></ThemeProvider>
    );
    fireEvent.click(screen.getByText('Archive'));
    await Promise.resolve(); await Promise.resolve();
    expect(showToast).not.toHaveBeenCalledWith('Project archived', 'warn');
  });

  it('viewer：沒有 Archive／Unarchive 按鈕（但仍看得到 Archived 區塊）', () => {
    render(<Harness role="viewer" />);
    expect(screen.queryByText('Archive')).toBeNull();
    fireEvent.click(screen.getByText('Archived (2)'));
    expect(screen.getByText('Bravo')).toBeTruthy();
    expect(screen.queryByText('Unarchive')).toBeNull();
  });

  it('封存狀態來自 props：unmount 後重新 mount（切分頁／重新整理）仍保持', () => {
    const first = render(<Harness />);
    expect(screen.getByText('Archived (2)')).toBeTruthy();
    first.unmount();
    render(<Harness />);
    expect(screen.getByText('Archived (2)')).toBeTruthy();
    expect(screen.queryByText('Bravo')).toBeNull();
  });
});
