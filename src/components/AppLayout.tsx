import type { ReactNode } from "react";
import { cn } from "@repo/ui";
import { Sidebar } from "./Sidebar";
import { RequireAuth } from "./RequireAuth";
import { MobileTopBar } from "./MobileTopBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { DealCopilotRail } from "./DealCopilotRail";
import { Footer } from "./Footer";

export function AppLayout({
  children,
  title,
  subtitle,
  actions,
  mobileBottomReserve = false,
  showDealCopilotRail = false,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Extra main padding so a mobile sticky CTA sits above the bottom nav. */
  mobileBottomReserve?: boolean;
  /** Web A contextual rail; rendered from `xl` only. */
  showDealCopilotRail?: boolean;
}) {
  return (
    <RequireAuth>
      <div className="flex min-h-dvh w-full bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-background focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="skip-to-main-content"
        >
          Skip to main content
        </a>
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <MobileTopBar />
          <div className="relative flex min-h-0 min-w-0 flex-1">
            <main
              id="main-content"
              tabIndex={-1}
              className={cn(
                "relative min-w-0 flex-1 overflow-x-hidden px-3 py-4 outline-none sm:px-8 sm:py-10",
                mobileBottomReserve
                  ? "pb-[calc(5.75rem+4.75rem+env(safe-area-inset-bottom,0px))] lg:pb-10"
                  : "pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] lg:pb-10",
              )}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_5%,oklch(0.76_0.16_171/0.08),transparent_30%),radial-gradient(circle_at_80%_0%,oklch(0.76_0.09_245/0.07),transparent_26%)]"
              />
              <div className="relative mx-auto max-w-7xl">
                {(title || actions) && (
                  <div className="glass-panel mb-6 rounded-2xl p-3 sm:mb-8 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        {title && (
                          <h1 className="break-words text-xl font-semibold tracking-tight text-foreground sm:text-3xl">
                            {title}
                          </h1>
                        )}
                        {subtitle && (
                          <p className="mt-1 break-words text-sm text-muted-foreground">
                            {subtitle}
                          </p>
                        )}
                      </div>
                      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
                    </div>
                  </div>
                )}
                {!title && subtitle && (
                  <div className="mb-8 rounded-2xl border border-border/60 bg-card/70 p-4 sm:p-5">
                    <div>
                      <p className="text-sm text-muted-foreground">{subtitle}</p>
                    </div>
                  </div>
                )}
                {children}
              </div>
              <Footer />
            </main>
            {showDealCopilotRail ? <DealCopilotRail /> : null}
          </div>
          <MobileBottomNav />
        </div>
      </div>
    </RequireAuth>
  );
}
