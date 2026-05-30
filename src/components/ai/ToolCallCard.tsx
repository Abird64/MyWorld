import { useState } from 'react';
import { Check, X, Trash2, Loader2, CircleCheck, Search, Send, Pencil, Zap } from 'lucide-react';
import type { ToolCallDef } from '@/types/ai';
import { parseGenericArgs } from '@/utils/aiParsers';
import { TOOL_LABELS } from '@/utils/aiLabels';
import { SKILL_COLORS } from '@/styles/theme';
import { useAppTheme } from '@/stores/themeStore';

/** skill_id → 中文名 */
const SKILL_NAME_MAP: Record<string, string> = {};
for (const [id, info] of Object.entries(SKILL_COLORS)) {
  SKILL_NAME_MAP[id] = info.name;
}

interface ToolCallCardProps {
  toolCall: ToolCallDef;
  isExecuting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onModify?: (feedback: string) => void;
  info?: { group: string; label: string; color: string };
}

export function ToolCallCard(props: ToolCallCardProps) {
  const appTheme = useAppTheme();
  const { toolCall } = props;

  const info = TOOL_LABELS[toolCall.function.name];
  if (!info) {
    return (
      <div className="mt-2 p-3 rounded-xl border text-xs" style={{ backgroundColor: appTheme.canvas, borderColor: appTheme.hairline, color: appTheme.inkMuted48 }}>
        未知操作: {toolCall.function.name}
      </div>
    );
  }

  switch (info.group) {
    case '创建':
      return <CreateCard {...props} info={info} />;
    case '执行':
      return <ExecuteCard {...props} info={info} />;
    case '删除':
      return <DeleteCard {...props} info={info} />;
    case '修改':
      return <UpdateCard {...props} info={info} />;
    case '查询':
      return <QueryCard {...props} info={info} />;
    default:
      return <GenericCard {...props} info={info} />;
  }
}

// ========== 分组卡片：创建类 ==========

function CreateCard({ toolCall, isExecuting, onConfirm, onCancel, onModify, info }: ToolCallCardProps) {
  const appTheme = useAppTheme();
  const params = parseGenericArgs(toolCall);
  const [modifyMode, setModifyMode] = useState(false);

  // 提取展示字段
  const title = (params.title as string) || (params.name as string) || '';
  const detailLines = buildDetailLines(toolCall.function.name, params);

  return (
    <div className="mt-2 rounded-xl border overflow-hidden" style={{ backgroundColor: appTheme.canvas, borderColor: `${info?.color || '#58A968'}30` }}>
      <CardHeader icon={<Check size={12} />} color={info?.color || '#58A968'} title={info?.label || '创建'} />
      <div className="px-4 py-3 space-y-2">
        {title ? <div><span className="text-sm font-medium" style={{ color: appTheme.ink }}>{title}</span></div> : null}
        {detailLines.map((line, i) => (
          <p key={i} className="text-xs" style={{ color: appTheme.inkMuted48 }}>{line}</p>
        ))}
      </div>
      {modifyMode ? (
        <CardModifyInput onSubmit={(text) => { onModify?.(text); setModifyMode(false); }} onBack={() => setModifyMode(false)} />
      ) : (
        <CardActions
          isExecuting={isExecuting} onConfirm={onConfirm} onCancel={onCancel}
          onModifyClick={onModify ? () => setModifyMode(true) : undefined}
          confirmLabel="确认" confirmColor={info?.color || '#58A968'}
        />
      )}
    </div>
  );
}

// ========== 分组卡片：执行类（完成/确认） ==========

