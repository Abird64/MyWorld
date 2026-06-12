import { useEffect, useState } from 'react';
import { Plus, Sparkle, Ticket, Coins, ShoppingCart } from 'lucide-react';
import { NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useWishStore } from '@/stores/wishStore';
import type { Wish, WishLevel } from '@/types/wish';
import { WISH_LEVELS, WISH_LEVEL_VALUES } from '@/types/wish';
import { Card } from '@/components/ui/Card';
import { LEVEL_ICONS, LEVEL_COLORS } from './config';
import { LedgerView } from './LedgerView';
import { HistoryView } from './HistoryView';
import { ShopModal } from './ShopModal';
import { PityModal } from './PityModal';
import { WishFormModal } from './WishFormModal';
import { DrawResultModal } from './DrawResultModal';
import { InventoryView } from './InventoryView';
import { Toast } from '@/components/ui/Toast';

export function WishesPage() {
  const appTheme = useAppTheme();
  const {
    wishes,
    balance,
    draws,
    pityProgress,
    ledger,
    ledgerTotal,
    inventory,
    inventoryCount,
    isLoading,
    selectedLevel,
    showAddModal,
    editingWish,
    activeTab,
    fetchWishes,
    fetchBalance,
    fetchDraws,
    fetchPityProgress,
    fetchLedger,
    fetchInventory,
    createWish,
    updateWish,
    deleteWish,
    draw,
    claimPityWish,
    buyTickets,
    redeemDraw,
    adjustStock,
    setSelectedLevel,
    setShowAddModal,
    setEditingWish,
    setActiveTab,
  } = useWishStore();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    level: 1 as WishLevel,
    quantity: 1,
    isInfinite: false,
  });

  // Draw animation states
  const [isDrawing, setIsDrawing] = useState(false);
  const [, setDrawType] = useState<'micro' | 'shimmer' | null>(null);
  const [drawResult, setDrawResult] = useState<{
    success: boolean;
    wish: Wish | null;
    is_pity: boolean;
    pity_count: number;
    message: string;
  } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'glow' | 'micro_ticket' | 'shimmer_ticket'>('all');
  const [showShopModal, setShowShopModal] = useState(false);
  const [showPityModal, setShowPityModal] = useState(false);
  const [pityType, setPityType] = useState<'micro' | 'shimmer'>('micro');
  const [deletingWish, setDeletingWish] = useState<Wish | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchWishes();
    fetchBalance();
    fetchDraws();
    fetchPityProgress('micro');
    fetchPityProgress('shimmer');
    fetchLedger();
    fetchInventory();
  }, [fetchWishes, fetchBalance, fetchDraws, fetchPityProgress, fetchLedger, fetchInventory]);

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
        quantity: formData.isInfinite ? -1 : formData.quantity,
      });
    } else {
      await createWish({
        title: formData.title,
        description: formData.description,
        level: formData.level,
        quantity: formData.isInfinite ? -1 : formData.quantity,
      });
    }

    // Reset form
    setFormData({ title: '', description: '', level: 1, quantity: 1, isInfinite: false });
    setShowAddModal(false);
    setEditingWish(null);
  };

  // Open edit modal
  const openEdit = (wish: Wish) => {
    setEditingWish(wish);
    setFormData({
      title: wish.title,
      description: wish.description || '',
      level: wish.level,
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

  // Close draw modal
  const closeDraw = () => {
    setIsDrawing(false);
    setDrawType(null);
    setDrawResult(null);
    setShowResult(false);
    setCardFlipped(false);
  };

  return (
    <>
    <PageContainer>
      <NavBar title="心愿夹" />

      {/* ─── Tab Bar ─── */}
      <div className="px-4 sm:px-8 pt-2">
        <div
          className="max-w-[700px] mx-auto flex gap-1 p-1 rounded-xl"
          style={{ backgroundColor: appTheme.surfacePearl }}
        >
          {([
            ['wishes', '商店'],
            ['inventory', `仓库${inventoryCount > 0 ? `(${inventoryCount})` : ''}`],
            ['history', '抽奖记录'],
            ['ledger', '收支明细'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                if (key === 'ledger') fetchLedger();
              }}
              className="flex-1 py-2 text-xs font-medium rounded-lg transition-all"
              style={{
                backgroundColor: activeTab === key ? appTheme.canvas : 'transparent',
                color: activeTab === key ? appTheme.ink : appTheme.inkMuted48,
                boxShadow: activeTab === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'ledger' ? (
        <LedgerView
          ledger={ledger}
          ledgerTotal={ledgerTotal}
          ledgerFilter={ledgerFilter}
          setLedgerFilter={setLedgerFilter}
          fetchLedger={fetchLedger}
        />
      ) : activeTab === 'inventory' ? (
        <InventoryView items={inventory} onRedeem={redeemDraw} />
      ) : activeTab === 'history' ? (
        <HistoryView draws={draws} />
      ) : (
      <>
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
          </Card>

          {/* ─── 抽奖区域 ─── */}
          <Card padding={false} className="overflow-hidden">
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium" style={{ color: appTheme.inkMuted80 }}>
                  抽奖
                </h3>
                <button
                  onClick={() => setShowShopModal(true)}
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
                  {(pityProgress.micro?.current ?? 0) >= (pityProgress.micro?.threshold ?? 30) ? (
                    <button
                      onClick={() => { setPityType('micro'); setShowPityModal(true); }}
                      className="text-xs py-1.5 px-3 rounded-full font-medium transition-all"
                      style={{ backgroundColor: '#E8B959', color: '#fff' }}
                    >
                      自选心愿
                    </button>
                  ) : (
                    <div className="px-2">
                      <div className="flex justify-between text-[10px] mb-1" style={{ color: appTheme.inkMuted48 }}>
                        <span>自选进度</span>
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
                  )}
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
                  {(pityProgress.shimmer?.current ?? 0) >= (pityProgress.shimmer?.threshold ?? 80) ? (
                    <button
                      onClick={() => { setPityType('shimmer'); setShowPityModal(true); }}
                      className="text-xs py-1.5 px-3 rounded-full font-medium transition-all"
                      style={{ backgroundColor: '#C49A6C', color: '#fff' }}
                    >
                      自选心愿
                    </button>
                  ) : (
                    <div className="px-2">
                      <div className="flex justify-between text-[10px] mb-1" style={{ color: appTheme.inkMuted48 }}>
                        <span>自选进度</span>
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
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* ─── 等级过滤 ─── */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setSelectedLevel(null)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all"
              style={{
                backgroundColor: selectedLevel === null ? appTheme.surfacePearl : 'transparent',
                color: selectedLevel === null ? appTheme.ink : appTheme.inkMuted48,
                border: `0.5px solid ${selectedLevel === null ? appTheme.hairline : 'transparent'}`,
                outline: selectedLevel === null ? `1.5px solid ${appTheme.primary}` : 'none',
                outlineOffset: '-1.5px',
              }}
            >
              全部
            </button>
            {WISH_LEVEL_VALUES.map((level) => {
              const config = WISH_LEVELS[level];
              const Icon = LEVEL_ICONS[level];
              const isSelected = selectedLevel === level;
              return (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all"
                  style={{
                    backgroundColor: isSelected ? `${withAlpha(config.color, 0.15)}` : 'transparent',
                    color: isSelected ? config.color : appTheme.inkMuted48,
                    border: `0.5px solid ${isSelected ? config.color : 'transparent'}`,
                    outline: isSelected ? `1.5px solid ${config.color}` : 'none',
                    outlineOffset: '-1.5px',
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
              {WISH_LEVEL_VALUES.map((level) => {
                const levelWishes = wishesByLevel[level] ?? [];
                if (levelWishes.length === 0 && selectedLevel !== null && selectedLevel !== level) return null;
                if (selectedLevel !== null && selectedLevel !== level) return null;

                const config = WISH_LEVELS[level];
                const Icon = LEVEL_ICONS[level];

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
                        onClick={() => openAdd(level)}
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
                              {wish.quantity === -1 ? (
                                <span
                                  className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: appTheme.surfacePearl, color: appTheme.inkMuted48 }}
                                >
                                  无限
                                </span>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => adjustStock(wish.id, 1)}
                                    disabled={wish.achieved_count >= wish.quantity}
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs transition-colors disabled:opacity-30"
                                    style={{ backgroundColor: appTheme.surfacePearl, color: appTheme.ink }}
                                    title="减少剩余"
                                  >
                                    −
                                  </button>
                                  <span
                                    className="text-xs px-2 py-0.5 rounded-full min-w-[60px] text-center"
                                    style={{ backgroundColor: appTheme.surfacePearl, color: appTheme.inkMuted48 }}
                                  >
                                    {wish.quantity - wish.achieved_count}/{wish.quantity}
                                  </span>
                                  <button
                                    onClick={() => adjustStock(wish.id, -1)}
                                    disabled={wish.achieved_count <= 0}
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs transition-colors disabled:opacity-30"
                                    style={{ backgroundColor: appTheme.surfacePearl, color: appTheme.ink }}
                                    title="增加剩余"
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
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
                              onClick={() => setDeletingWish(wish)}
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

      <WishFormModal
        show={showAddModal}
        editingWish={editingWish}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        onClose={() => {
          setShowAddModal(false);
          setEditingWish(null);
        }}
      />

      </>
      )}

      <DrawResultModal
        isDrawing={isDrawing}
        drawResult={drawResult}
        cardFlipped={cardFlipped}
        showResult={showResult}
        onClose={closeDraw}
      />

      <PityModal
        show={showPityModal}
        onClose={() => setShowPityModal(false)}
        pityType={pityType}
        wishes={wishes}
        claimPityWish={claimPityWish}
        onClaimed={() => {}}
      />

      <ShopModal
        show={showShopModal}
        onClose={() => setShowShopModal(false)}
        balance={balance}
        isLoading={isLoading}
        buyTickets={async (type, count) => {
          await buyTickets(type, count);
          const label = type === 'micro' ? '微光' : '拾光';
          setToastMsg(`成功购买 ${count} 张${label}奖券`);
        }}
      />

      {/* 删除确认弹窗 */}
      {deletingWish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div
            className="mx-4 p-6 rounded-2xl max-w-[320px] w-full"
            style={{ backgroundColor: appTheme.canvas }}
          >
            <h3 className="text-lg font-medium mb-2" style={{ color: appTheme.ink }}>
              确认删除
            </h3>
            <p className="text-sm mb-6" style={{ color: appTheme.inkMuted48 }}>
              确定要删除心愿「{deletingWish.title}」吗？此操作不可撤销。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingWish(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ backgroundColor: appTheme.surfacePearl, color: appTheme.ink }}
              >
                取消
              </button>
              <button
                onClick={async () => {
                  await deleteWish(deletingWish.id);
                  setDeletingWish(null);
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ backgroundColor: '#E65C5C', color: '#fff' }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

    </PageContainer>

    <Toast
      message={toastMsg ?? ''}
      visible={!!toastMsg}
      onClose={() => setToastMsg(null)}
    />
    </>
  );
}
