# 🤖 Copilot Development Guidelines for NoteX

## 📋 Core Principles

### ✅ **Always Do This:**

1. **🌍 Internationalization First**: Never hardcode user-facing ### **Key Package Roles:**
- **`@notex/types`**: All shared TypeScript interfaces
- **`@notex/config`**: Settings management + i18n system
- **`@notex/ui`**: Reusable components + design tokens + `useSettings` hook + icon system
- **`@notex/database`**: Repository pattern + Supabase client
- **`@notex/utils`**: Platform detection + validation helpers

### **Icon System Architecture:**
- **CSS Classes**: Data URI encoded SVGs with `mask-image` for theming
- **Base class**: `.icon` with `display: inline-block` and `flex-shrink: 0`
- **Theming**: `background-color: currentColor` for automatic theme adaptation
- **Custom icons**: Added to `packages/ui/src/tokens/_icons.scss`
- **Size control**: Tailwind classes (`w-4 h-4`) override base sizings
2. **⚙️ Settings-Driven**: Extract configuration to settings files
3. **🎨 Design System**: Use existing UI components and design tokens
4. **📦 Monorepo Awareness**: Respect package boundaries and dependencies
5. **🔧 Type Safety**: Maintain strict TypeScript compliance across all changes

---

## �️ Architecture Overview

### **PNPM Monorepo Structure**
```
notex/
├── apps/web/                 # Next.js 14 App Router (main app)
├── packages/
│   ├── config/               # Settings + i18n (layered config system)
│   ├── database/             # Supabase client + repository pattern
│   ├── types/                # Shared TypeScript definitions
│   ├── ui/                   # Component library + design tokens
│   └── utils/                # Platform detection + validation
```

### **Data Flow Architecture**
- **Frontend**: Next.js App Router with server/client component separation
- **Database**: PostgreSQL via Supabase (hybrid schema: stable columns + JSONB flexibility)
- **Search**: Full-text search optimized for Portuguese (`unaccent` + `pg_trgm`)
- **Security**: Row-level security (RLS) + role-based access control
- **Settings**: 4-layer configuration (default → market → environment → user)

---

## �🌍 Internationalization (i18n) Rules

### **String Management:**
- ❌ **Never write**: `<h1>Knowledge Cards</h1>`
- ✅ **Always write**: `<h1>{localize('CARDS_PAGE_TITLE')}</h1>`
- ✅ **Add to locale files**: `packages/config/src/i18n/pt-PT.json` & `default.json`
- ✅ **Use SCREAMING_SNAKE_CASE** for locale keys
- ✅ **Group related keys** (e.g., `CARDS_PAGE_TITLE`, `CARDS_PAGE_DESCRIPTION`)

### **Component i18n Pattern:**
```tsx
// ✅ Standard pattern for new components
'use client';
import { useSettings } from '@notex/ui';
import { createLocalizeFunction, loadLocale } from '@notex/config';
import type { Locale } from '@notex/types';

const [localize, setLocalize] = useState<ReturnType<typeof createLocalizeFunction>['localize'] | null>(null);
const { settings, loading } = useSettings();

useEffect(() => {
  async function initLocale() {
    if (!settings?.SETUP?.language || loading) return;
    await loadLocale(settings.SETUP.language as Locale);
    const { localize: localizeFunc } = createLocalizeFunction(settings.SETUP.language as Locale);
    setLocalize(() => localizeFunc);
  }
  initLocale();
}, [settings?.SETUP?.language, loading]);
```

---

## ⚙️ Settings Configuration Rules

### **Settings Structure:**
- ✅ **Add new categories** to `AppSettings` interface in `packages/types/src/settings.ts`
- ✅ **Update default settings** in `packages/config/src/settings/default.settings.json`
- ✅ **Consider market overrides** in `packages/config/src/settings/market/pt-PT.settings.json`
- ✅ **Use descriptive keys**: `HOMEPAGE.buttons.viewCards` not `buttons.btn1`

