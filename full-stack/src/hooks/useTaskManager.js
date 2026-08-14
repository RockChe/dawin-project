'use client';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { computeAllProgress, toISO, toBusinessDateString } from '@/lib/utils';
import { getInitialData } from '@/server/actions/dashboard';
import {
  createTask as createTaskAction,
  updateTask as updateTaskAction,
  deleteTask as deleteTaskAction,
  createSubtask as createSubtaskAction,
  updateSubtask as updateSubtaskAction,
  deleteSubtask as deleteSubtaskAction,
  toggleSubtask as toggleSubtaskAction,
  createLink as createLinkAction,
  deleteLink as deleteLinkAction,
  deleteFile as deleteFileAction,
  upsertTasks as upsertTasksAction,
  updateManyTasks as updateManyTasksAction,
  deleteManyTasks as deleteManyTasksAction,
  deleteAllTasks as deleteAllTasksAction,
} from '@/server/actions/tasks';
import {
  createProject as createProjectAction,
  updateProject as updateProjectAction,
  deleteProject as deleteProjectAction,
  reorderProjects as reorderProjectsAction,
} from '@/server/actions/projects';
import { saveConfig } from '@/server/actions/config';
import { runReorder } from './reorderProjects';

const DEFAULT_CATS = ['商務合作', '活動', '播出/開始', '行銷', '發行', '市場展'];
const CACHE_KEY = 'dash_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
// task columns backed by PG `date` — values get normalised to ISO on write
const DATE_COLUMNS = new Set(['startDate', 'endDate']);

function checkAuthError(result) {
  if (result?.error === 'UNAUTHORIZED' || result?.error === 'FORBIDDEN') {
    window.location.href = '/login';
    return true;
  }
  return false;
}

// Restore rows removed by a cascade delete without clobbering edits made to
// OTHER rows while the delete was in flight. `originalSnapshot` fixes the
// relative order to put the removed rows back into; anything still present
// in `current` keeps its (possibly since-edited) value, and anything in
// `current` that wasn't in the snapshot (created after the optimistic
// delete) is appended at the end.
export function mergeRestore(current, originalSnapshot, removedItems) {
  if (!removedItems.length) return current;
  const removedIds = new Set(removedItems.map(r => r.id));
  const currentById = new Map(current.map(c => [c.id, c]));
  // Order comes from the snapshot; the VALUE of a surviving row comes from
  // `current`, so an edit that landed while the delete was in flight survives
  // the rollback. Only the rows this delete removed fall back to the snapshot.
  const restored = originalSnapshot
    .filter(o => currentById.has(o.id) || removedIds.has(o.id))
    .map(o => currentById.get(o.id) ?? o);
  const extra = current.filter(c => !originalSnapshot.some(o => o.id === c.id));
  return [...restored, ...extra];
}

