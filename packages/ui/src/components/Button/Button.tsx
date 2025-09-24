import React from 'react';
import clsx from 'clsx';
import styles from './Button.module.scss';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant of the button */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Size of the button */
  size?: 'small' | 'medium' | 'large';
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Icon to display before the button text */
  iconBefore?: React.ReactNode;
  /** Icon to display after the button text */
  iconAfter?: React.ReactNode;
  /** Whether the button should take full width of its container */
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'medium',
      loading = false,
      iconBefore,
      iconAfter,
      fullWidth = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={clsx(
          styles.button,
          styles[variant],
          styles[size],
          {
            [styles.loading]: loading,
            [styles.fullWidth]: fullWidth,
          },
          className
        )}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading && (
          <span className={styles.loadingSpinner} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" className={styles.spinner}>
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="32"
                strokeDashoffset="32"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  values="32;0;32"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
          </span>
        )}
        
        {iconBefore && !loading && (
          <span className={styles.iconBefore} aria-hidden="true">
            {iconBefore}
          </span>
        )}
        
        <span className={clsx(styles.content, { [styles.hidden]: loading })}>
          {children}
        </span>
        
        {iconAfter && !loading && (
          <span className={styles.iconAfter} aria-hidden="true">
            {iconAfter}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';