### **Settings Usage Pattern:**
```tsx
// ✅ Always destructure and provide fallbacks
const { settings } = useSettings();
const buttonConfig = settings.HOMEPAGE?.buttons?.viewCards;
if (buttonConfig) {
  // Use configuration
}
```

### **Settings Layers** (ordered by precedence):
1. **Default** (`default.settings.json`) - Base configuration
2. **Market** (`market/pt-PT.settings.json`) - Locale-specific overrides
3. **Environment** (`env.json`) - Runtime configuration
4. **User** - Dynamic user preferences

---

## 🎨 UI Component Guidelines

### **Component Standards:**
- ✅ **Use existing components**: `Button`, `Card`, `SearchBar`, `SearchFilters`
- ❌ **Never use**: `<button>`, `<input>` directly
- ✅ **Import from**: `@notex/ui` package
- ✅ **Add 'use client'** to components using React hooks
- ✅ **Extract component config** to settings when applicable

### **Icon System:**
- ✅ **Use CSS classes**: `<i className="icon icon-name"></i>` for all icons
- ✅ **Size variants**: `icon-sm`, `icon-lg`, `icon-xl` or Tailwind classes `w-4 h-4`
- ✅ **Custom icons**: Data URI encoded in `packages/ui/src/tokens/_icons.scss`
- ❌ **Never use**: Inline SVG or `<img>` tags for icons

### **Modal Overlays:**
- ✅ **Structure**: `modal-overlay` → `modal-content` → `modal-header` + `modal-body`
- ✅ **Click-outside**: `onClick` on overlay, `stopPropagation` on content
- ✅ **Accessibility**: `aria-label` on close buttons, focus management
- ✅ **Styling**: Fixed positioning, backdrop blur, responsive design

### **OAuth Button Styling:**
```tsx
// ✅ Google sign-in button pattern - use iconBefore prop for proper alignment
<Button
  variant="primary"
  className="google-signin-button"  // White background, specific styling
  disabled={loading}
  iconBefore={<i className="icon icon-google w-4 h-4" aria-hidden="true"></i>}
>
  {localize('AUTH_SIGN_IN_GOOGLE')}
</Button>
```
- ✅ **Brand colors**: Use gradient backgrounds for recognizable OAuth buttons
- ✅ **Consistent sizing**: `w-4 h-4` for icons, `justify-content: flex-start`
- ✅ **Accessibility**: `aria-hidden="true"` on decorative icons
- ✅ **Icon alignment**: Always use `iconBefore`/`iconAfter` props, never direct children

### **Click-Outside Handling:**
```tsx
// ✅ Modal click-outside pattern
const menuRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setShowMenu(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

---

## 📦 Package Architecture Rules

### **Import Hierarchy:**
```tsx
// ✅ Correct import order
import React from 'react';                    // External
import { Component } from '@notex/ui';        // Internal packages
import { localFunction } from './utils';     // Local files
import type { Type } from '@notex/types';    // Types last
```

### **Package Dependencies:**
- ✅ **Core packages**: `@notex/types`, `@notex/config`, `@notex/ui`
- ✅ **Add dependencies** to `package.json` when importing across packages
- ✅ **Use workspace:** prefix** for internal package dependencies
- ❌ **Never import** from `../../../other-package`

### **Key Package Roles:**
- **`@notex/types`**: All shared TypeScript interfaces
- **`@notex/config`**: Settings management + i18n system
- **`@notex/ui`**: Reusable components + design tokens + `useSettings` hook
- **`@notex/database`**: Repository pattern + Supabase client
- **`@notex/utils`**: Platform detection + validation helpers

---

## 🗂️ File Organization Rules

### **Component Structure:**
```text
📁 ComponentName/
├── 📄 ComponentName.tsx ('use client' if needed)
├── 📄 ComponentName.module.scss
├── 📄 index.ts (clean exports)
└── 📄 types.ts (if complex props)
```

### **New Components Checklist:**
- ✅ Add 'use client' if using hooks
- ✅ Export from package `index.ts`
- ✅ Create corresponding locale keys
- ✅ Extract configuration to settings
- ✅ Follow TypeScript strict mode
- ✅ Include SCSS module for styles

---

## 🗃️ Database Patterns

### **Repository Pattern:**
```typescript
// ✅ Use repository classes for data operations
import { KnowledgeCardRepository } from '@notex/database';

