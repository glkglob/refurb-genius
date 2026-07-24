/**
 * Trades slice — infrastructure surface.
 *
 * Preferred for wiring code that must reach repositories without going through
 * presentation. Routes must not import this module; use `@/features/trades`.
 */
export {
  listCurrentUserTradesJobs,
  getTradesJobById,
  listTradesJobs,
  listPostedTradesJobs,
  createTradesJob,
  updateTradesJob,
  deleteTradesJob,
} from "./repositories/tradesJobStore";

export {
  createTradesJobInterest,
  listCurrentUserInterests,
  listCurrentUserInterestsWithJobs,
  listJobInterests,
  updateTradesJobInterestStatus,
  getCurrentUserInterestForJob,
  type TradesJobInterestWithJob,
} from "./repositories/tradesJobInterestStore";

export {
  getCurrentUserTradeProfile,
  getTradeProfileByUserId,
  upsertCurrentUserTradeProfile,
} from "./repositories/tradeProfileStore";
