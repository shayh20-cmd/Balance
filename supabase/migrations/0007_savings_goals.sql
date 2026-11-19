-- How much the household wants to save in a month. It comes out of the variable budget ("left to spend").
create table savings_goals (
  household_id uuid not null references households on delete cascade,
  month date not null,
  amount_agorot int not null check (amount_agorot >= 0),
  updated_at timestamptz not null default now(),
  primary key (household_id, month)
);
alter table savings_goals enable row level security;
create policy savings_goals_all on savings_goals for all using (is_member(household_id)) with check (is_member(household_id));
revoke all on savings_goals from anon;