const cards = await KnowledgeCardRepository.search({
  query: 'grammar',
  category: 'linguistics',
  filters: { difficulty: 'intermediate' }
});
```

### **Schema Design:**
- **Hybrid approach**: Stable columns + flexible JSONB payload
- **Full-text search**: Portuguese-optimized with `unaccent` + `pg_trgm`
- **Row-level security**: Automatic data isolation
- **Audit trail**: Change tracking for content management

### **Migration Strategy:**
- **Incremental migrations** in `packages/database/migrations/`
- **Safe defaults** on read for backward compatibility
- **Generated columns** for search vectors

---

## 🔧 Development Workflow

### **Before Any Changes:**
1. ✅ **Run**: `pnpm type-check` to ensure no type errors
2. ✅ **Check**: Current settings structure for existing patterns
3. ✅ **Review**: Locale files for similar string patterns
4. ✅ **Verify**: Package dependencies are correct

### **After Changes:**
1. ✅ **Run**: `pnpm cleanup` to format JSON files
2. ✅ **Build**: `pnpm build` to verify compilation
3. ✅ **Test**: `pnpm dev` to ensure app runs
4. ✅ **Check**: Browser console for runtime errors

### **Settings & Locale Changes:**
```bash
# ✅ Always run after editing JSON files
pnpm cleanup

# ✅ Rebuild types after interface changes
cd packages/types && pnpm build
```

### **Critical Development Commands:**
```bash
pnpm dev              # Start development server
pnpm type-check       # Type check all packages (strict mode)
pnpm cleanup          # Format JSON files (locales + settings)
pnpm build            # Build all packages
pnpm --filter web dev # Start only web app
```

---

## 🚨 Common Pitfalls to Avoid

### **Client/Server Components:**
- ❌ **Don't import** client components in server components
- ✅ **Create wrapper** components with 'use client' for hooks
- ✅ **Use** `ClientSettingsProvider` pattern for context

### **Async Operation Patterns:**
```tsx
// ✅ Localization initialization with error handling
useEffect(() => {
  async function initializeLocalization() {
    if (!settings?.SETUP?.language || settingsLoading) return;

    try {
      await loadLocale(settings.SETUP.language as Locale);
      const { localize: localizeFunc } = createLocalizeFunction(settings.SETUP.language as Locale);
      setLocalize(() => localizeFunc);
    } catch (error) {
      console.error('Failed to load locale:', error);
      setLocalize(() => (key: string) => key); // Fallback to key
    }
  }

  initializeLocalization();
}, [settings?.SETUP?.language, settingsLoading]);
```
- ✅ **Error boundaries**: Always provide fallbacks for async operations
- ✅ **Loading states**: Check loading flags before async operations
- ✅ **Cleanup**: Proper dependency arrays in useEffect
- ✅ **Graceful degradation**: Fallback to key names if localization fails

### **Component State Patterns:**
```tsx
// ✅ Complex form state with defaults and type safety
const [title, setTitle] = useState(card?.title || '');
const [category, setCategory] = useState(card?.category || '');
const [difficulty, setDifficulty] = useState(
  (card?.content && 'difficulty' in card.content ? card.content.difficulty : undefined) || 'beginner'
);
const [status, setStatus] = useState(card?.status || 'draft');
const [editableByOthers, setEditableByOthers] = useState(card?.editable_by_others ?? false);
```
- ✅ **Default values**: Always provide sensible defaults for form fields
- ✅ **Type safety**: Use union types for constrained values
- ✅ **Optional chaining**: Safe access to nested object properties
- ✅ **Nullish coalescing**: `??` for boolean defaults, `||` for string defaults

### **Form Data Patterns:**
```tsx
// ✅ Form data transformation pattern
const formData = {
  title: title.trim(),
  category: category.trim(),
  content: {
    version: 2 as const,
    summary: summary.trim(),
    body: body.trim(),
    examples: examples.split('\n').filter(ex => ex.trim()).map(ex => ex.trim()),
    sources: sources.split('\n').filter(src => src.trim()).map(src => src.trim()),
  },
  metadata: {
    tags: tags.split(',').filter(tag => tag.trim()).map(tag => tag.trim()),
  },
};

