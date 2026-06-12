/**
 * AI HOT 服务 - 封装 AI 资讯相关的 Tauri 命令调用
 */
import { tauriInvoke } from './tauri';

export interface AihotItem {
  id?: string;
  title: string;
  titleEn?: string;
  url: string;
  source: string;
  publishedAt?: string;
  summary?: string;
  category?: string;
  score?: number;
  selected?: boolean;
}

export interface AihotItemsResponse {
  count: number;
  hasNext: boolean;
  nextCursor?: string;
  items: AihotItem[];
}

export interface AihotDailyItem {
  title: string;
  summary?: string;
  sourceUrl?: string;
  sourceName?: string;
}

export interface AihotDailySection {
  label: string;
  items: AihotDailyItem[];
}

export interface AihotFlash {
  title: string;
  sourceName?: string;
  sourceUrl?: string;
  publishedAt?: string;
}

export interface AihotDailyResponse {
  date: string;
  lead?: { title?: string; leadParagraph?: string };
  sections: AihotDailySection[];
  flashes?: AihotFlash[];
}

export interface AihotDailyIndex {
  date: string;
  leadTitle?: string;
}

export interface AihotDailiesResponse {
  count: number;
  items: AihotDailyIndex[];
}

/** 获取精选/全部条目 */
export async function fetchItems(params?: {
  mode?: string;
  category?: string;
  since?: string;
  take?: number;
  query?: string;
}): Promise<AihotItemsResponse> {
  return tauriInvoke<AihotItemsResponse>('fetch_aihot_items', {
    mode: params?.mode,
    category: params?.category,
    since: params?.since,
    take: params?.take,
    q: params?.query,
  });
}

/** 获取最新日报 */
export async function fetchDaily(): Promise<AihotDailyResponse> {
  return tauriInvoke<AihotDailyResponse>('fetch_aihot_daily');
}

/** 获取指定日期日报 */
export async function fetchDailyByDate(date: string): Promise<AihotDailyResponse> {
  return tauriInvoke<AihotDailyResponse>('fetch_aihot_daily_by_date', { date });
}

/** 获取日报归档列表 */
export async function fetchDailies(take?: number): Promise<AihotDailiesResponse> {
  return tauriInvoke<AihotDailiesResponse>('fetch_aihot_dailies', { take });
}
