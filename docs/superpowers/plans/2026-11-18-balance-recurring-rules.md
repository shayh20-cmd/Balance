# Balance Recurring Items, Installments and Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fixed items and income that model real life:
- amounts that vary (water, electricity);
- an end month (loans, installment purchases);
- installment purchases from the card file become temporary fixed items, so future months already know about them;
- categories learned from the person's corrections;
- suggestions for things that look recurring.

**Architecture:**
- The engine stays pure. Variable items get their expected amount from linked actuals of earlier months, which the data layer loads and passes in.
- Installment items are drafted by a pure function from a `CardFile` and upserted by `installment_key`, so re-uploading never doubles them.
- Category rules and recurring suggestions are pure functions over `Txn[]`, keyed by `merchantKey(name)`.

**Tech Stack:** Vite, React 18, TypeScript, Supabase, Vitest, PGlite. Nothing new.

**Spec:** `docs/superpowers/specs/2026-11-06-balance-design.md`:
- §6.2: fixed items, variable amounts and installments;
- §7.4: rules, recurring detection, "rules, not guesses";
- §7.6: the rulings of 2026-11-18, added with this plan.

This is plan 2b of the roadmap, following plan 2 (`2026-11-17-balance-import-close.md`).

## Global Constraints

- Free only. No new service, no server code beyond SQL migrations.
- Money in integer agorot; dates `YYYY-MM-DD`; months `YYYY-MM`; Asia/Jerusalem.
- Hebrew UI, RTL, logical CSS, in-app confirm only. Every automatic choice shows where it came from (§7.4 "כללים, לא ניחושים").
- Real exports are never committed. Fixtures stay synthetic.
- **Variable-amount item:** the expected amount is the average of the last 3 months with linked actuals before the month. With none, the entered amount is used. The sure linking window is ±50% (instead of ±20%), ±6 days.
- **End month:** an item is due only in months `<= endMonth`. Linked actuals still count after it, like any off-cycle payment.
- **Installment item:**
  - name `"<merchant> (תשלומים)"`, `kind: 'fixed'`, `paidBy: 'card'`, `amount` the row's charge;
  - `dayOfMonth` the purchase day; `startMonth` the month of installment 1; `endMonth` the month of the last installment;
  - key `inst:<last4>:<purchase date>:<merchant>:<count>`.
- **Merchant key:** lower-case, digits and punctuation removed, whitespace collapsed, trimmed. `"EXPRESS 7"` → `"express"`, `'יאלי בשכונה בע"מ'` → `"יאלי בשכונה בעמ"`.
- **Category precedence on import:** the person's category on a matched txn, then a learned rule, then Leumi's map.

## Review Focus

1. **The same card file uploaded twice, or next month's file showing installment 7 of 10:** no second installment item, and the row links to the existing one. Test in Task 5.
2. **A loan or installment item after its last month:** not counted as expected, and doesn't show as due. Test in Task 2.
3. **A variable item whose history includes a month with two linked payments (a catch-up bill):** that month counts as their sum, still one month in the average. Test in Task 2.
4. **A supermarket visited several times a month:** never suggested as recurring. Only one txn a month for a merchant counts. Test in Task 7.
5. **A rule learned from an edit:** applies to new imports. It doesn't recategorize existing txns, and doesn't override a category the person already set on a matched txn. Test in Task 6.

---

## File Structure

```
supabase/migrations/0004_recurring_rules.sql
src/engine/types.ts        RecurringItem gains endMonth, variableAmount, installmentKey
src/engine/month.ts        isDueInMonth (endMonth), expectedAmount, MonthInput.history
src/engine/merchant.ts     merchantKey
src/engine/detect.ts       detectRecurring
src/import/installments.ts installmentDrafts
src/import/leumiChecking.ts linkRecurring: ±50% for variable items
src/import/plan.ts         planCardImport: rules
src/data/mappers.ts, src/data/repo.ts   new columns, history, rules, dismissals
src/ui/screens/Recurring.tsx            end month, variable checkbox, loan hint
src/ui/screens/CloseMonth.tsx           installment items before planning
src/ui/screens/Review.tsx               "אולי זה קבוע?" suggestions
src/ui/components/TransactionForm.tsx   where the category came from
```

---

### Task 1: Migration — end month, variable amount, installment key, rules, dismissals

