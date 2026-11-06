# Balance Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working, installable Hebrew PWA in which an allowlisted user creates a household, invites members, keeps recurring income/fixed items and funds, enters transactions by hand, and sees "left to spend this month" and this week's target on the home screen (option A).

**Architecture:** A pure TypeScript budget engine (`src/engine/`) computes every number from plain data, with no I/O. Supabase stores the data. Every table is scoped to a household by Row Level Security, and creating a household, inviting and joining go through `security definer` RPCs that check the allowlist. A React SPA reads rows through a thin repository (`src/data/`), maps them into engine input, and renders the screens.

**Tech Stack:**
- Vite 6, React 18, TypeScript 5 (strict), `react-router-dom` 6 (`HashRouter`).
- `@supabase/supabase-js` 2 and `vite-plugin-pwa`.
- Tests: Vitest, `@testing-library/react` with jsdom, and `@electric-sql/pglite` for SQL/RLS tests.
- Hosting: Cloudflare Pages (`wrangler pages deploy`).

**Spec:** `docs/superpowers/specs/2026-11-06-balance-design.md` (Hebrew). Roadmap: `docs/superpowers/plans/2026-11-06-balance-roadmap.md`. This is plan 1 of 4.

## Global Constraints

- Free tiers only: Supabase Free, Cloudflare Pages. Users never pay and need no AI subscription.
- Hebrew only, RTL: `<html lang="he" dir="rtl">`. Use logical CSS properties (`margin-inline-start`, `text-align: start`), never left/right.
- Money is an integer number of agorot, in ILS. Display as `6,840 ₪`: thousands separator, no decimals when the value is whole, otherwise 2 decimals.
- Every date is a `YYYY-MM-DD` string. Month and week boundaries use the `Asia/Jerusalem` time zone.
- Month = calendar month, by transaction date (not the bank charge date).
- Week = Sunday to Saturday, clipped to the month.
- Bank login details are never stored, anywhere.
- One household per user in v1. Only allowlisted emails may create a household. Accepting an invite allowlists the invitee.
- Every table carries `household_id` and RLS: a user reads and writes only the rows of their own household.
- The bank balance is shown separately and never enters "left to spend".

## Review Focus

1. **A month with no recurring items, or no transactions at all.** The home screen must show 0 ₪ and an empty list, not NaN or a crash. Test in Task 3 (`computeMonth` with empty input) and Task 9 (Home with an empty summary).
2. **A refund (negative amount)** must reduce variable spending, and must not make "spent" go negative past zero for the week bar. Test in Task 3 and Task 4.
3. **The last partial week (Nov 29-30, 2026) and the first day of a month.** The target must divide by the days left, never by 0. Test in Task 4.
4. **A fund whose target date is this month or already past.** `monthsLeft` must floor at 1, and a past fund provisions 0. Test in Task 5.
5. **A second user reading another household's rows.** Expected: zero rows, and inserts rejected. Test in Task 6.

---

## File Structure

```
Balance/
  package.json, tsconfig.json, vite.config.ts, index.html, .env.example
  src/
    engine/            pure budget logic, no imports from data/ or ui/
      types.ts         shared engine types
      money.ts         agorot helpers, formatShekels
      dates.ts         month/week/date arithmetic, todayInIsrael
      installments.ts  splitInstallments
      month.ts         computeMonth
      week.ts          weeksOfMonth, computeWeek
      funds.ts         fundProvision, fundOverspend
    data/
      supabase.ts      client from env
      mappers.ts       DB rows ⇄ engine types
      repo.ts          all queries and RPC calls
    ui/
      App.tsx, routes.tsx, styles.css
      auth/SignIn.tsx, onboarding/Onboarding.tsx, onboarding/AcceptInvite.tsx
      screens/Home.tsx, Transactions.tsx, AddTransaction.tsx,
              Recurring.tsx, Funds.tsx, Settings.tsx
      components/ProgressBar.tsx, Amount.tsx, SourcePill.tsx
  supabase/
    migrations/0001_core.sql
    tests/auth-stub.sql        test-only stand-in for Supabase's auth schema
  tests/
    engine/*.test.ts, data/*.test.ts, sql/rls.test.ts, ui/*.test.tsx
    sql/harness.ts             PGlite loader
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.env.example`, `src/main.tsx`, `src/ui/App.tsx`, `src/ui/styles.css`, `tests/smoke.test.tsx`
- Modify: `.gitignore` (add `dist/`, `.wrangler/`)

**Interfaces:**
- Produces: `npm test` (`vitest run`), `npm run dev`, `npm run build`, `npm run typecheck` (`tsc --noEmit`). Env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

