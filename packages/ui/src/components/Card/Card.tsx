// Knowledge Card Component
// Displays a knowledge card with content, examples, and metadata

import React from 'react';
import { KnowledgeCard } from '@notex/database';
import styles from './Card.module.scss';

export interface CardProps {
  card: KnowledgeCard;
  className?: string;
  onClick?: () => void;
}

export function Card({ card, className, onClick }: CardProps) {
  const { title, category, content, metadata, created_at } = card;
  
  // Parse content safely
  const summary = content?.summary || '';
  const examples = (content?.examples || []) as string[];
  const difficulty = (metadata?.difficulty as string) || 'beginner';
  const tags = (metadata?.tags || []) as string[];

  // Format date
  const createdDate = new Date(created_at).toLocaleDateString('pt-PT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <article 
      className={`${styles.card} ${className || ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <h3 className={styles.title}>{title}</h3>
          <span className={styles.category}>{category}</span>
        </div>
        <div className={styles.metadata}>
          <span className={`${styles.difficulty} ${styles[difficulty as keyof typeof styles] || ''}`}>
            {difficulty}
          </span>
        </div>
      </header>

      {/* Content */}
      <div className={styles.content}>
        {summary && (
          <p className={styles.summary}>{summary}</p>
        )}

        {examples.length > 0 && (
          <div className={styles.examples}>
            <h4 className={styles.examplesTitle}>Exemplos:</h4>
            <ul className={styles.examplesList}>
              {examples.slice(0, 3).map((example, index) => (
                <li key={index} className={styles.example}>
                  {example}
                </li>
              ))}
              {examples.length > 3 && (
                <li className={styles.moreExamples}>
                  +{examples.length - 3} mais exemplos
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.tags}>
          {tags.slice(0, 3).map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className={styles.moreTags}>+{tags.length - 3}</span>
          )}
        </div>
        <time className={styles.date} dateTime={created_at}>
          {createdDate}
        </time>
      </footer>
    </article>
  );
}