/**
 * fix-wave finding: SortableSubItem always rendered subtask notes through
 * InlineNote, which is unconditionally editable (click → input box) — no
 * canWrite gate at all, unlike the name field two lines above it and unlike
 * DataTab's desktop subtask row (which swaps to ReadOnlyCell for viewers).
 * A viewer could click the note and get an editable textbox even though the
 * write action underneath is blocked server-side.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import SortableSubItem from '@/components/dashboard/SortableSubItem';

const SUB = { id: 's1', name: 'Sub 1', notes: 'some note', owner: null, done: false };

function renderAs(role) {
  return render(
    <ThemeProvider>
      <PermissionProvider role={role}>
        <SortableSubItem sub={SUB} toggleSub={() => {}} updateSub={() => {}} deleteSub={() => {}} configOwners={[]} />
      </PermissionProvider>
    </ThemeProvider>
  );
}

describe('SortableSubItem 備註對 viewer 唯讀', () => {
  it('viewer 點備註不會出現可編輯的 input', () => {
    renderAs('viewer');
    fireEvent.click(screen.getByText('some note'));
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('admin 點備註仍會進入編輯模式（input 出現）', () => {
    renderAs('admin');
    fireEvent.click(screen.getByText('some note'));
    expect(screen.getByRole('textbox')).toBeTruthy();
  });
});
