-- P0-DB-1 (2/2) — RLS consolidation, initplan fix, FK covering indexes
--
-- Canonical one-policy-per-role/action for touched tables.
-- All touched policies use (select auth.uid()) once (initplan-friendly).
-- Adds missing FK covering indexes. Does not drop any existing index.

-- ===========================================================================
-- A. estimates — drop legacy broad + overlapping policies
-- ===========================================================================

DROP POLICY IF EXISTS "Users can create own estimates" ON public.estimates;
DROP POLICY IF EXISTS "Users can delete own estimates" ON public.estimates;
DROP POLICY IF EXISTS "Users can update own estimates" ON public.estimates;
DROP POLICY IF EXISTS "estimates_all_own" ON public.estimates;
DROP POLICY IF EXISTS "estimates_select_own" ON public.estimates;
DROP POLICY IF EXISTS "estimates_select_authenticated" ON public.estimates;
DROP POLICY IF EXISTS "estimates_select_admin" ON public.estimates;
DROP POLICY IF EXISTS "estimates_insert_draft_own" ON public.estimates;
DROP POLICY IF EXISTS "estimates_update_draft_own" ON public.estimates;
DROP POLICY IF EXISTS "estimates_delete_draft_own" ON public.estimates;

CREATE POLICY "estimates_select_authenticated"
  ON public.estimates
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR user_id = (select auth.uid())
  );

CREATE POLICY "estimates_insert_draft_own"
  ON public.estimates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND pricing_authority = 'none'
    AND pricing_policy_version IS NULL
    AND catalog_revision IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = estimates.project_id
        AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "estimates_update_draft_own"
  ON public.estimates
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (select auth.uid())
    AND pricing_authority = 'none'
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = estimates.project_id
        AND p.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND pricing_authority = 'none'
    AND pricing_policy_version IS NULL
    AND catalog_revision IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = estimates.project_id
        AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "estimates_delete_draft_own"
  ON public.estimates
  FOR DELETE
  TO authenticated
  USING (
    user_id = (select auth.uid())
    AND pricing_authority = 'none'
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = estimates.project_id
        AND p.user_id = (select auth.uid())
    )
  );

-- ===========================================================================
-- B. estimate_rooms
-- ===========================================================================

DROP POLICY IF EXISTS "Users can manage rooms on their own estimates" ON public.estimate_rooms;
DROP POLICY IF EXISTS "estimate_rooms_select_admin" ON public.estimate_rooms;
DROP POLICY IF EXISTS "estimate_rooms_select_own" ON public.estimate_rooms;
DROP POLICY IF EXISTS "estimate_rooms_select_consolidated" ON public.estimate_rooms;
DROP POLICY IF EXISTS "estimate_rooms_insert" ON public.estimate_rooms;
DROP POLICY IF EXISTS "estimate_rooms_insert_draft_own" ON public.estimate_rooms;
DROP POLICY IF EXISTS "estimate_rooms_update" ON public.estimate_rooms;
DROP POLICY IF EXISTS "estimate_rooms_update_draft_own" ON public.estimate_rooms;
DROP POLICY IF EXISTS "estimate_rooms_delete" ON public.estimate_rooms;
DROP POLICY IF EXISTS "estimate_rooms_delete_draft_own" ON public.estimate_rooms;

CREATE POLICY "estimate_rooms_select_authenticated"
  ON public.estimate_rooms
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.estimates e
      WHERE e.id = estimate_rooms.estimate_id
        AND e.user_id = (select auth.uid())
    )
  );

CREATE POLICY "estimate_rooms_insert_draft_own"
  ON public.estimate_rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.estimates e
      JOIN public.projects p ON p.id = e.project_id
      WHERE e.id = estimate_rooms.estimate_id
        AND e.user_id = (select auth.uid())
        AND p.user_id = (select auth.uid())
        AND e.pricing_authority = 'none'
    )
  );

CREATE POLICY "estimate_rooms_update_draft_own"
  ON public.estimate_rooms
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.estimates e
      JOIN public.projects p ON p.id = e.project_id
      WHERE e.id = estimate_rooms.estimate_id
        AND e.user_id = (select auth.uid())
        AND p.user_id = (select auth.uid())
        AND e.pricing_authority = 'none'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.estimates e
      JOIN public.projects p ON p.id = e.project_id
      WHERE e.id = estimate_rooms.estimate_id
        AND e.user_id = (select auth.uid())
        AND p.user_id = (select auth.uid())
        AND e.pricing_authority = 'none'
    )
  );

