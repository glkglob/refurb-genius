/**
 * Marketplace feature public API (AO-1B1).
 *
 * Presentation and routes import from this barrel only.
 * Persistence for favorites writes lives in `@/lib/marketplace-write`.
 */
export {
  useToggleTradeFavorite,
  type ToggleTradeFavoriteInput,
  type ToggleTradeFavoriteResult,
} from "./presentation/hooks/useToggleTradeFavorite";