- [ ] **Step 1: Init the project and install dependencies**

Run `npm create vite@latest . -- --template react-ts` (into the existing repo), then:

```bash
npm i @supabase/supabase-js react-router-dom
npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom @electric-sql/pglite vite-plugin-pwa
```

- [ ] **Step 2: Configure the app**
  - `index.html`: `<html lang="he" dir="rtl">`, title `Balance`.
  - `vite.config.ts`: Vitest config with `environment: 'jsdom'` and `setupFiles` that import `@testing-library/jest-dom`.
  - `VitePWA` with `registerType: 'autoUpdate'` and a manifest: `name: 'Balance'`, `short_name: 'Balance'`, `lang: 'he'`, `dir: 'rtl'`, `display: 'standalone'`, `start_url: '.'`, 192 and 512 PNG icons in `public/` (a plain placeholder icon is fine).
  - `tsconfig`: `strict: true`.
  - Scripts: `test`, `typecheck`, `dev`, `build`.

- [ ] **Step 3: Write the smoke test**

```tsx
// tests/smoke.test.tsx
test('App renders the product name', () => {
  render(<App />);
  expect(screen.getByText('Balance')).toBeInTheDocument();
});
```

- [ ] **Step 4: Make it pass**

`App` renders a header with `Balance`. `styles.css` holds a phone-first layout (max-width 480px, centred) and uses logical properties only.

- [ ] **Step 5: Verify**

Run `npm test && npm run typecheck && npm run build`. Expected: 1 test passes, no type errors, and `dist/` contains `manifest.webmanifest`.

- [ ] **Step 6: Commit**

```bash
git commit -m "chore: scaffold Vite React PWA"
```

---

### Task 2: Money, dates and installments

**Files:**
- Create: `src/engine/types.ts`, `src/engine/money.ts`, `src/engine/dates.ts`, `src/engine/installments.ts`
- Test: `tests/engine/money.test.ts`, `tests/engine/dates.test.ts`, `tests/engine/installments.test.ts`

**Interfaces:**
- Produces (`types.ts`):

```ts
export type Agorot = number;               // integer
export type ISODate = string;              // 'YYYY-MM-DD'
export type Month = string;                // 'YYYY-MM'
export type Source = 'manual' | 'file' | 'sms' | 'email' | 'apple_pay' | 'google_wallet';
export interface Txn {
  id: string; date: ISODate; amount: Agorot;  // expense > 0, refund < 0; income > 0
  kind: 'expense' | 'income';
  merchant: string; categoryId: string | null;
  recurringItemId: string | null; fundId: string | null;
  isCardSettlement: boolean; source: Source; memberId: string;
  status: 'pending' | 'confirmed';
}
export interface RecurringItem {
  id: string; kind: 'income' | 'fixed'; name: string; amount: Agorot;
  dayOfMonth: number; intervalMonths: number; startMonth: Month; active: boolean;
  paidBy: 'bank' | 'card';
}
export interface Fund {
  id: string; name: string; target: Agorot; targetDate: ISODate;
  balance: Agorot;                         // saved before the month being computed
  isGeneral: boolean;
}
```

- Produces (`money.ts`): `formatShekels(a: Agorot): string`, `toAgorot(shekels: string | number): Agorot` (parses `"12.5"`, `"1,200"`; throws on non-numeric input).
- Produces (`dates.ts`):
  - `monthOf(d: ISODate): Month`
  - `daysInMonth(m: Month): number`
  - `monthsBetween(from: Month, to: Month): number` (`to` minus `from`, can be negative)
  - `addMonths(m: Month, n: number): Month`
  - `dayOfWeek(d: ISODate): number` (0 = Sunday)
  - `addDays(d: ISODate, n: number): ISODate`
  - `todayInIsrael(now?: Date): ISODate`

  All arithmetic is UTC on date-only values. `todayInIsrael` uses `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' })`.
- Produces (`installments.ts`): `splitInstallments(total: Agorot, count: number, firstDate: ISODate): { date: ISODate; amount: Agorot; index: number }[]`. Each installment is dated in successive months on the same day, clamped to the month's last day. The remainder goes to the first installment.

- [ ] **Step 1: Write failing tests**