CREATE POLICY "estimate_rooms_delete_draft_own"
  ON public.estimate_rooms
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.estimates e
      JOIN public.projects p ON p.id = e.project_id
      WHERE e.id = estimate_rooms.estimate_id
        AND e.user_id = (select auth.uid())
        AND p.user_id = (select auth.uid())
        AND e.pricing_authority = 'none'
    )
  );

-- ===========================================================================
-- C. estimate_items
-- ===========================================================================

DROP POLICY IF EXISTS "Users can create own estimate items" ON public.estimate_items;
DROP POLICY IF EXISTS "Users can delete own estimate items" ON public.estimate_items;
DROP POLICY IF EXISTS "Users can update own estimate items" ON public.estimate_items;
DROP POLICY IF EXISTS "estimate_items_all_own" ON public.estimate_items;
DROP POLICY IF EXISTS "estimate_items_select_admin" ON public.estimate_items;
DROP POLICY IF EXISTS "estimate_items_select_own" ON public.estimate_items;
DROP POLICY IF EXISTS "estimate_items_select_authenticated" ON public.estimate_items;
DROP POLICY IF EXISTS "estimate_items_insert_draft_own" ON public.estimate_items;
DROP POLICY IF EXISTS "estimate_items_update_draft_own" ON public.estimate_items;
DROP POLICY IF EXISTS "estimate_items_delete_draft_own" ON public.estimate_items;

CREATE POLICY "estimate_items_select_authenticated"
  ON public.estimate_items
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.estimates e
      WHERE e.id = estimate_items.estimate_id
        AND e.user_id = (select auth.uid())
    )
  );

CREATE POLICY "estimate_items_insert_draft_own"
  ON public.estimate_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND rate_source IS NULL
    AND rate_key IS NULL
    AND catalog_revision IS NULL
    AND base_unit_rate IS NULL
    AND regional_multiplier IS NULL
    AND resolved_unit_rate IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.estimates e
      JOIN public.projects p ON p.id = e.project_id
      WHERE e.id = estimate_items.estimate_id
        AND e.user_id = (select auth.uid())
        AND p.user_id = (select auth.uid())
        AND e.pricing_authority = 'none'
    )
  );

CREATE POLICY "estimate_items_update_draft_own"
  ON public.estimate_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.estimates e
      JOIN public.projects p ON p.id = e.project_id
      WHERE e.id = estimate_items.estimate_id
        AND e.user_id = (select auth.uid())
        AND p.user_id = (select auth.uid())
        AND e.pricing_authority = 'none'
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND rate_source IS NULL
    AND rate_key IS NULL
    AND catalog_revision IS NULL
    AND base_unit_rate IS NULL
    AND regional_multiplier IS NULL
    AND resolved_unit_rate IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.estimates e
      JOIN public.projects p ON p.id = e.project_id
      WHERE e.id = estimate_items.estimate_id
        AND e.user_id = (select auth.uid())
        AND p.user_id = (select auth.uid())
        AND e.pricing_authority = 'none'
    )
  );

CREATE POLICY "estimate_items_delete_draft_own"
  ON public.estimate_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.estimates e
      JOIN public.projects p ON p.id = e.project_id
      WHERE e.id = estimate_items.estimate_id
        AND e.user_id = (select auth.uid())
        AND p.user_id = (select auth.uid())
        AND e.pricing_authority = 'none'
    )
  );

-- ===========================================================================
-- D. trade_messages — no sender spoof; one policy per action
-- ===========================================================================

DROP POLICY IF EXISTS "trade_messages_all_own" ON public.trade_messages;
DROP POLICY IF EXISTS "trade_messages_select_party" ON public.trade_messages;
DROP POLICY IF EXISTS "trade_messages_select_consolidated" ON public.trade_messages;
DROP POLICY IF EXISTS "trade_messages_insert_as_self" ON public.trade_messages;
DROP POLICY IF EXISTS "trade_messages_insert_consolidated" ON public.trade_messages;
DROP POLICY IF EXISTS "trade_messages_update_consolidated" ON public.trade_messages;
DROP POLICY IF EXISTS "trade_messages_delete_consolidated" ON public.trade_messages;

CREATE POLICY "trade_messages_select_party"
  ON public.trade_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quote_requests q
      WHERE q.id = trade_messages.quote_request_id
        AND (
          q.user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.tradespeople t
            WHERE t.id = q.tradesperson_id
              AND t.user_id = (select auth.uid())
          )
        )
    )
  );

-- INSERT requires BOTH sender_id = caller AND participant membership.
-- No OR branch that allows spoofing sender_id.
CREATE POLICY "trade_messages_insert_as_self"
  ON public.trade_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (select auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.quote_requests q
      WHERE q.id = trade_messages.quote_request_id
        AND (
          q.user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.tradespeople t
            WHERE t.id = q.tradesperson_id
              AND t.user_id = (select auth.uid())
          )
        )
    )
  );

