import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, X, Search, ArrowUpDown, ListChecks } from 'lucide-react';
import { CapsuleTabs, NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useTaskStore } from '@/stores/taskStore';
import { useSkillStore } from '@/stores/skillStore';
import * as skillService from '@/services/skillService';
import { isToday, isFuture, isOverdue } from '@/utils/dateFormat';
import type { Task, CompleteResult } from '@/types/task';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';
import type { CreateTaskData } from '@/components/tasks/CreateTaskModal';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import type { SaveData } from '@/components/tasks/TaskDetailPanel';
import { BatchOperationsBar } from '@/components/tasks/BatchOperationsBar';
import { TaskCard } from '@/components/tasks/TaskCard';
import { RewardPopup } from '@/components/tasks/RewardPopup';

// ========== 常量 ==========

const categories = [
  { id: 'wanxiang', label: '全部' },
  { id: 'jinchen', label: '今天' },
  { id: 'yuanyuan', label: '已完成' },
  { id: 'qixu', label: '进行中' },
  { id: 'chimu', label: '已过期' },
];


// ========== 过滤函数 ==========

function filterTasks(tasks: Task[], tabId: string, searchQuery: string): Task[] {
  let result: Task[];
  switch (tabId) {
    case 'wanxiang':
      result = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
      break;
    case 'jinchen':
      result = tasks.filter((t) => {
        if (t.status === 'completed' || t.status === 'cancelled') return false;
        if (t.scheduled_at && isToday(t.scheduled_at)) return true;
        if (!t.scheduled_at && t.deadline && isOverdue(t.deadline)) return true;
        return false;
      });
      break;
    case 'yuanyuan':
      result = tasks.filter((t) => t.status === 'completed');
      break;
    case 'qixu':
      result = tasks.filter((t) => {
        if (t.status === 'completed' || t.status === 'cancelled') return false;
        if (t.scheduled_at && isFuture(t.scheduled_at)) return true;
        if (t.deadline && isFuture(t.deadline)) return true;
        return false;
      });
      break;
    case 'chimu':
      result = tasks.filter((t) => {
        if (t.status === 'completed' || t.status === 'cancelled') return false;
        if (t.deadline && isOverdue(t.deadline)) return true;
        if (t.scheduled_at && isOverdue(t.scheduled_at)) return true;
        return false;
      });
      break;
    default:
      result = tasks;
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    result = result.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.notes && t.notes.toLowerCase().includes(q))
    );
  }

  return result;
}

// ========== Page ==========

