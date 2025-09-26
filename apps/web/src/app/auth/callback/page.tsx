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