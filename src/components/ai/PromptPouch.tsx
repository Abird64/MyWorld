import { useRef } from 'react';
import type { PromptTemplate } from '@/utils/builtinPrompts';
import { useAppTheme } from '@/stores/themeStore';

interface PromptPouchProps {
  prompts: PromptTemplate[];
  onSelect: (prompt: PromptTemplate) => void;
}

export function PromptPouch({ prompts, onSelect }: PromptPouchProps) {
  const appTheme = useAppTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (prompts.length === 0) return null;

  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    e.preventDefault();
    scrollRef.current.scrollLeft += e.deltaY;
  };

  return (
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
      style={{ scrollbarWidth: 'none' }}
    >
      {prompts.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p)}
          className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs transition-all border whitespace-nowrap"
          style={{
            color: `${appTheme.ink}99`,
            backgroundColor: `${appTheme.ink}08`,
            borderColor: `${appTheme.ink}0D`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = appTheme.primary;
            e.currentTarget.style.backgroundColor = `${appTheme.primary}12`;
            e.currentTarget.style.borderColor = `${appTheme.primary}33`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = `${appTheme.ink}99`;
            e.currentTarget.style.backgroundColor = `${appTheme.ink}08`;
            e.currentTarget.style.borderColor = `${appTheme.ink}0D`;
          }}
          title={p.prompt}
        >
          {p.title}
        </button>
      ))}
    </div>
  );
}
