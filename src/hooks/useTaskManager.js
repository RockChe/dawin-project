'use client';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { computeAllProgress } from '@/lib/utils';
import {
  getDashboardData,
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
  deleteManyTasks as deleteManyTasksAction,
  deleteAllTasks as deleteAllTasksAction,
} from '@/server/actions/tasks';
import { getSessionInfo } from '@/server/actions/auth';
import {
  getProjects,
  createProject as createProjectAction,
  updateProject as updateProjectAction,
  deleteProject as deleteProjectAction,
} from '@/server/actions/projects';
import { getConfigs, saveConfig } from '@/server/actions/config';

const DEFAULT_CATS = ['商務合作', '活動', '播出/開始', '行銷', '發行', '市場展'];

function checkAuthError(result) {
  if (result?.error === 'UNAUTHORIZED' || result?.error === 'FORBIDDEN') {
    window.location.href = '/login';
    return true;
  }
  return false;
}

export default function useTaskManager() {
  const [projects, setProjects] = useState([]);
  const [allT, setAllT] = useState([]);
  const [allS, setAllS] = useState([]);
  const [allL, setAllL] = useState([]);
  const [allF, setAllF] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type, fading: false });
    toastTimer.current = setTimeout(() => {
      setToast(prev => prev ? { ...prev, fading: true } : null);
      setTimeout(() => setToast(null), 300);
    }, 2200);
  }, []);

  const CACHE_KEY = 'dash_cache';

  const applyData = useCallback((dashData, projData, configsRes, sessionInfo) => {
    if (checkAuthError(dashData) || checkAuthError(projData)) return;
    if (sessionInfo?.role) setUserRole(sessionInfo.role);
    const tasksList = dashData.tasks || [];
    const subsList = dashData.subtasks || [];
    setAllT(tasksList);
    setAllS(subsList);
    setAllL(dashData.links || []);
    setAllF(dashData.files || []);
    setProjects(Array.isArray(projData) ? projData : []);

    // Owners: merge configured + unique owners from tasks/subtasks
    const taskOwners = tasksList.flatMap(t => (t.owner || '').split(',').map(o => o.trim()).filter(Boolean));
    const subOwners = subsList.map(s => s.owner).filter(Boolean);
    const dbOwners = Array.isArray(configsRes?.owners) ? configsRes.owners : [];
    const mergedOwners = [...new Set([...dbOwners, ...taskOwners, ...subOwners])];
    setConfigOwners(mergedOwners);

    // Categories: seed default if DB has no data
    const cats = configsRes?.categories;
    if (Array.isArray(cats) && cats.length > 0) {
      setConfigCats(cats);
    } else {
      setConfigCats(DEFAULT_CATS);
      saveConfig('categories', DEFAULT_CATS);
    }
  }, []);

  // Load data from server with SWR cache
  const loadData = useCallback(async () => {
    // Try to restore from sessionStorage cache first
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { dashData, projData, configsRes, sessionInfo } = JSON.parse(cached);
        applyData(dashData, projData, configsRes, sessionInfo);
        setLoading(false);
      }
    } catch {}

    // Always fetch fresh data from server
    try {
      const [dashData, projData, configsRes, sessionInfo] = await Promise.all([
        getDashboardData(),
        getProjects(),
        getConfigs(['owners', 'categories']),
        getSessionInfo(),
      ]);
      if (checkAuthError(dashData) || checkAuthError(projData) || checkAuthError(configsRes)) return;
      applyData(dashData, projData, configsRes, sessionInfo);

      // Update cache
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ dashData, projData, configsRes, sessionInfo }));
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

  useEffect(() => { loadData(); }, [loadData]);

  // ── Task CRUD ──
  const updateTask = useCallback(async (id, field, value) => {
    // Optimistic update
    setAllT(p => p.map(t => t.id === id ? { ...t, [field]: value } : t));
    invalidateCache();
    const updateData = {};
    // Map field names for the DB
    const fieldMap = { task: 'task', status: 'status', category: 'category', start: 'startDate', end: 'endDate', duration: 'duration', owner: 'owner', priority: 'priority', notes: 'notes' };
    const dbField = fieldMap[field] || field;
    updateData[dbField] = value;
    const result = await updateTaskAction(id, updateData);
    if (checkAuthError(result)) return;
    if (result?.error) showToast(result.error, 'error');
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
    setAllT(p => p.filter(t => t.id !== id));
    setAllS(p => p.filter(s => s.taskId !== id));
    setAllL(p => p.filter(l => l.taskId !== id));
    setAllF(p => p.filter(f => f.taskId !== id));
    invalidateCache();
    const result = await deleteTaskAction(id);
    if (checkAuthError(result)) return;
    showToast('任務已刪除', 'error');
  }, [showToast, invalidateCache]);

  // ── Subtask CRUD ──
  const toggleSub = useCallback(async (id) => {
    setAllS(p => p.map(s => s.id === id ? { ...s, done: !s.done, doneDate: !s.done ? new Date().toISOString().split('T')[0] : null } : s));
    invalidateCache();
    const result = await toggleSubtaskAction(id);
    if (checkAuthError(result)) return;
  }, [invalidateCache]);

  const updateSub = useCallback(async (id, field, value) => {
    setAllS(p => p.map(s => s.id === id ? { ...s, [field]: value } : s));
    const result = await updateSubtaskAction(id, { [field]: value });
    if (checkAuthError(result)) return;
  }, []);

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
    setAllS(p => p.filter(s => s.id !== id));
    invalidateCache();
    const result = await deleteSubtaskAction(id);
    if (checkAuthError(result)) return;
    showToast('子任務已刪除', 'error');
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
    setAllL(p => p.filter(l => l.id !== id));
    const result = await deleteLinkAction(id);
    if (checkAuthError(result)) return;
    showToast('連結已刪除', 'error');
  }, [showToast]);

  // ── File CRUD ──
  const addFile = useCallback((taskId, fileData) => {
    setAllF(p => [...p, fileData]);
    showToast('檔案已上傳', 'success');
  }, [showToast]);

  const deleteFileHandler = useCallback(async (id) => {
    setAllF(p => p.filter(f => f.id !== id));
    const result = await deleteFileAction(id);
    if (checkAuthError(result)) return;
    showToast('檔案已刪除', 'error');
  }, [showToast]);

  // ── Project CRUD ──
  const renameProject = useCallback(async (id, newName) => {
    if (!newName.trim()) return;
    setProjects(p => p.map(proj => proj.id === id ? { ...proj, name: newName } : proj));
    const result = await updateProjectAction(id, { name: newName });
    if (checkAuthError(result)) return;
    showToast('專案已重新命名', 'success');
  }, [showToast]);

  const addProject = useCallback(async (name) => {
    const formData = new FormData();
    formData.set('name', name);
    const result = await createProjectAction(formData);
    if (checkAuthError(result)) return;
    if (result?.success) {
      setProjects(p => [...p, result.project]);
      showToast('專案已建立', 'success');
    }
    return result;
  }, [showToast]);

  const deleteProjectHandler = useCallback(async (id) => {
    setProjects(p => p.filter(proj => proj.id !== id));
    setAllT(p => p.filter(t => t.projectId !== id));
    const result = await deleteProjectAction(id);
    if (checkAuthError(result)) return;
    showToast('專案已刪除', 'error');
  }, [showToast]);

  // ── Batch Delete ──
  const deleteManyTasks = useCallback(async (ids) => {
    setAllT(p => p.filter(t => !ids.includes(t.id)));
    setAllS(p => p.filter(s => !ids.includes(s.taskId)));
    setAllL(p => p.filter(l => !ids.includes(l.taskId)));
    setAllF(p => p.filter(f => !ids.includes(f.taskId)));
    invalidateCache();
    const result = await deleteManyTasksAction(ids);
    if (checkAuthError(result)) return;
    showToast(`已刪除 ${result.deleted} 筆任務`, 'error');
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
    await loadData();
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

  const [configCats, setConfigCats] = useState(DEFAULT_CATS);
  const [configOwners, setConfigOwners] = useState([]);

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
    reorderSubs, importTasks,
    deleteManyTasks, deleteAllTasks,
    configCats, saveConfigCats, configOwners, saveConfigOwners,
    reload: loadData,
  };
}
