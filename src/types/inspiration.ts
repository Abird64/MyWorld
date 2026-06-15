/** 灵感分类 */
export interface InspirationCategory {
  id: string;
  name: string;
  icon: string;   // lucide 图标名，前端映射
  color: string;   // hex 色值
  isDefault: boolean;
}

/** 灵感笔记 */
export interface InspirationNote {
  id: string;
  title: string;
  content: string;
  /** 所属分类 ID */
  categoryId: string;
  /** 来源链接（可选） */
  sourceUrl?: string;
  /** 来源标题（可选，如视频标题） */
  sourceTitle?: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 创建灵感笔记的参数 */
export interface CreateInspirationParams {
  title: string;
  content: string;
  categoryId: string;
  sourceUrl?: string;
  sourceTitle?: string;
  tags?: string[];
}

// ─── 预设分类 ───

export const DEFAULT_CATEGORIES: InspirationCategory[] = [
  {
    id: 'shannian',
    name: '闪念记录',
    icon: 'zap',
    color: '#E8B959',
    isDefault: true,
  },
  {
    id: 'daiban',
    name: '行动清单',
    icon: 'check-square',
    color: '#3A8FB7',
    isDefault: true,
  },
  {
    id: 'zhishi',
    name: '知识点',
    icon: 'book-open',
    color: '#4CAF76',
    isDefault: true,
  },
  {
    id: 'jinju',
    name: '金句摘录',
    icon: 'quote',
    color: '#5856d6',
    isDefault: true,
  },
  {
    id: 'ziyuan',
    name: '资源收藏',
    icon: 'folder-open',
    color: '#B87353',
    isDefault: true,
  },
  {
    id: 'fansi',
    name: '随想反思',
    icon: 'brain',
    color: '#C97070',
    isDefault: true,
  },
];