function ExecuteCard({ toolCall, isExecuting, onConfirm, onCancel, onModify, info }: ToolCallCardProps) {
  const appTheme = useAppTheme();
  const params = parseGenericArgs(toolCall);
  const [modifyMode, setModifyMode] = useState(false);
  const query = (params.query as string) || '';
  const detailLines = buildDetailLines(toolCall.function.name, params);

  return (
    <div className="mt-2 rounded-xl border overflow-hidden" style={{ backgroundColor: appTheme.canvas, borderColor: `${info?.color || '#7CB342'}30` }}>
      <CardHeader icon={<CircleCheck size={12} />} color={info?.color || '#7CB342'} title={info?.label || '执行'} />
      <div className="px-4 py-3 space-y-2">
        {query ? (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>搜索：</span>
            <span className="text-sm font-medium" style={{ color: appTheme.ink }}>"{query}"</span>
          </div>
        ) : null}
        {detailLines.map((line, i) => (
          <p key={i} className="text-xs" style={{ color: appTheme.inkMuted48 }}>{line}</p>
        ))}
      </div>
      {modifyMode ? (
        <CardModifyInput onSubmit={(text) => { onModify?.(text); setModifyMode(false); }} onBack={() => setModifyMode(false)} />
      ) : (
        <CardActions
          isExecuting={isExecuting} onConfirm={onConfirm} onCancel={onCancel}
          onModifyClick={onModify ? () => setModifyMode(true) : undefined}
          confirmLabel="确认" confirmColor={info?.color || '#7CB342'}
        />
      )}
    </div>
  );
}

// ========== 分组卡片：删除类 ==========

function DeleteCard({ toolCall, isExecuting, onConfirm, onCancel, onModify, info }: ToolCallCardProps) {
  const appTheme = useAppTheme();
  const params = parseGenericArgs(toolCall);
  const [modifyMode, setModifyMode] = useState(false);
  const query = (params.query as string) || '';

  return (
    <div className="mt-2 rounded-xl border overflow-hidden" style={{ backgroundColor: appTheme.canvas, borderColor: `${info?.color || '#E65C5C'}30` }}>
      <CardHeader icon={<Trash2 size={12} />} color={info?.color || '#E65C5C'} title={info?.label || '删除'} />
      <div className="px-4 py-3 space-y-2">
        {query ? (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>搜索：</span>
            <span className="text-sm font-medium" style={{ color: appTheme.ink }}>"{query}"</span>
          </div>
        ) : null}
        <p className="text-xs" style={{ color: '#E65C5C' }}>此操作不可撤销，请确认</p>
      </div>
      {modifyMode ? (
        <CardModifyInput onSubmit={(text) => { onModify?.(text); setModifyMode(false); }} onBack={() => setModifyMode(false)} />
      ) : (
        <CardActions
          isExecuting={isExecuting} onConfirm={onConfirm} onCancel={onCancel}
          onModifyClick={onModify ? () => setModifyMode(true) : undefined}
          confirmLabel="确认删除" confirmColor={info?.color || '#E65C5C'}
        />
      )}
    </div>
  );
}

// ========== 分组卡片：修改类 ==========

function UpdateCard({ toolCall, isExecuting, onConfirm, onCancel, onModify, info }: ToolCallCardProps) {
  const appTheme = useAppTheme();
  const params = parseGenericArgs(toolCall);
  const [modifyMode, setModifyMode] = useState(false);
  const query = (params.query as string) || '';
  const detailLines = buildDetailLines(toolCall.function.name, params);

  return (
    <div className="mt-2 rounded-xl border overflow-hidden" style={{ backgroundColor: appTheme.canvas, borderColor: `${info?.color || '#E8B959'}30` }}>
      <CardHeader icon={<Pencil size={12} />} color={info?.color || '#E8B959'} title={info?.label || '修改'} />
      <div className="px-4 py-3 space-y-2">
        {query ? (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>搜索：</span>
            <span className="text-sm font-medium" style={{ color: appTheme.ink }}>"{query}"</span>
          </div>
        ) : null}
        {detailLines.map((line, i) => (
          <p key={i} className="text-xs" style={{ color: appTheme.inkMuted48 }}>{line}</p>
        ))}
      </div>
      {modifyMode ? (
        <CardModifyInput onSubmit={(text) => { onModify?.(text); setModifyMode(false); }} onBack={() => setModifyMode(false)} />
      ) : (
        <CardActions
          isExecuting={isExecuting} onConfirm={onConfirm} onCancel={onCancel}
          onModifyClick={onModify ? () => setModifyMode(true) : undefined}
          confirmLabel="确认修改" confirmColor={info?.color || '#E8B959'}
        />
      )}
    </div>
  );
}

// ========== 分组卡片：查询类 ==========