```ts
expect(formatShekels(684000)).toBe('6,840 ₪');
expect(formatShekels(5850)).toBe('58.50 ₪');
expect(formatShekels(-32000)).toBe('-320 ₪');
expect(formatShekels(0)).toBe('0 ₪');
expect(toAgorot('1,200')).toBe(120000);
expect(toAgorot('12.5')).toBe(1250);
expect(() => toAgorot('abc')).toThrow();

expect(dayOfWeek('2026-11-01')).toBe(0);            // Sunday
expect(daysInMonth('2026-11')).toBe(30);
expect(daysInMonth('2028-02')).toBe(29);
expect(monthsBetween('2026-11', '2027-08')).toBe(9);
expect(addMonths('2026-11', 3)).toBe('2027-02');
expect(todayInIsrael(new Date('2026-11-06T22:30:00Z'))).toBe('2026-11-07');  // 00:30 in Israel

expect(splitInstallments(100000, 3, '2026-01-31')).toEqual([
  { date: '2026-01-31', amount: 33334, index: 1 },
  { date: '2026-02-28', amount: 33333, index: 2 },
  { date: '2026-03-31', amount: 33333, index: 3 },
]);
```

- [ ] **Step 2: Run the tests**

Run `npx vitest run tests/engine`. Expected: FAIL, the modules are missing.

- [ ] **Step 3: Implement the three modules** with the signatures above.

- [ ] **Step 4: Run the tests again**

Run `npx vitest run tests/engine`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(engine): money, dates, installments"
```

---

### Task 3: Month computation

**Files:**
- Create: `src/engine/month.ts`
- Test: `tests/engine/month.test.ts`

**Interfaces:**
- Consumes: the types from Task 2. `fundProvision` and `fundOverspend` are 0 in this task, and Task 5 wires them in.
- Produces:

```ts
export interface MonthInput {
  month: Month; recurring: RecurringItem[]; funds: Fund[]; txns: Txn[];
  carryIn: Agorot;            // from the previous month's close (plan 4); 0 until then
}
export interface MonthSummary {
  month: Month;
  income: Agorot;             // actual where linked, otherwise expected
  fixed: Agorot;              // the same rule
  fundProvision: Agorot;      // sum over funds
  fundOverspend: Agorot;      // fund spending beyond what the fund holds, moved to variable
  variableBudget: Agorot;     // income - fixed - fundProvision + carryIn
  variableSpent: Agorot;      // includes fundOverspend
  leftToSpend: Agorot;        // variableBudget - variableSpent
}
export function isDueInMonth(item: RecurringItem, m: Month): boolean;
export function computeMonth(input: MonthInput): MonthSummary;
export function isVariable(t: Txn): boolean;   // expense, no recurringItemId, no fundId, not a card settlement
```

Rules, from spec §6.2:
- A recurring item is due when it is `active`, `monthsBetween(startMonth, m) >= 0`, and that difference divides evenly by `intervalMonths`.
- For each due item: if any txn in the month has `recurringItemId === item.id`, the sum of those txns counts instead of `item.amount`. Otherwise `item.amount` counts.
- Income txns without `recurringItemId` add to `income`.
- Card-settlement txns are ignored everywhere.
- Only txns whose `monthOf(date) === m` count.

- [ ] **Step 1: Write failing tests**

Fixture: month `2026-11`.
- Salary: income, 1,500,000 agorot, interval 1, start `2026-01`.
- Rent: fixed, 600,000, interval 1, start `2026-01`.
- Arnona: fixed, 80,000, interval 2, start `2026-02`, so it is due in even months only.
- Netflix: fixed, 5,990, card.

Tests:
- `empty input → all zeros, leftToSpend 0`.
- `expected amounts when nothing is linked`. Assert `income` 1,500,000 and `fixed` 605,990, since arnona is not due in November.
- `isDueInMonth arnona`: false for `2026-11`, true for `2026-12`, false for `2026-01` (before the start).
- `actual replaces expected`. A txn linked to the salary of 1,480,000 gives `income` 1,480,000.
- `linked card txn is not variable`. A Netflix txn of 5,990 linked to Netflix gives `variableSpent` 0.
- `refund reduces variable`. An expense of 34,200 plus an expense of −4,200 gives `variableSpent` 30,000.
- `card settlement ignored`. An expense of 438,000 with `isCardSettlement` gives `variableSpent` 0.
- `other month ignored`. A txn dated `2026-10-31` is not counted.
- `leftToSpend = variableBudget − variableSpent` with `carryIn` −20,000.

- [ ] **Step 2: Run the tests**

Run `npx vitest run tests/engine/month.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `computeMonth`.**

