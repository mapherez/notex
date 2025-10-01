'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../Button';
import { useSettings } from '../../hooks/useSettings';
import { createLocalizeFunction, loadLocale } from '@notex/config';
import type { Locale } from '@notex/types';
import type { CreateKnowledgeCard, UpdateKnowledgeCard, KnowledgeCard } from '@notex/database';
import styles from './CardEditor.module.scss';

interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'normal';
  can_create: boolean;
}

interface CardEditorProps {
  card?: KnowledgeCard;
  onSave: (data: CreateKnowledgeCard | UpdateKnowledgeCard) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  userProfile?: UserProfile | null;
}

export function CardEditor({ card, onSave, onCancel, isLoading = false, userProfile }: CardEditorProps) {
  const [localize, setLocalize] = useState<((key: string, params?: Record<string, string | number>) => string) | null>(null);
  const { settings, loading: settingsLoading } = useSettings();

  // Permission checks
  const canEdit = userProfile?.role === 'admin' ||
    (userProfile?.role === 'normal' && card?.editable_by_others);
  const isAdmin = userProfile?.role === 'admin';

  // Form state
  const [title, setTitle] = useState(card?.title || '');
  const [category, setCategory] = useState(card?.category || '');
  const [summary, setSummary] = useState(card?.content?.summary || '');
  const [body, setBody] = useState(card?.content?.body || '');
  const [examples, setExamples] = useState(card?.content?.examples?.join('\n') || '');
  const [sources, setSources] = useState(card?.content?.sources?.join('\n') || '');
  const [difficulty, setDifficulty] = useState(
    (card?.content && 'difficulty' in card.content ? card.content.difficulty : undefined) || 'beginner'
  );
  const [tags, setTags] = useState(card?.metadata?.tags?.join(', ') || '');
  const [status, setStatus] = useState(card?.status || 'draft');
  const [editableByOthers, setEditableByOthers] = useState(card?.editable_by_others ?? false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!localize) return;

    const formData = {
      title: title.trim(),
      category: category.trim(),
      content: {
        version: 2 as const,
        summary: summary.trim(),
        body: body.trim(),
        examples: examples.split('\n').filter(ex => ex.trim()).map(ex => ex.trim()),
        sources: sources.split('\n').filter(src => src.trim()).map(src => src.trim()),
        difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced',
      },
      metadata: {
        tags: tags.split(',').filter(tag => tag.trim()).map(tag => tag.trim()),
      },
      status: status as 'draft' | 'published' | 'archived',
      editable_by_others: editableByOthers,
    };

    // Add slug for new cards (id is handled by the page for updates)
    const data = card
      ? formData  // For updates, don't include id - the page handles it
      : { ...formData, slug: generateSlug(title) };

    await onSave(data as CreateKnowledgeCard | UpdateKnowledgeCard);
  };

  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  if (settingsLoading || !localize) {
    return <div className={styles.loading}>Loading...</div>;
  }

  // Permission check for editing existing cards
  if (!canEdit && card) {
    return (
      <div className={styles.cardEditor}>
        <div className={styles.permissionDenied}>
          <h1>{localize('PERMISSION_DENIED')}</h1>
          <p>{localize('EDIT_PERMISSION_REQUIRED')}</p>
          <Button variant="secondary" onClick={onCancel}>
            {localize('GO_BACK')}
          </Button>
        </div>
      </div>
    );
  }

  const categoryOptions = settings?.HOMEPAGE?.categoryOptions || [];
  const difficultyOptions = settings?.HOMEPAGE?.difficultyOptions || [];

  return (
    <div className={styles.cardEditor} data-content-type="interaction-heavy">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.header}>
          <h1>{card ? localize('EDIT_CARD') : localize('CREATE_CARD')}</h1>
          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={isLoading}
            >
              {localize('CANCEL')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !title.trim()}
            >
              {isLoading ? localize('SAVING') : localize('SAVE')}
            </Button>
          </div>
        </div>

        <div className={styles.formGrid}>
          {/* Title */}
          <div className={styles.field}>
            <label htmlFor="title" className={styles.label}>
              {localize('TITLE')} *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={styles.input}
              required
              placeholder={localize('ENTER_TITLE')}
            />
          </div>

          {/* Category */}
          <div className={styles.field}>
            <label htmlFor="category" className={styles.label}>
              {localize('CATEGORY')} *
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={styles.select}
              required
            >
              <option value="">{localize('SELECT_CATEGORY')}</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {localize(option.label)}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty */}
          <div className={styles.field}>
            <label htmlFor="difficulty" className={styles.label}>
              {localize('DIFFICULTY')}
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
              className={styles.select}
            >
              {difficultyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {localize(option.label)}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className={styles.field}>
            <label htmlFor="status" className={styles.label}>
              {localize('STATUS')}
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'published' | 'archived')}
              className={styles.select}
            >
              <option value="draft">{localize('DRAFT')}</option>
              <option value="published">{localize('PUBLISHED')}</option>
              <option value="archived">{localize('ARCHIVED')}</option>
            </select>
          </div>
        </div>

        {/* Summary */}
        <div className={styles.field}>
          <label htmlFor="summary" className={styles.label}>
            {localize('SUMMARY')}
          </label>
          <textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className={styles.textarea}
            rows={3}
            placeholder={localize('ENTER_SUMMARY')}
          />
        </div>

        {/* Body */}
        <div className={styles.field}>
          <label htmlFor="body" className={styles.label}>
            {localize('CONTENT')} *
          </label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={styles.textarea}
            rows={10}
            required
            placeholder={localize('ENTER_CONTENT')}
          />
        </div>

        {/* Examples */}
        <div className={styles.field}>
          <label htmlFor="examples" className={styles.label}>
            {localize('EXAMPLES')}
          </label>
          <textarea
            id="examples"
            value={examples}
            onChange={(e) => setExamples(e.target.value)}
            className={styles.textarea}
            rows={5}
            placeholder={localize('ENTER_EXAMPLES')}
          />
          <small className={styles.help}>{localize('EXAMPLES_HELP')}</small>
        </div>

        {/* Sources */}
        <div className={styles.field}>
          <label htmlFor="sources" className={styles.label}>
            {localize('SOURCES')}
          </label>
          <textarea
            id="sources"
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            className={styles.textarea}
            rows={3}
            placeholder={localize('ENTER_SOURCES')}
          />
          <small className={styles.help}>{localize('SOURCES_HELP')}</small>
        </div>

        {/* Tags */}
        <div className={styles.field}>
          <label htmlFor="tags" className={styles.label}>
            {localize('TAGS')}
          </label>
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className={styles.input}
            placeholder={localize('ENTER_TAGS')}
          />
          <small className={styles.help}>{localize('TAGS_HELP')}</small>
        </div>

        {/* Admin controls */}
        {isAdmin && (
          <div className={styles.field}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={editableByOthers}
                onChange={(e) => setEditableByOthers(e.target.checked)}
                className={styles.checkbox}
              />
              {localize('EDITABLE_BY_OTHERS')}
            </label>
            <small className={styles.help}>{localize('EDITABLE_BY_OTHERS_HELP')}</small>
          </div>
        )}
      </form>
    </div>
  );
}