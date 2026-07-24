/**
 * Product / technical ownership registry (verified).
 */
import type { Maturity, RegistryStatus } from "./types";

export type OwnershipRecord = {
  id: string;
  label: string;
  owner: string;
  purpose: string;
  currentStatus: string;
  maturity: Maturity;
  enforcementStatus: RegistryStatus;
  paths: string[];
  notes?: string;
};

export const OWNERSHIP: OwnershipRecord[] = [
  {
    id: "refurb-genius",
    label: "Refurb Genius",
    owner: "Product — Refurb Genius",
    purpose:
      "Public-facing refurbishment application (projects, estimates, photos, reports, marketplace UX)",
    currentStatus: "Live product behaviour in single app shell; core root is @repo/core shim",
    maturity: "live",
    enforcementStatus: "documented",
    paths: ["src/core/refurbGenius"],
    notes: "No dedicated product-isolation invariant; IQ isolation is vacuous today.",
  },
  {
    id: "refurb-iq",
    label: "Refurb IQ",
    owner: "Product — Refurb IQ",
    purpose: "Commercial / professional property intelligence boundary",
    currentStatus: "Reserved empty namespace only",
    maturity: "reserved",
    enforcementStatus: "reserved",
    paths: ["src/core/refurbIq"],
  },
  {
    id: "deal-copilot",
    label: "Deal Copilot",
    owner: "Assistant — Deal Copilot",
    purpose: "Shared intelligent assistant across the platform",
    currentStatus: "Live multi-root implementation with transitional persistence access",
    maturity: "live",
    enforcementStatus: "transitional",
    paths: [
      "src/core/dealCopilot",
      "src/components/deal-copilot",
      "src/lib/deal-copilot",
      "src/serverFns/dealCopilot.ts",
      "src/serverFns/dealChat.ts",
      "src/serverFns/dealAnalysis.ts",
    ],
  },
  {
    id: "platform",
    label: "Platform",
    owner: "Shared Intelligent Platform",
    purpose: "Vendor seams, auth wiring, observability, env, storage helpers",
    currentStatus: "Live; AI SDK isolation enforced",
    maturity: "live",
    enforcementStatus: "enforced",
    paths: ["src/platform"],
  },
  {
    id: "shared",
    label: "Shared (app shell)",
    owner: "Shared Intelligent Platform",
    purpose: "Routes, components shell, transitional lib/hooks/services, serverFns",
    currentStatus: "Single TanStack app at src/",
    maturity: "live",
    enforcementStatus: "partial",
    paths: [
      "src/routes",
      "src/components",
      "src/serverFns",
      "src/lib",
      "src/hooks",
      "src/services",
    ],
  },
  {
    id: "packages",
    label: "Packages",
    owner: "Shared Intelligent Platform / domain owners",
    purpose: "Framework-independent types, core, services, supabase factories, UI",
    currentStatus: "Live; packages must not import application src (enforced)",
    maturity: "live",
    enforcementStatus: "enforced",
    paths: [
      "packages/core",
      "packages/services",
      "packages/types",
      "packages/supabase",
      "packages/ui",
      "packages/integrations",
    ],
  },
];
