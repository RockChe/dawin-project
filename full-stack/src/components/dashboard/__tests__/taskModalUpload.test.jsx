/**
 * fix-wave finding: TaskModal.handleFileUpload used a different error-handling
 * shape than FileManagerModal.handleFileUpload for the SAME /api/upload
 * endpoint — FileManagerModal runs FORBIDDEN through useForbiddenHandler
 * (toast + router.refresh, so a viewer downgraded mid-session sees the stale
 * UI refresh); TaskModal just showed a generic toast and never refreshed.
 * This test locks TaskModal onto the same shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import TaskModal from '@/components/dashboard/TaskModal';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

class FakeXHR {
  constructor() {
    this.upload = {};
    FakeXHR.instances.push(this);
  }
  open() {}
  send() {}
  abort() {}
}
FakeXHR.instances = [];

const TASK = {
  id: 't1', task: 'T1', status: '待辦', startDate: '2026-08-01', endDate: '2026-08-10',
  duration: 9, owner: null, priority: '中', notes: null,
};

function renderModal(showToast) {
  const props = {
    task: TASK, projectId: 'p1', projectName: 'P1', onClose: () => {},
    addTask: async () => ({ success: true }), updateTask: async () => {},
    allS: [], addSub: async () => {}, deleteSub: async () => {}, toggleSub: async () => {}, updateSub: async () => {},
    configCats: [], configOwners: [], reorderSubs: () => {},
    allL: [], allF: [], addLink: async () => {}, addFile: () => {}, deleteLink: async () => {}, deleteFile: async () => {},
    showToast,
  };
  return render(
    <ThemeProvider>
      <PermissionProvider role="admin">
        <TaskModal {...props} />
      </PermissionProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeXHR.instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
});

describe('TaskModal 檔案上傳錯誤處理跟 FileManagerModal 對齊（走 useForbiddenHandler）', () => {
  it('FORBIDDEN → toast 權限不足 + router.refresh()', () => {
    const showToast = vi.fn();
    renderModal(showToast);
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    const xhr = FakeXHR.instances[0];
    xhr.responseText = JSON.stringify({ error: 'FORBIDDEN' });
    act(() => { xhr.onload(); });

    expect(refresh).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('權限不足', 'error');
  });

  it('一般錯誤 → showToast(result.error)，不 refresh', () => {
    const showToast = vi.fn();
    renderModal(showToast);
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    const xhr = FakeXHR.instances[0];
    xhr.responseText = JSON.stringify({ error: '上傳失敗' });
    act(() => { xhr.onload(); });

    expect(refresh).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('上傳失敗', 'error');
  });
});
