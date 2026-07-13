interface Props {
  error: Error;
  onRetry?: () => void;
}

export function ErrorPanel({ error, onRetry }: Props) {
  return (
    <div className="error-panel" role="alert">
      <p className="head">Something failed</p>
      <p className="msg">{error.message}</p>
      {onRetry && (
        <button className="btn" type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
