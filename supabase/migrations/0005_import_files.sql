-- One row per uploaded file, so the close screen can show what was already loaded.
create table import_files (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references auth.users,
  file_name text not null default '',
  kind text not null check (kind in ('card', 'checking')),
  card_last4 text,
  billing_month date,
  first_date date,
  last_date date,
  row_count int not null default 0,
  matched int not null default 0,
  added int not null default 0,
  review int not null default 0
);
create index import_files_household on import_files (household_id, uploaded_at);
alter table import_files enable row level security;
create policy import_files_all on import_files for all using (is_member(household_id)) with check (is_member(household_id));
revoke all on import_files from anon;
