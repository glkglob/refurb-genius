-- P0 Security hardening (2026-07-21 assessment)
-- 1. Freeze profiles.role against self-escalation
-- 2. Make share_links tokens non-enumerable (exact-token RPC)
-- 3. Enforce sender_id authenticity on trade_messages

-- ---------------------------------------------------------------------------
-- 1. Freeze profiles.role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Allow only service_role or an already-admin session.
    -- is_admin() reads the *current* auth.uid() row; a non-admin cannot pass.
    IF NOT (
      current_setting('role', true) = 'service_role'
      OR public.is_admin()
    ) THEN
      RAISE EXCEPTION 'profiles.role cannot be changed by non-admin users'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_escalation();

-- ---------------------------------------------------------------------------
-- 2. Share links: drop enumerable public SELECT; add exact-token RPC
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "share_links_public_token_read" ON public.share_links;

CREATE OR REPLACE FUNCTION public.resolve_share_link(p_token text)
RETURNS TABLE (
  id uuid,
  study_id uuid,
  visibility text,
  access_role text,
  expires_at timestamptz,
  owner_user_id uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    sl.id,
    sl.study_id,
    sl.visibility,
    sl.access_role,
    sl.expires_at,
    sl.owner_user_id
  FROM public.share_links sl
  WHERE sl.token = p_token
    AND sl.revoked_at IS NULL
    AND (sl.expires_at IS NULL OR sl.expires_at > now())
    AND sl.visibility = 'public';
$$;

REVOKE ALL ON FUNCTION public.resolve_share_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_share_link(text) TO anon, authenticated;

COMMENT ON FUNCTION public.resolve_share_link(text) IS
  'Resolve a public, non-revoked, non-expired share link by exact token. Prevents token enumeration.';

-- ---------------------------------------------------------------------------
-- 3. Trade messages: enforce sender_id = auth.uid()
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "trade_messages_all_own" ON public.trade_messages;
DROP POLICY IF EXISTS "trade_messages_select_party" ON public.trade_messages;
DROP POLICY IF EXISTS "trade_messages_insert_as_self" ON public.trade_messages;

-- SELECT: any party on the quote_request may read
CREATE POLICY "trade_messages_select_party" ON public.trade_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quote_requests q
      WHERE q.id = trade_messages.quote_request_id
        AND (
          q.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.tradespeople t
            WHERE t.id = q.tradesperson_id
              AND t.user_id = auth.uid()
          )
        )
    )
  );

-- INSERT: must be a party AND sender_id must match the caller
CREATE POLICY "trade_messages_insert_as_self" ON public.trade_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.quote_requests q
      WHERE q.id = trade_messages.quote_request_id
        AND (
          q.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.tradespeople t
            WHERE t.id = q.tradesperson_id
              AND t.user_id = auth.uid()
          )
        )
    )
  );

-- No UPDATE / DELETE policies: messages are append-only by design.

-- ---------------------------------------------------------------------------
-- 4. Trades marketplace: allow browse of posted jobs (owner still sees all own)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "trades_jobs_select_posted" ON public.trades_jobs;
CREATE POLICY "trades_jobs_select_posted" ON public.trades_jobs
  FOR SELECT TO anon, authenticated
  USING (
    status = 'posted'
    OR user_id = auth.uid()
  );

-- Directory browse for authenticated users (marketplace)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tradespeople'
  ) THEN
    DROP POLICY IF EXISTS "tradespeople_select_directory" ON public.tradespeople;
    CREATE POLICY "tradespeople_select_directory" ON public.tradespeople
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;
