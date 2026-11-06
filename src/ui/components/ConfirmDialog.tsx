// In-app confirmation; window.confirm is blocked in some embedded browsers and can't be styled.
export default function ConfirmDialog({ text, confirmLabel, onConfirm, onCancel }: {
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <div className="dialog">
        <p>{text}</p>
        <div className="actions">
          <button type="button" onClick={onCancel}>ביטול</button>
          <button type="button" className="primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
