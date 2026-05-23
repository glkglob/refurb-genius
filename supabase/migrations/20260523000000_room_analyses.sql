create table if not exists room_analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null,
  photo_id uuid references photos(id) on delete set null,
  photo_url text not null,
  photo_name text not null,
  room_type text not null,
  condition_level text not null,
  refurbishment_level text not null,
  visible_issues jsonb not null default '[]',
  recommended_works jsonb not null default '[]',
  ai_summary text not null default '',
  confidence_score real not null default 0,
  created_at timestamptz not null default now()
);

alter table room_analyses enable row level security;

create policy "Users can view their own analyses"
  on room_analyses for select
  using (auth.uid() = user_id);

create policy "Users can insert their own analyses"
  on room_analyses for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own analyses"
  on room_analyses for delete
  using (auth.uid() = user_id);

create index idx_room_analyses_project on room_analyses(project_id);
