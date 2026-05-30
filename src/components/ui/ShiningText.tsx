import { motion } from "motion/react";
import { useAppTheme } from "@/stores/themeStore";

export function ShiningText({ text }: { text: string }) {
  const appTheme = useAppTheme();
  return (
    <motion.span
      className="inline-block text-sm font-light"
      style={{
        backgroundImage: `linear-gradient(110deg, ${appTheme.inkMuted48}, 35%, ${appTheme.ink}, 50%, ${appTheme.inkMuted48}, 75%, ${appTheme.inkMuted48})`,
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
      initial={{ backgroundPosition: "200% 0" }}
      animate={{ backgroundPosition: "-200% 0" }}
      transition={{
        repeat: Infinity,
        duration: 2,
        ease: "linear",
      }}
    >
      {text}
    </motion.span>
  );
}
