'use client';

import { Button } from '@notex/ui';

export default function HomePage() {
  return (
    <main className="container">
      <header className="header">
        <h1>NoteX</h1>
        <p>Knowledge Management System</p>
      </header>
      
      <section className="hero">
        <h2>Welcome to your knowledge base</h2>
        <p>
          Start creating and organizing your knowledge cards with modern accessibility 
          and internationalization features built-in.
        </p>
        
        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Button 
            variant="primary"
            onClick={() => window.location.href = '/cards'}
          >
            View Knowledge Cards
          </Button>
          <Button variant="secondary">Learn More</Button>
          <Button variant="ghost">View Demo</Button>
        </div>
      </section>
    </main>
  );
}