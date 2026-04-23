import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import clsx from 'clsx';
import type { TagColor } from '../../core/models/models';

export function IconBadge({
  color = 'purple',
  icon: Icon,
}: {
  color?: TagColor;
  icon: ComponentType<LucideProps>;
}) {
  return (
    <span className={clsx('icon-badge', color)} aria-hidden="true">
      <Icon size={22} strokeWidth={1.8} />
    </span>
  );
}
