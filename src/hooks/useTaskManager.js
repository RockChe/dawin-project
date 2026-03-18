'use client';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { computeProgress } from '@/lib/utils';
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
} from '@/server/actions/tasks';
import {
  getProjects,
  createProject as createProjectAction,
  updateProject as updateProjectAction,
  deleteProject as deleteProjectAction,
} from '@/server/actions/projects';

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
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type, fading: false });
    toastTimer.current = setTimeout(() => {
      setToast(prev => prev ? { ...prev, fading: true } : null);
      setTimeout(() => setToast(null), 300);
    }, 2200);
  }, []);

  // Load data from server
  const loadData = useCallback(async () => {
    try {
      const [dashData, projData] = await Promise.all([getDashboardData(), getProjects()]);
      if (checkAuthError(dashData) || checkAuthError(projData)) return;
      setAllT(dashData.tasks || []);
      setAllS(dashData.subtasks || []);
      setAllL(dashData.links || []);
      setAllF(dashData.files || []);
      setProjects(Array.isArray(projData) ? projData : []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load data:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Task CRUD ──
  const updateTask = useCallback(async (id, field, value) => {
    // Optimistic update
    setAllT(p => p.map(t => t.id === id ? { ...t, [field]: value } : t));
    const updateData = {};
    // Map field names for the DB
    const fieldMap = { task: 'task', status: 'status', category: 'category', start: 'startDate', end: 'endDate', duration: 'duration', owner: 'owner', priority: 'priority', notes: 'notes' };
    const dbField = fieldMap[field] || field;
    updateData[dbField] = value;
    const result = await updateTaskAction(id, updateData);
    if (checkAuthError(result)) return;
    if (result?.error) showToast(result.error, 'error');
  }, [showToast]);

  const addTask = useCallback(async (projectId, data) => {
    const result = await createTaskAction({ projectId, ...data });
    if (checkAuthError(result)) return;
    if (result?.success) {
      setAllT(p => [...p, result.task]);
      showToast('任務已建立', 'success');
    }
    return result;
  }, [showToast]);

  const deleteTask = useCallback(async (id) => {
    setAllT(p => p.filter(t => t.id !== id));
    setAllS(p => p.filter(s => s.taskId !== id));
    setAllL(p => p.filter(l => l.taskId !== id));
    setAllF(p => p.filter(f => f.taskId !== id));
    const result = await deleteTaskAction(id);
    if (checkAuthError(result)) return;
    showToast('任務已刪除', 'error');
  }, [showToast]);

  // ── Subtask CRUD ──
  const toggleSub = useCallback(async (id) => {
    setAllS(p => p.map(s => s.id === id ? { ...s, done: !s.done, doneDate: !s.done ? new Date().toISOString().split('T')[0] : null } : s));
    const result = await toggleSubtaskAction(id);
    if (checkAuthError(result)) return;
  }, []);

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
      showToast('子任務已新增', 'success');
    }
    return result;
  }, [showToast]);

  const deleteSub = useCallback(async (id) => {
    setAllS(p => p.filter(s => s.id !== id));
    const result = await deleteSubtaskAction(id);
    if (checkAuthError(result)) return;
    showToast('子任務已刪除', 'error');
  }, [showToast]);

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
  const twp = useMemo(() => allT.map(t => {
    const p = computeProgress(t.id, allS);
    const proj = projects.find(pr => pr.id === t.projectId);
    return {
      ...t,
      project: proj?.name || '',
      progress: t.status === '已完成' ? 100 : p.pct,
      sDone: p.done,
      sTotal: p.total,
      // Map DB fields to display fields
      start: t.startDate,
      end: t.endDate,
    };
  }), [allT, allS, projects]);

  const [configCats, setConfigCats] = useState(['商務合作', '活動', '播出/開始', '行銷', '發行', '市場展']);
  const [configOwners, setConfigOwners] = useState([]);

  return {
    projects, setProjects,
    allT, setAllT, allS, setAllS,
    allL, setAllL, allF, setAllF,
    twp,
    toast, showToast,
    toggleSub, updateTask, updateSub,
    addTask, deleteTask, addSub, deleteSub,
    addLink, deleteLink,
    addFile, deleteFile: deleteFileHandler,
    renameProject, addProject, deleteProject: deleteProjectHandler,
    reorderSubs,
    configCats, setConfigCats, configOwners, setConfigOwners,
    loading, reload: loadData,
  };
}
