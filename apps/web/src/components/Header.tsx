'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { UserIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@notex/ui';
import { createLocalizeFunction, loadLocale } from '@notex/config';
import type { Locale } from '@notex/types';

interface HeaderProps {
  onSignIn: () => void;
  onSignOut: () => void;
}

export function Header({ onSignIn, onSignOut }: HeaderProps) {
  const { user, profile, loading } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [localize, setLocalize] = useState<((key: string, params?: Record<string, string | number>) => string) | null>(null);
  const { settings, loading: settingsLoading } = useSettings();

  // Initialize localization
  useEffect(() => {
    async function initializeLocalization() {
      if (!settings?.SETUP?.language || settingsLoading) return;

      try {
        await loadLocale(settings.SETUP.language as Locale);
        const { localize: localizeFunc } = createLocalizeFunction(settings.SETUP.language as Locale);
        setLocalize(() => localizeFunc);
      } catch (error) {
        console.error('Failed to load locale:', error);
        setLocalize(() => (key: string) => key);
      }
    }

    initializeLocalization();
  }, [settings?.SETUP?.language, settingsLoading]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLoginClick = () => {
    setShowMenu(false);
    setShowModal(true);
  };

  const handleSignOut = () => {
    setShowMenu(false);
    onSignOut();
  };

  const getUserDisplayName = () => {
    if (profile?.email) {
      // Extract name from email or use first part
      const name = profile.email.split('@')[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return 'User';
  };

  return (
    <>
      {/* Header */}
      <header className="site-header">
        <nav className="main-nav">
          <div className="nav-brand">
            <Link href="/">NoteX</Link>
          </div>

          <div className="nav-user">
            {user ? (
              <div className="user-info">
                <span className="greeting">{localize ? localize('HEADER_GREETING', { name: getUserDisplayName() }) : `Hey, ${getUserDisplayName()}`}</span>
                <div className="user-menu-container" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="user-icon-button"
                    aria-label={localize ? localize('A11Y_USER_MENU') : 'User menu'}
                  >
                    <UserIcon className="user-icon" />
                  </button>

                  {showMenu && (
                    <div className="user-menu">
                      <button
                        onClick={handleSignOut}
                        className="menu-item sign-out"
                      >
                        {localize ? localize('HEADER_SIGN_OUT') : 'Sign Out'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="user-menu-container" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="user-icon-button"
                  aria-label={localize ? localize('A11Y_USER_MENU') : 'User menu'}
                >
                  <UserIcon className="user-icon" />
                </button>

                {showMenu && (
                  <div className="user-menu">
                    <button
                      onClick={handleLoginClick}
                      className="menu-item login"
                    >
                      {localize ? localize('HEADER_LOGIN') : 'Login'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Login Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{localize ? localize('HEADER_WELCOME_TITLE') : 'Welcome to NoteX'}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="modal-close"
                aria-label={localize ? localize('A11Y_CLOSE_MODAL') : 'Close modal'}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <p>{localize ? localize('HEADER_WELCOME_DESCRIPTION') : 'Sign in to access all features and start creating knowledge cards.'}</p>

              <button
                onClick={() => {
                  setShowModal(false);
                  onSignIn();
                }}
                className="google-signin-button"
                disabled={loading}
              >
                <svg className="google-icon" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {localize ? localize('HEADER_CONTINUE_WITH_GOOGLE') : 'Continue with Google'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}