- [ ] **Step 4: Run the tests again**

Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(engine): computeMonth"
```

---

### Task 4: Weeks and the weekly target

**Files:**
- Create: `src/engine/week.ts`
- Test: `tests/engine/week.test.ts`

**Interfaces:**
- Consumes: `computeMonth` and `isVariable` (Task 3), and `dates.ts`.
- Produces:

```ts
export interface WeekRange { start: ISODate; end: ISODate; days: number; index: number } // index from 1
export function weeksOfMonth(m: Month): WeekRange[];
export interface WeekStatus {
  week: WeekRange; weekCount: number;
  target: Agorot;               // floor(leftAtStart / daysLeftFromStart * week.days), min 0
  spent: Agorot;                // variable spending inside the week (may be < 0)
  remaining: Agorot;            // target - spent
  projectedOverspend: Agorot;   // max(0, floor(spent / daysElapsed * week.days) - target)
}
export function computeWeek(input: MonthInput, today: ISODate): WeekStatus;
```

- `leftAtStart` = `variableBudget` minus the variable spending dated before `week.start`.
- `daysLeftFromStart` = days from `week.start` to the month's end, inclusive.
- `daysElapsed` = days from `week.start` to `today`, inclusive, never less than 1.
- `today` must fall inside `input.month`. Throw otherwise.

- [ ] **Step 1: Write failing tests**

```ts
expect(weeksOfMonth('2026-11').map(w => [w.start, w.end, w.days])).toEqual([
  ['2026-11-01','2026-11-07',7], ['2026-11-08','2026-11-14',7], ['2026-11-15','2026-11-21',7],
  ['2026-11-22','2026-11-28',7], ['2026-11-29','2026-11-30',2]]);
expect(weeksOfMonth('2026-12')[0]).toMatchObject({ start: '2026-12-01', end: '2026-12-05', days: 5 });
```

With a fixture of one income recurring item of 820,000, nothing else, so `variableBudget` is 820,000:
- `week 1 target` on `2026-11-03`, no spending: `floor(820000 / 30 * 7)` = 191,333.
- `overspend in week 1 lowers week 2 target`: week 1 spending of 300,000, today `2026-11-09`. The target is `floor(520000 / 23 * 7)` = 158,260.
- `pace warning`: today `2026-11-03`, 102,000 spent this week. `projectedOverspend` = `floor(102000 / 3 * 7) − 191333` = 46,667.
- `last partial week`: today `2026-11-30`, with a target computed over 2 days. Never divide by 0.
- `refund-only week`: `spent` −5,000 gives `remaining` = target + 5,000 and `projectedOverspend` 0.

- [ ] **Step 2: Run the tests**

Run `npx vitest run tests/engine/week.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `weeksOfMonth` and `computeWeek`.**

- [ ] **Step 4: Run the tests again**

Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(engine): weekly target"
```

---

### Task 5: Fund provision and fund overspend

**Files:**
- Create: `src/engine/funds.ts`
- Modify: `src/engine/month.ts` (use the real functions)
- Test: `tests/engine/funds.test.ts`, and extend `tests/engine/month.test.ts`

**Interfaces:**
- Produces:

```ts
export function fundProvision(f: Fund, m: Month): Agorot;
// 0 if targetDate's month < m or balance >= target;
// else ceil((target - balance) / max(1, monthsBetween(m, monthOf(targetDate))))
// isGeneral funds provision 0 (they only receive savings)
export function fundOverspend(f: Fund, m: Month, txns: Txn[]): Agorot;
// max(0, sum of expense txns in m with fundId === f.id − (f.balance + fundProvision(f, m)))
```

- [ ] **Step 1: Write failing tests**

- Trip: target 1,200,000, `targetDate` `2027-08-15`, balance 0, in `2026-11`. Provision = `ceil(1200000 / 9)` = 133,334.
- The same trip with balance 400,000: provision = `ceil(800000 / 9)` = 88,889.
- A test this month: target 115,000, `targetDate` `2026-11-15`, balance 60,000. Provision is 55,000 (`monthsLeft` floors at 1).
- A past target (`2026-10-01`): provision 0. A general fund: provision 0.
- Overspend: car fund with balance 100,000 and provision 20,000, a fund txn of 150,000. Overspend is 30,000.
- In `month.test`: `fundProvision` is the sum over funds, and `fundOverspend` adds to `variableSpent`.

- [ ] **Step 2: Run the tests**

Run `npx vitest run tests/engine`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement both functions and wire them into `computeMonth`.**

- [ ] **Step 4: Run the tests again**

Run `npx vitest run tests/engine`. Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(engine): funds"
```

---

### Task 6: Database schema, RLS and RPCs

**Files:**
- Create: `supabase/migrations/0001_core.sql`, `supabase/tests/auth-stub.sql`, `tests/sql/harness.ts`
- Test: `tests/sql/rls.test.ts`

