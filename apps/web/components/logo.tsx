import Image from "next/image";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { width: 140, height: 168, className: "h-11 w-auto" },
  md: { width: 180, height: 216, className: "h-16 w-auto" },
  lg: { width: 240, height: 288, className: "h-28 w-auto" },
};

export function Logo({ size = "md", className = "" }: LogoProps) {
  const s = sizes[size];
  return (
    <Image
      src="/logos/tres-cielos.png"
      alt="TRESCIELOS"
      width={s.width}
      height={s.height}
      priority
      className={`${s.className} object-contain ${className}`.trim()}
    />
  );
}