function QueryCard({ toolCall, isExecuting, onConfirm, onCancel, onModify, info }: ToolCallCardProps) {
  const appTheme = useAppTheme();
  const params = parseGenericArgs(toolCall);
  const [modifyMode, setModifyMode] = useState(false);
  const query = (params.query as string) || (params.date as string) || '';
  const detailLines = buildDetailLines(toolCall.function.name, params);

  return (
    <div className="mt-2 rounded-xl border overflow-hidden" style={{ backgroundColor: appTheme.canvas, borderColor: `${info?.color || '#6B9BD2'}30` }}>
      <CardHeader icon={<Search size={12} />} color={info?.color || '#6B9BD2'} title={info?.label || '查询'} />
      <div className="px-4 py-3 space-y-2">
        {query ? (
          <span className="text-sm font-medium" style={{ color: appTheme.ink }}>"{query}"</span>
        ) : (
          <span className="text-sm" style={{ color: appTheme.inkMuted48 }}>查询</span>
        )}
        {detailLines.map((line, i) => (
          <p key={i} className="text-xs" style={{ color: appTheme.inkMuted48 }}>{line}</p>
        ))}
      </div>
      {modifyMode ? (
        <CardModifyInput onSubmit={(text) => { onModify?.(text); setModifyMode(false); }} onBack={() => setModifyMode(false)} />
      ) : (
        <CardActions
          isExecuting={isExecuting} onConfirm={onConfirm} onCancel={onCancel}
          onModifyClick={onModify ? () => setModifyMode(true) : undefined}
          confirmLabel="执行" confirmColor={info?.color || '#6B9BD2'}
        />
      )}
    </div>
  );
}

// ========== 兜底卡片 ==========

function GenericCard({ toolCall, isExecuting, onConfirm, onCancel, info }: ToolCallCardProps) {
  const appTheme = useAppTheme();
  const params = parseGenericArgs(toolCall);
  const detailLines = buildDetailLines(toolCall.function.name, params);

  return (
    <div className="mt-2 rounded-xl border overflow-hidden" style={{ backgroundColor: appTheme.canvas, borderColor: appTheme.hairline }}>
      <CardHeader icon={<Zap size={12} />} color={info?.color || '#888'} title={info?.label || toolCall.function.name} />
      <div className="px-4 py-3 space-y-2">
        {detailLines.map((line, i) => (
          <p key={i} className="text-xs" style={{ color: appTheme.inkMuted48 }}>{line}</p>
        ))}
      </div>
      <CardActions
        isExecuting={isExecuting} onConfirm={onConfirm} onCancel={onCancel}
        confirmLabel="确认" confirmColor={info?.color || '#888'}
      />
    </div>
  );
}

// ========== 通用子组件 ==========

function CardHeader({ icon, color, title }: { icon: React.ReactNode; color: string; title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: `${color}12`, borderBottom: `1px solid ${color}20` }}>
      <div className="w-5 h-5 flex items-center justify-center rounded" style={{ backgroundColor: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <span className="text-sm font-medium" style={{ color }}>{title}</span>
    </div>
  );
}

function CardActions({
  isExecuting, onConfirm, onCancel, onModifyClick, confirmLabel, confirmColor,
}: {
  isExecuting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onModifyClick?: () => void;
  confirmLabel: string;
  confirmColor: string;
}) {
  const appTheme = useAppTheme();
  return (
    <div className="flex" style={{ borderTop: `1px solid ${appTheme.hairline}` }}>
      <button
        onClick={onConfirm}
        disabled={isExecuting}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm transition-colors disabled:opacity-50"
        style={{ color: confirmColor }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${confirmColor}0D`)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        {isExecuting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        {confirmLabel}
      </button>
      {onModifyClick && (
        <>
          <div className="w-px" style={{ backgroundColor: appTheme.hairline }} />
          <button
            onClick={onModifyClick}
            disabled={isExecuting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm transition-colors disabled:opacity-50"
            style={{ color: '#C08B30' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#C08B30' + '0D')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Pencil size={14} />
            修改
          </button>
        </>
      )}
      <div className="w-px" style={{ backgroundColor: appTheme.hairline }} />
      <button
        onClick={onCancel}
        disabled={isExecuting}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm transition-colors disabled:opacity-50"
        style={{ color: appTheme.inkMuted48 }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${appTheme.ink}0D`)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <X size={14} />
        取消
      </button>
    </div>
  );
}

