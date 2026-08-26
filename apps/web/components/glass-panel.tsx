import type { ReactNode } from "react";

type GlassPanelProps = {
  children: ReactNode;
  className?: string;
  strong?: boolean;
};

export function GlassPanel({
  children,
  className = "",
  strong = false,
}: GlassPanelProps) {
  return (
    <div
      className={`${strong ? "glass-strong" : "glass"} rounded-glass ${className}`.trim()}
    >
      {children}
    </div>
  );
}
