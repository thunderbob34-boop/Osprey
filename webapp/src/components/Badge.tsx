interface Props {
  children: React.ReactNode;
  variant?: 'default' | 'amber' | 'solid' | 'muted';
}

export function Badge({ children, variant = 'default' }: Props) {
  const cls = variant === 'default' ? 'badge' : `badge ${variant}`;
  return <span className={cls}>{children}</span>;
}
