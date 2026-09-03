import { cn } from "@repo/ui";
import wordmarkOnLight from "@/assets/brand/rg-wordmark-on-light.svg";
import wordmarkOnDark from "@/assets/brand/rg-wordmark-on-dark.svg";
import compactOnLight from "@/assets/brand/rg-compact-on-light.svg";
import compactOnDark from "@/assets/brand/rg-compact-on-dark.svg";
import compactMicroOnLight from "@/assets/brand/rg-compact-micro-on-light.svg";
import compactMicroOnDark from "@/assets/brand/rg-compact-micro-on-dark.svg";

const WORDMARK = { width: 1260, height: 288 } as const;
const COMPACT = { width: 596, height: 743 } as const;

const ASSETS = {
  primary: {
    light: { src: wordmarkOnLight, ...WORDMARK },
    dark: { src: wordmarkOnDark, ...WORDMARK },
  },
  compact: {
    light: { src: compactOnLight, ...COMPACT },
    dark: { src: compactOnDark, ...COMPACT },
  },
  compactMicro: {
    light: { src: compactMicroOnLight, ...COMPACT },
    dark: { src: compactMicroOnDark, ...COMPACT },
  },
} as const;

export type BrandLogoProps = {
  variant: "primary" | "compact" | "compactMicro";
  surface: "light" | "dark" | "adaptive";
  decorative?: boolean;
  className?: string;
};

const imgClassName = "block h-full w-auto max-h-full max-w-full object-contain object-left";

function BrandMarkImg({
  src,
  width,
  height,
  className,
}: {
  src: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <img
      src={src}
      width={width}
      height={height}
      alt=""
      draggable={false}
      className={cn(imgClassName, className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    />
  );
}

export function BrandLogo({ variant, surface, decorative = false, className }: BrandLogoProps) {
  const pair = ASSETS[variant];

  return (
    <div
      className={cn("inline-flex max-w-full items-center", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Refurb Genius"}
      aria-hidden={decorative ? true : undefined}
    >
      {surface === "light" ? (
        <BrandMarkImg {...pair.light} />
      ) : surface === "dark" ? (
        <BrandMarkImg {...pair.dark} />
      ) : (
        <>
          <BrandMarkImg {...pair.light} className="dark:hidden" />
          <BrandMarkImg {...pair.dark} className="hidden dark:block" />
        </>
      )}
    </div>
  );
}
