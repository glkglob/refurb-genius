// Platform core barrel. Future products (Deal Copilot, Refurb IQ) import
// from `@/core/*` to share business logic with Refurb Genius.
//
// TODO(deal-copilot): expose `dealCopilot` here once the submodule has a
// real public API. Reserved namespace lives at `@/core/dealCopilot` —
// see `./dealCopilot/README.md` for the planned surface and rules.
//
// TODO(refurb-iq): expose `refurbIq` here once the submodule has a real
// public API. Reserved namespace lives at `@/core/refurbIq` — see
// `./refurbIq/README.md` for the planned surface and rules.

export * as projects from "./projects";
export * as pricing from "./pricing";
export * as roi from "./roi";
export * as reports from "./reports";
export * as ai from "./ai";

