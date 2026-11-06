-- Balance core schema: households, members, budget data, and the RPCs that create and join households.
-- Every household table is scoped by Row Level Security through is_member().

create table allowlist (
  email text primary key
);

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users,
  created_at timestamptz not null default now()
);

create table members (
  household_id uuid not null references households on delete cascade,
  user_id uuid not null unique references auth.users on delete cascade,
  display_name text not null,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table recurring_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  kind text not null check (kind in ('income', 'fixed')),
  name text not null,
  amount_agorot int not null,
  day_of_month int not null default 1 check (day_of_month between 1 and 31),
  interval_months int not null default 1 check (interval_months >= 1),
  start_month date not null,
  paid_by text not null default 'bank' check (paid_by in ('bank', 'card')),
  category_id uuid references categories on delete set null,
  active bool not null default true,
  created_at timestamptz not null default now()
);

create table funds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null,
  target_agorot int not null default 0,
  target_date date not null,
  is_general bool not null default false,
  annual bool not null default false,
  created_at timestamptz not null default now()
);

create table fund_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  fund_id uuid not null references funds on delete cascade,
  month date not null,
  amount_agorot int not null,
  kind text not null check (kind in ('provision', 'deposit', 'withdrawal', 'adjust')),
  created_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  member_id uuid not null references auth.users,
  date date not null,
  amount_agorot int not null,
  kind text not null check (kind in ('expense', 'income')),
  merchant text not null default '',
  category_id uuid references categories on delete set null,
  recurring_item_id uuid references recurring_items on delete set null,
  fund_id uuid references funds on delete set null,
  is_card_settlement bool not null default false,
  source text not null check (source in ('manual', 'file', 'sms', 'email', 'apple_pay', 'google_wallet')),
  status text not null default 'confirmed' check (status in ('pending', 'confirmed')),
  installment_group uuid,
  installment_index int,
  installment_count int,
  note text,
  created_at timestamptz not null default now()
);
create index transactions_household_date on transactions (household_id, date);

create table invites (
  token uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  email text not null,
  created_by uuid not null references auth.users,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table bank_balance (
  household_id uuid primary key references households on delete cascade,
  amount_agorot int not null,
  as_of date not null
);

-- Membership checks. security definer so policies can read members without recursing into its own RLS.
create function is_member(hid uuid) returns bool
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where household_id = hid and user_id = auth.uid())
$$;

create function is_owner(hid uuid) returns bool
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where household_id = hid and user_id = auth.uid() and role = 'owner')
$$;

create function create_household(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
  cat text;
  i int := 0;
begin
  if not exists (select 1 from allowlist where email = lower(auth.jwt()->>'email')) then
    raise exception 'not_allowlisted';
  end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'already_member';
  end if;
  insert into households (name, owner_id) values (p_name, auth.uid()) returning id into hid;
  insert into members (household_id, user_id, display_name, role) values (hid, auth.uid(), p_display_name, 'owner');
  foreach cat in array array['סופר', 'אוכל בחוץ', 'דלק ותחבורה', 'בריאות', 'ילדים', 'פנאי', 'קניות', 'בית', 'אחר'] loop
    i := i + 1;
    insert into categories (household_id, name, sort) values (hid, cat, i);
  end loop;
  insert into funds (household_id, name, target_agorot, target_date, is_general)
    values (hid, 'חיסכון כללי', 0, '2099-12-31', true);
  return hid;
end
$$;

create function create_invite(p_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
  tok uuid;
begin
  select household_id into hid from members where user_id = auth.uid();
  if hid is null then
    raise exception 'not_member';
  end if;
  insert into allowlist (email) values (lower(p_email)) on conflict do nothing;
  insert into invites (household_id, email, created_by) values (hid, lower(p_email), auth.uid()) returning token into tok;
  return tok;
end
$$;

create function accept_invite(p_token uuid, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv invites%rowtype;
begin
  select * into inv from invites where token = p_token;
  if inv.token is null or inv.accepted_at is not null or inv.expires_at < now()
     or inv.email <> lower(auth.jwt()->>'email') then
    raise exception 'invite_invalid';
  end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'already_member';
  end if;
  insert into members (household_id, user_id, display_name, role) values (inv.household_id, auth.uid(), p_display_name, 'member');
  update invites set accepted_at = now() where token = p_token;
  return inv.household_id;
end
$$;

-- Row Level Security
alter table allowlist enable row level security;
alter table invites enable row level security;
revoke all on allowlist, invites from authenticated, anon;

alter table households enable row level security;
create policy households_select on households for select using (is_member(id));
create policy households_delete on households for delete using (is_owner(id));

alter table members enable row level security;
create policy members_select on members for select using (is_member(household_id));
create policy members_delete on members for delete using (is_owner(household_id) or user_id = auth.uid());

alter table categories enable row level security;
create policy categories_all on categories for all using (is_member(household_id)) with check (is_member(household_id));
alter table recurring_items enable row level security;
create policy recurring_all on recurring_items for all using (is_member(household_id)) with check (is_member(household_id));
alter table funds enable row level security;
create policy funds_all on funds for all using (is_member(household_id)) with check (is_member(household_id));
alter table fund_entries enable row level security;
create policy fund_entries_all on fund_entries for all using (is_member(household_id)) with check (is_member(household_id));
alter table transactions enable row level security;
create policy transactions_all on transactions for all using (is_member(household_id)) with check (is_member(household_id));
alter table bank_balance enable row level security;
create policy bank_balance_all on bank_balance for all using (is_member(household_id)) with check (is_member(household_id));
