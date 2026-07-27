/**
 * Admin feature public API (AO-1D1).
 *
 * Routes import hooks and types from here only.
 * Infrastructure reads and query options remain internal to the slice
 * (query options are re-exported for focused tests).
 */
export { useAdminPlatformStats, useAdminRecentProjects, useAdminUsers } from "./presentation";

export type { AdminPlatformStats, AdminRecentProject, AdminUser } from "./domain";
