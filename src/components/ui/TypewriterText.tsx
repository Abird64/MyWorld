import { useState, useEffect } from 'react';

interface TypewriterTextProps {
  texts: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function TypewriterText({
  texts,
  typingSpeed = 80,
  deletingSpeed = 40,
  pauseDuration = 2500,
  className = '',
  style,
}: TypewriterTextProps) {
  const [textIndex, setTextIndex] = useState(() => Math.floor(Math.random() * texts.length));
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentText = texts[textIndex] || '';

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (!isDeleting && charIndex < currentText.length) {
      timer = setTimeout(() => setCharIndex((c) => c + 1), typingSpeed);
    } else if (!isDeleting && charIndex === currentText.length) {
      timer = setTimeout(() => setIsDeleting(true), pauseDuration);
    } else if (isDeleting && charIndex > 0) {
      timer = setTimeout(() => setCharIndex((c) => c - 1), deletingSpeed);
    } else if (isDeleting && charIndex === 0) {
      setIsDeleting(false);
      setTextIndex((i) => {
        if (texts.length <= 1) return 0;
        let next = i;
        while (next === i) next = Math.floor(Math.random() * texts.length);
        return next;
      });
    }

    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, currentText, typingSpeed, deletingSpeed, pauseDuration]);

  return (
    <span className={className} style={style}>
      {currentText.slice(0, charIndex)}
      <span
        className="inline-block w-[1px] h-[1em] ml-[1px] align-middle animate-pulse"
        style={{ backgroundColor: 'currentColor', opacity: 0.6 }}
      />
    </span>
  );
}
