import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  addTransaction, deleteTransaction, getTransaction, loadCategoryRules, loadMonth, saveCategoryRule, updateTransaction,
  type CategoryRule, type MonthData,
} from '../../data/repo';
import { merchantKey } from '../../engine/merchant';
import { monthOf, todayInIsrael } from '../../engine/dates';
import type { Txn } from '../../engine/types';
import ConfirmDialog from '../components/ConfirmDialog';
import TransactionForm, { type FormDraft } from '../components/TransactionForm';
import { useHousehold } from '../household';
import { useToast } from '../toast';

/** An edit that sets a new category teaches a rule for the merchant. */
export function ruleToSave(
  before: { merchant: string; categoryId: string | null } | undefined,
  after: { merchant: string; categoryId: string | null },
): { merchant: string; categoryId: string } | null {
  if (!before || !after.categoryId || after.categoryId === before.categoryId || !merchantKey(after.merchant)) return null;
  return { merchant: after.merchant, categoryId: after.categoryId };
}

/** "Rules, not guesses" (§7.4): where a transaction's category came from. */
export function categoryOrigin(t: { merchant: string; categoryHint: string | null }, rules: CategoryRule[]): string | null {
  if (rules.some((r) => r.merchantKey === merchantKey(t.merchant))) return 'לפי כלל שלמד מתיקון שלך';
  return t.categoryHint ? `לפי הקטגוריה של לאומי: ${t.categoryHint}` : null;
}

export default function AddTransaction() {
  const { id } = useParams();
  const { household, userId } = useHousehold();
  const navigate = useNavigate();
  const toast = useToast();
  const today = todayInIsrael();
  const [data, setData] = useState<MonthData | null>(null);
  const [initial, setInitial] = useState<(Txn & { note: string | null }) | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<CategoryRule[]>([]);

  useEffect(() => {
    loadMonth(household.id, monthOf(today)).then(setData, () => setError('לא הצלחנו לטעון את הנתונים.'));
    if (id) getTransaction(id).then(setInitial, () => setError('העסקה לא נמצאה.'));
    loadCategoryRules(household.id).then(setRules, () => setRules([]));
  }, [household.id, id, today]);

  async function save(draft: FormDraft, installments: number) {
    try {
      if (id) await updateTransaction(id, draft);
      else await addTransaction(household.id, { ...draft, memberId: userId }, installments);
      const rule = ruleToSave(initial, draft);
      const name = rule && data?.categories.find((c) => c.id === rule.categoryId)?.name;
      if (rule && name) {
        await saveCategoryRule(household.id, rule.merchant, rule.categoryId).then(
          () => toast(`מעכשיו ${rule.merchant} יסווג כ${name}`),
          () => toast('נשמר'),
        );
      } else {
        toast('נשמר');
      }
      navigate(-1);
    } catch {
      setError('השמירה נכשלה. נסו שוב.');
    }
  }

  async function remove() {
    if (!id) return;
    try {
      await deleteTransaction(id);
      toast('נמחק');
      navigate(-1);
    } catch {
      setError('המחיקה נכשלה. נסו שוב.');
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!data || (id && !initial)) return <p className="muted">טוען…</p>;
  return (
    <>
      <h1>{id ? 'עריכת עסקה' : 'הוספה ידנית'}</h1>
      <TransactionForm
        categories={data.categories}
        recurring={data.recurring}
        funds={data.funds}
        today={today}
        initial={initial}
        categoryOrigin={initial ? categoryOrigin(initial, rules) : null}
        onSubmit={save}
        onDelete={id ? () => setConfirming(true) : undefined}
      />
      {confirming && <ConfirmDialog text="למחוק את העסקה?" confirmLabel="מחיקה" onConfirm={remove} onCancel={() => setConfirming(false)} />}
    </>
  );
}