**Interfaces:**
- Produces, as tables (all with `id uuid primary key default gen_random_uuid()` unless noted, and `created_at timestamptz default now()`):
  - `allowlist(email text primary key)`
  - `households(id, name text not null, owner_id uuid not null references auth.users)`
  - `members(household_id uuid references households on delete cascade, user_id uuid unique references auth.users, display_name text not null, role text check (role in ('owner','member')), primary key (household_id, user_id))`
  - `categories(id, household_id, name text, sort int)`
  - `recurring_items(id, household_id, kind text check (kind in ('income','fixed')), name text, amount_agorot int, day_of_month int check (day_of_month between 1 and 31), interval_months int default 1 check (interval_months >= 1), start_month date, paid_by text check (paid_by in ('bank','card')), category_id uuid null, active bool default true)`
  - `funds(id, household_id, name text, target_agorot int, target_date date, is_general bool default false, annual bool default false)`
  - `fund_entries(id, household_id, fund_id uuid references funds on delete cascade, month date, amount_agorot int, kind text check (kind in ('provision','deposit','withdrawal','adjust')))`
  - `transactions(id, household_id, member_id uuid references auth.users, date date, amount_agorot int, kind text, merchant text, category_id uuid null, recurring_item_id uuid null, fund_id uuid null, is_card_settlement bool default false, source text check (source in ('manual','file','sms','email','apple_pay','google_wallet')), status text default 'confirmed', installment_group uuid null, installment_index int null, installment_count int null, note text null)`
  - `invites(token uuid primary key default gen_random_uuid(), household_id, email text, created_by uuid, expires_at timestamptz default now() + interval '14 days', accepted_at timestamptz null)`
  - `bank_balance(household_id uuid primary key, amount_agorot int, as_of date)`

  All `household_id` columns: `uuid not null references households on delete cascade`.
- Produces, as functions:
  - `is_member(hid uuid) returns bool` (`security definer`, `stable`)
  - `is_owner(hid uuid) returns bool`
  - `create_household(p_name text, p_display_name text) returns uuid`. It raises `'not_allowlisted'` unless `lower(auth.jwt()->>'email')` is in the allowlist, and `'already_member'` if the caller is already a member. It inserts the household and the owner member, the default categories (סופר, אוכל בחוץ, דלק ותחבורה, בריאות, ילדים, פנאי, קניות, בית, אחר, with sort 1-9), and a general fund named `חיסכון כללי` (`is_general`, target 0, `target_date` `'2099-12-31'`).
  - `create_invite(p_email text) returns uuid`. Callable by members. It inserts `lower(p_email)` into the allowlist (on conflict do nothing) and returns the token.
  - `accept_invite(p_token uuid, p_display_name text) returns uuid`. The caller's email must equal the invite email. It raises `'invite_invalid'` if the invite is expired, accepted or mismatched. It adds the member with role `member` and returns the `household_id`.
- RLS: enabled on every table.
  - `households`: select where `is_member(id)`; delete where `is_owner(id)`. There is no direct insert.
  - `members`: select where `is_member(household_id)`; delete where `is_owner(household_id)` or `user_id = auth.uid()`.
  - Every other household table: all operations where `is_member(household_id)`, and inserts `with check (is_member(household_id))`.
  - `allowlist` and `invites`: no direct client access, RPC only.
- `tests/sql/harness.ts` exports `newDb(): Promise<PGlite>`, which runs `auth-stub.sql` and then every migration in order. It also exports `asUser(db, id: string, email: string): Promise<void>`, which runs `set role authenticated` and sets `request.jwt.claims` to `{"sub": id, "email": email}`, and `asAdmin(db)`, which runs `reset role`.
- `auth-stub.sql` (test only, never deployed):
  - creates the `auth` schema and `auth.users(id uuid primary key, email text)`;
  - defines `auth.uid()` and `auth.jwt()` from `current_setting('request.jwt.claims', true)`;
  - creates the roles `authenticated` and `anon`;
  - runs `grant usage on schema public, auth to authenticated` and `alter default privileges in schema public grant all on tables to authenticated`, plus `grant execute on functions`.

- [ ] **Step 1: Write failing tests** (`tests/sql/rls.test.ts`)

Before each test, run as admin: insert users A (`a@x.com`) and B (`b@x.com`) and C (`c@x.com`) into `auth.users`, and allowlist `a@x.com` and `b@x.com`.

