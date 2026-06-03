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

export * from "./components/accordion";
export * from "./components/alert-dialog";
export * from "./components/alert";
export * from "./components/aspect-ratio";
export * from "./components/avatar";
export * from "./components/badge";
export * from "@/components/ui/breadcrumb";
export * from "./components/button";
export * from "./components/card";
export * from "@/components/ui/calendar";
export * from "@/components/ui/carousel";
export * from "@/components/ui/chart";
export * from "./components/checkbox";
export * from "./components/collapsible";
export * from "./components/command";
export * from "@/components/ui/context-menu";
export * from "./components/dialog";
export * from "@/components/ui/drawer";
export * from "./components/dropdown-menu";
export * from "@/components/ui/form";
export * from "./components/hover-card";
export * from "@/components/ui/input-otp";
export * from "./components/input";
export * from "./components/label";
export * from "@/components/ui/menubar";
export * from "@/components/ui/navigation-menu";
export * from "./components/pagination";
export * from "./components/popover";
export * from "./components/progress";
export * from "./components/radio-group";
export * from "@/components/ui/resizable";
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

// Re-export cn utility from src
export { cn } from "./lib/utils";