function CardModifyInput({ onSubmit, onBack }: { onSubmit: (text: string) => void; onBack: () => void }) {
  const appTheme = useAppTheme();
  const [text, setText] = useState('');

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
  };

  return (
    <div className="px-4 py-3 space-y-2.5" style={{ borderTop: `1px solid ${appTheme.hairline}` }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        placeholder="补充你的意见，让 AI 重新生成..."
        autoFocus
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors"
        style={{ backgroundColor: `${appTheme.ink}08`, color: appTheme.ink }}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#C08B30' + '18', color: '#C08B30' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#C08B30' + '28')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#C08B30' + '18')}
        >
          <Send size={12} />
          发送
        </button>
        <button
          onClick={() => { setText(''); onBack(); }}
          className="px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={{ color: appTheme.inkMuted48 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = appTheme.ink)}
          onMouseLeave={(e) => (e.currentTarget.style.color = appTheme.inkMuted48)}
        >
          返回
        </button>
      </div>
    </div>
  );
}

// ========== 工具函数 ==========

/** 从通用参数中提取关键展示字段 */
function buildDetailLines(_toolName: string, params: Record<string, unknown>): string[] {
  const lines: string[] = [];

  // 忽略 query 字段（已在卡片标题区展示）
  const skip = new Set(['query', 'title', 'name', 'content']);

  for (const [key, value] of Object.entries(params)) {
    if (skip.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    if (key === 'status' || key === 'priority') continue; // 展示在 badge 区

    // XP 分配特殊处理
    if (key === 'xp_allocations' && Array.isArray(value)) {
      const xpParts = (value as Array<{ skill_id: string; xp_amount: number }>)
        .map((a) => `${SKILL_NAME_MAP[a.skill_id] || a.skill_id}+${a.xp_amount}`)
        .join('  ');
      if (xpParts) lines.push(`XP：${xpParts}`);
      continue;
    }

    // 联系方式特殊处理
    if (key === 'contact_methods' && Array.isArray(value)) {
      const methodLabels: Record<string, string> = {
        phone: '电话', wechat: '微信', qq: 'QQ', email: '邮箱', other: '其他',
      };
      const parts = (value as Array<{ method_type: string; value: string }>)
        .map((m) => `${methodLabels[m.method_type] || m.method_type}:${m.value}`);
      if (parts.length) lines.push(`${FIELD_LABELS[key] || key}：${parts.join('、')}`);
      continue;
    }

    const label = FIELD_LABELS[key] || key;
    const formatted = formatValue(key, value);
    if (formatted) {
      lines.push(`${label}：${formatted}`);
    }
  }

  return lines.slice(0, 8); // 最多展示8行
}

function formatValue(_key: string, value: unknown): string {
  if (typeof value === 'string') {
    // 截断过长的字符串
    if (value.length > 100) return value.slice(0, 100) + '...';
    return value;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.join('、');
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 80);
  return String(value);
}

const FIELD_LABELS: Record<string, string> = {
  description: '描述',
  scheduled_at: '计划时间',
  deadline: '截止时间',
  estimated_minutes: '预估耗时(分钟)',
  notes: '备注',
  tags: '标签',
  start_at: '开始时间',
  end_at: '结束时间',
  is_all_day: '全天',
  location: '地点',
  category: '分类',
  calendar_id: '日历',
  rrule: '重复规则',
  reminder: '提醒(分钟前)',
  date: '日期',
  mood: '心情',
  content: '内容',
  start_date: '开始日期',
  end_date: '结束日期',
  nickname: '昵称',
  group_name: '分组',
  birthday_calendar: '日历类型',
  birthday_year: '出生年份',
  birthday_month: '出生月份',
  birthday_day: '出生日期',
  contact_methods: '联系方式',
  year: '年',
  month: '月',
  event_type: '事件类型',
  frequency_type: '频率',
  icon: '图标',
  color: '颜色',
  habit_id: '习惯ID',
};