export function TasksPage() {
  const appTheme = useAppTheme();
  const isMobile = useIsMobile();
  const txt = appTheme.ink;
  const txtLight = withAlpha(txt, 0.3);
  const txtMid = withAlpha(txt, 0.5);
  const txtMeta = withAlpha(txt, 0.4);
  const bgSubtle = withAlpha(txt, 0.05);
  // 列表状态
  const [activeCategory, setActiveCategory] = useState('wanxiang');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'deadline' | 'priority'>('created_at');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // 子任务
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [subtasksMap, setSubtasksMap] = useState<Map<string, Task[]>>(new Map());

  // 批量操作
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 创建
  const [showCreate, setShowCreate] = useState(false);

  // 详情面板
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailSubtasks, setDetailSubtasks] = useState<Task[]>([]);

  // Reward popup
  const [rewardResult, setRewardResult] = useState<CompleteResult | null>(null);

  // Toast
  const [toast, setToast] = useState('');
  // 确认
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const { tasks, isLoading, fetchTasks, completeTask, uncompleteTask, createTask, updateTask, deleteTask, fetchSubtasks } = useTaskStore();
  const { fetchSkills } = useSkillStore();

  useEffect(() => {
    fetchTasks();
    fetchSkills();
  }, [fetchTasks, fetchSkills]);

  // 过滤 + 排序
  const filteredTasks = useMemo(() => {
    let result = filterTasks(tasks, activeCategory, searchQuery);
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'deadline': {
          const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          return da - db;
        }
        case 'priority': {
          const pa = priorityOrder[a.priority ?? 'none'] ?? 3;
          const pb = priorityOrder[b.priority ?? 'none'] ?? 3;
          return pa - pb;
        }
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return result;
  }, [tasks, activeCategory, searchQuery, sortBy]);

  const showToast = (msg: string, duration = 4000) => {
    setToast(msg);
    setTimeout(() => setToast(''), duration);
  };

  // ========== 任务操作 ==========

  const openDetail = async (task: Task) => {
    setSelectedTask(task);
    try {
      const subs = await fetchSubtasks(task.id);
      setDetailSubtasks(subs);
    } catch { setDetailSubtasks([]); }
  };

  const closeDetail = () => {
    setSelectedTask(null);
    setDetailSubtasks([]);
  };

  const handleQuickComplete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const result = await completeTask(id);
      setRewardResult(result);
    } catch { showToast('操作失败，请重试', 3000); }
  };

  const handleSubtaskComplete = async (id: string) => {
    try {
      await completeTask(id);
      if (selectedTask) {
        const subs = await fetchSubtasks(selectedTask.id);
        setDetailSubtasks(subs);
      }
    } catch { showToast('操作失败，请重试', 3000); }
  };

  const toggleSubtasks = useCallback(async (taskId: string) => {
    if (expandedTasks.has(taskId)) {
      setExpandedTasks((prev) => { const next = new Set(prev); next.delete(taskId); return next; });
    } else {
      const subs = await fetchSubtasks(taskId);
      setSubtasksMap((prev) => new Map(prev).set(taskId, subs));
      setExpandedTasks((prev) => new Set(prev).add(taskId));
    }
  }, [expandedTasks, fetchSubtasks]);

  // ========== 创建 ==========

  const handleCreate = async (data: CreateTaskData) => {
    const task = await createTask({
      title: data.title,
      description: data.description,
      priority: data.priority,
      scheduled_at: data.scheduled_at,
      deadline: data.deadline,
      estimated_minutes: data.estimated_minutes,
      glow_reward: data.glow_reward,
      tags: data.tags,
    });
    const skillEntries = Object.entries(data.skillXps)
      .filter(([_, v]) => v > 0)
      .map(([skill_id, xp_amount]) => ({ skill_id, xp_amount }));
    if (skillEntries.length > 0) {
      await skillService.setTaskSkills(task.id, skillEntries);
    }
  };

  // ========== 详情面板操作 ==========

  const handleSave = async (id: string, data: SaveData) => {
    await updateTask(id, {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      deadline: data.deadline,
      scheduled_at: data.scheduled_at,
      estimated_minutes: data.estimated_minutes,
      notes: data.notes,
      tags: data.tags,
    });
    const skillEntries = Object.entries(data.skillXps)
      .filter(([_, v]) => v > 0)
      .map(([skill_id, xp_amount]) => ({ skill_id, xp_amount }));
    await skillService.setTaskSkills(id, skillEntries);
    showToast('已保存', 2000);
  };

  const handleCompleteFromDetail = async (id: string) => {
    const result = await completeTask(id);
    closeDetail();
    setRewardResult(result);
  };

  const handleUncompleteFromDetail = async (id: string) => {
    await uncompleteTask(id);
    closeDetail();
  };

  const handleDeleteFromDetail = async (id: string) => {
    await deleteTask(id);
    closeDetail();
  };

  const handleAddSubtask = async (title: string) => {
    if (!selectedTask) return;
    const subtask = await createTask({ title, parent_id: selectedTask.id });
    setDetailSubtasks((prev) => [...prev, subtask]);
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    await deleteTask(subtaskId);
    setDetailSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
  };

  // ========== 批量操作 ==========

  const handleBatchComplete = async () => {
    let ok = 0;
    for (const id of selectedIds) {
      const task = tasks.find((t) => t.id === id);
      if (task && task.status !== 'completed') {
        try { await completeTask(id); ok++; } catch { /* skip */ }
      }
    }
    if (ok > 0) showToast(`已完成 ${ok} 个任务`, 2000);
    setSelectedIds(new Set());
    setMultiSelectMode(false);
  };

  const executeBatchDelete = async () => {
    let ok = 0;
    for (const id of selectedIds) {
      try { await deleteTask(id); ok++; } catch { /* skip */ }
    }
    if (ok > 0) showToast(`已删除 ${ok} 个任务`, 2000);
    setSelectedIds(new Set());
    setMultiSelectMode(false);
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setShowBatchDeleteConfirm(true);
  };

  // ========== 渲染 ==========

  const emptyText: Record<string, string> = {
    yuanyuan: '暂无已完成的任务',
    jinchen: '今天没有待办事项',
    chimu: '没有过期的任务，真棒',
    qixu: '没有未来的计划',
    wanxiang: '暂无任务，点击右下角创建',
  };

  return (
    <PageContainer className="relative" style={{ '--ink-25': withAlpha(appTheme.ink, 0.25), '--ink-30': withAlpha(appTheme.ink, 0.3), '--primary': appTheme.primary, '--primary-30': withAlpha(appTheme.primary, 0.3), '--primary-87': withAlpha(appTheme.primary, 0.87) } as React.CSSProperties}>
      <NavBar title="任务" />

      {/* 固定控制区 */}
      <div className="flex-shrink-0 flex flex-col items-center px-4 sm:px-8 pt-6 pb-4 relative z-10">
        <div className="w-full max-w-[1000px]">
          <CapsuleTabs items={categories} activeId={activeCategory} onChange={setActiveCategory} accentColor={appTheme.primary} />
        </div>
        <div className="h-4" />
        <div className="w-full max-w-[1000px] flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: txtLight }} />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索任务..."
              className={`w-full rounded-full pl-11 pr-4 py-3 text-base focus:outline-none task-search-input transition-all ${isMobile ? '' : 'backdrop-blur-sm'}`}
              style={{ backgroundColor: withAlpha(appTheme.canvas, 0.6), color: txt }} />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: txtLight }}
                onMouseEnter={(e) => (e.currentTarget.style.color = txtMeta)}
                onMouseLeave={(e) => (e.currentTarget.style.color = txtLight)}>
                <X size={16} />
              </button>
            )}
          </div>
          <div className="relative">
            <button onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${isMobile ? '' : 'backdrop-blur-sm'}`}
              style={{ backgroundColor: withAlpha(appTheme.canvas, 0.6), color: txtMeta }}
              onMouseEnter={(e) => (e.currentTarget.style.color = txtMid)}
              onMouseLeave={(e) => (e.currentTarget.style.color = txtMeta)}
              title="排序"
              aria-label="排序方式">
              <ArrowUpDown size={18} />
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-2 rounded-2xl py-2 z-20 min-w-[140px]"
                  style={{ backgroundColor: appTheme.canvas }}>
                  {[
                    { value: 'created_at' as const, label: '创建时间' },
                    { value: 'deadline' as const, label: '截止时间' },
                    { value: 'priority' as const, label: '优先级' },
                  ].map((opt) => (
                    <button key={opt.value}
                      onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                      style={sortBy === opt.value ? { color: appTheme.primary, fontWeight: 500 } : { color: txtMeta }}
                      onMouseEnter={sortBy !== opt.value ? (e) => (e.currentTarget.style.backgroundColor = bgSubtle) : undefined}
                      onMouseLeave={sortBy !== opt.value ? (e) => (e.currentTarget.style.backgroundColor = 'transparent') : undefined}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={() => { setMultiSelectMode(!multiSelectMode); if (multiSelectMode) setSelectedIds(new Set()); }}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-colors"
            style={multiSelectMode
              ? { backgroundColor: appTheme.primary, color: appTheme.onPrimary }
              : { backgroundColor: withAlpha(appTheme.canvas, 0.6), color: txtMeta }}
            onMouseEnter={!multiSelectMode ? (e) => (e.currentTarget.style.color = txtMid) : undefined}
            onMouseLeave={!multiSelectMode ? (e) => (e.currentTarget.style.color = txtMeta) : undefined}
            title="批量操作"
            aria-label="批量操作">
            <ListChecks size={18} />
          </button>
        </div>
      </div>

      {/* 任务卡片列表 */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-4 sm:px-8 pb-8 relative z-10">
        <div className="w-full max-w-[1000px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><p className="text-lg" style={{ color: txtMeta }}>加载中...</p></div>
          ) : filteredTasks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  multiSelectMode={multiSelectMode}
                  isSelected={selectedIds.has(task.id)}
                  isExpanded={expandedTasks.has(task.id)}
                  subtasks={subtasksMap.get(task.id) ?? []}
                  onClick={openDetail}
                  onToggleSelect={(id) => setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return next;
                  })}
                  onQuickComplete={handleQuickComplete}
                  onToggleSubtasks={toggleSubtasks}
                  onSubtaskClick={openDetail}
                  onSubtaskComplete={handleQuickComplete}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-20">
              <p className="text-lg" style={{ color: txtMeta }}>{emptyText[activeCategory] || '暂无任务'}</p>
            </div>
          )}
        </div>
      </div>

      {/* 创建任务弹窗 */}
      <CreateTaskModal show={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />

      {/* 任务详情面板 */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          detailSubtasks={detailSubtasks}
          onClose={closeDetail}
          onSave={handleSave}
          onComplete={handleCompleteFromDetail}
          onUncomplete={handleUncompleteFromDetail}
          onDelete={handleDeleteFromDetail}
          onAddSubtask={handleAddSubtask}
          onCompleteSubtask={handleSubtaskComplete}
          onDeleteSubtask={handleDeleteSubtask}
        />
      )}

      {/* 批量操作栏 */}
      {multiSelectMode && (
        <BatchOperationsBar
          selectedCount={selectedIds.size}
          totalCount={filteredTasks.length}
          onSelectAll={() => setSelectedIds(new Set(filteredTasks.map((t) => t.id)))}
          onDeselectAll={() => setSelectedIds(new Set())}
          onBatchComplete={handleBatchComplete}
          onBatchDelete={handleBatchDelete}
          onCancel={() => { setMultiSelectMode(false); setSelectedIds(new Set()); }}
        />
      )}

      {/* 右下角加号按钮 */}
      {!multiSelectMode && (
        <button onClick={() => setShowCreate(true)}
          className="fixed bottom-[72px] right-8 z-30 w-14 h-14 rounded-full text-white active:scale-95 transition-all flex items-center justify-center task-fab">
          <Plus size={28} strokeWidth={2.5} />
        </button>
      )}

      {/* 批量删除确认 */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowBatchDeleteConfirm(false)}>
          <div className="rounded-2xl p-6 mx-4 w-[320px]" style={{ backgroundColor: appTheme.canvas }} onClick={(e) => e.stopPropagation()}>
            <p className="text-base mb-6" style={{ color: txtMid }}>确定要删除选中的 {selectedIds.size} 个任务吗？一旦删除，就不能回来了。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowBatchDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-2xl text-sm transition-colors"
                style={{ color: txtMid, backgroundColor: bgSubtle }}>
                取消
              </button>
              <button onClick={() => { executeBatchDelete(); setShowBatchDeleteConfirm(false); }}
                className="flex-1 py-2.5 rounded-2xl text-sm transition-colors"
                style={{ backgroundColor: appTheme.danger, color: '#fff' }}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-2xl text-sm max-w-[500px]"
          style={{ backgroundColor: appTheme.surfaceDark2, color: appTheme.ink }}>
          {toast}
        </div>
      )}

      {/* 结算卡片 */}
      <RewardPopup result={rewardResult} onClose={() => setRewardResult(null)} />

    </PageContainer>
  );
}
