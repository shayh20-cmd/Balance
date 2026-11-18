-- The merchant a card-paid fixed item is charged under (merchantKey of the file's merchant name), learned when
-- a link is confirmed. A card row links surely only to the item whose merchant it is.
alter table recurring_items add column merchant_key text;