**Files:**
- Create: `supabase/migrations/0004_recurring_rules.sql`
- Test: `tests/sql/recurring-rules.test.ts`

**Interfaces:**
- Produces, on `recurring_items`:
  - `end_month date` (null = no end);
  - `variable_amount bool not null default false`;
  - `installment_key text`, with a unique index `(household_id, installment_key)`, not partial (as in 0003).
- Produces the table `category_rules(household_id uuid references households on delete cascade, merchant_key text, category_id uuid not null references categories on delete cascade, updated_at timestamptz default now(), primary key (household_id, merchant_key))`.
- Produces the table `recurring_dismissals(household_id uuid references households on delete cascade, merchant_key text, created_at timestamptz default now(), primary key (household_id, merchant_key))`.
- Both tables get RLS `for all using/with check is_member(household_id)` and `revoke all … from anon`.

- [ ] **Step 1: Write failing tests**
  - `installment_key is unique per household and upsert ignores a duplicate`.
  - `category_rules and recurring_dismissals are visible only to members`.
  - `end_month defaults to null and variable_amount to false`.
- [ ] **Step 2:** Run `npx vitest run tests/sql/recurring-rules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write `0004_recurring_rules.sql`.**
- [ ] **Step 4:** Run `npx vitest run tests/sql`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(db): end month, variable amount, installment key, category rules`.

---

### Task 2: Engine — end month and variable expected amounts

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/month.ts`, `tests/fixtures/engine.ts` (defaults `endMonth: null`, `variableAmount: false`, `installmentKey: null`)
- Test: `tests/engine/month.test.ts`

**Interfaces:**
- `RecurringItem` gains `endMonth: Month | null`, `variableAmount: boolean` and `installmentKey: string | null`.
- `MonthInput` gains `history?: Record<string, Record<Month, Agorot>>`: per item id, the sum of linked actuals per earlier month.
- Produces `expectedAmount(item: RecurringItem, history: Record<Month, Agorot> | undefined, m: Month): Agorot`, exported from `month.ts`.
- `recurringTotal` uses `expectedAmount` where it now uses `i.amount`. `isDueInMonth` returns false when `endMonth && m > endMonth`.

- [ ] **Step 1: Write failing tests**
  - `an item is not due after its end month` (end `2026-12`: due `2026-12`, not due `2027-01`).
  - `a linked payment after the end month still counts`.
  - `variable item expects the average of its last 3 months with actuals`: history `{2026-07: 20000, 2026-09: 26000, 2026-10: 30000, 2026-11: 99999}`, month `2026-11` gives `25333` (rounded); `2026-11` itself is excluded.
  - `variable item with no history expects the entered amount`.
  - `a month with two linked payments counts as their sum` (Review Focus 3): history built from the sum, so the average is over months.
  - `non-variable item ignores history`.
- [ ] **Step 2:** Run `npx vitest run tests/engine`. Expected: FAIL.
- [ ] **Step 3: Implement.** Round the average with `Math.round`. Use the 3 latest months `< m` that have an entry.
- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass. Fix the call sites that build a `RecurringItem` (Recurring screen, mappers) so `npx tsc --noEmit` is clean.
- [ ] **Step 5: Commit** `feat(engine): end month and variable expected amounts`.

---

### Task 3: Data — new columns, history, rules and dismissals

**Files:**
- Modify: `src/data/mappers.ts` (`RecurringRow` gains `end_month`, `variable_amount` and `installment_key`; both directions map them, with `end_month` as `YYYY-MM-01` ⇄ `YYYY-MM`), `src/data/repo.ts`
- Test: `tests/data/mappers.test.ts`

**Interfaces:**
- **`loadMonth`:** also returns `history` for `MonthInput`. It runs one query for transactions with `recurring_item_id not null`, dated from `addMonths(month, -6)-01` up to `month-01` exclusive, summed per item and month.
- **Rules:** `loadCategoryRules(householdId): Promise<{ merchantKey: string; categoryId: string }[]>` and `saveCategoryRule(householdId, merchant: string, categoryId: string): Promise<void>`. The second upserts on the primary key with `merchant_key = merchantKey(merchant)` and skips an empty key.
- **Dismissals:** `loadDismissals(householdId): Promise<string[]>` and `dismissRecurring(householdId, merchantKey: string): Promise<void>`.
- **Installment items:** `upsertInstallmentItems(householdId, drafts: Omit<RecurringItem, 'id'>[]): Promise<number>`. It upserts with `onConflict: 'household_id,installment_key', ignoreDuplicates: true` and returns how many rows were new (`select` after the upsert).
- **History for detection:** `loadRecentTxns(householdId, from: ISODate): Promise<Txn[]>`.
- Produces `merchantKey(name: string): string` in `src/engine/merchant.ts`, with tests in `tests/engine/merchant.test.ts` for the two examples in Global Constraints plus `'  ' → ''`.

- [ ] **Step 1: Write failing tests**
  - `a recurring row with end_month converts and back`.
  - The `merchantKey` cases above.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `npm run typecheck && npx vitest run`. Expected: clean and all pass.
- [ ] **Step 5: Commit** `feat(data): recurring history, category rules, dismissals`.

---

### Task 4: Recurring screen — end month, variable amount, loans

**Files:**
- Modify: `src/ui/screens/Recurring.tsx`
- Test: `tests/ui/recurring.test.tsx`

**Interfaces:**
- **Form fields:**
  - `חודש אחרון (לא חובה)`: `<input type="month">`, empty = no end.
  - Checkbox `הסכום משתנה מחודש לחודש`, with the hint `הסכום הצפוי יחושב לפי ממוצע 3 החודשים האחרונים`.
  - Under the kind selector for fixed items, the hint `הלוואה או עסקה בתשלומים: הוצאה קבועה עם חודש אחרון`.
- **List row:**
  - for a variable item, `משתנה · צפוי {formatShekels(expected)}` with the expected amount from `expectedAmount`;
  - `עד {monthName} {year}` when `endMonth` is set;
  - `נוצר מקובץ האשראי` when `installmentKey` is set.
- **Validation:** an end month before the start month shows `החודש האחרון לפני חודש ההתחלה`.

- [ ] **Step 1: Write failing tests** (the presentational part, repo mocked as in `tests/ui/funds.test.tsx`)
  - `a variable item shows its expected average`.
  - `an item with an end month shows "עד דצמבר 2026"`.
  - `an end month before the start is rejected`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(ui): end month and variable amounts for fixed items`.

