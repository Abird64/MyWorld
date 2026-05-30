import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { TimelineDropdown } from '@/components/diary/TimelineDropdown';
import { ReflectionPanel } from '@/components/diary/ReflectionPanel';
import { useJournalStore } from '@/stores/journalStore';
import { SKILL_COLORS } from '@/styles/theme';
import { useAppTheme } from '@/stores/themeStore';
import type { CompleteResult } from '@/types/task';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatWeekday(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return WEEKDAYS[date.getDay()];
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function DiaryPage() {
  const appTheme = useAppTheme();
  const {
    currentDate,
    content,
    isLoading,
    isReflecting,
    error,
    showTimeline,
    showReflectionPanel,
    aiContent,
    xpResult,
    contacts,
    reflectionMood,
    reflectionTags,
    updateContent,
    loadToday,
    saveNow,
    setCurrentDate,
    toggleTimeline,
    completeDiary,
    removeContact,
    confirmAllContacts,
    setShowReflectionPanel,
  } = useJournalStore();

  const [xpToast, setXpToast] = useState<CompleteResult | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  useEffect(() => {
    return () => { saveNow(); };
  }, [saveNow]);

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  const handleRixing = async () => {
    await saveNow();
    const result = await completeDiary();
    if (result) {
      setXpToast(result.xp_result);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setXpToast(null), 4000);
    }
  };

  const handleSaveDraft = async () => {
    await saveNow();
  };

  const handlePrevDay = () => setCurrentDate(shiftDate(currentDate, -1));
  const handleNextDay = () => setCurrentDate(shiftDate(currentDate, 1));

  const wordCount = content.length;

  return (
    <PageContainer className="flex flex-col" bgColor={appTheme.canvasParchment}>
      <NavBar title="日记" />

      {/* 日期导航 */}
      <div className="flex-shrink-0 flex flex-col items-center pt-4 pb-2 gap-2">
        <div className="flex items-center gap-5">
          <button
            onClick={handlePrevDay}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{
              border: `1px solid ${appTheme.hairline}`,
              backgroundColor: appTheme.canvas,
              color: appTheme.inkMuted80,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = appTheme.canvasParchment)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = appTheme.canvas)}
          >
            <ChevronLeft size={18} />
          </button>

          <button
            onClick={toggleTimeline}
            className="flex flex-col items-center min-w-[120px] cursor-pointer"
          >
            {isLoading ? (
              <span className="text-sm" style={{ color: `${appTheme.ink}80` }}>加载中...</span>
            ) : (
              <>
                <span className="text-lg font-semibold" style={{ color: appTheme.ink }}>
                  {formatDisplayDate(currentDate)}
                </span>
                <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>
                  {formatWeekday(currentDate)}
                </span>
              </>
            )}
          </button>

          <button
            onClick={handleNextDay}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{
              border: `1px solid ${appTheme.hairline}`,
              backgroundColor: appTheme.canvas,
              color: appTheme.inkMuted80,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = appTheme.canvasParchment)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = appTheme.canvas)}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* 提灯总结按钮 */}
        <button
          onClick={async () => {
            useJournalStore.setState({ xpResult: null, contacts: [] });
            await useJournalStore.getState().fetchAiDiary();
            useJournalStore.getState().setShowReflectionPanel(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors text-sm"
          style={{ color: `${appTheme.ink}66` }}
          onMouseEnter={(e) => (e.currentTarget.style.color = appTheme.ink)}
          onMouseLeave={(e) => (e.currentTarget.style.color = `${appTheme.ink}66`)}
          title="查看提灯总结"
        >
          <span>✨</span>
          <span>提灯总结</span>
        </button>
      </div>

      {/* 时间线日历覆盖层 */}
      {showTimeline && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={toggleTimeline} />
          <div className="fixed top-28 left-1/2 -translate-x-1/2 z-50 w-full max-w-[1000px]">
            <TimelineDropdown />
          </div>
        </>
      )}

      {/* 日记正文 */}
      <div className="flex-1 flex flex-col overflow-hidden px-4 sm:px-8">
        <div className="flex-1 overflow-y-auto max-w-[800px] w-full mx-auto">
          <style>{`
            .diary-textarea::placeholder { color: ${appTheme.ink}4D; }
          `}</style>
          <textarea
            className="diary-textarea w-full h-full bg-transparent resize-none text-base focus:outline-none py-4"
            style={{
              color: appTheme.ink,
              caretColor: appTheme.primary,
              lineHeight: 1.8,
              minHeight: 'calc(100% - 40px)',
            }}
            placeholder="今天发生了什么值得记录的事？"
            value={content}
            onChange={(e) => updateContent(e.target.value)}
          />
        </div>
        <div className="flex-shrink-0 text-right py-2 max-w-[800px] w-full mx-auto">
          <span className="text-xs" style={{ color: `${appTheme.ink}4D` }}>{wordCount} 字</span>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div
        className="flex-shrink-0 flex gap-2 px-4 sm:px-8 py-3"
        style={{ borderTop: `0.5px solid ${appTheme.hairline}` }}
      >
        <button
          onClick={handleSaveDraft}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{
            border: `1px solid ${appTheme.hairline}`,
            backgroundColor: appTheme.canvas,
            color: appTheme.inkMuted80,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = appTheme.primary)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = appTheme.hairline)}
        >
          保存草稿
        </button>
        <button
          className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: appTheme.primary, color: '#fff' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = appTheme.primaryFocus)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = appTheme.primary)}
          onClick={handleRixing}
          disabled={isReflecting}
        >
          {isReflecting ? '思考中...' : '提灯总结'}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-2xl text-sm cursor-pointer"
          onClick={() => useJournalStore.setState({ error: null })}
        >
          {error}
        </div>
      )}

      {/* XP 结算浮窗 */}
      {xpToast && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div
            className="pointer-events-auto rounded-2xl px-8 py-6 animate-in fade-in zoom-in duration-300"
            style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}
            onClick={() => setXpToast(null)}
          >
            <p className="text-base font-medium text-center mb-4 tracking-wider" style={{ color: appTheme.ink }}>
              提灯总结完成
            </p>
            <div className="flex flex-wrap gap-3 justify-center mb-3">
              {xpToast.skill_xps.map((s) => {
                const color = SKILL_COLORS[s.skill_id]?.hex ?? '#999';
                return (
                  <div
                    key={s.skill_id}
                    className="rounded-full px-4 py-1.5 flex items-center gap-2"
                    style={{ backgroundColor: `${color}18` }}
                  >
                    <span className="text-sm" style={{ color }}>{s.skill_name}</span>
                    <span className="text-sm font-medium" style={{ color: appTheme.ink }}>+{s.xp}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-center" style={{ color: `${appTheme.ink}4D` }}>
              共获得 {xpToast.xp_earned} XP · 点击关闭
            </p>
          </div>
        </div>
      )}

      {/* 提灯总结面板 */}
      <ReflectionPanel
        show={showReflectionPanel}
        date={currentDate}
        xpResult={xpResult}
        reflection={aiContent}
        contacts={contacts}
        mood={reflectionMood}
        tags={reflectionTags}
        onClose={() => setShowReflectionPanel(false)}
        onContactSync={(index) => removeContact(index)}
        onContactIgnore={(index) => removeContact(index)}
        onConfirmAll={() => confirmAllContacts()}
      />
    </PageContainer>
  );
}
