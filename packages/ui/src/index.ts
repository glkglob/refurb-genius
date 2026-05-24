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

export * from "@/components/ui/accordion";
export * from "./components/alert-dialog";
export * from "@/components/ui/alert";
export * from "@/components/ui/aspect-ratio";
export * from "./components/avatar";
export * from "./components/badge";
export * from "@/components/ui/breadcrumb";
export * from "./components/button";
export * from "./components/card";
export * from "@/components/ui/calendar";
export * from "@/components/ui/carousel";
export * from "@/components/ui/chart";
export * from "./components/checkbox";
export * from "@/components/ui/collapsible";
export * from "@/components/ui/command";
export * from "@/components/ui/context-menu";
export * from "./components/dialog";
export * from "@/components/ui/drawer";
export * from "@/components/ui/dropdown-menu";
export * from "@/components/ui/form";
export * from "@/components/ui/hover-card";
export * from "@/components/ui/input-otp";
export * from "./components/input";
export * from "./components/label";
export * from "@/components/ui/menubar";
export * from "@/components/ui/navigation-menu";
export * from "@/components/ui/pagination";
export * from "@/components/ui/popover";
export * from "@/components/ui/progress";
export * from "./components/radio-group";
export * from "@/components/ui/resizable";
export * from "@/components/ui/scroll-area";
export * from "./components/select";
export * from "./components/separator";
export * from "@/components/ui/sheet";
export * from "@/components/ui/sidebar";
export * from "./components/skeleton";
export * from "@/components/ui/slider";
export * from "@/components/ui/sonner";
export * from "./components/switch";
export * from "@/components/ui/table";
export * from "./components/tabs";
export * from "./components/textarea";
export * from "@/components/ui/toggle-group";
export * from "@/components/ui/toggle";
export * from "./components/tooltip";

// Re-export cn utility from src
export { cn } from "./lib/utils";
