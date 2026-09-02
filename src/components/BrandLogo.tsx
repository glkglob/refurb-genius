import { cn } from "@repo/ui";
import logoLight from "@/assets/brand/logo-light-horizontal.png";
import logoDark from "@/assets/brand/logo-dark-horizontal.jpg";

const LIGHT_WIDTH = 597;
const LIGHT_HEIGHT = 165;
const DARK_WIDTH = 593;
const DARK_HEIGHT = 164;

type BrandLogoProps = {
  className?: string;
  /** When true, hide the mark from the accessibility tree (parent already names the product). */
  decorative?: boolean;
};

const imgClassName = "block h-auto w-full max-w-full object-contain object-left";

export function BrandLogo({ className, decorative = false }: BrandLogoProps) {
  return (
    <div
      className={cn("inline-block max-w-full", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Refurb Genius"}
      aria-hidden={decorative ? true : undefined}
    >
      <img
        src={logoLight}
        width={LIGHT_WIDTH}
        height={LIGHT_HEIGHT}
        alt=""
        draggable={false}
        className={cn(imgClassName, "dark:hidden")}
        style={{ aspectRatio: `${LIGHT_WIDTH} / ${LIGHT_HEIGHT}` }}
      />
      <img
        src={logoDark}
        width={DARK_WIDTH}
        height={DARK_HEIGHT}
        alt=""
        draggable={false}
        className={cn(imgClassName, "hidden dark:block")}
        style={{ aspectRatio: `${DARK_WIDTH} / ${DARK_HEIGHT}` }}
      />
    </div>
  );
}
