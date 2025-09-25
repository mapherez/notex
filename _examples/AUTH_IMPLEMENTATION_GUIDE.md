# NoteX Authentication & Permission System Implementation Guide

## Overview

This document outlines the implementation of Google OAuth authentication and role-based permissions for the NoteX knowledge management system.

## Permission System Design

### User Roles

- **Guests**: Can read all cards (no login required)
- **Normal Users**: Can read all cards + edit cards flagged as "editable by others"
- **Admins**: Can read/edit/create all cards + manage card permissions

### Card Permissions

- `editable_by_others`: Boolean flag set by admins
- If `true`: Normal users can edit the card
- If `false`: Only admins can edit the card
- All users can create cards if they have `can_create` permission

## Database Schema Changes

### 1. User Profiles Table

```sql
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'normal')) NOT NULL DEFAULT 'normal',
  can_create BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Knowledge Cards Table Extension

```sql
ALTER TABLE knowledge_cards
ADD COLUMN editable_by_others BOOLEAN NOT NULL DEFAULT false;
```

## Implementation Phases

### Phase 1: Google OAuth Setup (30-45 minutes)

#### 1.1 Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback` (for development)
7. Copy Client ID and Client Secret

#### 1.2 Supabase Configuration

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Google provider
3. Paste Client ID and Client Secret
4. Add redirect URLs (same as Google Cloud Console)
5. Save changes

### Phase 2: Database Setup (15-20 minutes)

#### 2.1 Create Tables

Run these SQL commands in Supabase SQL Editor:

```sql
-- Create user profiles table
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'normal')) NOT NULL DEFAULT 'normal',
  can_create BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add permissions to knowledge_cards
ALTER TABLE knowledge_cards
ADD COLUMN editable_by_others BOOLEAN NOT NULL DEFAULT false;

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_cards ENABLE ROW LEVEL SECURITY;
```

#### 2.2 Row Level Security Policies

```sql
-- User profiles policies
CREATE POLICY "Users can read their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Knowledge cards policies
CREATE POLICY "Anyone can read cards" ON knowledge_cards
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create cards" ON knowledge_cards
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND can_create = true
    )
  );

CREATE POLICY "Users can update cards based on permissions" ON knowledge_cards
  FOR UPDATE USING (
    -- Admins can edit anything
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    -- Normal users can edit if editable_by_others is true
    (editable_by_others = true AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'normal'
    ))
  );
```

#### 2.3 Initial Admin Setup

After you log in with Google, manually insert your admin profile:

```sql
INSERT INTO user_profiles (id, email, role, can_create)
VALUES (
  'your-user-id-here',
  'your-email@gmail.com',
  'admin',
  true
);
```

### Phase 3: Frontend Auth System (1-1.5 hours)

#### 3.1 Auth Context (`packages/ui/src/contexts/AuthContext.tsx`)

```typescript
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@notex/database';

interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'normal';
  can_create: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user profile:', error);
      }

      setProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signInWithGoogle,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

#### 3.2 Auth Callback Page (`apps/web/src/app/auth/callback/page.tsx`)

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@notex/database';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Error during auth callback:', error);
        router.push('/');
        return;
      }

      if (data.session) {
        // Check if user profile exists, create if not
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();

        if (!profile) {
          // Create basic profile for new users
          await supabase.from('user_profiles').insert({
            id: data.session.user.id,
            email: data.session.user.email,
            role: 'normal',
            can_create: false
          });
        }

        router.push('/');
      } else {
        router.push('/');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
```

#### 3.3 Login Component (`packages/ui/src/components/Auth/LoginButton.tsx`)

```typescript
'use client';

import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export function LoginButton() {
  const { user, signInWithGoogle, signOut, loading } = useAuth();

  if (loading) {
    return (
      <button disabled className="px-4 py-2 text-sm bg-gray-100 rounded">
        Loading...
      </button>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {user.user_metadata?.name || user.email}
        </span>
        <button
          onClick={signOut}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={signInWithGoogle}
      className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        {/* Google icon SVG */}
        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Sign in with Google
    </button>
  );
}
```

### Phase 4: Permission Checks (45-60 minutes)

#### 4.1 Update Card Editor

Add permission checks and admin controls:

```typescript
// In CardEditor component
const { profile } = useAuth();
const canEdit = profile?.role === 'admin' ||
  (profile?.role === 'normal' && card?.editable_by_others);
const canCreate = profile?.can_create;

// Show edit controls only if user has permission
if (!canEdit && card) {
  return <div>You don't have permission to edit this card.</div>;
}

// Show "editable by others" checkbox for admins
{profile?.role === 'admin' && (
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={editableByOthers}
      onChange={(e) => setEditableByOthers(e.target.checked)}
    />
    Editable by normal users
  </label>
)}
```

#### 4.2 Update Repository

Add permission checks to create/update methods:

```typescript
// In KnowledgeCardRepository.create()
static async create(data: CreateKnowledgeCard): Promise<KnowledgeCard> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('can_create')
    .eq('id', user.id)
    .single();

  if (!profile?.can_create) {
    throw new Error('Create permission required');
  }

  // ... rest of create logic
}
```

## Testing Checklist

### 1. Authentication

- [ ] Google sign-in works
- [ ] User profile is created automatically
- [ ] Sign-out works
- [ ] Session persists on refresh

### 2. Permissions

- [ ] Guests can read all cards
- [ ] Normal users can read all, edit flagged cards
- [ ] Admins can read/edit/create all cards
- [ ] Permission errors show appropriate messages

### 3. Admin Features

- [ ] "Editable by others" checkbox appears for admins
- [ ] Checkbox state saves correctly
- [ ] Permission changes take effect immediately

## User Management

### Adding New Users

1. User signs in with Google
2. Profile is auto-created with `role: 'normal'`, `can_create: false`
3. Manually update in Supabase dashboard:

   ```sql
   UPDATE user_profiles
   SET role = 'admin', can_create = true
   WHERE email = 'user@example.com';
   ```

### Promoting Users

Use Supabase dashboard or create admin interface to update user roles.

## Troubleshooting

### Common Issues

1. **OAuth redirect errors**: Check redirect URLs in Google Cloud Console and Supabase
2. **Permission denied**: Check RLS policies and user profile data
3. **Profile not created**: Check auth callback page and database triggers

### Debug Commands

```bash
# Check user session
supabase auth get-user

# Check user profile
supabase db inspect user_profiles

# Test RLS policies
supabase db test-policies
```

## Next Steps

1. Complete Google OAuth setup
2. Implement database schema
3. Add auth context and UI
4. Test permission system
5. Add admin interface for user management

## Time Estimate: 4-6 hours total

- Database setup: 30 minutes
- Auth system: 1.5 hours
- Permission system: 1.5 hours
- Testing & polish: 1 hour