- `non-allowlisted user cannot create a household`: as C, `create_household` rejects with `not_allowlisted`.
- `create_household seeds categories and general fund`: as A, there are 9 categories and 1 fund with `is_general`.
- `second create_household fails`: rejects with `already_member`.
- `household isolation`: A and B each create a household. As B, `select * from transactions` returns 0 rows after A inserted one. An insert of a transaction with A's `household_id` is rejected.
- `invite flow`: A invites `c@x.com`. As C, `accept_invite` succeeds and C reads A's transaction.
- `invite email mismatch`: B accepting C's token rejects with `invite_invalid`.
- `only owner deletes household`: C's delete affects 0 rows, and A's delete removes it.

- [ ] **Step 2: Run the tests**

Run `npx vitest run tests/sql`. Expected: FAIL, because the migration is missing.

- [ ] **Step 3: Write `0001_core.sql`** to satisfy the interfaces above.

- [ ] **Step 4: Run the tests again**

Run `npx vitest run tests/sql`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(db): core schema, RLS, household RPCs"
```

---

### Task 7: Data layer

**Files:**
- Create: `src/data/supabase.ts`, `src/data/mappers.ts`, `src/data/repo.ts`
- Test: `tests/data/mappers.test.ts`

**Interfaces:**
- Consumes: the engine types (Task 2) and the schema (Task 6).
- Produces:
  - `mappers.ts`: `rowToTxn`, `txnToRow`, `rowToRecurring`, `recurringToRow`, `rowToFund(row, entries)`.
    - Column names become camelCase, and `start_month` (a date) becomes a `Month`.
    - `Fund.balance` is the sum of the fund's `fund_entries` with `month` < the computed month, where withdrawals are negative.
  - `repo.ts`, every function returning a Promise and throwing `Error(message)` on a Supabase error:
    - `getMyHousehold(): {id, name, role, displayName} | null`
    - `createHousehold(name, displayName)`, `createInvite(email): string` (the token), `acceptInvite(token, displayName)`
    - `loadMonth(householdId, month): MonthInput & { categories, members, bankBalance }`. It loads the month's txns, the recurring items, and the funds with their entries. `carryIn` is 0.
    - `addTransaction(householdId, draft: Omit<Txn,'id'|'status'>, installments?: number)`. With `installments > 1` it inserts the `splitInstallments` rows with a shared `installment_group`.
    - `updateTransaction(id, patch)`, `deleteTransaction(id)`
    - `upsertRecurring`, `deleteRecurring`, `upsertFund`, `deleteFund`
    - `setBankBalance(householdId, amount, asOf)`
  - `supabase.ts`: `export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)`.

- [ ] **Step 1: Write failing tests**

- A full row converts to a Txn and back to the same row.
- A recurring row with `start_month` `'2026-02-01'` becomes `startMonth` `'2026-02'`.
- `rowToFund` with entries `+50,000 provision` (October), `+30,000 deposit` (October), `−20,000 withdrawal` (October) and `+10,000` (November), computed for November, gives balance 60,000.

- [ ] **Step 2: Run the tests**

Run `npx vitest run tests/data`. Expected: FAIL.

- [ ] **Step 3: Implement `mappers.ts`, then `repo.ts` and `supabase.ts`.**

The repo has no unit tests. It is covered by Task 12's manual check against the real project.

- [ ] **Step 4: Run the tests and the type check**

Run `npx vitest run tests/data && npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(data): mappers and repository"
```

---

### Task 8: Sign-in, onboarding and invites

**Files:**
- Create: `src/ui/auth/SignIn.tsx`, `src/ui/onboarding/Onboarding.tsx`, `src/ui/onboarding/AcceptInvite.tsx`, `src/ui/routes.tsx`
- Modify: `src/ui/App.tsx`
- Test: `tests/ui/onboarding.test.tsx`

**Interfaces:**
- Consumes: `repo.getMyHousehold`, `createHousehold`, `acceptInvite`, and `supabase.auth`.
- Produces routes under `HashRouter`:
  - `/` Home, `/tx` Transactions, `/add` AddTransaction, `/recurring`, `/funds`, `/settings`, `/invite/:token`.
  - `App` gates the routes in order: no session → `SignIn`. A session but no household, and the route isn't an invite → `Onboarding`. Otherwise → the routes, with a bottom tab bar (בית, עסקאות, קבועות, קופות, הגדרות).

Copy (Hebrew, exact):

| מסך | טקסט |
|---|---|
| SignIn | כותרת `כניסה ל-Balance`, שדה `אימייל`, כפתור `שלחו לי קישור כניסה`, אחרי שליחה `נשלח קישור לכתובת {email}` |
| Onboarding | `שם משק הבית`, `השם שלך`, כפתור `יצירת משק בית` |
| שגיאת `not_allowlisted` | `הכתובת הזו עדיין לא הוזמנה ל-Balance. בקשו הזמנה ממי ששלח לכם את הקישור.` |
| AcceptInvite | `הצטרפות למשק בית`, `השם שלך`, כפתור `הצטרפות`, שגיאת `invite_invalid`: `ההזמנה לא בתוקף או שנשלחה לכתובת אחרת.` |

- [ ] **Step 1: Write failing tests**

Mock `repo` with `vi.mock`.
- `Onboarding shows the not-invited message when createHousehold rejects with not_allowlisted`.
- `Onboarding calls createHousehold with the typed names`.

- [ ] **Step 2: Run the tests**

Run `npx vitest run tests/ui/onboarding.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement the screens and the router.**

