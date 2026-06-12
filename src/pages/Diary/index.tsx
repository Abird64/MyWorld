import { useEffect, useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react';
import { NavBar, ImageViewer } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { TimelineDropdown } from '@/components/diary/TimelineDropdown';
import { ReflectionPanel } from '@/components/diary/ReflectionPanel';
import { useJournalStore } from '@/stores/journalStore';
import { SKILL_COLORS } from '@/styles/theme';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
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
    images,
    imageDataCache,
    updateContent,
    loadToday,
    saveNow,
    setCurrentDate,
    toggleTimeline,
    completeDiary,
    removeContact,
    confirmAllContacts,
    setShowReflectionPanel,
    uploadImage,
    deleteImage,
    loadImageData,
  } = useJournalStore();

  const [xpToast, setXpToast] = useState<CompleteResult | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

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

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        await uploadImage(file);
      }
    }
    e.target.value = '';
  }, [uploadImage]);

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
              <span className="text-sm" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>加载中...</span>
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
          style={{ color: `${withAlpha(appTheme.ink, 0.4)}` }}
          onMouseEnter={(e) => (e.currentTarget.style.color = appTheme.ink)}
          onMouseLeave={(e) => (e.currentTarget.style.color = `${withAlpha(appTheme.ink, 0.4)}`)}
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
            .diary-textarea::placeholder { color: ${withAlpha(appTheme.ink, 0.3)}; }
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
          <span className="text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.3)}` }}>{wordCount} 字</span>
        </div>

        {/* 图片附件区 */}
        <div className="flex-shrink-0 max-w-[800px] w-full mx-auto pb-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageSelect}
          />
          {/* 图片缩略图网格 */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {images.map((img) => {
                const cachedSrc = imageDataCache[img.id];
                if (!cachedSrc) {
                  // 懒加载图片数据
                  loadImageData(img.id, img.file_path);
                }
                return (
                  <div key={img.id} className="relative group/thumb">
                    {cachedSrc ? (
                      <img
                        src={cachedSrc}
                        alt={img.file_name}
                        className="w-16 h-16 rounded-lg object-cover cursor-pointer"
                        style={{ border: `1px solid ${withAlpha(appTheme.ink, 0.1)}` }}
                        onClick={() => setViewingImage(cachedSrc)}
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: withAlpha(appTheme.ink, 0.05) }}
                      >
                        <ImagePlus size={16} style={{ color: withAlpha(appTheme.ink, 0.2) }} />
                      </div>
                    )}
                    <button
                      onClick={() => deleteImage(img.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-black/60 text-white"
                      aria-label="删除图片"
                    >
                      <X size={12} />
                    </button>
                    <button
                      onClick={() => deleteImage(img.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-black/60 text-white"
                      aria-label="删除图片"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {/* 添加图片按钮 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{
              color: withAlpha(appTheme.ink, 0.4),
              border: `1px dashed ${withAlpha(appTheme.ink, 0.2)}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = appTheme.ink;
              e.currentTarget.style.borderColor = appTheme.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = withAlpha(appTheme.ink, 0.4);
              e.currentTarget.style.borderColor = withAlpha(appTheme.ink, 0.2);
            }}
          >
            <ImagePlus size={14} />
            添加图片
          </button>
        </div>
      </div>

      {/* 图片查看大图 */}
      <ImageViewer
        src={viewingImage}
        onClose={() => setViewingImage(null)}
      />

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
          style={{ backgroundColor: appTheme.primary, color: appTheme.onPrimary }}
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
                    style={{ backgroundColor: `${withAlpha(color, 0.09)}` }}
                  >
                    <span className="text-sm" style={{ color }}>{s.skill_name}</span>
                    <span className="text-sm font-medium" style={{ color: appTheme.ink }}>+{s.xp}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-4">
              <span className="text-sm font-medium" style={{ color: '#D4A843' }}>
                +{xpToast.glow_earned} 萤火
              </span>
              <span className="text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.3)}` }}>
                {xpToast.xp_earned} XP · 点击关闭
              </span>
            </div>
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
