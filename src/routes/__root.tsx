import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Component, useEffect } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { PostHogProvider } from "@posthog/react";

import { Toaster } from "@/components/ui/sonner";
import { captureException } from "@/lib/sentry";
import { logger } from "@/lib/logger";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  logger.error("Route error caught", { error: error.message });
  const router = useRouter();

  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

// VITE_PUBLIC_URL must be set in Vercel project settings for both production and preview
// environments (e.g. https://www.refurbgenius.info). Without it, og:image and og:url
// fall back to the production domain so social cards still render on preview deployments.
const SITE_URL =
  (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, "") ??
  "https://www.refurbgenius.info";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Refurb Genius — Property Refurbishment Analysis" },
      {
        name: "description",
        content:
          "AI-powered refurbishment analysis for UK property investors. Upload photos, get estimates, model ROI.",
      },
      { name: "author", content: "Refurb Genius" },
      { property: "og:title", content: "Refurb Genius — Property Refurbishment Analysis" },
      {
        property: "og:description",
        content: "AI-powered refurbishment analysis for UK property investors.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}/og-image.jpg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:site_name", content: "Refurb Genius" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE_URL}/og-image.jpg` },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "theme-color", content: "#ffffff" },
      {
        name: "google-site-verification",
        content: "NAteh4Jb4nPdtyDxEBNBcGOYM8H0TTO37zO5yCtQnPU",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
      {
        rel: "icon",
        href: "/favicon.ico",
      },
      {
        rel: "icon",
        type: "image/png",
        href: "/favicon.png",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "apple-touch-icon-precomposed",
        href: "/apple-touch-icon-precomposed.png",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <PostHogProvider
          apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN as string}
          options={{
            api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string,
            autocapture: false,
            capture_pageview: false,
            capture_pageleave: false,
            persistence: "localStorage+cookie",
            person_profiles: "identified_only",
            capture_exceptions: true,
          }}
        >
          {children}
        </PostHogProvider>
        <Scripts />
      </body>
    </html>
  );
}

// ---------------------------------------------------------------------------
// React Error Boundary — catches rendering errors that TanStack Router's
// errorComponent cannot (e.g. provider crashes inside the app tree,
// hydration failures, bad route components).
// Placed inside ThemeProvider (and now also inside AuthProvider) so that
// the themed fallback UI is available for errors in <Outlet /> content.
// Foundational providers (QueryClientProvider + AuthProvider) sit above it.
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error("Root error boundary caught rendering error", {
      error: error.message,
      componentStack: errorInfo.componentStack,
    });
    captureException(error, { componentStack: errorInfo.componentStack });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              An unexpected error occurred. You can try again or head back to the home page.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Try again
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Go home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <RootErrorBoundary>
            <Outlet />
          </RootErrorBoundary>
          <Toaster />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
