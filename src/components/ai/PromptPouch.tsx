import { useRef } from 'react';
import type { PromptTemplate } from '@/utils/builtinPrompts';
import { useAppTheme, withAlpha } from '@/stores/themeStore';

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
    <>
      <style>{`
        .pouch-btn {
          color: ${withAlpha(appTheme.ink, 0.6)};
          background-color: ${withAlpha(appTheme.ink, 0.03)};
          border-color: ${withAlpha(appTheme.ink, 0.05)};
        }
        .pouch-btn:hover {
          color: ${appTheme.primary};
          background-color: ${withAlpha(appTheme.primary, 0.07)};
          border-color: ${withAlpha(appTheme.primary, 0.2)};
        }
      `}</style>
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
            className="pouch-btn flex-shrink-0 px-2.5 py-1 rounded-full text-xs transition-all border whitespace-nowrap"
            title={p.prompt}
          >
            {p.title}
          </button>
        ))}
      </div>
    </>
  );
}
