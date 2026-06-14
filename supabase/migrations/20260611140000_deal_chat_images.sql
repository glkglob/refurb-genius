-- Deal messages image attachments (Phase 3).
-- Stores up to 5 Supabase Storage public URLs per message.
-- Idempotent: IF NOT EXISTS guard on the column.

alter table public.deal_messages
  add column if not exists image_urls text[] not null default '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deal_messages_image_urls_max_5'
  ) THEN
    ALTER TABLE public.deal_messages
      ADD CONSTRAINT deal_messages_image_urls_max_5
      CHECK (cardinality(image_urls) <= 5);
  END IF;
END
$$;
