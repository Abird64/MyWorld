import { useState, useEffect, useCallback } from 'react';
import { PageContainer } from '@/components/layout';
import { NavBar } from '@/components/ui';
import { HabitCard } from '@/components/habits/HabitCard';
import { CreateHabitModal } from '@/components/habits/CreateHabitModal';
import { HabitHeatmap } from '@/components/habits/HabitHeatmap';
import { useHabitStore } from '@/stores/habitStore';
import { useAppTheme } from '@/stores/themeStore';
import { Plus } from 'lucide-react';
import type { HabitWithStreak, CreateHabitInput, UpdateHabitInput } from '@/types/habit';

export function HabitsPage() {
  const appTheme = useAppTheme();
  const { habits, weekMatrix, fetchAll, checkHabit, uncheckHabit, createHabit, updateHabit, deleteHabit } = useHabitStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<HabitWithStreak | null>(null);
  const [viewingDetail, setViewingDetail] = useState<HabitWithStreak | null>(null);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleToggle = useCallback((habitId: string, checked: boolean) => {
    if (checked) {
      uncheckHabit(habitId);
    } else {
      checkHabit(habitId);
    }
  }, [checkHabit, uncheckHabit]);

  const handleSubmit = useCallback(async (input: CreateHabitInput | (UpdateHabitInput & { id: string })) => {
    if ('id' in input) {
      const { id, ...rest } = input;
      await updateHabit(id, rest);
    } else {
      await createHabit(input);
    }
    setShowForm(false);
    setEditing(null);
  }, [createHabit, updateHabit]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteHabit(id);
    setShowForm(false);
    setEditing(null);
  }, [deleteHabit]);

  // 今日概览
  const todayChecked = habits.filter((h) => h.checked_today).length;
  const totalHabits = habits.length;

  return (
    <PageContainer className="relative">
      <NavBar title="习惯" />

      <div className="flex-1 overflow-y-auto flex flex-col items-center px-4 sm:px-8 pt-6 pb-8 relative z-10">
        <div className="w-full max-w-[1000px] space-y-6">
          {/* 今日概览 */}
          {totalHabits > 0 && (
            <div className="rounded-[18px] p-4 flex items-center gap-4" style={{ backgroundColor: `${appTheme.primary}12`, border: `0.5px solid ${appTheme.hairline}` }}>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                style={{ backgroundColor: appTheme.primary, color: appTheme.ink }}
              >
                {todayChecked}/{totalHabits}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: appTheme.ink }}>今日进度</p>
                <p className="text-xs" style={{ color: `${appTheme.ink}66` }}>
                  {todayChecked === totalHabits ? '全部完成！继续加油' : `还有 ${totalHabits - todayChecked} 个习惯待打卡`}
                </p>
              </div>
            </div>
          )}

          {/* 习惯卡片网格 */}
          {totalHabits > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {habits.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  weekMatrix={weekMatrix.find((w) => w.habit_id === habit.id)}
                  onToggle={handleToggle}
                  onEdit={(h) => { setEditing(h); setShowForm(true); }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] p-12 text-center space-y-4" style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}>
              <p className="text-lg" style={{ color: `${appTheme.ink}66` }}>还没有习惯</p>
              <button
                onClick={() => { setEditing(null); setShowForm(true); }}
                className="px-5 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2"
                style={{ backgroundColor: appTheme.primary, color: appTheme.ink }}
              >
                <Plus size={18} /> 创建第一个习惯
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      {totalHabits > 0 && (
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="fixed bottom-[72px] right-8 z-30 w-14 h-14 rounded-full text-white active:scale-95 transition-all flex items-center justify-center"
          style={{ backgroundColor: appTheme.primary }}
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      )}

      {/* 创建/编辑弹窗 */}
      {showForm && (
        <CreateHabitModal
          editing={editing}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onDelete={editing ? () => handleDelete(editing.id) : undefined}
        />
      )}

      {/* 热力图详情 */}
      {viewingDetail && (
        <HabitHeatmap
          habit={viewingDetail}
          onClose={() => setViewingDetail(null)}
        />
      )}
    </PageContainer>
  );
}
