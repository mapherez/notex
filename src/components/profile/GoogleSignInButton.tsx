import type { ButtonHTMLAttributes } from 'react';

export function GoogleSignInButton({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} type="button" className={['google-sign-in-button', className].filter(Boolean).join(' ')}>
      <img src={`${import.meta.env.BASE_URL}assets/google-g.png`} width="20" height="20" alt="" aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
}
