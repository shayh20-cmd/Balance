import type { FundDetails } from '../../data/repo';
import { fundProvision } from '../../engine/funds';
import { formatShekels } from '../../engine/money';
import type { Month } from '../../engine/types';
import { shortDate } from '../format';
import ProgressBar from './ProgressBar';

export default function FundCard({ fund, month, onEdit, onDelete }: {
  fund: FundDetails;
  month: Month;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="card">
      <div className="row">
        <strong>{fund.name}</strong>
        {fund.isGeneral ? (
          <span>{formatShekels(fund.balance)}</span>
        ) : (
          <span>{`${formatShekels(fund.balance)} / ${formatShekels(fund.target)}`}</span>
        )}
      </div>
      {!fund.isGeneral && (
        <>
          <ProgressBar value={fund.balance} max={fund.target} />
          <div className="row">
            <span className="muted">{`הפרשה החודש: ${formatShekels(fundProvision(fund, month))}`}</span>
            <span className="muted">{`עד ${shortDate(fund.targetDate)}`}</span>
          </div>
          <div className="actions-inline">
            <button type="button" onClick={onEdit}>עריכה</button>
            <button type="button" className="danger" onClick={onDelete}>מחיקה</button>
          </div>
        </>
      )}
    </section>
  );
}