`SignIn` uses `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } })`.

- [ ] **Step 4: Run the tests again**

Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ui): sign-in, onboarding, invites"
```

---

### Task 9: Home screen (option A)

**Files:**
- Create: `src/ui/screens/Home.tsx`, `src/ui/components/ProgressBar.tsx`, `src/ui/components/Amount.tsx`, `src/ui/components/SourcePill.tsx`
- Test: `tests/ui/home.test.tsx`

**Interfaces:**
- Consumes: `loadMonth`, `computeMonth`, `computeWeek`, `todayInIsrael`, `formatShekels`.
- Produces: `<HomeView summary={MonthSummary} week={WeekStatus} recent={Txn[]} bank={{amount, asOf} | null} householdName={string} memberCount={number} />`. This is a pure presentational component. `Home` is the container that loads the data and renders it.
- The expected next card charge (spec §6.6) needs to know which transactions were made by card, and that knowledge only arrives with files and SMS. It ships in plan 2. Leave a slot for it in the bank card.

Layout, top to bottom, per the chosen mockup:
1. The month name in Hebrew (`נובמבר`), plus `{householdName} · {n} משתתפים`.
2. `נשאר לבזבז החודש`, then the big amount, then `מתוך {variableBudget} להוצאות משתנות`, then a bar (spent / budget).
3. `השבוע ({index} מתוך {weekCount})`, then the row `יעד שבועי` with the target, then a bar, then `הוצאתם {spent} · נשארו {remaining} עד שבת`. The bar turns amber when `projectedOverspend > 0`, with `בקצב הנוכחי תחרגו ב-~{projectedOverspend}`.
4. `אחרונות`: the last 5 transactions, merchant on the start side and amount on the end side, with a `SourcePill`. Pill labels: `Apple Pay`, `Google Wallet`, `SMS`, `מייל`, `קובץ`, `ידני`.
5. The bank card: `יתרה בבנק: {amount} · עודכן {asOf}`, or `יתרה בבנק: לא הוזנה`.
6. A floating button `+ הוספה ידנית` linking to `/add`.

When `leftToSpend < 0`, the big number is shown in red as a negative.

- [ ] **Step 1: Write failing tests** for `HomeView`

- `shows left-to-spend formatted`: 684,000 renders `6,840 ₪`.
- `week line`: `הוצאתם 1,020 ₪ · נשארו 620 ₪ עד שבת`.
- `pace warning only when projectedOverspend > 0`.
- `empty month renders 0 ₪ and no recent rows` (Review Focus 1).
- `bank missing shows "לא הוזנה"`.
- `ProgressBar clamps its ratio to [0, 1]`: spent −5,000 renders width 0%, and spent above budget renders 100% (Review Focus 2).

- [ ] **Step 2: Run the tests**

Run `npx vitest run tests/ui/home.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement the components and the container.**

- [ ] **Step 4: Run the tests again**

Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ui): home screen"
```

---

### Task 10: Manual entry and the transactions list

**Files:**
- Create: `src/ui/screens/AddTransaction.tsx`, `src/ui/screens/Transactions.tsx`
- Test: `tests/ui/add-transaction.test.tsx`

**Interfaces:**
- Consumes: `repo.addTransaction`, `updateTransaction`, `deleteTransaction`, `loadMonth`, `toAgorot`.
- AddTransaction fields:
  - a toggle `הוצאה` / `הכנסה`;
  - `סכום`;
  - `תאריך` (default today in Israel);
  - `בית עסק / תיאור`;
  - `קטגוריה`;
  - `שיוך` (none, one of the recurring items of the same kind, or one of the funds; fund only for expenses);
  - `מספר תשלומים` (1-36, expenses only);
  - `הערה`.

  Save: `שמירה`. On success it navigates to `/` and shows the toast `נשמר`. The `source` is `manual`, and `memberId` is the current user.
- Transactions:
  - The list for a month, with previous/next month arrows.
  - Filters: category, member, source.
  - A tap opens the same form in edit mode, with `מחיקה` behind the in-app confirm `למחוק את העסקה?`. Never `window.confirm`.

- [ ] **Step 1: Write failing tests**

- `amount "1,200" with 3 installments calls addTransaction with amount 120000 and installments 3`.
- `invalid amount shows "סכום לא תקין" and does not save`.
- `fund option hidden for income`.

- [ ] **Step 2: Run the tests**

Run `npx vitest run tests/ui/add-transaction.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement both screens.**

