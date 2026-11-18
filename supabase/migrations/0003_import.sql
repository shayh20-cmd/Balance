-- Plan 2: file import and month close.
-- import_key makes re-uploading a file a no-op. The index is not partial, so PostgREST's
-- on_conflict=household_id,import_key can use it; NULL keys (manual, Google Wallet) never collide.
alter table transactions
  add column import_key text,
  add column needs_review bool not null default false,
  add column category_name_hint text;
create unique index transactions_import_key on transactions (household_id, import_key);

create table month_closes (
  household_id uuid not null references households on delete cascade,
  month date not null,
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users,
  primary key (household_id, month)
);
alter table month_closes enable row level security;
create policy month_closes_all on month_closes for all using (is_member(household_id)) with check (is_member(household_id));
revoke all on month_closes from anon;
