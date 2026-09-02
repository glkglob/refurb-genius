import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div
      className="glass-panel flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center sm:p-12"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-background/70">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
