import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useUIStore } from '@/stores/uiStore';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';

// 呼吸周期: 4s 吸气 → 2s 保持 → 4s 呼气 → 2s 保持
type BreathingPhase = 'idle' | 'inhale' | 'hold' | 'exhale' | 'rest';

const PHASE_CONFIG: Record<BreathingPhase, { text: string; duration: number }> = {
  idle: { text: '准备开始', duration: 0 },
  inhale: { text: '吸气...', duration: 4000 },
  hold: { text: '保持...', duration: 2000 },
  exhale: { text: '呼气...', duration: 4000 },
  rest: { text: '自然呼吸', duration: 2000 },
};

export function MeditationPage() {
  const appTheme = useAppTheme();
  const setActiveSubPage = useUIStore((s) => s.setActiveSubPage);

  // 状态
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [phase, setPhase] = useState<BreathingPhase>('idle');
  const [timeLeft, setTimeLeft] = useState(0);
  const [completed, setCompleted] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理定时器
  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (phaseTimeoutRef.current) {
      clearTimeout(phaseTimeoutRef.current);
      phaseTimeoutRef.current = null;
    }
  }, []);

  // 开始冥想
  const startMeditation = (minutes: number) => {
    setSelectedDuration(minutes);
    setTimeLeft(minutes * 60);
    setIsActive(true);
    setIsPaused(false);
    setCompleted(false);
    setPhase('inhale');
  };

  // 暂停/继续
  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  // 停止冥想
  const stopMeditation = () => {
    clearTimers();
    setIsActive(false);
    setIsPaused(false);
    setPhase('idle');
    setTimeLeft(0);
    setCompleted(false);
    setSelectedDuration(null);
  };

  // 完成冥想
  const completeMeditation = () => {
    clearTimers();
    setCompleted(true);
    setPhase('idle');
  };

  // 呼吸周期循环
  const runBreathingCycle = useCallback(() => {
    const cycle = () => {
      setPhase('inhale');
      phaseTimeoutRef.current = setTimeout(() => {
        setPhase('hold');
        phaseTimeoutRef.current = setTimeout(() => {
          setPhase('exhale');
          phaseTimeoutRef.current = setTimeout(() => {
            setPhase('rest');
            phaseTimeoutRef.current = setTimeout(() => {
              cycle();
            }, 2000);
          }, 4000);
        }, 2000);
      }, 4000);
    };
    cycle();
  }, []);

  // 倒计时 - 独立 effect，不干扰呼吸周期
  useEffect(() => {
    if (!isActive || isPaused) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          completeMeditation();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, isPaused]);

  // 呼吸周期 - 独立 effect，只在开始/暂停时触发
  useEffect(() => {
    if (!isActive || isPaused) {
      clearTimers();
      return;
    }

    // 开始呼吸周期
    runBreathingCycle();

    return clearTimers;
  }, [isActive, isPaused, runBreathingCycle, clearTimers]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        stopMeditation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 呼吸灯动画配置
  const getBreathingScale = () => {
    switch (phase) {
      case 'inhale':
        return 1.3;
      case 'hold':
        return 1.3;
      case 'exhale':
        return 1;
      case 'rest':
        return 1;
      default:
        return 1;
    }
  };

  const getBreathingOpacity = () => {
    switch (phase) {
      case 'inhale':
        return 1;
      case 'hold':
        return 1;
      case 'exhale':
        return 0.5;
      case 'rest':
        return 0.5;
      default:
        return 0.8;
    }
  };

  return (
    <PageContainer className="flex flex-col">
      <NavBar
        title="冥想"
        showBack
        onBack={() => {
          if (isActive) {
            clearTimers();
          }
          setActiveSubPage(null);
        }}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <AnimatePresence mode="wait">
          {!isActive && !completed && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center"
            >
              {/* 标题 */}
              <h2
                className="text-2xl font-light mb-2"
                style={{ color: appTheme.ink }}
              >
                选择一段陪伴你的时间
              </h2>
              <p
                className="text-sm mb-10"
                style={{ color: appTheme.inkMuted48 }}
              >
                跟随呼吸灯的明暗，找到内心的平静
              </p>

              {/* 时长选项 */}
              <div className="flex gap-4">
                {[3, 5, 10].map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => startMeditation(minutes)}
                    className="px-8 py-6 rounded-2xl transition-all btn-press"
                    style={{
                      backgroundColor: withAlpha(appTheme.ink, 0.03),
                      border: `1px solid ${appTheme.hairline}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = withAlpha(
                        appTheme.primary,
                        0.08
                      );
                      e.currentTarget.style.borderColor = appTheme.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = withAlpha(
                        appTheme.ink,
                        0.03
                      );
                      e.currentTarget.style.borderColor = appTheme.hairline;
                    }}
                  >
                    <span
                      className="text-3xl font-semibold"
                      style={{ color: appTheme.ink }}
                    >
                      {minutes}
                    </span>
                    <span
                      className="text-sm ml-1"
                      style={{ color: appTheme.inkMuted48 }}
                    >
                      分钟
                    </span>
                  </button>
                ))}
              </div>

              {/* 提示 */}
              <p
                className="mt-10 text-xs"
                style={{ color: appTheme.inkMuted48 }}
              >
                找一个舒适的姿势，让我们开始
              </p>
            </motion.div>
          )}

          {isActive && (
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              {/* 剩余时间 */}
              <div
                className="text-4xl font-light mb-12 tabular-nums"
                style={{ color: appTheme.ink }}
              >
                {formatTime(timeLeft)}
              </div>

              {/* 呼吸灯 */}
              <div className="relative w-64 h-64 flex items-center justify-center">
                {/* 外圈光晕 */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${withAlpha(
                      appTheme.primary,
                      0.15
                    )} 0%, transparent 70%)`,
                  }}
                  animate={{
                    scale: getBreathingScale(),
                    opacity: getBreathingOpacity(),
                  }}
                  transition={{
                    duration: phase === 'inhale' || phase === 'exhale' ? 4 : 0,
                    ease: 'easeInOut',
                  }}
                />

                {/* 主呼吸灯 */}
                <motion.div
                  className="w-32 h-32 rounded-full flex items-center justify-center"
                  style={{
                    background: `radial-gradient(circle, ${withAlpha(
                      appTheme.primary,
                      0.6
                    )} 0%, ${withAlpha(appTheme.primary, 0.2)} 100%)`,
                    boxShadow: `0 0 60px ${withAlpha(appTheme.primary, 0.3)}`,
                  }}
                  animate={{
                    scale: getBreathingScale(),
                    opacity: getBreathingOpacity(),
                  }}
                  transition={{
                    duration: phase === 'inhale' || phase === 'exhale' ? 4 : 0,
                    ease: 'easeInOut',
                  }}
                >
                  {/* 中心文字 */}
                  <motion.span
                    className="text-lg font-light"
                    style={{ color: appTheme.onPrimary }}
                    animate={{ opacity: isPaused ? 0.5 : 1 }}
                  >
                    {PHASE_CONFIG[phase].text}
                  </motion.span>
                </motion.div>

                {/* 萤火虫点缀 */}
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 rounded-full"
                    style={{
                      backgroundColor: '#A8E6CF',
                      boxShadow: '0 0 6px 3px rgba(168, 230, 207, 0.4)',
                    }}
                    initial={{
                      x: Math.cos((i * 72 * Math.PI) / 180) * 100,
                      y: Math.sin((i * 72 * Math.PI) / 180) * 100,
                      opacity: 0.3,
                    }}
                    animate={{
                      opacity: [0.3, 0.8, 0.3],
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 3 + i * 0.5,
                      repeat: Infinity,
                      delay: i * 0.5,
                    }}
                  />
                ))}
              </div>

              {/* 控制按钮 */}
              <div className="flex items-center gap-6 mt-16">
                <button
                  onClick={togglePause}
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-all btn-press"
                  style={{
                    backgroundColor: withAlpha(appTheme.ink, 0.08),
                    color: appTheme.ink,
                  }}
                  title={isPaused ? '继续 (空格)' : '暂停 (空格)'}
                  aria-label={isPaused ? '继续' : '暂停'}
                >
                  {isPaused ? <Play size={24} /> : <Pause size={24} />}
                </button>

                <button
                  onClick={stopMeditation}
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-all btn-press"
                  style={{
                    backgroundColor: withAlpha(appTheme.danger, 0.15),
                    color: appTheme.danger,
                  }}
                  title="停止 (Esc)"
                  aria-label="停止"
                >
                  <Square size={24} />
                </button>
              </div>

              {/* 快捷键提示 */}
              <div
                className="mt-8 flex items-center gap-4 text-xs"
                style={{ color: appTheme.inkMuted48 }}
              >
                <span>空格 暂停</span>
                <span>·</span>
                <span>Esc 停止</span>
              </div>
            </motion.div>
          )}

          {completed && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center"
            >
              {/* 完成图标 */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
                style={{
                  background: `radial-gradient(circle, ${withAlpha(
                    appTheme.primary,
                    0.3
                  )} 0%, transparent 70%)`,
                }}
              >
                <motion.div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: withAlpha(appTheme.primary, 0.2),
                  }}
                >
                  <span
                    className="text-2xl"
                    style={{ color: appTheme.primary }}
                  >
                    ✓
                  </span>
                </motion.div>
              </motion.div>

              {/* 完成文案 */}
              <h2
                className="text-2xl font-light mb-3"
                style={{ color: appTheme.ink }}
              >
                你做得很好
              </h2>
              <p
                className="text-sm mb-10"
                style={{ color: appTheme.inkMuted48 }}
              >
                愿这份平静陪伴你
              </p>

              {/* 统计 */}
              <div
                className="px-6 py-4 rounded-xl mb-8"
                style={{ backgroundColor: withAlpha(appTheme.ink, 0.03) }}
              >
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div
                      className="text-2xl font-semibold"
                      style={{ color: appTheme.ink }}
                    >
                      {selectedDuration}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: appTheme.inkMuted48 }}
                    >
                      分钟
                    </div>
                  </div>
                  <div
                    className="w-px h-10"
                    style={{ backgroundColor: appTheme.hairline }}
                  />
                  <div className="text-center">
                    <div
                      className="text-2xl font-semibold"
                      style={{ color: appTheme.ink }}
                    >
                      {Math.round((selectedDuration || 0) * 6)}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: appTheme.inkMuted48 }}
                    >
                      次呼吸
                    </div>
                  </div>
                </div>
              </div>

              {/* 返回按钮 */}
              <button
                onClick={() => setActiveSubPage(null)}
                className="px-8 py-3 rounded-full transition-all btn-press"
                style={{
                  backgroundColor: appTheme.primary,
                  color: appTheme.onPrimary,
                }}
              >
                完成
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageContainer>
  );
}
