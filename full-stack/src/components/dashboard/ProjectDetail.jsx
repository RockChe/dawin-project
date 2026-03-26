'use client';

import { useState } from 'react';
import { FM } from '@/lib/theme';
import { useTheme } from '@/components/ThemeProvider';
import { pD, fD, computeProgress } from '@/lib/utils';
import ProgressBar from './ProgressBar';

export default function ProjectDetail({ initialData }) {
  const { X, SC, PC, PJC } = useTheme();
  const { project, tasks, subtasks } = initialData;

  const tasksWithProgress = tasks.map(t => {
    const p = computeProgress(t.id, subtasks, t);
    return {
      ...t,
      progress: t.status === '已完成' ? 100 : p.pct,
      sDone: p.done,
      sTotal: p.total,
      timeBased: p.timeBased || false,
    };
  });

  const stats = {};
  Object.keys(SC).forEach(k => stats[k] = 0);
  tasksWithProgress.forEach(t => stats[t.status]++);

  const avgProg = tasksWithProgress.length === 0 ? 0
    : Math.round(tasksWithProgress.reduce((s, t) => s + t.progress, 0) / tasksWithProgress.length);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <a href="/dashboard" style={{ fontSize: 13, color: X.textDim, textDecoration: 'none' }}>← 返回儀表板</a>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: X.text, marginTop: 8 }}>{project.name}</h1>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 24 }}>
        {Object.entries(SC).map(([k, c]) => (
          <div key={k} style={{ background: X.surface, borderRadius: 12, padding: '12px 16px', border: `1px solid ${X.border}` }}>
            <div style={{ fontSize: 13, color: X.textSec, marginBottom: 4 }}>{k}</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FM, color: c.color }}>{stats[k] || 0}</div>
          </div>
        ))}
        <div style={{ background: X.surface, borderRadius: 12, padding: '12px 16px', border: `1px solid ${X.border}` }}>
          <div style={{ fontSize: 13, color: X.textSec, marginBottom: 4 }}>整體進度</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FM, color: X.accent }}>{avgProg}%</div>
        </div>
      </div>

      {/* Tasks */}
      <div style={{ background: X.surface, borderRadius: 12, border: `1px solid ${X.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${X.border}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>任務列表</h3>
        </div>
        {tasksWithProgress.map(task => {
          const sc = SC[task.status] || {};
          const pc = PC[task.priority] || {};
          const tSubs = subtasks.filter(s => s.taskId === task.id);

          return (
            <div key={task.id} style={{ padding: '14px 20px', borderBottom: `1px solid ${X.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: pc.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: X.text, marginBottom: 4 }}>{task.task}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, padding: '1px 8px', borderRadius: 10, background: sc.bg, color: sc.color, fontWeight: 600 }}>{task.status}</span>
                  {task.category && <span style={{ fontSize: 12, color: X.textDim }}>{task.category}</span>}
                  {task.owner && <span style={{ fontSize: 12, color: X.textSec }}>{task.owner}</span>}
                  {task.startDate && <span style={{ fontSize: 12, color: X.textDim, fontFamily: FM }}>{fD(task.startDate)} → {fD(task.endDate)}</span>}
                </div>
                {(tSubs.length > 0 || task.timeBased) && (
                  <div style={{ marginTop: 6, maxWidth: 200 }}>
                    <ProgressBar pct={task.progress} done={task.sDone} total={task.sTotal} timeBased={task.timeBased} />
                  </div>
                )}
              </div>
              <div style={{ fontFamily: FM, fontSize: 14, fontWeight: 600, color: task.progress === 100 ? X.green : X.accent }}>{task.progress}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
