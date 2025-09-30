'use client';

import React from 'react';
import { Button } from '../Button';

interface LoginButtonProps {
  user?: { user_metadata?: { name?: string }; email?: string } | null;
  loading?: boolean;
  onSignIn?: () => void;
  onSignOut?: () => void;
  localize?: (key: string, params?: Record<string, string | number>) => string;
}

export function LoginButton({
  user,
  loading = false,
  onSignIn,
  onSignOut,
  localize
}: LoginButtonProps) {
  if (loading) {
    return (
      <Button disabled variant="secondary">
        {localize ? localize('AUTH_LOADING') : 'Loading...'}
      </Button>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {user.user_metadata?.name || user.email}
        </span>
        <Button
          onClick={onSignOut}
          variant="secondary"
        >
          {localize ? localize('AUTH_SIGN_OUT') : 'Sign Out'}
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={onSignIn}
      variant="primary"
      className="flex items-center gap-2"
      iconBefore={<i className="icon icon-google w-4 h-4" aria-hidden="true"></i>}
    >
      {localize ? localize('AUTH_SIGN_IN_GOOGLE') : 'Sign in with Google'}
    </Button>
  );
}