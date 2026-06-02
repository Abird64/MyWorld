import { useEffect, useState } from 'react';
import { NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { useMemoryStore } from '@/stores/memoryStore';
import { useAppTheme } from '@/stores/themeStore';
import { useUIStore } from '@/stores/uiStore';
import { MEMORY_TYPE_LABELS, MEMORY_TYPE_ICONS } from '@/types/memory';
import type { Memory } from '@/types/memory';
import { formatRelativeTime } from '@/utils/dateFormat';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const ALL_TYPES = ['identity', 'interest', 'taste', 'habit', 'personality', 'relationship', 'status', 'goal', 'event', 'other'] as const;

function groupByType(memories: Memory[]): Map<string, Memory[]> {
  const map = new Map<string, Memory[]>();
  for (const m of memories) {
    const list = map.get(m.memory_type) || [];
    list.push(m);
    map.set(m.memory_type, list);
  }
  return map;
}

export function MemoriesPage() {
  const appTheme = useAppTheme();
  const { memories, loading, selectedType, fetchMemories, deleteMemory, setSelectedType } =
    useMemoryStore();
  const activeSubPage = useUIStore((s) => s.activeSubPage);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (activeSubPage === 'memories') {
      fetchMemories();
    }
  }, [activeSubPage]);

  const handleDelete = async (id: string) => {
    await deleteMemory(id);
    setConfirmDelete(null);
  };

  const toggleSource = (id: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const grouped = groupByType(memories);

  const filterPills = [
    { key: null, label: '全部', icon: '📒' },
    ...ALL_TYPES.map(tp => ({
      key: tp,
      label: MEMORY_TYPE_LABELS[tp],
      icon: MEMORY_TYPE_ICONS[tp],
    })),
  ];

  return (
    <PageContainer className="flex flex-col" bgColor={appTheme.canvasParchment}>
      <NavBar title="笔记" />

      {/* 类型筛选栏 */}
      <div className="px-6 py-3 flex gap-2 overflow-x-auto">
        {filterPills.map(pill => {
          const isActive = selectedType === pill.key;
          return (
            <button
              key={pill.key ?? '__all__'}
              onClick={() => setSelectedType(pill.key)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all"
              style={{
                backgroundColor: isActive ? appTheme.primary : 'transparent',
                color: isActive ? appTheme.onPrimary : appTheme.ink,
                border: `1px solid ${isActive ? appTheme.primary : appTheme.hairline}`,
                opacity: isActive ? 1 : 0.7,
              }}
            >
              <span>{pill.icon}</span>
              <span>{pill.label}</span>
            </button>
          );
        })}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: appTheme.ink }}>
            加载中...
          </div>
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-4" style={{ color: appTheme.ink }}>
            <span className="text-4xl">📒</span>
            <p className="text-center opacity-60">
              提灯还没有写任何笔记。
              <br />
              当你在对话中提到值得记住的事，提灯会帮你记下来。
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {ALL_TYPES.map(tp => {
              const items = grouped.get(tp);
              if (!items || items.length === 0) return null;
              return (
                <div key={tp}>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: appTheme.ink, opacity: 0.6 }}>
                    <span>{MEMORY_TYPE_ICONS[tp]}</span>
                    <span>{MEMORY_TYPE_LABELS[tp]}</span>
                    <span>({items.length})</span>
                  </h3>
                  <div className="space-y-3">
                    {items.map(m => (
                      <div
                        key={m.id}
                        className="rounded-2xl p-4 transition-all"
                        style={{
                          backgroundColor: appTheme.canvas,
                          color: appTheme.ink,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="flex-1 text-base leading-relaxed">{m.content}</p>
                          <button
                            onClick={() => setConfirmDelete(m.id)}
                            className="p-1 rounded-lg opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                            style={{ color: appTheme.danger }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {m.source_text && (
                          <div className="mt-2">
                            <button
                              onClick={() => toggleSource(m.id)}
                              className="flex items-center gap-1 text-xs opacity-50 hover:opacity-80 transition-opacity"
                              style={{ color: appTheme.ink }}
                            >
                              {expandedSources.has(m.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              来源
                            </button>
                            {expandedSources.has(m.id) && (
                              <p
                                className="mt-1 text-xs px-3 py-2 rounded-xl opacity-70"
                                style={{
                                  backgroundColor: appTheme.divider,
                                  color: appTheme.ink,
                                }}
                              >
                                {m.source_text}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="mt-2 text-xs opacity-40" style={{ color: appTheme.ink }}>
                          {formatRelativeTime(m.created_at)}
                        </div>

                        {/* 删除确认 */}
                        {confirmDelete === m.id && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs opacity-60" style={{ color: appTheme.ink }}>
                              确定删除这条记忆？
                            </span>
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="px-3 py-1 rounded-lg text-xs text-white"
                              style={{ backgroundColor: appTheme.danger }}
                            >
                              确认
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-3 py-1 rounded-lg text-xs"
                              style={{
                                backgroundColor: appTheme.canvasParchment,
                                color: appTheme.ink,
                              }}
                            >
                              取消
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
