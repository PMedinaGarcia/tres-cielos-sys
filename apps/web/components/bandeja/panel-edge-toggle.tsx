"use client";

type Side = "left" | "right";

type Props = {
  side: Side;
  expanded: boolean;
  onToggle: () => void;
  label: string;
  vertical?: boolean;
};

export function PanelRail({
  side,
  label,
  onExpand,
}: {
  side: Side;
  label: string;
  onExpand: () => void;
}) {
  return (
    <div className="glass flex h-full min-h-0 w-full flex-col items-center justify-start rounded-glass py-2">
      <PanelEdgeToggle
        side={side}
        expanded={false}
        onToggle={onExpand}
        label={label}
        vertical
      />
    </div>
  );
}

export function PanelEdgeToggle({ side, expanded, onToggle, label, vertical }: Props) {
  const pointsRight = side === "left" ? expanded : !expanded;
  const rotation = vertical
    ? pointsRight
      ? "rotate-90"
      : "-rotate-90"
    : pointsRight
      ? ""
      : "rotate-180";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink/45 transition hover:bg-white/60 hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className={`h-3.5 w-3.5 ${rotation}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 3.5 10.5 8 6 12.5" />
      </svg>
    </button>
  );
}
