/**
 * 心愿服务 - 封装所有心愿系统的 Tauri 命令调用
 */
import { tauriInvoke } from './tauri';
import type { Wish, WishDraw, GlowBalance, CreateWishInput, UpdateWishInput, DrawResult } from '@/types/wish';

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
  return tauriInvoke<Wish>('create_wish', input);
}

/** 更新心愿 */
export async function updateWish(input: UpdateWishInput): Promise<Wish> {
  return tauriInvoke<Wish>('update_wish', input);
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
  return tauriInvoke<GlowBalance>('add_glow', { amount, source });
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

/** 兑换心愿（抽到后用萤火购买） */
export async function redeemWish(wishId: string): Promise<Wish> {
  return tauriInvoke<Wish>('redeem_wish', { wishId });
}
