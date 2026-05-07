import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { DISCLAIMER } from "@/lib/mockData";

export function AppLayout({ children, title, subtitle, actions }: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-6xl">
            {(title || actions) && (
              <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {title && <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>}
                  {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
                </div>
                {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
              </div>
            )}
            {children}
            <p className="mt-12 text-xs text-muted-foreground">{DISCLAIMER}</p>
          </div>
        </main>
      </div>
    </div>
  );
}
