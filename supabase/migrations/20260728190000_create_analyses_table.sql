create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null default '',
  media_type text not null check (media_type in ('image', 'video')),
  verdict text not null,
  deepfake_probability integer not null,
  confidence integer not null,
  ai_probability integer,
  real_probability integer,
  summary text not null,
  observations text[] not null default '{}',
  backend text not null default 'python-fastapi-onnxruntime',
  model text not null default 'prithivMLmods/AI-vs-Deepfake-vs-Real-ONNX',
  frame_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists analyses_user_created_at_idx
  on public.analyses (user_id, created_at desc);

alter table public.analyses enable row level security;

create policy "Users can read their own analyses"
  on public.analyses
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own analyses"
  on public.analyses
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own analyses"
  on public.analyses
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own analyses"
  on public.analyses
  for delete
  using (auth.uid() = user_id);
