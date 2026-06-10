import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { RequireAuth } from "./RequireAuth";
import { MobileTopBar } from "./MobileTopBar";
import { Footer } from "./Footer";

export function AppLayout({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <RequireAuth>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar />
          <main className="relative flex-1 overflow-hidden px-4 py-6 sm:px-8 sm:py-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_5%,oklch(0.76_0.16_171/0.08),transparent_30%),radial-gradient(circle_at_80%_0%,oklch(0.76_0.09_245/0.07),transparent_26%)]"
            />
            <div className="relative mx-auto max-w-7xl">
              {(title || actions) && (
                <div className="glass-panel mb-8 rounded-2xl p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      {title && (
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                          {title}
                        </h1>
                      )}
                      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
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
        </div>
      </div>
    </RequireAuth>
  );
}
