import { useEffect, useState, useRef } from 'react';
import { Card, NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { TimelineDropdown } from '@/components/diary/TimelineDropdown';
import { ReflectionPanel } from '@/components/diary/ReflectionPanel';
import { useJournalStore } from '@/stores/journalStore';
import { SKILL_COLORS } from '@/styles/theme';
import { appTheme } from '@/styles/theme';
import type { CompleteResult } from '@/types/task';


const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return `${dateStr} ${WEEKDAYS[date.getDay()]}`;
}

export function DiaryPage() {
  const {
    currentDate,
    content,
    isLoading,
    isSaving,
    isReflecting,
    lastSaved,
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
    toggleTimeline,
    completeDiary,
    removeContact,
    confirmAllContacts,
    setShowReflectionPanel,
  } = useJournalStore();

  // 日记结算浮窗
  const [xpToast, setXpToast] = useState<CompleteResult | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初始化：加载今日日记
  useEffect(() => {
    loadToday();
  }, [loadToday]);

  // 卸载前强制保存
  useEffect(() => {
    return () => {
      saveNow();
    };
  }, [saveNow]);

  // 清理 toast 计时器
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const handleRixing = async () => {
    await saveNow();
    const result = await completeDiary();
    if (result) {
      // 显示 XP 结算浮窗
      setXpToast(result.xp_result);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setXpToast(null), 4000);
    }
  };

  return (
    <PageContainer className="relative" bgColor={appTheme.canvasParchment}>
      <NavBar title="日记" />

      {/* 固定控制区：日期胶囊 */}
      <div className="flex-shrink-0 flex flex-col items-center pt-6 pb-3">
        {/* 日期胶囊 - 可点击打开时间线 */}
        <div className="flex justify-center px-4 sm:px-8 w-full">
          <div className="max-w-[1000px] flex-1">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTimeline}
                className="min-w-[200px] py-4 rounded-full px-10 flex items-center justify-center transition-colors cursor-pointer"
                style={{ backgroundColor: appTheme.canvas }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = appTheme.canvasParchment)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = appTheme.canvas)}
              >
                {isLoading ? (
                  <span className=" text-xl" style={{ color: `${appTheme.ink}80` }}>加载中...</span>
                ) : (
                  <span className=" text-xl" style={{ color: appTheme.ink }}>
                    {formatDisplayDate(currentDate)}
                  </span>
                )}
              </button>

              {/* 日省详情按钮 */}
              <button
                onClick={async () => {
                  // 获取已保存的 AI 日记并打开面板（清除上次日省的 XP/联系人数据）
                  useJournalStore.setState({ xpResult: null, contacts: [] });
                  await useJournalStore.getState().fetchAiDiary();
                  useJournalStore.getState().setShowReflectionPanel(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full transition-colors text-sm"
                style={{ color: `${appTheme.ink}66` }}
                onMouseEnter={(e) => (e.currentTarget.style.color = appTheme.ink)}
                onMouseLeave={(e) => (e.currentTarget.style.color = `${appTheme.ink}66`)}
                title="查看日省详情"
              >
                <span className="text-base">✨</span>
                <span className="">日省详情</span>
              </button>

              {/* 保存状态指示 */}
              {isSaving && (
                <span className=" text-sm" style={{ color: `${appTheme.ink}4D` }}>保存中...</span>
              )}
              {!isSaving && lastSaved && (
                <span className=" text-sm" style={{ color: `${appTheme.ink}4D` }}>已保存</span>
              )}
            </div>
          </div>
        </div>
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
      <div className="flex-1 flex justify-center items-center px-4 sm:px-8 pb-20">
        <style>{`
          .diary-textarea::placeholder { color: ${appTheme.ink}4D; }
        `}</style>
        <Card
          variant="diary"
          className="w-full max-w-[1000px] h-[400px] sm:h-[600px]"
          style={{ backgroundColor: appTheme.canvas }}
        >
          <textarea
            className="diary-textarea w-full h-full bg-transparent resize-none text-xl focus:outline-none p-4"
            style={{ color: appTheme.ink, caretColor: appTheme.primary }}
            placeholder="在此记录今日点滴..."
            value={content}
            onChange={(e) => updateContent(e.target.value)}
          />
        </Card>
      </div>

      {/* 日省按钮 */}
      <div className="absolute right-4 sm:right-20 bottom-4 sm:bottom-20">
        <button
          className="w-[100px] h-[60px] rounded-full flex items-center justify-center transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: appTheme.primary }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = appTheme.primaryFocus)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = appTheme.primary)}
          onClick={handleRixing}
          disabled={isReflecting}
        >
          <span className=" text-xl text-white">
            {isReflecting ? '思考中...' : '日省'}
          </span>
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
            style={{ backgroundColor: appTheme.surfaceBlack }}
            onClick={() => setXpToast(null)}
          >
            <p className=" text-xl text-white/90 text-center mb-4 tracking-widest">
              日省完成
            </p>
            <div className="flex flex-wrap gap-3 justify-center mb-3">
              {xpToast.skill_xps.map((s) => {
                const color = SKILL_COLORS[s.skill_id]?.hex ?? '#999';
                return (
                  <div
                    key={s.skill_id}
                    className="rounded-full px-4 py-1.5 flex items-center gap-2"
                    style={{ backgroundColor: `${color}30` }}
                  >
                    <span className=" text-sm" style={{ color }}>{s.skill_name}</span>
                    <span className=" text-sm text-white/80">+{s.xp}</span>
                  </div>
                );
              })}
            </div>
            <p className=" text-sm text-white/40 text-center">
              共获得 {xpToast.xp_earned} XP · 点击关闭
            </p>
          </div>
        </div>
      )}

      {/* 日省详情面板 */}
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
