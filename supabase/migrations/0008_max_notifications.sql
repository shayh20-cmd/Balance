-- Max app notifications: one for every card transaction, in the shop, by phone or online.
--   'בוצעה עסקה בסך 19.0 ש"ח בDott pass בכרטיס המסתיים ב- 5218. פרטים נוספים ...'
-- They arrive as source 'card_app'. The same purchase can also come from Google Wallet, so a second
-- notification with the same amount on the same card within 15 minutes counts as a duplicate.

alter table transactions drop constraint transactions_source_check;
alter table transactions add constraint transactions_source_check
  check (source in ('manual', 'file', 'sms', 'email', 'apple_pay', 'google_wallet', 'card_app'));

create function parse_max_notification(p_text text, out merchant text, out amount_agorot int, out card_last4 text)
language plpgsql immutable as $$
declare
  body text := regexp_replace(coalesce(p_text, ''), '[‎‏‪-‮⁦-⁩]', '', 'g');
  m text[];
begin
  m := regexp_match(body,
    'בסך\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:ש["״]?ח|₪)\s*ב\s*(.+?)\s+בכרטיס\s+המסתיים\s+ב-?\s*([0-9]{4})');
  if m is null then
    return;
  end if;
  amount_agorot := round(replace(m[1], ',', '')::numeric * 100)::int;
  merchant := btrim(m[2]);
  card_last4 := m[3];
end
$$;
revoke execute on function parse_max_notification(text) from anon;

create or replace function ingest_notification(p_token text, p_title text, p_text text, p_source text default 'google_wallet')
returns text
language plpgsql security definer set search_path = public as $$
declare
  dev devices%rowtype;
  parsed record;
  src text := p_source;
begin
  select * into dev from devices where token::text = p_token and revoked_at is null;
  if dev.id is null then
    raise exception 'invalid_token';
  end if;
  if p_source not in ('google_wallet', 'apple_pay', 'sms', 'email', 'card_app') then
    raise exception 'invalid_source';
  end if;
  update devices set last_seen_at = now() where id = dev.id;

  -- The text says which app it came from: Max's wording first, then Google Wallet's.
  select * into parsed from parse_max_notification(p_text);
  if parsed.amount_agorot is not null then
    src := 'card_app';
  else
    select * into parsed from parse_wallet_notification(p_title, p_text);
  end if;

  if parsed.amount_agorot is null or parsed.amount_agorot <= 0 or coalesce(parsed.merchant, '') = '' then
    insert into ingest_inbox (household_id, member_id, source, title, body)
      values (dev.household_id, dev.member_id, src, coalesce(p_title, ''), coalesce(p_text, ''));
    return 'inbox';
  end if;

  -- One purchase, two notifications: the automation app firing twice, or Google Wallet and Max both
  -- reporting it. Same amount on the same card (or same merchant when the card is unknown), 15 minutes.
  if exists (
    select 1 from transactions t
    where t.household_id = dev.household_id and t.amount_agorot = parsed.amount_agorot
      and t.source in ('google_wallet', 'apple_pay', 'card_app', 'sms', 'email')
      and t.created_at > now() - interval '15 minutes'
      and (case when t.card_last4 is not null and parsed.card_last4 is not null
                then t.card_last4 = parsed.card_last4
                else t.merchant = parsed.merchant end)
  ) then
    return 'duplicate';
  end if;

  insert into transactions (household_id, member_id, date, amount_agorot, kind, merchant, source, status, card_last4, raw_text)
  values (dev.household_id, dev.member_id, (now() at time zone 'Asia/Jerusalem')::date, parsed.amount_agorot, 'expense',
          parsed.merchant, src, 'pending', parsed.card_last4, p_text);
  return 'ok';
end
$$;