---

### Task 5: Installment purchases become fixed items

**Files:**
- Create: `src/import/installments.ts`
- Modify: `src/import/leumiChecking.ts` (sure window ±50% when `item.variableAmount`), `src/ui/screens/CloseMonth.tsx`
- Test: `tests/import/installments.test.ts`, `tests/import/leumiChecking.test.ts`

**Interfaces:**
- Produces `installmentDrafts(file: CardFile, items: RecurringItem[]): Omit<RecurringItem, 'id'>[]`. It yields one draft per installment row whose key (Global Constraints) isn't already on an item, with `active: true`, `intervalMonths: 1` and `variableAmount: false`.
- **`CloseMonth`, per card file:**
  1. Run `installmentDrafts`, then `upsertInstallmentItems`, then reload `recurring` (via `loadMonth`).
  2. Pass the reloaded items to `planCardImport`.
  3. If any items were added, append the line `נוספו {n} עסקאות בתשלומים לקבועות`.

- [ ] **Step 1: Write failing tests**
  - `an installment row 6 of 10 drafts an item from 2026-06 to 2026-03 next year`:
    - fixture row purchase `2026-06-22`, `12200`;
    - `startMonth '2026-06'`, `endMonth '2027-03'`, `dayOfMonth 22`, `paidBy 'card'`;
    - name `'ליברה ביטוח חובה (תשלומים)'`.
  - `no draft when the item already exists` (Review Focus 1: the same key for installment 7 of the same purchase).
  - `regular rows draft nothing`.
  - `planCardImport links the installment row to its item`: plan with the drafted item, given an id; the insert carries its `recurring_item_id`.
  - `a variable item links a bill 40% above expected without review` (in `leumiChecking.test.ts`).
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `npx vitest run && npm run build`. Expected: all pass and the build succeeds.
- [ ] **Step 5: Commit** `feat(import): installment purchases become fixed items`.

---

### Task 6: Category rules learned from corrections

**Files:**
- Modify: `src/import/plan.ts`, `src/ui/screens/AddTransaction.tsx`, `src/ui/components/TransactionForm.tsx`, `src/ui/screens/CloseMonth.tsx`
- Test: `tests/import/plan.test.ts`, `tests/ui/add-transaction.test.tsx`

