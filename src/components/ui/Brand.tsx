import { useAppStore } from '../../store/useAppStore';

export function BrandMark({ className, alt = '' }: { className?: string; alt?: string }) {
  const theme = useAppStore((state) => state.settings.theme);

  return (
    <img
      className={className}
      src={`${import.meta.env.BASE_URL}assets/notex-mark-${theme === 'light' ? 'light' : 'dark'}.svg`}
      alt={alt}
    />
  );
}

export function BrandName({ className = '' }: { className?: string }) {
  return <span className={`brand-wordmark ${className}`}>Note<span className="brand-wordmark__accent">X</span></span>;
}
