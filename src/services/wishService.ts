/**
 * 心愿服务 - 封装所有心愿系统的 Tauri 命令调用
 */
import { tauriInvoke } from './tauri';
import type { Wish, WishDraw, GlowBalance, CreateWishInput, UpdateWishInput, DrawResult, PityProgress, GlowLedgerResult, InventoryItem } from '@/types/wish';

/** 获取心愿列表 */
export async function listWishes(status?: string): Promise<Wish[]> {
  return tauriInvoke<Wish[]>('list_wishes', { status });
}

/** 获取单个心愿 */
export async function getWish(id: string): Promise<Wish | null> {
  return tauriInvoke<Wish | null>('get_wish', { id });
}

/** 创建心愿 */
export async function createWish(input: CreateWishInput): Promise<Wish> {
  return tauriInvoke<Wish>('create_wish', { input });
}

/** 更新心愿 */
export async function updateWish(input: UpdateWishInput): Promise<Wish> {
  return tauriInvoke<Wish>('update_wish', { input });
}

/** 删除心愿 */
export async function deleteWish(id: string): Promise<void> {
  return tauriInvoke<void>('delete_wish', { id });
}

/** 标记心愿已达成 */
export async function markWishAchieved(id: string): Promise<void> {
  return tauriInvoke<void>('mark_wish_achieved', { id });
}

/** 获取萤火余额 */
export async function getGlowBalance(): Promise<GlowBalance> {
  return tauriInvoke<GlowBalance>('get_glow_balance');
}

/** 增加萤火 */
export async function addGlow(amount: number, source: string): Promise<GlowBalance> {
  return tauriInvoke<GlowBalance>('add_glow', { input: { amount, source } });
}

/** 增加奖券 */
export async function addTickets(micro: number, shimmer: number): Promise<GlowBalance> {
  return tauriInvoke<GlowBalance>('add_tickets', { micro, shimmer });
}

/** 获取抽奖记录 */
export async function listDraws(limit?: number): Promise<WishDraw[]> {
  return tauriInvoke<WishDraw[]>('list_draws', { limit: limit ?? 20 });
}

/** 获取保底进度 */
export async function getPityProgress(ticketType: 'micro' | 'shimmer'): Promise<PityProgress> {
  return tauriInvoke<PityProgress>('get_pity_progress', { ticketType });
}

/** 抽奖 */
export async function drawWish(ticketType: 'micro' | 'shimmer'): Promise<DrawResult> {
  return tauriInvoke<DrawResult>('draw_wish', { ticketType });
}

/** 购买奖券 */
export async function buyTickets(ticketType: 'micro' | 'shimmer', count: number): Promise<GlowBalance> {
  return tauriInvoke<GlowBalance>('buy_tickets', { ticketType, count });
}

/** 保底自选（抽满保底次数后免费任选） */
export async function claimPityWish(ticketType: 'micro' | 'shimmer', wishId: string): Promise<DrawResult> {
  return tauriInvoke<DrawResult>('claim_pity_wish', { ticketType, wishId });
}

/** 兑换心愿（抽到后用萤火购买） */
export async function redeemWish(wishId: string): Promise<Wish> {
  return tauriInvoke<Wish>('redeem_wish', { wishId });
}

/** 获取萤火账本 */
export async function listGlowLedger(params?: {
  assetType?: 'glow' | 'micro_ticket' | 'shimmer_ticket';
  reason?: string;
  limit?: number;
  offset?: number;
}): Promise<GlowLedgerResult> {
  return tauriInvoke<GlowLedgerResult>('list_glow_ledger', {
    assetType: params?.assetType,
    reason: params?.reason,
    limit: params?.limit,
    offset: params?.offset,
  });
}

/** 查询仓库：未核销的中奖记录 */
export async function listInventory(): Promise<InventoryItem[]> {
  return tauriInvoke<InventoryItem[]>('list_inventory');
}

/** 核销仓库物品 */
export async function redeemDraw(drawId: string): Promise<void> {
  return tauriInvoke<void>('redeem_draw', { drawId });
}

/** 获取待核销数量 */
export async function getInventoryCount(): Promise<number> {
  return tauriInvoke<number>('get_inventory_count');
}

/** 调整心愿剩余库存 */
export async function adjustWishStock(wishId: string, delta: number): Promise<Wish> {
  return tauriInvoke<Wish>('adjust_wish_stock', { wishId, delta });
}
