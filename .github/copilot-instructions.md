# 🤖 Copilot Development Guidelines for NoteX

## 📋 Core Principles

**🌍 Internationalization First**: Never hardcode user-facing strings. Always use:
```tsx
<h1>{localize('CARDS_PAGE_TITLE')}</h1>
```

**⚙️ Settings-Driven Architecture**: Extract ALL configuration to settings files. 4-layer system:
1. `packages/config/src/settings/default.settings.json` - Base config
2. `packages/config/src/settings/market/pt-PT.settings.json` - Market overrides
3. `packages/config/src/settings/env.json` - Runtime config
4. User preferences - Dynamic overrides

**📦 Monorepo Structure**: 5 core packages with strict boundaries:
- `@notex/types` - Shared TypeScript interfaces
- `@notex/config` - Settings + i18n system
- `@notex/ui` - Components + design tokens + `useSettings` hook
- `@notex/database` - Repository pattern + Supabase client
- `@notex/utils` - Platform detection + validation helpers

**🔧 Type Safety First**: Strict TypeScript across all packages. Hybrid PostgreSQL schema:
- Stable columns for core data (`title`, `category`, `status`)
- JSONB for flexible content (`content`, `metadata`) with version numbers

---

## 🏗️ Architecture Overview

**Frontend**: Next.js 14 App Router with server/client component separation
**Database**: PostgreSQL via Supabase (Portuguese FTS with `unaccent` + `pg_trgm`)
**Security**: Row-level security (RLS) + role-based access control
**Search**: Full-text search optimized for Portuguese linguistics

**Provider Nesting** (critical initialization order):
```tsx
<AuthProvider>
  <ClientSettingsProvider>
    <ThemeProvider defaultTheme={settings.SETUP.theme}>
      <AppLayout>{children}</AppLayout>
    </ThemeProvider>
  </ClientSettingsProvider>
</AuthProvider>
```

---

## 🔄 Critical Workflows

**Development**:
```bash
pnpm dev              # Start development server
pnpm type-check       # Strict TS check all packages (run before commits)
pnpm cleanup          # Format JSON files (locales + settings)
pnpm build            # Build all packages
```

**After Changes**:
- Edit JSON files → `pnpm cleanup` (required)
- Change interfaces → `cd packages/types && pnpm build`
- Add dependencies → Update package.json + `pnpm install`

---

## 🎨 Component Patterns

**i18n Initialization** (required for all components):
```tsx
'use client';
const [localize, setLocalize] = useState(null);
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

**Data Operations** (always use repository pattern):
```tsx
import { KnowledgeCardRepository } from '@notex/database';

const cards = await KnowledgeCardRepository.search({
  query: 'grammar',
  category: 'linguistics',
  filters: { difficulty: 'intermediate' }
});
```

**Settings Usage** (always destructure with fallbacks):
```tsx
const { settings } = useSettings();
const buttonConfig = settings.HOMEPAGE?.buttons?.viewCards;
```

---

## 📝 Code Standards

**Import Hierarchy**:
```tsx
import React from 'react';                    // External
import { Component } from '@notex/ui';        // Internal packages
import { localFunction } from './utils';     // Local files
import type { Type } from '@notex/types';    // Types last
```

**Component Structure**:
```
ComponentName/
├── ComponentName.tsx ('use client' if hooks)
├── ComponentName.module.scss
├── index.ts (clean exports)
└── types.ts (if complex props)
```

**Naming**: PascalCase components, camelCase settings keys, SCREAMING_SNAKE_CASE locale keys

---

## 🚨 Common Pitfalls

- ❌ Never import client components in server components
- ❌ Never hardcode strings - always use `localize()`
- ❌ Never access settings without checking `loading` state
- ❌ Never use `../../../` imports between packages
- ✅ Always add 'use client' to components with React hooks
- ✅ Always provide fallbacks for async operations
- ✅ Always run `pnpm type-check` before commits
- ✅ Always run `pnpm cleanup` after JSON edits

---

## 🎯 Key Files to Understand

- `apps/web/src/app/layout.tsx` - Provider nesting + app structure
- `packages/ui/src/hooks/useSettings.tsx` - Settings system
- `packages/config/src/i18n.ts` - Localization system
- `packages/database/src/repository.ts` - Data access patterns
- `packages/config/src/settings/default.settings.json` - Configuration structure

*When in doubt, follow existing patterns in the codebase. Consistency is key! 🗝️*