**Interfaces:**
- **`planCardImport`** gains a 7th parameter, `rules: { merchantKey: string; categoryId: string }[] = []`. A rule matching `merchantKey(row.merchant)` wins over `leumiCategoryToOurs` (Global Constraints precedence).
- **`AddTransaction` on save of an edit:** when `categoryId` changed and is set, call `saveCategoryRule(household.id, merchant, categoryId)`, then toast `מעכשיו {merchant} יסווג כ{category}`. The merchant goes in as typed.
- **`TransactionForm`:**
  - It takes an optional `categoryOrigin: string | null` and shows it as a muted line under the category: `לפי כלל שלמד מתיקון שלך` or `לפי הקטגוריה של לאומי: {hint}`.
  - `AddTransaction` computes it: a rule for the merchant gives the first text; otherwise `category_name_hint` gives the second.
  - `Txn` doesn't carry the hint yet, so add `categoryHint: string | null` to `Txn`, the mappers and the fixtures.

- [ ] **Step 1: Write failing tests**
  - `a learned rule beats Leumi's category on import`.
  - `a rule does not override the person's category on a matched txn` (Review Focus 5).
  - `editing a category saves a rule for the merchant` (UI, with `saveCategoryRule` mocked).
  - `the form explains where the category came from`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement.** `CloseMonth` loads the rules once and passes them in.
- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: category rules learned from corrections`.

---

### Task 7: Suggest recurring items

**Files:**
- Create: `src/engine/detect.ts`
- Modify: `src/ui/screens/Review.tsx`, `src/data/importRepo.ts` (`reviewCount` adds the suggestions count; pass the detection inputs in)
- Test: `tests/engine/detect.test.ts`

**Interfaces:**
- Produces:

```ts
export interface RecurringSuggestion {
  merchantKey: string; merchant: string; kind: 'income' | 'fixed'; amount: Agorot; dayOfMonth: number;
  paidBy: 'bank' | 'card'; months: Month[];   // the evidence, oldest first
}
export function detectRecurring(txns: Txn[], items: RecurringItem[], dismissed: string[], today: ISODate): RecurringSuggestion[];
```

- **Rules:**
  - Look only at the last 4 full months before `monthOf(today)`, and only at txns with no `recurringItemId`, no `fundId` and no card settlement.
  - A merchant key qualifies when it has **exactly one** txn in each of **at least 3 consecutive** of those months (Review Focus 4), with every amount within ±15% of their median.
  - The suggestion's `amount` and `dayOfMonth` are the medians, and `paidBy` is `card` when the txns have a `cardLast4`.
  - Skip merchant keys in `dismissed` and keys equal to `merchantKey(item.name)` of an existing item.
- **`Review`:**
  - A section `אולי זה קבוע?`. Each row shows the merchant, `{amount} · הופיע ב{months as month names}`, and two buttons.
  - `הוספה כפריט קבוע` calls `upsertRecurring` with `startMonth = monthOf(today)`, then removes the row.
  - `לא קבוע` calls `dismissRecurring`.
  - Data comes from `loadRecentTxns(household.id, addMonths(monthOf(today), -4) + '-01')`, `loadDismissals` and `loadMonth(...).recurring`.

- [ ] **Step 1: Write failing tests**
  - `a monthly Netflix at 54.90 for 3 months is suggested, with its months as evidence`.
  - `a supermarket with several visits a month is not suggested`.
  - `amounts 30% apart are not suggested`.
  - `two months only are not enough`.
  - `dismissed and existing items are not suggested`.
  - `a monthly income (same payer) is suggested as income`.
- [ ] **Step 2:** Run `npx vitest run tests/engine/detect.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `npx vitest run && npm run build`. Expected: all pass and the build succeeds.
- [ ] **Step 5: Commit** `feat: suggest recurring items from history`.

---

### Task 8: Ship

- [ ] **Step 1:** Run `npx supabase db push --remote --dry-run`. Expected: `0004_recurring_rules.sql` only. **Ask Shai before** running `--yes`.
- [ ] **Step 2:** Merge into `main`, push, and watch the deploy workflow go green.
- [ ] **Step 3:** Shai re-uploads his card file. Check that:
  - the two insurance installments (6 of 10) appear under קבועות `עד מרץ 2027`;
  - re-uploading adds no item.
- [ ] **Step 4:** Mark the water item `הסכום משתנה` and check its expected amount on the קבועות screen.