export default function useTaskManager(initialData) {
  const [projects, setProjects] = useState(initialData?.projects || []);
  const [allT, setAllT] = useState(initialData?.tasks || []);
  const [allS, setAllS] = useState(initialData?.subtasks || []);
  const [allL, setAllL] = useState(initialData?.links || []);
  const [allF, setAllF] = useState(initialData?.files || []);
  const [loading, setLoading] = useState(!initialData);
  const [userRole, setUserRole] = useState(initialData?.session?.role || null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const toastFadeTimer = useRef(null);
  const initialDataApplied = useRef(!!initialData);

  const [configCats, setConfigCats] = useState(DEFAULT_CATS);
  const [configOwners, setConfigOwners] = useState([]);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (toastFadeTimer.current) clearTimeout(toastFadeTimer.current);
    setToast({ msg, type, fading: false });
    toastTimer.current = setTimeout(() => {
      setToast(prev => prev ? { ...prev, fading: true } : null);
      toastFadeTimer.current = setTimeout(() => setToast(null), 300);
    }, 2200);
  }, []);

  const applyData = useCallback((data) => {
    if (checkAuthError(data)) return;
    const tasksList = data.tasks || [];
    const subsList = data.subtasks || [];
    if (data.session?.role) setUserRole(data.session.role);
    setAllT(tasksList);
    setAllS(subsList);
    setAllL(data.links || []);
    setAllF(data.files || []);
    setProjects(Array.isArray(data.projects) ? data.projects : []);

    // Owners: solely from users table
    setConfigOwners(Array.isArray(data.userNames) ? data.userNames : []);

    // Categories: seed default if DB has no data
    const cats = data.configs?.categories;
    if (Array.isArray(cats) && cats.length > 0) {
      setConfigCats(cats);
    } else {
      setConfigCats(DEFAULT_CATS);
      saveConfig('categories', DEFAULT_CATS);
    }
  }, []);

  // Load data from server with TTL-based SWR cache
  const loadData = useCallback(async (force = false) => {
    // Try to restore from sessionStorage cache first
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        applyData(parsed);
        setLoading(false);

        // If cache is fresh and not forced, skip server fetch
        if (!force && parsed.cachedAt && (Date.now() - parsed.cachedAt < CACHE_TTL)) {
          return;
        }
      }
    } catch {}

    // Fetch fresh data from server (single consolidated action)
    try {
      const data = await getInitialData();
      if (checkAuthError(data)) return;
      applyData(data);

      // Update cache with timestamp
      try {
        const payload = JSON.stringify({ ...data, cachedAt: Date.now() });
        if (payload.length < 4 * 1024 * 1024) {
          sessionStorage.setItem(CACHE_KEY, payload);
        }
      } catch {}
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  const invalidateCache = useCallback(() => {
    try { sessionStorage.removeItem(CACHE_KEY); } catch {}
  }, []);

  useEffect(() => {
    // If SSR data was provided, just cache it and skip fetch
    if (initialDataApplied.current) {
      initialDataApplied.current = false;
      try {
        const payload = JSON.stringify({ ...initialData, cachedAt: Date.now() });
        if (payload.length < 4 * 1024 * 1024) {
          sessionStorage.setItem(CACHE_KEY, payload);
        }
      } catch {}

      // Seed default categories if needed
      const cats = initialData?.configs?.categories;
      if (Array.isArray(cats) && cats.length > 0) {
        setConfigCats(cats);
      } else {
        setConfigCats(DEFAULT_CATS);
        saveConfig('categories', DEFAULT_CATS);
      }

      // Owners: solely from users table
      setConfigOwners(Array.isArray(initialData?.userNames) ? initialData.userNames : []);
      return;
    }

    let cancelled = false;
    const run = async () => {
      await loadData();
      if (cancelled) return;
    };
    run();
    return () => {
      cancelled = true;
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (toastFadeTimer.current) clearTimeout(toastFadeTimer.current);
    };
  }, [loadData, initialData]);

  // ── Task CRUD ──
  const pendingUpdates = useRef(new Set());

  // Mirrors so async callbacks can read the pre-update value without taking
  // the state as a dependency (which would re-create them on every edit).
  // Do NOT read state out of a setState updater side-effect — React only
  // runs an updater eagerly when the fiber has no other update already
  // pending; any setState call after the first one in the same synchronous
  // tick (or a 2nd mutation fired before the 1st's update flushes) has its
  // updater DEFERRED, leaving the captured value undefined (BUG01).
  const allTRef = useRef(allT);
  useEffect(() => { allTRef.current = allT; }, [allT]);
  const allSRef = useRef(allS);
  useEffect(() => { allSRef.current = allS; }, [allS]);
  const allLRef = useRef(allL);
  useEffect(() => { allLRef.current = allL; }, [allL]);
  const allFRef = useRef(allF);
  useEffect(() => { allFRef.current = allF; }, [allF]);
  const projectsRef = useRef(projects);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  const updateTask = useCallback(async (id, field, rawValue) => {
    // Canonicalize to the DB field name FIRST. `allT` rows are DB-shaped
    // (startDate/endDate), and `twp` re-derives the view aliases start/end
    // from them — so an optimistic write under the form name (`start`) would
    // be silently overwritten by twp and the UI would keep the old value.
    const fieldMap = { task: 'task', status: 'status', category: 'category', start: 'startDate', end: 'endDate', duration: 'duration', owner: 'owner', priority: 'priority', notes: 'notes' };
    const dbField = fieldMap[field] || field;

    // Date columns are PG `date`, and callers disagree on shape: TaskModal
    // sends ISO, DataTab's inline cell sends CalendarPicker output
    // ("2026/09/01 14:30"). Normalise here so the local row and the persisted
    // row always hold the same string. toISO is idempotent on ISO input.
    const value = DATE_COLUMNS.has(dbField) ? (toISO(rawValue ?? '') || null) : rawValue;

    const key = `${id}:${dbField}`;
    // Skip if same field on same task is already being updated (prevent race condition)
    if (pendingUpdates.current.has(key)) return;
    pendingUpdates.current.add(key);

    const prevRow = allTRef.current.find(t => t.id === id);
    const hadRow = !!prevRow;
    const prevValue = prevRow ? prevRow[dbField] : undefined;

    setAllT(p => p.map(t => t.id === id ? { ...t, [dbField]: value } : t));
    const updateData = {};
    updateData[dbField] = value;
    try {
      const result = await updateTaskAction(id, updateData);
      if (checkAuthError(result)) return;
      if (result?.error) {
        // Roll back only this field, so a concurrent edit to another field
        // on the same task isn't clobbered.
        if (hadRow) setAllT(p => p.map(t => t.id === id ? { ...t, [dbField]: prevValue } : t));
        showToast(result.error, 'error');
      } else {
        // The cached snapshot is now stale. loadData() short-circuits on a
        // cache younger than CACHE_TTL, so leaving it would make the next
        // mount re-apply the OLD value and never hit the server.
        invalidateCache();
      }
    } finally {
      pendingUpdates.current.delete(key);
    }
  }, [showToast, invalidateCache]);

  const addTask = useCallback(async (projectId, data) => {
    const result = await createTaskAction({ projectId, ...data });
    if (checkAuthError(result)) return;
    if (result?.success) {
      setAllT(p => [...p, result.task]);
      invalidateCache();
      showToast('任務已建立', 'success');
    } else if (result?.error) {
      showToast(result.error, 'error');
    }
    return result;
  }, [showToast, invalidateCache]);

  const deleteTask = useCallback(async (id) => {
    const prevTSnap = allTRef.current;
    const prevSSnap = allSRef.current;
    const prevLSnap = allLRef.current;
    const prevFSnap = allFRef.current;
    const removedT = prevTSnap.find(t => t.id === id);
    const tIdx = prevTSnap.findIndex(t => t.id === id);
    const removedS = prevSSnap.filter(s => s.taskId === id);
    const removedL = prevLSnap.filter(l => l.taskId === id);
    const removedF = prevFSnap.filter(f => f.taskId === id);

    setAllT(p => p.filter(t => t.id !== id));
    setAllS(p => p.filter(s => s.taskId !== id));
    setAllL(p => p.filter(l => l.taskId !== id));
    setAllF(p => p.filter(f => f.taskId !== id));
    invalidateCache();
    const result = await deleteTaskAction(id);
    if (checkAuthError(result)) return;
    if (result?.error) {
      if (removedT) {
        setAllT(p => p.some(t => t.id === id) ? p : [...p.slice(0, Math.min(tIdx, p.length)), removedT, ...p.slice(Math.min(tIdx, p.length))]);
      }
      if (removedS.length) setAllS(p => mergeRestore(p, prevSSnap, removedS));
      if (removedL.length) setAllL(p => mergeRestore(p, prevLSnap, removedL));
      if (removedF.length) setAllF(p => mergeRestore(p, prevFSnap, removedF));
      showToast(result.error, 'error');
    } else {
      showToast('任務已刪除', 'error');
    }
  }, [showToast, invalidateCache]);

  // ── Subtask CRUD ──
  const toggleSub = useCallback(async (id) => {
    // Per-row in-flight guard. Two quick clicks on the SAME subtask would both
    // read the same pre-update row, and the server's read-toggle-write would
    // silently drop one toggle; a failed rollback could also clobber a
    // successful one.
    const key = `sub:${id}:done`;
    if (pendingUpdates.current.has(key)) return;
    pendingUpdates.current.add(key);

    const prevRow = allSRef.current.find(s => s.id === id);
    setAllS(p => p.map(s => s.id === id
      ? { ...s, done: !s.done, doneDate: !s.done ? toBusinessDateString() : null }
      : s));
    try {
      const result = await toggleSubtaskAction(id);
      if (checkAuthError(result)) return;
      if (result?.error) {
        if (prevRow) setAllS(p => p.map(s => s.id === id ? prevRow : s));
        showToast(result.error, 'error');
        return;
      }
      // The server owns the day boundary, so adopt what it actually stored
      // rather than trusting the optimistic guess.
      if (result?.done !== undefined || result?.doneDate !== undefined) {
        setAllS(p => p.map(s => s.id === id ? {
          ...s,
          ...(result.done !== undefined ? { done: result.done } : {}),
          ...(result.doneDate !== undefined ? { doneDate: result.doneDate } : {}),
        } : s));
      }
      invalidateCache();
    } finally {
      pendingUpdates.current.delete(key);
    }
  }, [showToast, invalidateCache]);

  const updateSub = useCallback(async (id, field, value) => {
    const prevRow = allSRef.current.find(s => s.id === id);
    const prevValue = prevRow ? prevRow[field] : undefined;
    setAllS(p => p.map(s => s.id === id ? { ...s, [field]: value } : s));
    const result = await updateSubtaskAction(id, { [field]: value });
    if (checkAuthError(result)) return;
    if (result?.error) {
      if (prevRow) setAllS(p => p.map(s => s.id === id ? { ...s, [field]: prevValue } : s));
      showToast(result.error, 'error');
    } else {
      invalidateCache();
    }
  }, [showToast, invalidateCache]);

  const addSub = useCallback(async (taskId, data) => {
    const result = await createSubtaskAction({ taskId, ...data });
    if (checkAuthError(result)) return;
    if (result?.success) {
      setAllS(p => [...p, result.subtask]);
      invalidateCache();
      showToast('子任務已新增', 'success');
    }
    return result;
  }, [showToast, invalidateCache]);

  const deleteSub = useCallback(async (id) => {
    const idx = allSRef.current.findIndex(s => s.id === id);
    const removed = idx === -1 ? null : allSRef.current[idx];
    setAllS(p => p.filter(s => s.id !== id));
    const result = await deleteSubtaskAction(id);
    if (checkAuthError(result)) return;
    if (result?.error) {
      if (removed) {
        setAllS(p => p.some(s => s.id === id) ? p : [...p.slice(0, Math.min(idx, p.length)), removed, ...p.slice(Math.min(idx, p.length))]);
      }
      showToast(result.error, 'error');
    } else {
      invalidateCache();
      showToast('子任務已刪除', 'error');
    }
  }, [showToast, invalidateCache]);

  // ── Link CRUD ──
  const addLink = useCallback(async (taskId, data) => {
    const result = await createLinkAction({ taskId, ...data });
    if (checkAuthError(result)) return;
    if (result?.success) {
      setAllL(p => [...p, result.link]);
      invalidateCache();
      showToast('連結已新增', 'success');
    }
    return result;
  }, [showToast, invalidateCache]);

  const deleteLink = useCallback(async (id) => {
    const idx = allLRef.current.findIndex(l => l.id === id);
    const removed = idx === -1 ? null : allLRef.current[idx];
    setAllL(p => p.filter(l => l.id !== id));
    const result = await deleteLinkAction(id);
    if (checkAuthError(result)) return;
    if (result?.error) {
      if (removed) {
        setAllL(p => p.some(l => l.id === id) ? p : [...p.slice(0, Math.min(idx, p.length)), removed, ...p.slice(Math.min(idx, p.length))]);
      }
      showToast(result.error, 'error');
    } else {
      invalidateCache();
      showToast('連結已刪除', 'error');
    }
  }, [showToast, invalidateCache]);

  // ── File CRUD ──
  const addFile = useCallback((taskId, fileData) => {
    setAllF(p => [...p, fileData]);
    invalidateCache();
    showToast('檔案已上傳', 'success');
  }, [showToast, invalidateCache]);

  const deleteFileHandler = useCallback(async (id) => {
    const idx = allFRef.current.findIndex(f => f.id === id);
    const removed = idx === -1 ? null : allFRef.current[idx];
    setAllF(p => p.filter(f => f.id !== id));
    const result = await deleteFileAction(id);
    if (checkAuthError(result)) return;
    if (result?.error) {
      if (removed) {
        setAllF(p => p.some(f => f.id === id) ? p : [...p.slice(0, Math.min(idx, p.length)), removed, ...p.slice(Math.min(idx, p.length))]);
      }
      showToast(result.error, 'error');
    } else {
      invalidateCache();
      showToast('檔案已刪除', 'error');
    }
  }, [showToast, invalidateCache]);

  // ── Project CRUD ──
  const renameProject = useCallback(async (id, newName) => {
    if (!newName.trim()) return;
    const prev = [...projects];
    setProjects(p => p.map(proj => proj.id === id ? { ...proj, name: newName } : proj));
    const result = await updateProjectAction(id, { name: newName });
    if (checkAuthError(result)) return;
    if (result?.error) {
      setProjects(prev);
      showToast(result.error, 'error');
      return;
    }
    invalidateCache();
    showToast('專案已重新命名', 'success');
  }, [projects, showToast, invalidateCache]);

  const addProject = useCallback(async (name) => {
    const formData = new FormData();
    formData.set('name', name);
    const result = await createProjectAction(formData);
    if (checkAuthError(result)) return;
    if (result?.success) {
      setProjects(p => [...p, result.project]);
      invalidateCache();
      showToast('專案已建立', 'success');
    }
    return result;
  }, [showToast, invalidateCache]);

  const deleteProjectHandler = useCallback(async (id) => {
    const prevProjSnap = projectsRef.current;
    const prevTSnap = allTRef.current;
    const idx = prevProjSnap.findIndex(proj => proj.id === id);
    const removedProj = idx === -1 ? null : prevProjSnap[idx];
    const removedT = prevTSnap.filter(t => t.projectId === id);

    setProjects(p => p.filter(proj => proj.id !== id));
    setAllT(p => p.filter(t => t.projectId !== id));
    invalidateCache();
    const result = await deleteProjectAction(id);
    if (checkAuthError(result)) return;
    if (result?.error) {
      if (removedProj) {
        setProjects(p => p.some(proj => proj.id === id) ? p : [...p.slice(0, Math.min(idx, p.length)), removedProj, ...p.slice(Math.min(idx, p.length))]);
      }
      if (removedT.length) setAllT(p => mergeRestore(p, prevTSnap, removedT));
      showToast(result.error, 'error');
    } else {
      showToast('專案已刪除', 'error');
    }
  }, [showToast, invalidateCache]);

  // ── Batch Delete ──
  const deleteManyTasks = useCallback(async (ids) => {
    const prevTSnap = allTRef.current;
    const prevSSnap = allSRef.current;
    const prevLSnap = allLRef.current;
    const prevFSnap = allFRef.current;
    const removedT = prevTSnap.filter(t => ids.includes(t.id));
    const removedS = prevSSnap.filter(s => ids.includes(s.taskId));
    const removedL = prevLSnap.filter(l => ids.includes(l.taskId));
    const removedF = prevFSnap.filter(f => ids.includes(f.taskId));

    setAllT(p => p.filter(t => !ids.includes(t.id)));
    setAllS(p => p.filter(s => !ids.includes(s.taskId)));
    setAllL(p => p.filter(l => !ids.includes(l.taskId)));
    setAllF(p => p.filter(f => !ids.includes(f.taskId)));
    invalidateCache();
    const result = await deleteManyTasksAction(ids);
    if (checkAuthError(result)) return;
    if (result?.error) {
      if (removedT.length) setAllT(p => mergeRestore(p, prevTSnap, removedT));
      if (removedS.length) setAllS(p => mergeRestore(p, prevSSnap, removedS));
      if (removedL.length) setAllL(p => mergeRestore(p, prevLSnap, removedL));
      if (removedF.length) setAllF(p => mergeRestore(p, prevFSnap, removedF));
      showToast(result.error, 'error');
    } else {
      showToast(`已刪除 ${result.deleted} 筆任務`, 'error');
    }
    return result;
  }, [showToast, invalidateCache]);

  // ── Batch Update ──
  const updateManyTasks = useCallback(async (ids, field, value) => {
    const prevValues = new Map(allTRef.current.filter(t => ids.includes(t.id)).map(t => [t.id, t[field]]));
    setAllT(p => p.map(t => ids.includes(t.id) ? { ...t, [field]: value } : t));
    invalidateCache();
    const fieldMap = { task: 'task', status: 'status', category: 'category', owner: 'owner', priority: 'priority' };
    const result = await updateManyTasksAction(ids, { [fieldMap[field] || field]: value });
    if (checkAuthError(result)) return;
    if (result?.error) {
      setAllT(p => p.map(t => prevValues.has(t.id) ? { ...t, [field]: prevValues.get(t.id) } : t));
      showToast(result.error, 'error');
    } else {
      showToast(`已更新 ${result.updated} 筆任務`, 'success');
    }
    return result;
  }, [showToast, invalidateCache]);

  // ── Clean All ──
  const deleteAllTasks = useCallback(async () => {
    const result = await deleteAllTasksAction();
    if (checkAuthError(result)) return result;
    if (result?.success) {
      setAllT([]);
      setAllS([]);
      setAllL([]);
      setAllF([]);
      invalidateCache();
      showToast('所有任務已清除', 'error');
    }
    return result;
  }, [showToast, invalidateCache]);

  // ── Import (upsert) ──
  const importTasks = useCallback(async (csvTasks) => {
    const result = await upsertTasksAction(csvTasks);
    if (checkAuthError(result)) return result;
    if (result?.error) {
      showToast(result.error, 'error');
      return result;
    }
    showToast(`匯入完成：${result.updated} 筆更新、${result.inserted} 筆新增`, 'success');
    await loadData(true); // force refetch after import
    return result;
  }, [showToast, loadData]);

  // ── Reorder subtasks ──
  const reorderSubs = useCallback((taskId, activeId, overId) => {
    setAllS(prev => {
      const taskSubs = prev.filter(s => s.taskId === taskId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      const rest = prev.filter(s => s.taskId !== taskId);
      const oldIdx = taskSubs.findIndex(s => s.id === activeId);
      const newIdx = taskSubs.findIndex(s => s.id === overId);
      if (oldIdx === -1 || newIdx === -1) return prev;
      const [moved] = taskSubs.splice(oldIdx, 1);
      taskSubs.splice(newIdx, 0, moved);
      const reordered = taskSubs.map((s, i) => ({ ...s, sortOrder: i + 1 }));
      return [...rest, ...reordered];
    });
  }, []);

  // ── Reorder projects ──
  // orderedIds is computed purely from the current `projects` snapshot (via
  // runReorder/planProjectReorder) BEFORE awaiting persistence — never read out
  // of a setProjects updater side-effect. This is the BUG01 fix: the old code
  // relied on React executing the updater synchronously, which React does not
  // guarantee (updaters must be pure and run during render, twice in Strict
  // Mode), so the persist call was sometimes skipped and the order reverted on
  // refresh.
  const reorderProjects = useCallback(async (activeId, overId) => {
    const prevProjects = projects;
    invalidateCache();
    const outcome = await runReorder({
      projects,
      activeId,
      overId,
      setProjects,
      persist: reorderProjectsAction,
    });
    if (!outcome) return;
    if (checkAuthError(outcome.result)) return;
    if (outcome.result?.error) {
      setProjects(prevProjects);
      showToast(outcome.result.error, 'error');
    }
  }, [projects, showToast, invalidateCache]);

  // ── Computed: tasks with progress ──
  const twp = useMemo(() => {
    const progressMap = computeAllProgress(allS, allT);
    const projMap = new Map(projects.map(pr => [pr.id, pr.name]));
    return allT.map(t => {
      const p = progressMap.get(t.id) || { total: 0, done: 0, pct: 0 };
      return {
        ...t,
        project: projMap.get(t.projectId) || '',
        progress: t.status === '已完成' ? 100 : p.pct,
        sDone: p.done,
        sTotal: p.total,
        timeBased: p.timeBased || false,
        start: t.startDate,
        end: t.endDate,
      };
    });
  }, [allT, allS, projects]);

  const saveConfigOwners = useCallback(async (newOwners) => {
    setConfigOwners(newOwners);
    const result = await saveConfig('owners', newOwners);
    if (checkAuthError(result)) return;
    if (result?.error) showToast(result.error, 'error');
    else invalidateCache();
  }, [showToast, invalidateCache]);

  const saveConfigCats = useCallback(async (newCats) => {
    setConfigCats(newCats);
    const result = await saveConfig('categories', newCats);
    if (checkAuthError(result)) return;
    if (result?.error) showToast(result.error, 'error');
    else invalidateCache();
  }, [showToast, invalidateCache]);

  return {
    projects, setProjects,
    allT, setAllT, allS, setAllS,
    allL, setAllL, allF, setAllF,
    twp,
    loading, userRole,
    toast, showToast,
    toggleSub, updateTask, updateSub,
    addTask, deleteTask, addSub, deleteSub,
    addLink, deleteLink,
    addFile, deleteFile: deleteFileHandler,
    renameProject, addProject, deleteProject: deleteProjectHandler,
    reorderSubs, reorderProjects, importTasks,
    deleteManyTasks, updateManyTasks, deleteAllTasks,
    configCats, saveConfigCats, configOwners, saveConfigOwners,
    reload: loadData,
  };
}
