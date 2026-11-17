-- Real-time intake: a phone forwards each card notification (MacroDroid on Android) to ingest_notification,
-- authenticated by its own secret device token rather than a user session.

alter table transactions add column card_last4 text;
alter table transactions add column raw_text text;

create table devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  member_id uuid not null references auth.users on delete cascade,
  name text not null,
  token uuid not null unique default gen_random_uuid(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Notifications the parser couldn't read. Kept so nothing is lost; resolved by hand in the app.
create table ingest_inbox (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  member_id uuid not null references auth.users on delete cascade,
  source text not null,
  title text not null default '',
  body text not null default '',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table devices enable row level security;
create policy devices_select on devices for select using (is_member(household_id));
create policy devices_update on devices for update using (is_member(household_id)) with check (is_member(household_id));
create policy devices_delete on devices for delete using (is_member(household_id));
alter table ingest_inbox enable row level security;
create policy inbox_all on ingest_inbox for all using (is_member(household_id)) with check (is_member(household_id));
revoke all on devices, ingest_inbox from anon;

create function create_device(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
  tok uuid;
begin
  select household_id into hid from members where user_id = auth.uid();
  if hid is null then
    raise exception 'not_member';
  end if;
  insert into devices (household_id, member_id, name) values (hid, auth.uid(), p_name) returning token into tok;
  return tok;
end
$$;

-- Reads a Google Wallet notification: title = merchant,
-- text = 'עסקה בסך 41.64 ₪ בכרטיס לאומי מאסטרקארד פלטינה ••5218'. Bidi marks are stripped first.
create function parse_wallet_notification(p_title text, p_text text, out merchant text, out amount_agorot int, out card_last4 text)
language plpgsql immutable as $$
declare
  body text := regexp_replace(coalesce(p_text, ''), '[‎‏‪-‮⁦-⁩]', '', 'g');
  amount text;
begin
  merchant := btrim(regexp_replace(coalesce(p_title, ''), '[‎‏‪-‮⁦-⁩]', '', 'g'));
  amount := coalesce(
    (regexp_match(body, '([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*₪'))[1],
    (regexp_match(body, '₪\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)'))[1]
  );
  amount_agorot := case when amount is null then null else round(replace(amount, ',', '')::numeric * 100)::int end;
  card_last4 := (regexp_match(body, '([0-9]{4})\s*$'))[1];
end
$$;

create function ingest_notification(p_token text, p_title text, p_text text, p_source text default 'google_wallet')
returns text
language plpgsql security definer set search_path = public as $$
declare
  dev devices%rowtype;
  parsed record;
begin
  select * into dev from devices where token::text = p_token and revoked_at is null;
  if dev.id is null then
    raise exception 'invalid_token';
  end if;
  if p_source not in ('google_wallet', 'apple_pay', 'sms', 'email') then
    raise exception 'invalid_source';
  end if;
  update devices set last_seen_at = now() where id = dev.id;

  select * into parsed from parse_wallet_notification(p_title, p_text);
  if parsed.amount_agorot is null or parsed.amount_agorot <= 0 or parsed.merchant = '' then
    insert into ingest_inbox (household_id, member_id, source, title, body)
      values (dev.household_id, dev.member_id, p_source, coalesce(p_title, ''), coalesce(p_text, ''));
    return 'inbox';
  end if;

  -- automation apps sometimes fire twice for one notification
  if exists (
    select 1 from transactions
    where household_id = dev.household_id and source = p_source and merchant = parsed.merchant
      and amount_agorot = parsed.amount_agorot and created_at > now() - interval '10 minutes'
  ) then
    return 'duplicate';
  end if;

  insert into transactions (household_id, member_id, date, amount_agorot, kind, merchant, source, status, card_last4, raw_text)
  values (dev.household_id, dev.member_id, (now() at time zone 'Asia/Jerusalem')::date, parsed.amount_agorot, 'expense',
          parsed.merchant, p_source, 'pending', parsed.card_last4, p_text);
  return 'ok';
end
$$;

revoke execute on function parse_wallet_notification(text, text) from anon;
