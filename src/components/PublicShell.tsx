import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

/**
 * Public marketing / legal shell with a single document <main> landmark.
 * Pass `forceDark` for screens designed exclusively for the dark palette
 * (auth, hero marketing) so CSS variables stay correct even before theme hydration.
 */
export function PublicShell({
  children,
  footer,
  forceDark = false,
  className = "",
  mainClassName = "",
}: {
  children: ReactNode;
  footer?: ReactNode;
  forceDark?: boolean;
  className?: string;
  mainClassName?: string;
}) {
  return (
    <div
      className={`min-h-screen bg-background text-foreground ${forceDark ? "dark" : ""} ${className}`.trim()}
    >
      <Navbar />
      <main id="main-content" className={`outline-none ${mainClassName}`.trim()} tabIndex={-1}>
        {children}
      </main>
      {footer}
    </div>
  );
}
