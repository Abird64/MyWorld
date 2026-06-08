import { useAppTheme, withAlpha } from '@/stores/themeStore';
import type { Wish, WishLevel } from '@/types/wish';
import { WISH_LEVELS, WISH_LEVEL_VALUES } from '@/types/wish';

export interface WishFormData {
  title: string;
  description: string;
  level: WishLevel;
  quantity: number;
  isInfinite: boolean;
}

interface WishFormModalProps {
  show: boolean;
  editingWish: Wish | null;
  formData: WishFormData;
  setFormData: (data: WishFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function WishFormModal({ show, editingWish, formData, setFormData, onSubmit, onClose }: WishFormModalProps) {
  const appTheme = useAppTheme();

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ backgroundColor: appTheme.canvas }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: appTheme.ink }}>
          {editingWish ? '编辑心愿' : '添加心愿'}
        </h3>

        <form onSubmit={onSubmit} className="space-y-4">
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
              {WISH_LEVEL_VALUES.map((level) => {
                const config = WISH_LEVELS[level];
                const isSelected = formData.level === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        level,
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
              onClick={onClose}
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
  );
}
