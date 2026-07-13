interface Props {
  title: string;
  body: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, body, action }: Props) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
