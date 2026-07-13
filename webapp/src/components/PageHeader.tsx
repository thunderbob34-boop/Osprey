import type { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  title: ReactNode;
  sub?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, sub, actions }: Props) {
  return (
    <div className="page-head">
      <div>
        <div className="page-eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}