// ✅ Slug generation for URLs
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Remove multiple hyphens
};
```
- ✅ **Data sanitization**: Always trim strings and filter empty values
- ✅ **Array handling**: Split by newlines, filter empty items, trim each item
- ✅ **Slug generation**: Normalize, remove accents, clean special characters
- ✅ **Versioning**: Include version numbers in content structures

---

## 📝 Code Quality Standards

### **Naming Conventions:**
- ✅ **Components**: `PascalCase` (e.g., `SearchResultsPage`)
- ✅ **Files**: `PascalCase.tsx` for components, `camelCase.ts` for utils
- ✅ **Locale keys**: `SCREAMING_SNAKE_CASE`
- ✅ **Settings keys**: `camelCase` nested objects

### **Comments & Documentation:**
```tsx
// ✅ Good component header
'use client';

// ComponentName Component
// Brief description of component purpose and key features

import React from 'react';
```

---

## 🎯 Testing Integration Points

### **Always Test These:**
- ✅ **App starts**: `pnpm dev` runs without errors
- ✅ **Types compile**: `pnpm type-check` passes
- ✅ **Localization works**: Switch between pt-PT and en-US
- ✅ **Settings load**: Check browser console for settings loading
- ✅ **Icons render**: Verify icon classes display correctly across themes
- ✅ **Responsive design**: Test on different screen sizes

---

## 🔄 Future-Proofing

### **When Adding New Features:**
- ✅ **Consider i18n** from day one
- ✅ **Design for settings** configurability
- ✅ **Plan for multiple markets** (not just pt-PT)
- ✅ **Think accessibility** (ARIA labels, keyboard nav)
- ✅ **Mobile-first approach** for responsive design
- ✅ **Use icon system** for any UI icons (add to `_icons.scss` if needed)

---

## 🛠️ Quick Reference Commands

```bash
# Format all JSON files
pnpm cleanup

# Full development server
pnpm dev

# Type check everything
pnpm type-check

# Build all packages
pnpm build

# Build specific package
pnpm build --filter @notex/types
```

---

## 🎯 Key Files to Understand

### **Architecture Entry Points:**
- `apps/web/src/app/layout.tsx` - App structure + providers
- `packages/ui/src/hooks/useSettings.tsx` - Settings system
- `packages/config/src/i18n.ts` - Localization system
- `packages/database/src/repository.ts` - Data access patterns

### **Configuration Files:**
- `packages/config/src/settings/default.settings.json` - Base settings
- `packages/config/src/settings/market/pt-PT.settings.json` - Market overrides
- `packages/types/src/settings.ts` - Settings type definitions

### **Design System Files:**
- `packages/ui/src/tokens/_icons.scss` - Icon definitions and CSS classes
- `packages/ui/src/tokens/index.scss` - Design token imports
- `packages/ui/src/components/` - Reusable component library

### **Component Examples:**
- `packages/ui/src/components/Button/` - Component structure pattern
- `apps/web/src/components/ClientSettingsProvider.tsx` - Provider pattern
- `apps/web/src/components/Header.tsx` - Modal overlay + click-outside pattern

---

**Remember**: When in doubt, follow the existing patterns in the codebase. Consistency is key! 🗝️

*This file should be updated whenever we establish new patterns or best practices.*
