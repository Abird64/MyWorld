import { useAppTheme } from '@/stores/themeStore';

interface CapsuleTabItem {
  id: string;
  label: string;
}

interface CapsuleTabsProps {
  items: CapsuleTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  accentColor?: string;
  isDark?: boolean;
  className?: string;
}

export function CapsuleTabs({
  items,
  activeId,
  onChange,
  accentColor,
  className = '',
}: CapsuleTabsProps) {
  const appTheme = useAppTheme();
  const accent = accentColor ?? appTheme.primary;
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {items.map((item) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className="px-4 py-1.5 rounded-full text-sm transition-all duration-200 btn-press"
            style={{
              backgroundColor: isActive ? accent : 'transparent',
              color: isActive ? appTheme.onPrimary : appTheme.ink,
              border: isActive ? 'none' : `1px solid ${appTheme.hairline}`,
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
