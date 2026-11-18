import type { Fund, RecurringItem, Txn } from '../../src/engine/types';

export function item(p: Partial<RecurringItem> & Pick<RecurringItem, 'id' | 'kind' | 'amount'>): RecurringItem {
  return { name: p.id, dayOfMonth: 1, intervalMonths: 1, startMonth: '2026-01', active: true, paidBy: 'bank',
    endMonth: null, variableAmount: false, installmentKey: null, ...p };
}

let seq = 0;
export function txn(p: Partial<Txn> & Pick<Txn, 'date' | 'amount'>): Txn {
  return {
    id: `t${++seq}`, kind: 'expense', merchant: 'm', categoryId: null, recurringItemId: null, fundId: null,
    isCardSettlement: false, source: 'manual', memberId: 'u1', status: 'confirmed',
    cardLast4: null, importKey: null, needsReview: false, ...p,
  };
}

export function fund(p: Partial<Fund> & Pick<Fund, 'id' | 'target' | 'targetDate'>): Fund {
  return { name: p.id, balance: 0, isGeneral: false, ...p };
}
