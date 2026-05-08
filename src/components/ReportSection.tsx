import type { ReactNode } from "react";

export type ReportSectionProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function ReportSection({ title, subtitle, children }: ReportSectionProps) {
  return (
    <section className="break-inside-avoid">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
