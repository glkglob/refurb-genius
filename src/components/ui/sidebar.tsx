"use client";

// Re-export from @repo/ui (single source of truth after UI migration of sidebar).
// Note: sidebar has a dependency on the app's useIsMobile hook; the package copy
// retains the "@/hooks/use-mobile" import (resolved in monorepo root context).
export * from "@repo/ui/sidebar";
