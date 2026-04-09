create table if not exists public.app_documents (
  collection_path text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection_path, id)
);

create index if not exists app_documents_collection_path_idx
  on public.app_documents (collection_path);

create index if not exists app_documents_data_gin_idx
  on public.app_documents using gin (data);

alter table public.app_documents enable row level security;

drop policy if exists "Allow anon read app documents" on public.app_documents;
create policy "Allow anon read app documents"
  on public.app_documents for select
  to anon
  using (true);

drop policy if exists "Allow anon write app documents" on public.app_documents;
create policy "Allow anon write app documents"
  on public.app_documents for all
  to anon
  using (true)
  with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_documents'
  ) then
    alter publication supabase_realtime add table public.app_documents;
  end if;
end $$;
