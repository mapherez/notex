'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@notex/ui';
import { KnowledgeCardRepository, type KnowledgeCard } from '@notex/database';

export default function CardsPage() {
  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCards() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch all published cards
        const fetchedCards = await KnowledgeCardRepository.list({
          status: 'published'
        }, 20);
        
        setCards(fetchedCards);
      } catch (err) {
        console.error('Error fetching cards:', err);
        setError('Failed to load knowledge cards');
      } finally {
        setLoading(false);
      }
    }

    fetchCards();
  }, []);

  if (loading) {
    return (
      <main className="container">
        <div className="main">
          <h1>Knowledge Cards</h1>
          <div className="loading">Loading knowledge cards...</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container">
        <div className="main">
          <h1>Knowledge Cards</h1>
          <div className="error">{error}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="main">
        <h1>Knowledge Cards</h1>
        <p>Explore our collection of Portuguese language knowledge cards.</p>
        
        {cards.length === 0 ? (
          <div className="error">No knowledge cards found.</div>
        ) : (
          <div className="cards-grid">
            {cards.map((card) => (
              <Card
                key={card.id}
                card={card}
                onClick={() => {
                  // TODO: Navigate to card detail page
                  console.log('Clicked card:', card.slug);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}