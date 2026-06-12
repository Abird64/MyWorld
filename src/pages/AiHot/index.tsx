import { useEffect, useState, useCallback } from 'react';
import { NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useUIStore } from '@/stores/uiStore';
import * as aihotService from '@/services/aihotService';
import type { AihotItem, AihotDailyResponse } from '@/services/aihotService';
import { RefreshCw, ExternalLink, Loader2 } from 'lucide-react';

type Tab = 'selected' | 'daily';

const CATEGORY_LABELS: Record<string, string> = {
  'ai-models': '模型发布/更新',
  'ai-products': '产品发布/更新',
  'industry': '行业动态',
  'paper': '论文研究',
  'tip': '技巧与观点',
};

const CATEGORY_ORDER = ['ai-models', 'ai-products', 'industry', 'paper', 'tip'];

function formatTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} 小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay} 天前`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return '';
  }
}

function groupByCategory(items: AihotItem[]): Map<string, AihotItem[]> {
  const map = new Map<string, AihotItem[]>();
  for (const item of items) {
    const cat = item.category || 'other';
    const list = map.get(cat) || [];
    list.push(item);
    map.set(cat, list);
  }
  return map;
}

export function AiHotPage() {
  const appTheme = useAppTheme();
  const activeSubPage = useUIStore((s) => s.activeSubPage);

  const [tab, setTab] = useState<Tab>('selected');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AihotItem[]>([]);
  const [daily, setDaily] = useState<AihotDailyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSelected = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await aihotService.fetchItems({ mode: 'selected', take: 50 });
      setItems(resp.items);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDaily = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await aihotService.fetchDaily();
      setDaily(resp);
    } catch (e: unknown) {
      const msg = String(e);
      // 日报未生成时回退到昨天
      if (msg.includes('404') || msg.includes('No daily report')) {
        try {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const dateStr = yesterday.toISOString().split('T')[0];
          const resp = await aihotService.fetchDailyByDate(dateStr);
          setDaily(resp);
        } catch (e2) {
          setError(String(e2));
        }
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubPage !== 'aihot') return;
    if (tab === 'selected') {
      loadSelected();
    } else {
      loadDaily();
    }
  }, [activeSubPage, tab, loadSelected, loadDaily]);

  const handleRefresh = () => {
    if (tab === 'selected') loadSelected();
    else loadDaily();
  };

  return (
    <PageContainer className="flex flex-col" bgColor={appTheme.canvasParchment}>
      <NavBar title="AI 资讯" />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-4 pb-8">
        <div className="max-w-[800px] mx-auto space-y-4">

          {/* Tab 切换 */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: withAlpha(appTheme.ink, 0.06) }}>
            <TabButton
              label="精选"
              active={tab === 'selected'}
              onClick={() => setTab('selected')}
              appTheme={appTheme}
            />
            <TabButton
              label="日报"
              active={tab === 'daily'}
              onClick={() => setTab('daily')}
              appTheme={appTheme}
            />
            <button
              onClick={handleRefresh}
              className="ml-auto px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs btn-press"
              style={{ color: appTheme.inkMuted48 }}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              刷新
            </button>
          </div>

          {/* 内容区 */}
          {loading && (
            <div className="flex items-center justify-center py-16 gap-2" style={{ color: appTheme.inkMuted48 }}>
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">加载中…</span>
            </div>
          )}

          {error && !loading && (
            <div
              className="text-center py-12 px-4 rounded-xl text-sm"
              style={{ color: appTheme.danger, backgroundColor: withAlpha(appTheme.danger, 0.06) }}
            >
              {error}
            </div>
          )}

          {!loading && !error && tab === 'selected' && (
            <SelectedView items={items} appTheme={appTheme} />
          )}

          {!loading && !error && tab === 'daily' && daily && (
            <DailyView daily={daily} appTheme={appTheme} />
          )}

        </div>
      </div>
    </PageContainer>
  );
}

/* ─── Tab 按钮 ─── */
function TabButton({ label, active, onClick, appTheme }: {
  label: string;
  active: boolean;
  onClick: () => void;
  appTheme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors"
      style={{
        backgroundColor: active ? appTheme.canvas : 'transparent',
        color: active ? appTheme.ink : appTheme.inkMuted48,
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      {label}
    </button>
  );
}

/* ─── 精选视图：按 category 分组 ─── */
function SelectedView({ items, appTheme }: {
  items: AihotItem[];
  appTheme: ReturnType<typeof useAppTheme>;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-sm" style={{ color: appTheme.inkMuted48 }}>
        暂无精选内容
      </div>
    );
  }

  const groups = groupByCategory(items);
  let idx = 1;

  return (
    <div className="space-y-5">
      <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>
        共 {items.length} 条 · 按发布时间倒序
      </p>
      {CATEGORY_ORDER.map((cat) => {
        const catItems = groups.get(cat);
        if (!catItems) return null;
        return (
          <div key={cat}>
            <h3
              className="text-sm font-medium mb-2 px-1"
              style={{ color: appTheme.ink }}
            >
              {CATEGORY_LABELS[cat] || cat}
            </h3>
            <div
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.divider}` }}
            >
              {catItems.map((item, i) => {
                const currentIdx = idx++;
                return (
                  <ItemRow
                    key={item.id || i}
                    item={item}
                    index={currentIdx}
                    isLast={i === catItems.length - 1}
                    appTheme={appTheme}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── 日报视图 ─── */
function DailyView({ daily, appTheme }: {
  daily: AihotDailyResponse;
  appTheme: ReturnType<typeof useAppTheme>;
}) {
  let idx = 1;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-medium" style={{ color: appTheme.ink }}>
          AI HOT 日报 · {daily.date}
        </h2>
      </div>

      {daily.lead?.title && (
        <div
          className="p-4 rounded-xl text-sm"
          style={{
            backgroundColor: withAlpha(appTheme.primary, 0.06),
            color: appTheme.ink,
            border: `0.5px solid ${withAlpha(appTheme.primary, 0.15)}`,
          }}
        >
          <p className="font-medium mb-1">{daily.lead.title}</p>
          {daily.lead.leadParagraph && (
            <p style={{ color: appTheme.inkMuted48 }}>{daily.lead.leadParagraph}</p>
          )}
        </div>
      )}

      {daily.sections.map((section) => (
        <div key={section.label}>
          <h3
            className="text-sm font-medium mb-2 px-1"
            style={{ color: appTheme.ink }}
          >
            {section.label}
          </h3>
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.divider}` }}
          >
            {section.items.map((item, i) => {
              const currentIdx = idx++;
              return (
                <DailyItemRow
                  key={i}
                  item={item}
                  index={currentIdx}
                  isLast={i === section.items.length - 1}
                  appTheme={appTheme}
                />
              );
            })}
          </div>
        </div>
      ))}

      {daily.flashes && daily.flashes.length > 0 && (
        <div>
          <h3
            className="text-sm font-medium mb-2 px-1"
            style={{ color: appTheme.ink }}
          >
            快讯
          </h3>
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.divider}` }}
          >
            {daily.flashes.map((flash, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span style={{ color: appTheme.inkMuted48 }}>·</span>
                <div className="flex-1 min-w-0">
                  <span style={{ color: appTheme.ink }}>{flash.title}</span>
                  {flash.sourceName && (
                    <span className="ml-1 text-xs" style={{ color: appTheme.inkMuted48 }}>
                      — {flash.sourceName}
                    </span>
                  )}
                </div>
                {flash.sourceUrl && (
                  <a
                    href={flash.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 mt-0.5"
                    style={{ color: appTheme.primary }}
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 精选条目行 ─── */
function ItemRow({ item, index, isLast, appTheme }: {
  item: AihotItem;
  index: number;
  isLast: boolean;
  appTheme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <div
      className="px-4 py-3"
      style={{ borderBottom: isLast ? 'none' : `0.5px solid ${appTheme.divider}` }}
    >
      <div className="flex items-start gap-2">
        <span
          className="text-xs font-medium mt-0.5 flex-shrink-0 w-5 text-right"
          style={{ color: appTheme.inkMuted48 }}
        >
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[15px] font-medium hover:underline line-clamp-2"
              style={{ color: appTheme.ink }}
            >
              {item.title}
            </a>
            {item.score != null && (
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0"
                style={{
                  backgroundColor: withAlpha(appTheme.primary, 0.1),
                  color: appTheme.primary,
                }}
              >
                {item.score}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>
              {item.source}
            </span>
            {item.publishedAt && (
              <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>
                {formatTime(item.publishedAt)}
              </span>
            )}
          </div>
          {item.summary && (
            <p
              className="text-xs mt-1 line-clamp-2"
              style={{ color: appTheme.inkMuted80 }}
            >
              {item.summary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 日报条目行 ─── */
function DailyItemRow({ item, index, isLast, appTheme }: {
  item: { title: string; summary?: string; sourceUrl?: string; sourceName?: string };
  index: number;
  isLast: boolean;
  appTheme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <div
      className="px-4 py-3"
      style={{ borderBottom: isLast ? 'none' : `0.5px solid ${appTheme.divider}` }}
    >
      <div className="flex items-start gap-2">
        <span
          className="text-xs font-medium mt-0.5 flex-shrink-0 w-5 text-right"
          style={{ color: appTheme.inkMuted48 }}
        >
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <span className="text-[15px] font-medium" style={{ color: appTheme.ink }}>
              {item.title}
            </span>
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 mt-1"
                style={{ color: appTheme.primary }}
              >
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          {item.sourceName && (
            <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>
              {item.sourceName}
            </span>
          )}
          {item.summary && (
            <p
              className="text-xs mt-1 line-clamp-2"
              style={{ color: appTheme.inkMuted80 }}
            >
              {item.summary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
