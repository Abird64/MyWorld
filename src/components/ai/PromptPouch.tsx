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
    <>
      <style>{`
        .pouch-btn {
          color: ${appTheme.ink}99;
          background-color: ${appTheme.ink}08;
          border-color: ${appTheme.ink}0D;
        }
        .pouch-btn:hover {
          color: ${appTheme.primary};
          background-color: ${appTheme.primary}12;
          border-color: ${appTheme.primary}33;
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
