/**
 * Trades marketplace slice — public API.
 *
 * Routes and other slices import from here only; never from this slice's
 * infrastructure repositories. Domain types remain in `@/core/trades`.
 *
 * See docs/architecture/phase-6-migration-candidate.md (C1).
 */
export {
  listCurrentUserTradesJobs,
  getTradesJobById,
  listPostedTradesJobs,
  getPublicPostedTradesJob,
  resolveTradesJobForViewer,
  createTradesJob,
  updateTradesJob,
  deleteTradesJob,
} from "./infrastructure/repositories/tradesJobStore";

export {
  createTradesJobInterest,
  listCurrentUserInterests,
  listCurrentUserInterestsWithJobs,
  listJobInterests,
  updateTradesJobInterestStatus,
  getCurrentUserInterestForJob,
  type TradesJobInterestWithJob,
} from "./infrastructure/repositories/tradesJobInterestStore";

export {
  getCurrentUserTradeProfile,
  getTradeProfileByUserId,
  upsertCurrentUserTradeProfile,
} from "./infrastructure/repositories/tradeProfileStore";