-- Preserve participant update path (membership only; no sender spoof surface).
CREATE POLICY "trade_messages_update_party"
  ON public.trade_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quote_requests q
      WHERE q.id = trade_messages.quote_request_id
        AND (
          q.user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.tradespeople t
            WHERE t.id = q.tradesperson_id
              AND t.user_id = (select auth.uid())
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quote_requests q
      WHERE q.id = trade_messages.quote_request_id
        AND (
          q.user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.tradespeople t
            WHERE t.id = q.tradesperson_id
              AND t.user_id = (select auth.uid())
          )
        )
    )
  );

CREATE POLICY "trade_messages_delete_party"
  ON public.trade_messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quote_requests q
      WHERE q.id = trade_messages.quote_request_id
        AND (
          q.user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.tradespeople t
            WHERE t.id = q.tradesperson_id
              AND t.user_id = (select auth.uid())
          )
        )
    )
  );

-- ===========================================================================
-- E. trades_job_interests
-- ===========================================================================

DROP POLICY IF EXISTS "Job owners can view interests for their jobs" ON public.trades_job_interests;
DROP POLICY IF EXISTS "Users can insert own interest" ON public.trades_job_interests;
DROP POLICY IF EXISTS "Users can view own interests" ON public.trades_job_interests;
DROP POLICY IF EXISTS "interests: insert own" ON public.trades_job_interests;
DROP POLICY IF EXISTS "interests: job owner can view" ON public.trades_job_interests;
DROP POLICY IF EXISTS "interests: select own" ON public.trades_job_interests;
DROP POLICY IF EXISTS "interests: job owner can update status" ON public.trades_job_interests;
DROP POLICY IF EXISTS "trades_job_interests_insert_owner" ON public.trades_job_interests;
DROP POLICY IF EXISTS "trades_job_interests_select_consolidated" ON public.trades_job_interests;
DROP POLICY IF EXISTS "trades_job_interests_update_job_owner" ON public.trades_job_interests;

CREATE POLICY "trades_job_interests_insert_own"
  ON public.trades_job_interests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "trades_job_interests_select_authenticated"
  ON public.trades_job_interests
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.trades_jobs j
      WHERE j.id = trades_job_interests.job_id
        AND j.user_id = (select auth.uid())
    )
  );

CREATE POLICY "trades_job_interests_update_job_owner"
  ON public.trades_job_interests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trades_jobs j
      WHERE j.id = trades_job_interests.job_id
        AND j.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.trades_jobs j
      WHERE j.id = trades_job_interests.job_id
        AND j.user_id = (select auth.uid())
    )
  );

-- ===========================================================================
-- F. trades_jobs — role-specific; drop PUBLIC write policies
-- ===========================================================================

DROP POLICY IF EXISTS "Users can delete their own trades jobs" ON public.trades_jobs;
DROP POLICY IF EXISTS "Users can insert their own trades jobs" ON public.trades_jobs;
DROP POLICY IF EXISTS "Users can select their own trades jobs" ON public.trades_jobs;
DROP POLICY IF EXISTS "Users can update their own trades jobs" ON public.trades_jobs;
DROP POLICY IF EXISTS "trades_jobs_select_posted" ON public.trades_jobs;
DROP POLICY IF EXISTS "trades_jobs_select_owner" ON public.trades_jobs;
DROP POLICY IF EXISTS "trades_jobs_insert_owner" ON public.trades_jobs;
DROP POLICY IF EXISTS "trades_jobs_update_owner" ON public.trades_jobs;
DROP POLICY IF EXISTS "trades_jobs_delete_owner" ON public.trades_jobs;

CREATE POLICY "trades_jobs_select_posted_anon"
  ON public.trades_jobs
  FOR SELECT
  TO anon
  USING (status = 'posted');

CREATE POLICY "trades_jobs_select_authenticated"
  ON public.trades_jobs
  FOR SELECT
  TO authenticated
  USING (
    status = 'posted'
    OR user_id = (select auth.uid())
  );

CREATE POLICY "trades_jobs_insert_own"
  ON public.trades_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "trades_jobs_update_own"
  ON public.trades_jobs
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "trades_jobs_delete_own"
  ON public.trades_jobs
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ===========================================================================
-- G. tradespeople — single directory SELECT + owner/admin writes
-- ===========================================================================

