import { friendlyMessage } from '../lib/errorMessage';

interface Props {
  error: Error;
  onRetry?: () => void;
  fallback?: string;
}

export function ErrorPanel({ error, onRetry, fallback }: Props) {
  return (
    <div className="error-panel" role="alert">
      <p className="head">Something failed</p>
      <p className="msg">{friendlyMessage(error, fallback)}</p>
      {onRetry && (
        <button className="btn" type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
