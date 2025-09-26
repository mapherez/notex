import { HomePageContent } from '@/components/HomePageContent';

export default function HomePage() {
  console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  return <HomePageContent />;
}