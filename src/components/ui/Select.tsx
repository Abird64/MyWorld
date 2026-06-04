import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';

export interface SelectOption {
  value: string;
  label: string;
  color?: string; // optional color dot
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function Select({ value, onChange, options, placeholder = '请选择', className = '' }: SelectProps) {
  const appTheme = useAppTheme();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const txt = appTheme.ink;
  const txtHint = withAlpha(txt, 0.35);
  const txtMid = withAlpha(txt, 0.5);
  const bgSubtle = withAlpha(txt, 0.05);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 60,
      });
    }
  }, [open]);

  return (
    <div ref={triggerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors"
        style={{
          backgroundColor: bgSubtle,
          color: selectedOption ? txt : txtHint,
        }}
      >
        <span className="flex items-center gap-2">
          {selectedOption?.color && (
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedOption.color }} />
          )}
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown size={14} className={`transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} style={{ color: txtMid }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div
            style={dropdownStyle}
            className="rounded-xl py-1 border shadow-lg overflow-y-auto max-h-56"
            css-override="true"
          >
            <style>{`
              [css-override="true"] { background-color: ${appTheme.canvas}; border-color: ${withAlpha(txt, 0.1)}; }
            `}</style>
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
                  style={{
                    color: isSelected ? (opt.color || appTheme.primary) : txtMid,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = bgSubtle; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span className={isSelected ? '' : 'invisible'}>
                    <Check size={14} />
                  </span>
                  {opt.color && (
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
                  )}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