- [ ] **Step 4: Run the tests again**

Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ui): manual entry and transactions list"
```

---

### Task 11: Recurring items, funds and settings

**Files:**
- Create: `src/ui/screens/Recurring.tsx`, `src/ui/screens/Funds.tsx`, `src/ui/screens/Settings.tsx`
- Test: `tests/ui/funds.test.tsx`

**Interfaces:**
- Consumes: `repo.upsertRecurring`, `deleteRecurring`, `upsertFund`, `deleteFund`, `createInvite`, `setBankBalance`, and `fundProvision`.
- **Recurring:** two sections, `הכנסות` and `הוצאות קבועות`. Item fields:
  - `שם`, `סכום`, `יום בחודש`;
  - `כל כמה חודשים` (1, 2, 3, 6, 12);
  - `מחודש`;
  - `יורד מ` (בנק / אשראי), fixed items only.

  Each row shows the amount and `כל חודש`, or `כל {n} חודשים`.
- **Funds:** a card per fund, with name, `{balance} / {target}`, a progress bar, `הפרשה החודש: {fundProvision}` and `עד {targetDate}`. A button `+ קופה חדשה` opens fields `שם`, `סכום יעד`, `תאריך יעד` and the checkbox `חוזרת כל שנה`. The general fund can't be deleted.
- **Settings:**
  - Members list.
  - `הזמנת משתתף` (email) → `createInvite` → shows a copyable link `{origin}{pathname}#/invite/{token}`.
  - `יתרה בבנק` (amount + date) → `setBankBalance`.
  - Sign out: `יציאה`.

- [ ] **Step 1: Write failing tests**

- `fund card shows monthly provision from fundProvision`: the trip fixture from Task 5 shows `1,333.34 ₪`.
- `general fund has no delete button`.

- [ ] **Step 2: Run the tests**

Run `npx vitest run tests/ui/funds.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement the three screens.**

- [ ] **Step 4: Run the tests again**

Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ui): recurring, funds, settings"
```

---

### Task 12: Hosted setup and deploy

**Files:**
- Create: `README.md` (setup steps in Hebrew), `wrangler.toml` (`name = "balance"`, `pages_build_output_dir = "dist"`)
- Modify: `package.json` (`"deploy": "npm run build && wrangler pages deploy dist"`, `wrangler` and `supabase` as devDependencies)

Steps marked **(Shai)** need his own accounts and logins. The agent prepares everything else and waits.

- [ ] **Step 1 (Shai): Create the Supabase project**

Create a project named `balance` in the Supabase dashboard (Free plan allows 2 active projects; KKarcDB already uses one). Copy the project URL and the anon key into `.env.local`.

- [ ] **Step 2 (Shai): Log in and push the migration**

Run `npx supabase login`, then `npx supabase link --project-ref <ref>`, then `npx supabase db push`.

Expected: `0001_core.sql` is applied. Do not push `supabase/tests/auth-stub.sql`, which lives outside `migrations/`.

- [ ] **Step 3 (Shai): Configure Auth and the allowlist**
  - In Auth → URL Configuration, set Site URL to the Pages URL and add it to the redirect URLs.
  - Leave the email provider on.
  - In the SQL editor, run `insert into allowlist values ('<shai's email>');`.

- [ ] **Step 4 (Shai): Log in to Cloudflare and deploy**

Run `npx wrangler login`, then `npm run deploy`. Expected: a `https://balance-xxx.pages.dev` URL.

- [ ] **Step 5: Manual end-to-end check on the deployed site, on a phone**
  - sign in by magic link;
  - create a household;
  - add salary and rent;
  - add one fund;
  - enter a 3-installment expense;
  - check that Home shows the November numbers matching the engine;
  - invite a second email and accept it in another browser;
  - install to the home screen on Android and iPhone.

- [ ] **Step 6: Commit**

```bash
git commit -m "chore: deploy config and README"
```
