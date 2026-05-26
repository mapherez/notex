import {
  ChevronDown,
  Folder,
  Grid2X2,
  List,
  Search,
  SlidersHorizontal,
  Tag as TagIcon,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Collection,
  PreferredLayout,
  Tag,
  TagColor,
} from "../../core/models/models";
import {
  defaultNotesSortOrder,
  type NotesSortOrder,
} from "../../core/utils/noteFilters";
import { sortTagsByName } from "../../core/utils/tagSorting";
import { useClickOutside } from "../../core/utils/useClickOutside";
import { useKeyboardListNavigation } from "../../core/utils/useKeyboardListNavigation";
import { useI18n } from "../../i18n/I18nProvider";
import { CustomSelect } from "./CustomSelect";

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
  preferredLayout,
  onTagChange,
  onCollectionChange,
  onSortChange,
  onLayoutChange,
  onClear,
}: {
  tags: Tag[];
  collections: Collection[];
  selectedTagId: string | null;
  selectedCollectionId: string | null;
  sortOrder: NotesSortOrder;
  defaultSortOrder?: NotesSortOrder;
  sortLocked?: boolean;
  preferredLayout: PreferredLayout;
  onTagChange: (tagId: string | null) => void;
  onCollectionChange: (collectionId: string | null) => void;
  onSortChange: (sortOrder: NotesSortOrder) => void;
  onLayoutChange: (layout: PreferredLayout) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const tagOptions = useMemo(
    () =>
      sortTagsByName(tags).map((tag) => ({
        color: tag.color,
        label: tag.name,
        marker: "#",
        value: tag.id,
      })),
    [tags],
  );
  const collectionOptions = useMemo(
    () =>
      [...collections]
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        )
        .map((collection) => ({
          color: collection.color,
          label: collection.name,
          value: collection.id,
        })),
    [collections],
  );
  const hasActiveFilter =
    sortOrder !== defaultSortOrder ||
    Boolean(selectedTagId || selectedCollectionId);
  const sortOptions = [
    { value: "nameAsc", label: t("notes.filters.nameAsc") },
    { value: "nameDesc", label: t("notes.filters.nameDesc") },
    { value: "updatedAsc", label: t("notes.filters.updatedAsc") },
    { value: "updatedDesc", label: t("notes.filters.updatedDesc") },
  ];

  return (
    <div className="notes-filter-row" aria-label={t("notes.filters.label")}>
      <div className="notes-filter-control notes-filter-order">
        <span className="notes-filter-label">
          <SlidersHorizontal />
          {t("notes.filters.orderBy")}
        </span>
        <CustomSelect
          ariaLabel={t("notes.filters.orderBy")}
          disabled={sortLocked}
          onChange={(nextValue) => onSortChange(nextValue as NotesSortOrder)}
          options={sortOptions}
          value={sortOrder}
        />
      </div>

      <SearchableFilterField
        allLabel={t("notes.filters.allTags")}
        emptyLabel={t("notes.filters.noTags")}
        icon={TagIcon}
        label={t("notes.filters.tag")}
        onChange={onTagChange}
        options={tagOptions}
        searchPlaceholder={t("notes.filters.searchTags")}
        value={selectedTagId}
      />

      <SearchableFilterField
        allLabel={t("notes.filters.allCollections")}
        emptyLabel={t("notes.filters.noCollections")}
        icon={Folder}
        label={t("notes.filters.collection")}
        onChange={onCollectionChange}
        options={collectionOptions}
        searchPlaceholder={t("notes.filters.searchCollections")}
        value={selectedCollectionId}
      />

      {hasActiveFilter ? (
        <button className="notes-filter-clear" type="button" onClick={onClear}>
          <X />
          {t("notes.clearFilters")}
        </button>
      ) : null}

      <div className="notes-filter-control notes-filter-view">
        <span className="notes-filter-label">{t("notes.filters.view")}</span>
        <div
          className="notes-filter-toggle"
          role="group"
          aria-label={t("notes.filters.view")}
        >
          <button
            className={
              preferredLayout === "list"
                ? "notes-filter-view-button active"
                : "notes-filter-view-button"
            }
            type="button"
            aria-pressed={preferredLayout === "list"}
            onClick={() => onLayoutChange("list")}
          >
            <List />
            {t("notes.filters.listView")}
          </button>
          <button
            className={
              preferredLayout === "grid"
                ? "notes-filter-view-button active"
                : "notes-filter-view-button"
            }
            type="button"
            aria-pressed={preferredLayout === "grid"}
            onClick={() => onLayoutChange("grid")}
            disabled
          >
            <Grid2X2 />
            {t("notes.filters.gridView")}
          </button>
        </div>
      </div>
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
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = query.trim()
    ? options.filter((option) =>
        normalizeSearchValue(option.label).includes(
          normalizeSearchValue(query),
        ),
      )
    : options;
  const optionCount = filteredOptions.length + 1;
  const optionNavigation = useKeyboardListNavigation({
    enabled: open,
    itemCount: optionCount,
    onEscape: () => setOpen(false),
    onSelect: (index) => {
      if (index === 0) {
        selectValue(null);
        return;
      }

      const option = filteredOptions[index - 1];
      if (option) {
        selectValue(option.value);
      }
    },
  });

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
    setQuery("");
  }

  return (
    <div
      className="notes-filter-control notes-filter-combobox"
      ref={wrapperRef}
    >
      <span className="notes-filter-label">
        <Icon />
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
        <span
          className={
            selectedOption?.color
              ? `notes-filter-dot ${selectedOption.color}`
              : "notes-filter-dot neutral"
          }
        />
        <span>
          {selectedOption ? formatOptionLabel(selectedOption) : allLabel}
        </span>
        <ChevronDown />
      </button>
      {open ? (
        <div className="notes-filter-menu">
          <label className="notes-filter-search">
            <Search />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={optionNavigation.onKeyDown}
              placeholder={searchPlaceholder}
            />
          </label>
          <div className="notes-filter-options" role="listbox">
            <button
              className={filterOptionClassName(!value, optionNavigation.activeIndex === 0)}
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => selectValue(null)}
              onMouseEnter={() => optionNavigation.setActiveIndex(0)}
            >
              {allLabel}
            </button>
            {filteredOptions.length ? (
              filteredOptions.map((option, index) => (
                <button
                  className={filterOptionClassName(option.value === value, optionNavigation.activeIndex === index + 1)}
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => selectValue(option.value)}
                  onMouseEnter={() => optionNavigation.setActiveIndex(index + 1)}
                >
                  <span
                    className={
                      option.color
                        ? `notes-filter-dot ${option.color}`
                        : "notes-filter-dot neutral"
                    }
                  />
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

function filterOptionClassName(selected: boolean, active: boolean) {
  if (selected && active) {
    return "selected active";
  }

  if (selected) {
    return "selected";
  }

  return active ? "active" : undefined;
}

function normalizeSearchValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
