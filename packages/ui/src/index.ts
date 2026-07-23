// @repo/ui - Shared UI component library.
//
// Migrated components (source of truth in packages/ui/src/components/*) are
// exported via "./components/<name>" and also re-exported here for convenience.
//
// Legacy components still reference the app's src/components/ui/ via the
// @/ path alias and will be migrated incrementally.
//
// Shims in src/components/ui/ re-export from this package so existing app
// imports continue to work during the migration.

export { useIsMobile } from "./hooks/use-mobile";

export * from "./components/accordion";
export * from "./components/alert-dialog";
export * from "./components/alert";
export * from "./components/aspect-ratio";
export * from "./components/avatar";
export * from "./components/badge";
export * from "./components/button";
export * from "./components/card";
export * from "./components/checkbox";
export * from "./components/collapsible";
export * from "./components/command";
export * from "./components/dialog";
export * from "./components/dropdown-menu";
export * from "./components/hover-card";
export * from "./components/input";
export * from "./components/label";
export * from "./components/pagination";
export * from "./components/popover";
export * from "./components/progress";
export * from "./components/radio-group";
export * from "./components/scroll-area";
export * from "./components/select";
export * from "./components/separator";
export * from "./components/sheet";
export * from "./components/sidebar";
export * from "./components/skeleton";
export * from "./components/slider";
export * from "./components/sonner";
export * from "./components/switch";
export * from "./components/table";
export * from "./components/tabs";
export * from "./components/textarea";
export * from "./components/toggle-group";
export * from "./components/toggle";
export * from "./components/tooltip";

// Newly migrated (Item 4)
export * from "./components/breadcrumb";
export * from "./components/calendar";
export * from "./components/carousel";
export * from "./components/chart";
export * from "./components/context-menu";
export * from "./components/drawer";
export * from "./components/form";
export * from "./components/input-otp";
export * from "./components/menubar";
export * from "./components/navigation-menu";
export * from "./components/resizable";

// Re-export cn utility from src
export { cn } from "./lib/utils";
