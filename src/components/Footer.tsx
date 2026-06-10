import { Link } from "@tanstack/react-router";
import { DISCLAIMER } from "@/core/reports";

type FooterProps = {
  className?: string;
};

export function Footer({ className }: FooterProps) {
  return (
    <footer className={className}>
      <div className="mx-auto max-w-7xl border-t border-border/50 px-6 py-6">
        <p className="text-xs text-muted-foreground">{DISCLAIMER}</p>
        {/* Global legal links stay visible across primary app surfaces. */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Link
            to="/privacy"
            className="underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Read our Data Privacy policy"
          >
            Data Privacy
          </Link>
          <span aria-hidden>•</span>
          <Link
            to="/terms"
            className="underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Terms
          </Link>
          <span className="ml-auto">© {new Date().getFullYear()} Refurb Genius</span>
        </div>
      </div>
    </footer>
  );
}
