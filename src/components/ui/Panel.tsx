import type { PropsWithChildren, ReactNode } from 'react';
import clsx from 'clsx';

export function Panel({
  children,
  title,
  action,
  flush = false,
}: PropsWithChildren<{
  title?: string;
  action?: ReactNode;
  flush?: boolean;
}>) {
  return (
    <section className={clsx('panel', flush && 'flush')}>
      {title ? (
        <div className="panel-header">
          <h2 className="panel-title">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
