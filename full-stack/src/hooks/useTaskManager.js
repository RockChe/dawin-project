'use client';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { computeAllProgress } from '@/lib/utils';
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

const DEFAULT_CATS = ['商務合作', '活動', '播出/開始', '行銷', '發行', '市場展'];
const CACHE_KEY = 'dash_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function checkAuthError(result) {
  if (result?.error === 'UNAUTHORIZED' || result?.error === 'FORBIDDEN') {
    window.location.href = '/login';
    return true;
  }
  return false;
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
  const initialDataApplied = useRef(!!initialData);

  const [configCats, setConfigCats] = useState(DEFAULT_CATS);
  const [configOwners, setConfigOwners] = useState([]);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type, fading: false });
    toastTimer.current = setTimeout(() => {
      setToast(prev => prev ? { ...prev, fading: true } : null);
      toastTimer.current = setTimeout(() => setToast(null), 300);
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
    };
  }, [loadData, initialData]);

  // ── Task CRUD ──
  const updateTask = useCallback(async (id, field, value) => {
    let prev;
    setAllT(p => { prev = p; return p.map(t => t.id === id ? { ...t, [field]: value } : t); });
    invalidateCache();
    const updateData = {};
    const fieldMap = { task: 'task', status: 'status', category: 'category', start: 'startDate', end: 'endDate', duration: 'duration', owner: 'owner', priority: 'priority', notes: 'notes' };
    const dbField = fieldMap[field] || field;
    updateData[dbField] = value;
    const result = await updateTaskAction(id, updateData);
    if (checkAuthError(result)) return;
    if (result?.error) {
      setAllT(prev);
      showToast(result.error, 'error');
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
    let prevT, prevS, prevL, prevF;
    setAllT(p => { prevT = p; return p.filter(t => t.id !== id); });
    setAllS(p => { prevS = p; return p.filter(s => s.taskId !== id); });
    setAllL(p => { prevL = p; return p.filter(l => l.taskId !== id); });
    setAllF(p => { prevF = p; return p.filter(f => f.taskId !== id); });
    invalidateCache();
    const result = await deleteTaskAction(id);
    if (checkAuthError(result)) return;
    if (result?.error) {
      setAllT(prevT); setAllS(prevS); setAllL(prevL); setAllF(prevF);
      showToast(result.error, 'error');
    } else {
      showToast('任務已刪除', 'error');
    }
  }, [showToast, invalidateCache]);

  // ── Subtask CRUD ──
  const toggleSub = useCallback(async (id) => {
    let prev;
    setAllS(p => { prev = p; return p.map(s => s.id === id ? { ...s, done: !s.done, doneDate: !s.done ? new Date().toISOString().split('T')[0] : null } : s); });
    invalidateCache();
    const result = await toggleSubtaskAction(id);
    if (checkAuthError(result)) return;
    if (result?.error) {
      setAllS(prev);
      showToast(result.error, 'error');
    }
  }, [invalidateCache, showToast]);

  const updateSub = useCallback(async (id, field, value) => {
    let prev;
    setAllS(p => { prev = p; return p.map(s => s.id === id ? { ...s, [field]: value } : s); });
    invalidateCache();
    const result = await updateSubtaskAction(id, { [field]: value });
    if (checkAuthError(result)) return;
    if (result?.error) {
      setAllS(prev);
      showToast(result.error, 'error');
    }
  }, [invalidateCache, showToast]);

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
    let prev;
    setAllS(p => { prev = p; return p.filter(s => s.id !== id); });
    invalidateCache();
    const result = await deleteSubtaskAction(id);
    if (checkAuthError(result)) return;
    if (result?.error) {
      setAllS(prev);
      showToast(result.error, 'error');
    } else {
      showToast('子任務已刪除', 'error');
    }
  }, [showToast, invalidateCache]);

  // ── Link CRUD ──
  const addLink = useCallback(async (taskId, data) => {
    const result = await createLinkAction({ taskId, ...data });
    if (checkAuthError(result)) return;
    if (result?.success) {
      setAllL(p => [...p, result.link]);
      showToast('連結已新增', 'success');
    }
    return result;
  }, [showToast]);

  const deleteLink = useCallback(async (id) => {
    let prev;
    setAllL(p => { prev = p; return p.filter(l => l.id !== id); });
    invalidateCache();
    const result = await deleteLinkAction(id);
    if (checkAuthError(result)) return;
    if (result?.error) {
      setAllL(prev);
      showToast(result.error, 'error');
    } else {
      showToast('連結已刪除', 'error');
    }
  }, [showToast, invalidateCache]);

  // ── File CRUD ──
  const addFile = useCallback((taskId, fileData) => {
    setAllF(p => [...p, fileData]);
    showToast('檔案已上傳', 'success');
  }, [showToast]);

  const deleteFileHandler = useCallback(async (id) => {
    let prev;
    setAllF(p => { prev = p; return p.filter(f => f.id !== id); });
    invalidateCache();
    const result = await deleteFileAction(id);
    if (checkAuthError(result)) return;
    if (result?.error) {
      setAllF(prev);
      showToast(result.error, 'error');
    } else {
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
    let prevProj, prevT;
    setProjects(p => { prevProj = p; return p.filter(proj => proj.id !== id); });
    setAllT(p => { prevT = p; return p.filter(t => t.projectId !== id); });
    invalidateCache();
    const result = await deleteProjectAction(id);
    if (checkAuthError(result)) return;
    if (result?.error) {
      setProjects(prevProj); setAllT(prevT);
      showToast(result.error, 'error');
    } else {
      showToast('專案已刪除', 'error');
    }
  }, [showToast, invalidateCache]);

  // ── Batch Delete ──
  const deleteManyTasks = useCallback(async (ids) => {
    let prevT, prevS, prevL, prevF;
    setAllT(p => { prevT = p; return p.filter(t => !ids.includes(t.id)); });
    setAllS(p => { prevS = p; return p.filter(s => !ids.includes(s.taskId)); });
    setAllL(p => { prevL = p; return p.filter(l => !ids.includes(l.taskId)); });
    setAllF(p => { prevF = p; return p.filter(f => !ids.includes(f.taskId)); });
    invalidateCache();
    const result = await deleteManyTasksAction(ids);
    if (checkAuthError(result)) return;
    if (result?.error) {
      setAllT(prevT); setAllS(prevS); setAllL(prevL); setAllF(prevF);
      showToast(result.error, 'error');
    } else {
      showToast(`已刪除 ${result.deleted} 筆任務`, 'error');
    }
    return result;
  }, [showToast, invalidateCache]);

  // ── Batch Update ──
  const updateManyTasks = useCallback(async (ids, field, value) => {
    let prevT;
    setAllT(p => { prevT = p; return p.map(t => ids.includes(t.id) ? { ...t, [field]: value } : t); });
    invalidateCache();
    const fieldMap = { task: 'task', status: 'status', category: 'category', owner: 'owner', priority: 'priority' };
    const result = await updateManyTasksAction(ids, { [fieldMap[field] || field]: value });
    if (checkAuthError(result)) return;
    if (result?.error) {
      setAllT(prevT);
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
  const reorderProjects = useCallback(async (activeId, overId) => {
    let prevProjects;
    let orderedIds;
    setProjects(p => {
      prevProjects = [...p];
      const sorted = [...p].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      const oldIdx = sorted.findIndex(pr => pr.id === activeId);
      const newIdx = sorted.findIndex(pr => pr.id === overId);
      if (oldIdx === -1 || newIdx === -1) return p;
      const [moved] = sorted.splice(oldIdx, 1);
      sorted.splice(newIdx, 0, moved);
      orderedIds = sorted.map(pr => pr.id);
      return sorted.map((pr, i) => ({ ...pr, sortOrder: i + 1 }));
    });
    invalidateCache();
    if (!orderedIds) return;
    const result = await reorderProjectsAction(orderedIds);
    if (checkAuthError(result)) return;
    if (result?.error) {
      setProjects(prevProjects);
      showToast(result.error, 'error');
    }
  }, [showToast, invalidateCache]);

  // ── Computed: tasks with progress ──
  const twp = useMemo(() => {
    const progressMap = computeAllProgress(allS);
    const projMap = new Map(projects.map(pr => [pr.id, pr.name]));
    return allT.map(t => {
      const p = progressMap.get(t.id) || { total: 0, done: 0, pct: 0 };
      return {
        ...t,
        project: projMap.get(t.projectId) || '',
        progress: t.status === '已完成' ? 100 : p.pct,
        sDone: p.done,
        sTotal: p.total,
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
  }, [showToast]);

  const saveConfigCats = useCallback(async (newCats) => {
    setConfigCats(newCats);
    const result = await saveConfig('categories', newCats);
    if (checkAuthError(result)) return;
    if (result?.error) showToast(result.error, 'error');
  }, [showToast]);

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
