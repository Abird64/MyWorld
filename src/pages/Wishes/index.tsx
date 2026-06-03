import { useEffect, useState } from 'react';
import { Sparkles, Gift, Crown, Star, Plus, Sparkle, Ticket, Coins, ChevronRight, Shuffle, History, ShoppingCart, Infinity } from 'lucide-react';
import { NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useWishStore } from '@/stores/wishStore';
import type { Wish, WishLevel } from '@/types/wish';
import { WISH_LEVELS, WISH_LEVEL_NAMES, WISH_COST_RANGES } from '@/types/wish';
import { Card } from '@/components/ui/Card';
import { motion, AnimatePresence } from 'motion/react';

const LEVEL_ICONS = {
  1: Sparkles,
  2: Gift,
  3: Crown,
  4: Star,
};

const LEVEL_COLORS = {
  1: '#7EB8A2',
  2: '#5A9A9E',
  3: '#C49A6C',
  4: '#B76E79',
};

// Card back pattern for the draw animation
const CARD_BACK_STYLE = {
  background: 'repeating-linear-gradient(45deg, #1a1a1a 0px, #1a1a1a 10px, #2a2a2a 10px, #2a2a2a 20px)',
};

export function WishesPage() {
  const appTheme = useAppTheme();
  const {
    wishes,
    balance,
    draws,
    pityProgress,
    isLoading,
    selectedLevel,
    showAddModal,
    editingWish,
    activeTab,
    fetchWishes,
    fetchBalance,
    fetchDraws,
    fetchPityProgress,
    createWish,
    updateWish,
    deleteWish,
    markAchieved,
    draw,
    buyTickets,
    redeemWish,
    setSelectedLevel,
    setShowAddModal,
    setEditingWish,
    setActiveTab,
  } = useWishStore();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    level: 1 as WishLevel,
    cost_glow: 20,
    quantity: 1,      // -1 表示无限
    isInfinite: false,
  });

  // Draw animation states
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawType, setDrawType] = useState<'micro' | 'shimmer' | null>(null);
  const [drawResult, setDrawResult] = useState<{
    success: boolean;
    wish: Wish | null;
    is_pity: boolean;
    pity_count: number;
    message: string;
  } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemedWishId, setRedeemedWishId] = useState<string | null>(null);

  useEffect(() => {
    fetchWishes();
    fetchBalance();
    fetchDraws();
    fetchPityProgress('micro');
    fetchPityProgress('shimmer');
  }, [fetchWishes, fetchBalance, fetchDraws, fetchPityProgress]);

  // Filter wishes by selected level
  const filteredWishes = selectedLevel
    ? wishes.filter((w) => w.level === selectedLevel && w.status === 'active')
    : wishes.filter((w) => w.status === 'active');

  // Group wishes by level
  const wishesByLevel = filteredWishes.reduce((acc, wish) => {
    if (!acc[wish.level]) acc[wish.level] = [];
    acc[wish.level].push(wish);
    return acc;
  }, {} as Record<WishLevel, Wish[]>);

  // Handle add/edit submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    if (editingWish) {
      await updateWish({
        id: editingWish.id,
        title: formData.title,
        description: formData.description,
        level: formData.level,
        cost_glow: formData.cost_glow,
        quantity: formData.isInfinite ? -1 : formData.quantity,
      });
    } else {
      await createWish({
        title: formData.title,
        description: formData.description,
        level: formData.level,
        cost_glow: formData.cost_glow,
        quantity: formData.isInfinite ? -1 : formData.quantity,
      });
    }

    // Reset form
    setFormData({ title: '', description: '', level: 1, cost_glow: 20, quantity: 1, isInfinite: false });
    setShowAddModal(false);
    setEditingWish(null);
  };

  // Open edit modal
  const openEdit = (wish: Wish) => {
    setEditingWish(wish);
    setFormData({
      title: wish.title,
      description: wish.description || '',
      level: wish.level as WishLevel,
      cost_glow: wish.cost_glow,
      quantity: wish.quantity === -1 ? 1 : wish.quantity,
      isInfinite: wish.quantity === -1,
    });
    setShowAddModal(true);
  };

  // Open add modal
  const openAdd = (level?: WishLevel) => {
    setEditingWish(null);
    setFormData({
      title: '',
      description: '',
      level: level ?? 1,
      cost_glow: WISH_COST_RANGES[level ?? 1].min,
      quantity: 1,
      isInfinite: false,
    });
    setShowAddModal(true);
  };

  // Handle draw
  const handleDraw = async (type: 'micro' | 'shimmer') => {
    const ticketCount = type === 'micro' ? balance?.micro_tickets : balance?.shimmer_tickets;
    if (!ticketCount || ticketCount <= 0) {
      return;
    }

    setDrawType(type);
    setIsDrawing(true);
    setCardFlipped(false);
    setShowResult(false);
    setDrawResult(null);

    // Wait for flip animation to start
    setTimeout(async () => {
      const result = await draw(type);
      setDrawResult(result);

      // Flip card to reveal
      setTimeout(() => {
        setCardFlipped(true);
        setTimeout(() => {
          setShowResult(true);
        }, 300);
      }, 500);
    }, 300);
  };

  // Handle redeem
  const handleRedeem = async () => {
    if (!drawResult?.wish) return;

    setIsRedeeming(true);
    try {
      await redeemWish(drawResult.wish.id);
      setRedeemedWishId(drawResult.wish.id);
      setIsRedeeming(false);
    } catch (e) {
      setIsRedeeming(false);
    }
  };

  // Close draw modal
  const closeDraw = () => {
    setIsDrawing(false);
    setDrawType(null);
    setDrawResult(null);
    setShowResult(false);
    setCardFlipped(false);
    setRedeemedWishId(null);
  };

  return (
    <PageContainer>
      <NavBar title="心愿夹" />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8">
        <div className="max-w-[700px] mx-auto space-y-6 pt-4">

          {/* ─── 余额卡片 ─── */}
          <Card padding={false} className="overflow-hidden">
            <div className="px-5 py-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${withAlpha(LEVEL_COLORS[1], 0.15)}` }}
                >
                  <Coins size={20} style={{ color: LEVEL_COLORS[1] }} />
                </div>
                <div>
                  <div
                    className="text-2xl font-bold tracking-tight"
                    style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
                  >
                    {balance?.glow_amount.toLocaleString() ?? 0}
                  </div>
                  <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>萤火余额</p>
                </div>
              </div>
            </div>

            <div
              className="grid grid-cols-2"
              style={{ borderTop: `0.5px solid ${appTheme.hairline}` }}
            >
              {/* 微光奖券 */}
              <div className="flex items-center gap-3 px-5 py-3" style={{ borderRight: `0.5px solid ${appTheme.divider}` }}>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${withAlpha('#E8B959', 0.15)}` }}
                >
                  <Ticket size={18} style={{ color: '#E8B959' }} />
                </div>
                <div>
                  <div className="text-lg font-semibold" style={{ color: appTheme.ink }}>
                    {balance?.micro_tickets ?? 0}
                  </div>
                  <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>微光奖券</p>
                </div>
              </div>

              {/* 拾光奖券 */}
              <div className="flex items-center gap-3 px-5 py-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${withAlpha('#C49A6C', 0.15)}` }}
                >
                  <Ticket size={18} style={{ color: '#C49A6C' }} />
                </div>
                <div>
                  <div className="text-lg font-semibold" style={{ color: appTheme.ink }}>
                    {balance?.shimmer_tickets ?? 0}
                  </div>
                  <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>拾光奖券</p>
                </div>
              </div>
            </div>
          </Card>

          {/* ─── 抽奖区域 ─── */}
          <Card padding={false} className="overflow-hidden">
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium" style={{ color: appTheme.inkMuted80 }}>
                  抽奖
                </h3>
                <button
                  onClick={() => setActiveTab('shop')}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors"
                  style={{ backgroundColor: appTheme.surfacePearl, color: appTheme.primary }}
                >
                  <ShoppingCart size={12} />
                  购买奖券
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* 微光奖池 */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleDraw('micro')}
                    disabled={!balance?.micro_tickets || balance.micro_tickets <= 0}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all disabled:opacity-40"
                    style={{
                      backgroundColor: `${withAlpha('#E8B959', 0.1)}`,
                      border: `1px solid ${withAlpha('#E8B959', 0.3)}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Ticket size={20} style={{ color: '#E8B959' }} />
                      <span className="font-semibold" style={{ color: '#E8B959' }}>
                        {balance?.micro_tickets ?? 0}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>
                      微光奖池
                    </span>
                    <span className="text-[10px]" style={{ color: appTheme.inkMuted48 }}>
                      Lv.1-2 心愿
                    </span>
                  </button>
                  {/* Pity Progress */}
                  <div className="px-2">
                    <div className="flex justify-between text-[10px] mb-1" style={{ color: appTheme.inkMuted48 }}>
                      <span>保底进度</span>
                      <span>{pityProgress.micro?.current ?? 0} / {pityProgress.micro?.threshold ?? 30}</span>
                    </div>
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: appTheme.surfacePearl }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${((pityProgress.micro?.current ?? 0) / (pityProgress.micro?.threshold ?? 30)) * 100}%`,
                          backgroundColor: '#E8B959',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 拾光奖池 */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleDraw('shimmer')}
                    disabled={!balance?.shimmer_tickets || balance.shimmer_tickets <= 0}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all disabled:opacity-40"
                    style={{
                      backgroundColor: `${withAlpha('#C49A6C', 0.1)}`,
                      border: `1px solid ${withAlpha('#C49A6C', 0.3)}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Ticket size={20} style={{ color: '#C49A6C' }} />
                      <span className="font-semibold" style={{ color: '#C49A6C' }}>
                        {balance?.shimmer_tickets ?? 0}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>
                      拾光奖池
                    </span>
                    <span className="text-[10px]" style={{ color: appTheme.inkMuted48 }}>
                      Lv.3-4 心愿
                    </span>
                  </button>
                  {/* Pity Progress */}
                  <div className="px-2">
                    <div className="flex justify-between text-[10px] mb-1" style={{ color: appTheme.inkMuted48 }}>
                      <span>保底进度</span>
                      <span>{pityProgress.shimmer?.current ?? 0} / {pityProgress.shimmer?.threshold ?? 80}</span>
                    </div>
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: appTheme.surfacePearl }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${((pityProgress.shimmer?.current ?? 0) / (pityProgress.shimmer?.threshold ?? 80)) * 100}%`,
                          backgroundColor: '#C49A6C',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* ─── 等级过滤 ─── */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setSelectedLevel(null)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedLevel === null ? 'ring-1' : ''
              }`}
              style={{
                backgroundColor: selectedLevel === null ? appTheme.surfacePearl : 'transparent',
                color: selectedLevel === null ? appTheme.ink : appTheme.inkMuted48,
                border: `0.5px solid ${selectedLevel === null ? appTheme.hairline : 'transparent'}`,
                ...(selectedLevel === null ? { '--tw-ring-color': appTheme.primary, '--tw-ring-width': '1px' } as React.CSSProperties : {}),
              }}
            >
              全部
            </button>
            {[1, 2, 3, 4].map((level) => {
              const config = WISH_LEVELS[level as WishLevel];
              const Icon = LEVEL_ICONS[level as WishLevel];
              const isSelected = selectedLevel === level;
              return (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(level as WishLevel)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${isSelected ? 'ring-1' : ''}`}
                  style={{
                    backgroundColor: isSelected ? `${withAlpha(config.color, 0.15)}` : 'transparent',
                    color: isSelected ? config.color : appTheme.inkMuted48,
                    border: `0.5px solid ${isSelected ? config.color : 'transparent'}`,
                  }}
                >
                  <Icon size={14} />
                  Lv.{level}
                </button>
              );
            })}
          </div>

          {/* ─── 心愿列表 ─── */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <p style={{ color: appTheme.inkMuted48 }}>加载中...</p>
            </div>
          ) : filteredWishes.length === 0 ? (
            <div className="text-center py-16">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: appTheme.surfacePearl }}
              >
                <Sparkle size={28} style={{ color: appTheme.inkMuted48 }} />
              </div>
              <p className="text-lg mb-2" style={{ color: appTheme.inkMuted80 }}>暂无心愿</p>
              <p className="text-sm mb-6" style={{ color: appTheme.inkMuted48 }}>把"我想要"变成"我值得"</p>
              <button
                onClick={() => openAdd()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
                style={{ backgroundColor: appTheme.primary, color: appTheme.onPrimary }}
              >
                <Plus size={18} />
                添加心愿
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((level) => {
                const levelWishes = wishesByLevel[level as WishLevel] ?? [];
                if (levelWishes.length === 0 && selectedLevel !== null && selectedLevel !== level) return null;
                if (selectedLevel !== null && selectedLevel !== level) return null;

                const config = WISH_LEVELS[level as WishLevel];
                const Icon = LEVEL_ICONS[level as WishLevel];

                return (
                  <div key={level}>
                    {/* Level Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ backgroundColor: `${withAlpha(config.color, 0.15)}` }}
                      >
                        <Icon size={14} style={{ color: config.color }} />
                      </div>
                      <span className="text-sm font-medium" style={{ color: config.color }}>
                        Lv.{level} · {config.name}
                      </span>
                      <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>
                        {levelWishes.length} 个心愿
                      </span>
                      <button
                        onClick={() => openAdd(level as WishLevel)}
                        className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors"
                        style={{ color: config.color, backgroundColor: `${withAlpha(config.color, 0.08)}` }}
                      >
                        <Plus size={12} />
                        添加
                      </button>
                    </div>

                    {/* Wishes */}
                    <div className="space-y-2">
                      {levelWishes.map((wish) => (
                        <div
                          key={wish.id}
                          className="group flex items-start gap-3 p-4 rounded-2xl transition-all"
                          style={{ backgroundColor: appTheme.surfacePearl }}
                        >
                          <div
                            className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                            style={{ backgroundColor: config.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium mb-1" style={{ color: appTheme.ink }}>
                              {wish.title}
                            </div>
                            {wish.description && (
                              <p className="text-sm line-clamp-2" style={{ color: appTheme.inkMuted48 }}>
                                {wish.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: `${withAlpha(LEVEL_COLORS[1], 0.1)}`,
                                  color: LEVEL_COLORS[1],
                                }}
                              >
                                {wish.cost_glow} 萤火
                              </span>
                              <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: appTheme.surfacePearl,
                                  color: appTheme.inkMuted48,
                                }}
                              >
                                {wish.quantity === -1
                                  ? '无限'
                                  : `${wish.quantity - wish.achieved_count}/${wish.quantity} 剩余`
                                }
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(wish)}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ color: appTheme.inkMuted48 }}
                              title="编辑"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteWish(wish.id)}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ color: appTheme.inkMuted48 }}
                              title="删除"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* ─── Add/Edit Modal ─── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => {
            setShowAddModal(false);
            setEditingWish(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ backgroundColor: appTheme.canvas }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: appTheme.ink }}>
              {editingWish ? '编辑心愿' : '添加心愿'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: appTheme.inkMuted80 }}>
                  心愿名称
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="比如：一顿火锅、新耳机..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: appTheme.surfacePearl,
                    color: appTheme.ink,
                    border: `0.5px solid ${appTheme.hairline}`,
                  }}
                />
              </div>

              {/* Level */}
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: appTheme.inkMuted80 }}>
                  等级
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((level) => {
                    const config = WISH_LEVELS[level as WishLevel];
                    const isSelected = formData.level === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            level: level as WishLevel,
                            cost_glow: WISH_COST_RANGES[level as WishLevel].min,
                          });
                        }}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all"
                        style={{
                          backgroundColor: isSelected ? `${withAlpha(config.color, 0.15)}` : appTheme.surfacePearl,
                          border: `0.5px solid ${isSelected ? config.color : 'transparent'}`,
                        }}
                      >
                        <span
                          className="text-xs font-medium"
                          style={{ color: isSelected ? config.color : appTheme.inkMuted48 }}
                        >
                          Lv.{level}
                        </span>
                        <span
                          className="text-[10px] truncate w-full text-center"
                          style={{ color: isSelected ? appTheme.ink : appTheme.inkMuted48 }}
                        >
                          {config.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cost */}
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: appTheme.inkMuted80 }}>
                  萤火成本 <span style={{ color: appTheme.inkMuted48 }}>({WISH_COST_RANGES[formData.level].label})</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={WISH_COST_RANGES[formData.level].min}
                    max={WISH_COST_RANGES[formData.level].max}
                    value={formData.cost_glow}
                    onChange={(e) => setFormData({ ...formData, cost_glow: parseInt(e.target.value) || 0 })}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                    style={{
                      backgroundColor: appTheme.surfacePearl,
                      color: appTheme.ink,
                      border: `0.5px solid ${appTheme.hairline}`,
                    }}
                  />
                  <span className="text-sm" style={{ color: appTheme.inkMuted48 }}>萤火</span>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: appTheme.inkMuted80 }}>
                  数量
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isInfinite: !formData.isInfinite })}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      formData.isInfinite ? 'ring-1' : ''
                    }`}
                    style={{
                      backgroundColor: formData.isInfinite ? `${withAlpha(appTheme.primary, 0.15)}` : appTheme.surfacePearl,
                      color: formData.isInfinite ? appTheme.primary : appTheme.inkMuted48,
                      border: `0.5px solid ${formData.isInfinite ? appTheme.primary : appTheme.hairline}`,
                    }}
                  >
                    无限
                  </button>
                  {!formData.isInfinite && (
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                      style={{
                        backgroundColor: appTheme.surfacePearl,
                        color: appTheme.ink,
                        border: `0.5px solid ${appTheme.hairline}`,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: appTheme.inkMuted80 }}>
                  描述 <span style={{ color: appTheme.inkMuted48 }}>(可选)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="为什么想要这个？达成时会有什么感受？"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors resize-none"
                  style={{
                    backgroundColor: appTheme.surfacePearl,
                    color: appTheme.ink,
                    border: `0.5px solid ${appTheme.hairline}`,
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingWish(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ backgroundColor: appTheme.surfacePearl, color: appTheme.ink }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!formData.title.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: appTheme.primary, color: appTheme.onPrimary }}
                >
                  {editingWish ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Draw Result Modal ─── */}
      <AnimatePresence>
        {isDrawing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
            onClick={closeDraw}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Card Container with 3D flip */}
              <div
                className="relative w-72 h-96 cursor-pointer"
                style={{ perspective: '1000px' }}
                onClick={showResult ? closeDraw : undefined}
              >
                <motion.div
                  className="absolute inset-0 w-full h-full rounded-2xl shadow-2xl"
                  style={{
                    transformStyle: 'preserve-3d',
                    backfaceVisibility: 'hidden',
                  }}
                  animate={{
                    rotateY: cardFlipped ? 180 : 0,
                  }}
                  transition={{
                    duration: 0.6,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                >
                  {/* Card Front (Back of the card) */}
                  <div
                    className="absolute inset-0 w-full h-full rounded-2xl flex flex-col items-center justify-center"
                    style={{
                      background: `repeating-linear-gradient(45deg, ${withAlpha(appTheme.ink, 0.1)} 0px, ${withAlpha(appTheme.ink, 0.1)} 10px, ${withAlpha(appTheme.ink, 0.05)} 10px, ${withAlpha(appTheme.ink, 0.05)} 20px)`,
                      border: `2px solid ${withAlpha(appTheme.ink, 0.2)}`,
                      backfaceVisibility: 'hidden',
                    }}
                  >
                    <Shuffle size={48} style={{ color: withAlpha(appTheme.ink, 0.3) }} />
                    <p className="mt-4 text-sm" style={{ color: appTheme.inkMuted48 }}>
                      抽取中...
                    </p>
                  </div>

                  {/* Card Back (The result) */}
                  <div
                    className="absolute inset-0 w-full h-full rounded-2xl flex flex-col items-center justify-center p-6"
                    style={{
                      backgroundColor: drawResult?.wish
                        ? LEVEL_COLORS[drawResult.wish.level]
                        : appTheme.surfacePearl,
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    {drawResult?.wish ? (
                      <>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        >
                          {(() => {
                            const Icon = LEVEL_ICONS[drawResult.wish!.level];
                            return <Icon size={48} style={{ color: '#fff' }} />;
                          })()}
                        </motion.div>
                        <motion.p
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="mt-4 text-lg font-semibold text-center"
                          style={{ color: '#fff' }}
                        >
                          {drawResult.wish.title}
                        </motion.p>
                        <motion.p
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                          className="mt-2 text-sm text-center"
                          style={{ color: 'rgba(255,255,255,0.8)' }}
                        >
                          Lv.{drawResult.wish.level} · {WISH_LEVEL_NAMES[drawResult.wish.level]}
                        </motion.p>
                        {drawResult.wish.description && (
                          <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="mt-4 text-xs text-center line-clamp-3"
                            style={{ color: 'rgba(255,255,255,0.6)' }}
                          >
                            {drawResult.wish.description}
                          </motion.p>
                        )}
                        {/* Redeem Button */}
                        <motion.button
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 }}
                          onClick={handleRedeem}
                          disabled={isRedeeming || redeemedWishId === drawResult.wish.id}
                          className="mt-6 px-6 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50"
                          style={{
                            backgroundColor: redeemedWishId === drawResult.wish.id ? 'rgba(255,255,255,0.3)' : '#fff',
                            color: drawResult.wish ? LEVEL_COLORS[drawResult.wish.level] : appTheme.ink,
                          }}
                        >
                          {redeemedWishId === drawResult.wish.id
                            ? '已兑换'
                            : isRedeeming
                              ? '兑换中...'
                              : `用 ${drawResult.wish.cost_glow} 萤火兑换`
                          }
                        </motion.button>
                      </>
                    ) : (
                      <>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: 'spring' }}
                        >
                          <Sparkle size={48} style={{ color: appTheme.inkMuted48 }} />
                        </motion.div>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="mt-4 text-sm text-center"
                          style={{ color: appTheme.inkMuted48 }}
                        >
                          {drawResult?.message || '这次没有抽中'}
                        </motion.p>
                      </>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Click to close hint */}
              {showResult && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-center mt-6 text-sm"
                  style={{ color: appTheme.inkMuted48 }}
                >
                  点击卡片关闭
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Shop Modal ─── */}
      {activeTab === 'shop' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setActiveTab('wishes')}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ backgroundColor: appTheme.canvas }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: appTheme.ink }}>
              奖券商店
            </h3>
            <div className="space-y-4">
              {/* 微光奖券 */}
              <div
                className="p-4 rounded-xl"
                style={{ backgroundColor: `${withAlpha('#E8B959', 0.1)}`, border: `1px solid ${withAlpha('#E8B959', 0.3)}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Ticket size={20} style={{ color: '#E8B959' }} />
                    <span className="font-medium" style={{ color: '#E8B959' }}>微光奖券</span>
                  </div>
                  <span className="text-sm" style={{ color: appTheme.inkMuted48 }}>100 萤火/张</span>
                </div>
                <div className="flex gap-2">
                  {[1, 5, 10].map((count) => (
                    <button
                      key={count}
                      onClick={() => buyTickets('micro', count)}
                      disabled={isLoading || (balance?.glow_amount ?? 0) < count * 100}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                      style={{ backgroundColor: appTheme.surfacePearl, color: appTheme.ink }}
                    >
                      买 {count} 张
                    </button>
                  ))}
                </div>
              </div>
              {/* 拾光奖券 */}
              <div
                className="p-4 rounded-xl"
                style={{ backgroundColor: `${withAlpha('#C49A6C', 0.1)}`, border: `1px solid ${withAlpha('#C49A6C', 0.3)}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Ticket size={20} style={{ color: '#C49A6C' }} />
                    <span className="font-medium" style={{ color: '#C49A6C' }}>拾光奖券</span>
                  </div>
                  <span className="text-sm" style={{ color: appTheme.inkMuted48 }}>500 萤火/张</span>
                </div>
                <div className="flex gap-2">
                  {[1, 3, 5].map((count) => (
                    <button
                      key={count}
                      onClick={() => buyTickets('shimmer', count)}
                      disabled={isLoading || (balance?.glow_amount ?? 0) < count * 500}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                      style={{ backgroundColor: appTheme.surfacePearl, color: appTheme.ink }}
                    >
                      买 {count} 张
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('wishes')}
              className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ backgroundColor: appTheme.surfacePearl, color: appTheme.ink }}
            >
              关闭
            </button>
          </div>
        </div>
      )}

    </PageContainer>
  );
}
