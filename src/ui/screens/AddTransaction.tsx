import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addTransaction, deleteTransaction, getTransaction, loadMonth, updateTransaction, type MonthData } from '../../data/repo';
import { monthOf, todayInIsrael } from '../../engine/dates';
import type { Txn } from '../../engine/types';
import ConfirmDialog from '../components/ConfirmDialog';
import TransactionForm, { type FormDraft } from '../components/TransactionForm';
import { useHousehold } from '../household';
import { useToast } from '../toast';

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

  useEffect(() => {
    loadMonth(household.id, monthOf(today)).then(setData, () => setError('לא הצלחנו לטעון את הנתונים.'));
    if (id) getTransaction(id).then(setInitial, () => setError('העסקה לא נמצאה.'));
  }, [household.id, id, today]);

  async function save(draft: FormDraft, installments: number) {
    try {
      if (id) await updateTransaction(id, draft);
      else await addTransaction(household.id, { ...draft, memberId: userId }, installments);
      toast('נשמר');
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
        onSubmit={save}
        onDelete={id ? () => setConfirming(true) : undefined}
      />
      {confirming && <ConfirmDialog text="למחוק את העסקה?" confirmLabel="מחיקה" onConfirm={remove} onCancel={() => setConfirming(false)} />}
    </>
  );
}