DROP POLICY IF EXISTS "tradespeople_select_directory" ON public.tradespeople;
DROP POLICY IF EXISTS "tradespeople_select_authenticated" ON public.tradespeople;
DROP POLICY IF EXISTS "tradespeople_select_admin" ON public.tradespeople;
DROP POLICY IF EXISTS "tradespeople_all_own" ON public.tradespeople;
DROP POLICY IF EXISTS "tradespeople_insert_authenticated" ON public.tradespeople;
DROP POLICY IF EXISTS "tradespeople_update_authenticated" ON public.tradespeople;
DROP POLICY IF EXISTS "tradespeople_delete_authenticated" ON public.tradespeople;

CREATE POLICY "tradespeople_select_directory"
  ON public.tradespeople
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "tradespeople_insert_own"
  ON public.tradespeople
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "tradespeople_update_own_or_admin"
  ON public.tradespeople
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR user_id = (select auth.uid())
  )
  WITH CHECK (
    public.is_admin()
    OR user_id = (select auth.uid())
  );

CREATE POLICY "tradespeople_delete_own_or_admin"
  ON public.tradespeople
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR user_id = (select auth.uid())
  );

-- ===========================================================================
-- H. share_links — role-scoped SELECT so SECURITY INVOKER resolve works for anon
--    (anon cannot EXECUTE is_admin(); public-role policy that calls is_admin fails)
-- ===========================================================================

DROP POLICY IF EXISTS "share_links_select_public" ON public.share_links;
DROP POLICY IF EXISTS "share_links_select_admin" ON public.share_links;
DROP POLICY IF EXISTS "share_links_all_own" ON public.share_links;
DROP POLICY IF EXISTS "share_links_select_anon_public" ON public.share_links;
DROP POLICY IF EXISTS "share_links_select_authenticated" ON public.share_links;

-- Anon may see only currently valid public rows (exact-token filter remains in RPC).
CREATE POLICY "share_links_select_anon_public"
  ON public.share_links
  FOR SELECT
  TO anon
  USING (
    revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND visibility = 'public'
  );

CREATE POLICY "share_links_select_authenticated"
  ON public.share_links
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR owner_user_id = (select auth.uid())
    OR (
      revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
      AND visibility = 'public'
    )
  );

-- Owner write policies: scope to authenticated (not PUBLIC) with initplan uid.
DROP POLICY IF EXISTS "share_links_insert_own" ON public.share_links;
DROP POLICY IF EXISTS "share_links_update_own" ON public.share_links;
DROP POLICY IF EXISTS "share_links_delete_own" ON public.share_links;

CREATE POLICY "share_links_insert_own"
  ON public.share_links
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = (select auth.uid()));

CREATE POLICY "share_links_update_own"
  ON public.share_links
  FOR UPDATE
  TO authenticated
  USING (owner_user_id = (select auth.uid()))
  WITH CHECK (owner_user_id = (select auth.uid()));

CREATE POLICY "share_links_delete_own"
  ON public.share_links
  FOR DELETE
  TO authenticated
  USING (owner_user_id = (select auth.uid()));

-- ===========================================================================
-- I. Missing foreign-key covering indexes (no CONCURRENTLY; transactional OK)
-- ===========================================================================

-- estimate_items(catalog_revision, rate_key) → measured_boq_catalog_entries
CREATE INDEX IF NOT EXISTS estimate_items_catalog_revision_rate_key_idx
  ON public.estimate_items (catalog_revision, rate_key);

-- estimates(catalog_revision) → measured_boq_catalog_revisions
CREATE INDEX IF NOT EXISTS estimates_catalog_revision_idx
  ON public.estimates (catalog_revision);

-- measured_boq_catalog_events(package_id)
CREATE INDEX IF NOT EXISTS measured_boq_catalog_events_package_id_idx
  ON public.measured_boq_catalog_events (package_id);

-- measured_boq_catalog_events(prior_revision_id)
CREATE INDEX IF NOT EXISTS measured_boq_catalog_events_prior_revision_id_idx
  ON public.measured_boq_catalog_events (prior_revision_id);

COMMENT ON INDEX public.estimate_items_catalog_revision_rate_key_idx IS
  'P0-DB-1: covers estimate_items_catalog_entry_fkey (catalog_revision, rate_key).';
COMMENT ON INDEX public.estimates_catalog_revision_idx IS
  'P0-DB-1: covers estimates_catalog_revision_fkey.';
COMMENT ON INDEX public.measured_boq_catalog_events_package_id_idx IS
  'P0-DB-1: covers measured_boq_catalog_events_package_id_fkey.';
COMMENT ON INDEX public.measured_boq_catalog_events_prior_revision_id_idx IS
  'P0-DB-1: covers measured_boq_catalog_events_prior_revision_id_fkey.';
