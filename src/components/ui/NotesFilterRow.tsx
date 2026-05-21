import { ChevronDown, Folder, Search, SlidersHorizontal, Tag as TagIcon, X, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Collection, Tag, TagColor } from '../../core/models/models';
import { defaultNotesSortOrder, type NotesSortOrder } from '../../core/utils/noteFilters';
import { sortTagsByName } from '../../core/utils/tagSorting';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';

type FilterOption = {
  color?: TagColor;
  label: string;
  marker?: string;
  value: string;
};

export function NotesFilterRow({
  tags,
  collections,
  selectedTagId,
  selectedCollectionId,
  sortOrder,
  defaultSortOrder = defaultNotesSortOrder,
  sortLocked = false,
  onTagChange,
  onCollectionChange,
  onSortChange,
  onClear,
}: {
  tags: Tag[];
  collections: Collection[];
  selectedTagId: string | null;
  selectedCollectionId: string | null;
  sortOrder: NotesSortOrder;
  defaultSortOrder?: NotesSortOrder;
  sortLocked?: boolean;
  onTagChange: (tagId: string | null) => void;
  onCollectionChange: (collectionId: string | null) => void;
  onSortChange: (sortOrder: NotesSortOrder) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const tagOptions = useMemo(
    () =>
      sortTagsByName(tags).map((tag) => ({
        color: tag.color,
        label: tag.name,
        marker: '#',
        value: tag.id,
      })),
    [tags],
  );
  const collectionOptions = useMemo(
    () =>
      [...collections]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
        .map((collection) => ({
          color: collection.color,
          label: collection.name,
          value: collection.id,
        })),
    [collections],
  );
  const hasActiveFilter = sortOrder !== defaultSortOrder || Boolean(selectedTagId || selectedCollectionId);

  return (
    <div className="notes-filter-row" aria-label={t('notes.filters.label')}>
      <label className="notes-filter-control notes-filter-order">
        <span className="notes-filter-label">
          <SlidersHorizontal size={16} />
          {t('notes.filters.orderBy')}
        </span>
        <select
          className="select-control"
          disabled={sortLocked}
          value={sortOrder}
          onChange={(event) => onSortChange(event.target.value as NotesSortOrder)}
        >
          <option value="nameAsc">{t('notes.filters.nameAsc')}</option>
          <option value="nameDesc">{t('notes.filters.nameDesc')}</option>
          <option value="updatedAsc">{t('notes.filters.updatedAsc')}</option>
          <option value="updatedDesc">{t('notes.filters.updatedDesc')}</option>
        </select>
      </label>

      <SearchableFilterField
        allLabel={t('notes.filters.allTags')}
        emptyLabel={t('notes.filters.noTags')}
        icon={TagIcon}
        label={t('notes.filters.tag')}
        onChange={onTagChange}
        options={tagOptions}
        searchPlaceholder={t('notes.filters.searchTags')}
        value={selectedTagId}
      />

      <SearchableFilterField
        allLabel={t('notes.filters.allCollections')}
        emptyLabel={t('notes.filters.noCollections')}
        icon={Folder}
        label={t('notes.filters.collection')}
        onChange={onCollectionChange}
        options={collectionOptions}
        searchPlaceholder={t('notes.filters.searchCollections')}
        value={selectedCollectionId}
      />

      {hasActiveFilter ? (
        <button className="notes-filter-clear" type="button" onClick={onClear}>
          <X size={15} />
          {t('notes.clearFilters')}
        </button>
      ) : null}
    </div>
  );
}

function SearchableFilterField({
  allLabel,
  emptyLabel,
  icon: Icon,
  label,
  options,
  searchPlaceholder,
  value,
  onChange,
}: {
  allLabel: string;
  emptyLabel: string;
  icon: LucideIcon;
  label: string;
  options: FilterOption[];
  searchPlaceholder: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = query.trim()
    ? options.filter((option) => normalizeSearchValue(option.label).includes(normalizeSearchValue(query)))
    : options;

  useClickOutside(wrapperRef, open, () => {
    setOpen(false);
  });

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function selectValue(nextValue: string | null) {
    onChange(nextValue);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="notes-filter-control notes-filter-combobox" ref={wrapperRef}>
      <span className="notes-filter-label">
        <Icon size={16} />
        {label}
      </span>
      <button
        className="notes-filter-trigger"
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <span className={selectedOption?.color ? `notes-filter-dot ${selectedOption.color}` : 'notes-filter-dot neutral'} />
        <span>{selectedOption ? formatOptionLabel(selectedOption) : allLabel}</span>
        <ChevronDown size={16} />
      </button>
      {open ? (
        <div className="notes-filter-menu">
          <label className="notes-filter-search">
            <Search size={15} />
            <input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} />
          </label>
          <div className="notes-filter-options" role="listbox">
            <button className={!value ? 'selected' : undefined} type="button" role="option" aria-selected={!value} onClick={() => selectValue(null)}>
              {allLabel}
            </button>
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  className={option.value === value ? 'selected' : undefined}
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => selectValue(option.value)}
                >
                  <span className={option.color ? `notes-filter-dot ${option.color}` : 'notes-filter-dot neutral'} />
                  <span>{formatOptionLabel(option)}</span>
                </button>
              ))
            ) : (
              <span className="notes-filter-empty">{emptyLabel}</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatOptionLabel(option: FilterOption) {
  return option.marker ? `${option.marker} ${option.label}` : option.label;
}

function normalizeSearchValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
