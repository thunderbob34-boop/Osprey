interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Styled replacement for window.confirm() — used before any destructive action. */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', pending, onConfirm, onCancel }: Props) {
  if (!open) return null;
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-dialog-title">{title}</h3>
        <p>{message}</p>
        <div className="log-form-actions" style={{ marginTop: 20 }}>
          <button className="btn ghost" type="button" onClick={onCancel} disabled={pending}>{cancelLabel}</button>
          <button className="btn danger" type="button" onClick={onConfirm} disabled={pending}>{pending ? 'Deleting…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
