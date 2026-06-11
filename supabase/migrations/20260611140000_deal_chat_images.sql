-- Deal messages image attachments (Phase 3).
-- Stores up to 5 Supabase Storage public URLs per message.
-- Idempotent: IF NOT EXISTS guard on the column.

alter table public.deal_messages
  add column if not exists image_urls text[] not null default '{}';
