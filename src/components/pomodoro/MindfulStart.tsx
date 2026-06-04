import { useState } from 'react';
import { X, Check, Sparkles, Wind, Timer } from 'lucide-react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { FOCUS_COLOR } from '@/styles/theme';
import { generateMindfulSteps, type MindfulStep } from '@/services/mindfulService';

interface MindfulStartProps {
  open: boolean;
  onClose: () => void;
  taskTitle: string;
  taskDescription?: string;
  taskId?: string;
}

type Screen = 'intro' | 'steps' | 'done';

export function MindfulStart({ open, onClose, taskTitle, taskDescription, taskId }: MindfulStartProps) {
  const appTheme = useAppTheme();
  const { startFocus } = usePomodoroStore();
  const [screen, setScreen] = useState<Screen>('intro');
  const [steps, setSteps] = useState<MindfulStep[]>([]);

  const completedCount = steps.filter((s) => s.completed).length;
  const allDone = steps.length > 0 && completedCount === steps.length;

  const handleStart = () => {
    const generated = generateMindfulSteps(taskTitle, taskDescription);
    setSteps(generated);
    setScreen('steps');
  };

  const handleToggle = (id: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
    );
  };

  const handleFinish = () => {
    setScreen('done');
  };

  const handleStartPomodoro = () => {
    startFocus(taskId, taskTitle);
    handleClose();
  };

  const handleClose = () => {
    setScreen('intro');
    setSteps([]);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        className="relative w-[360px] max-h-[80vh] rounded-3xl overflow-hidden"
        style={{ backgroundColor: appTheme.canvas }}
      >
        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-full transition-colors z-10"
          style={{ color: appTheme.inkMuted48 }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(appTheme.ink, 0.06))}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <X size={18} />
        </button>

        {/* 引导屏 */}
        {screen === 'intro' && (
          <div className="flex flex-col items-center px-8 pt-12 pb-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: withAlpha(FOCUS_COLOR, 0.12) }}
            >
              <Wind size={28} style={{ color: FOCUS_COLOR }} />
            </div>

            <h3
              className="text-xl font-semibold mb-2 text-center"
              style={{ color: appTheme.ink }}
            >
              正念启动
            </h3>
            <p
              className="text-sm text-center mb-2 leading-relaxed"
              style={{ color: appTheme.inkMuted48 }}
            >
              不想开始没关系，让我们从小事做起。
            </p>
            <p
              className="text-xs text-center mb-8 leading-relaxed"
              style={{ color: appTheme.inkMuted48 }}
            >
              「{taskTitle}」
            </p>

            <button
              onClick={handleStart}
              className="w-full py-3 rounded-2xl text-white text-base transition-all flex items-center justify-center gap-2"
              style={{
                backgroundColor: FOCUS_COLOR,
                boxShadow: `0 4px 20px ${withAlpha(FOCUS_COLOR, 0.3)}`,
              }}
            >
              <Sparkles size={16} />
              深呼吸，开始引导
            </button>
          </div>
        )}

        {/* 步骤屏 */}
        {screen === 'steps' && (
          <div className="flex flex-col px-8 pt-8 pb-6">
            <h3
              className="text-lg font-semibold mb-1 text-center"
              style={{ color: appTheme.ink }}
            >
              跟着做就好
            </h3>
            <p
              className="text-xs text-center mb-6"
              style={{ color: appTheme.inkMuted48 }}
            >
              {completedCount} / {steps.length} 步已完成
            </p>

            {/* 进度条 */}
            <div
              className="w-full h-1.5 rounded-full overflow-hidden mb-6"
              style={{ backgroundColor: withAlpha(FOCUS_COLOR, 0.1) }}
            >
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${steps.length > 0 ? (completedCount / steps.length) * 100 : 0}%`,
                  backgroundColor: FOCUS_COLOR,
                }}
              />
            </div>

            {/* 步骤列表 */}
            <div className="space-y-3 mb-6">
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => handleToggle(step.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left"
                  style={{
                    backgroundColor: step.completed
                      ? withAlpha(FOCUS_COLOR, 0.08)
                      : withAlpha(appTheme.ink, 0.03),
                    border: `1px solid ${step.completed ? withAlpha(FOCUS_COLOR, 0.2) : 'transparent'}`,
                  }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      backgroundColor: step.completed ? FOCUS_COLOR : 'transparent',
                      border: step.completed ? 'none' : `1.5px solid ${appTheme.inkMuted48}`,
                    }}
                  >
                    {step.completed && <Check size={12} color="#fff" />}
                  </div>
                  <span
                    className="text-sm"
                    style={{
                      color: step.completed ? appTheme.ink : appTheme.inkMuted80,
                      textDecoration: step.completed ? 'line-through' : 'none',
                    }}
                  >
                    {step.text}
                  </span>
                </button>
              ))}
            </div>

            {/* 完成按钮 */}
            {allDone && (
              <button
                onClick={handleFinish}
                className="w-full py-3 rounded-2xl text-white text-base transition-all"
                style={{ backgroundColor: FOCUS_COLOR }}
              >
                我准备好了
              </button>
            )}
          </div>
        )}

        {/* 完成屏 */}
        {screen === 'done' && (
          <div className="flex flex-col items-center px-8 pt-12 pb-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: withAlpha(FOCUS_COLOR, 0.12) }}
            >
              <Sparkles size={28} style={{ color: FOCUS_COLOR }} />
            </div>

            <h3
              className="text-xl font-semibold mb-2 text-center"
              style={{ color: appTheme.ink }}
            >
              你已经进入状态了
            </h3>
            <p
              className="text-sm text-center mb-8 leading-relaxed"
              style={{ color: appTheme.inkMuted48 }}
            >
              每一步都算数。现在，开始专注吧。
            </p>

            <div className="flex gap-3 w-full">
              <button
                onClick={handleClose}
                className="flex-1 py-3 rounded-2xl text-sm transition-all"
                style={{
                  backgroundColor: withAlpha(appTheme.ink, 0.06),
                  color: appTheme.inkMuted80,
                }}
              >
                稍后再说
              </button>
              <button
                onClick={handleStartPomodoro}
                className="flex-1 py-3 rounded-2xl text-white text-sm transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: FOCUS_COLOR }}
              >
                <Timer size={15} />
                开始番茄钟
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
