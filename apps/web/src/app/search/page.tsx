'use client';

import React, { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Redirect to homepage with search parameters
    const params = new URLSearchParams(searchParams.toString());
    const queryString = params.toString();
    const targetUrl = queryString ? `/?${queryString}` : '/';

    router.replace(targetUrl);
  }, [searchParams, router]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Redirecting to homepage...</p>
    </div>
  );
}