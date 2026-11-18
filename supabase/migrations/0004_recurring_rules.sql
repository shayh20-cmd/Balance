-- Plan 2b: variable amounts, end month, installment items, learned category rules, dismissed suggestions.
alter table recurring_items
  add column end_month date,
  add column variable_amount bool not null default false,
  add column installment_key text;
-- Not partial, so PostgREST's on_conflict=household_id,installment_key can use it (as in 0003).
create unique index recurring_items_installment_key on recurring_items (household_id, installment_key);

create table category_rules (
  household_id uuid not null references households on delete cascade,
  merchant_key text not null,
  category_id uuid not null references categories on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (household_id, merchant_key)
);

create table recurring_dismissals (
  household_id uuid not null references households on delete cascade,
  merchant_key text not null,
  created_at timestamptz not null default now(),
  primary key (household_id, merchant_key)
);

alter table category_rules enable row level security;
create policy category_rules_all on category_rules for all using (is_member(household_id)) with check (is_member(household_id));
alter table recurring_dismissals enable row level security;
create policy recurring_dismissals_all on recurring_dismissals for all using (is_member(household_id)) with check (is_member(household_id));
revoke all on category_rules, recurring_dismissals from anon;
