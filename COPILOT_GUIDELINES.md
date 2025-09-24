# 🤖 Copilot Development Guidelines for NoteX

## 📋 Core Principles

### ✅ **Always Do This:**
1. **🌍 Internationalization First**: Never hardcode user-facing strings
2. **⚙️ Settings-Driven**: Extract configuration to settings files
3. **🎨 Design System**: Use existing UI components and design tokens
4. **📦 Monorepo Awareness**: Respect package boundaries and dependencies
5. **🔧 Type Safety**: Maintain strict TypeScript compliance across all changes

---

## 🌍 Internationalization (i18n) Rules

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

---

## 🎨 UI Component Guidelines

### **Component Standards:**
- ✅ **Use existing components**: `Button`, `Card`, `SearchBar`, `SearchFilters`
- ❌ **Never use**: `<button>`, `<input>` directly
- ✅ **Import from**: `@notex/ui` package
- ✅ **Add 'use client'** to components using React hooks
- ✅ **Extract component config** to settings when applicable

### **Button Usage:**
```tsx
// ❌ Wrong
<button onClick={handleClick}>Save</button>

// ✅ Correct
<Button 
  variant={settings.COMPONENT?.button?.variant || "primary"}
  onClick={handleClick}
>
  {localize('BUTTON_SAVE')}
</Button>
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

---

## 🗂️ File Organization Rules

### **Component Structure:**
```
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

---

## 🚨 Common Pitfalls to Avoid

### **Client/Server Components:**
- ❌ **Don't import** client components in server components
- ✅ **Create wrapper** components with 'use client' for hooks
- ✅ **Use** `ClientSettingsProvider` pattern for context

### **Async Settings:**
- ❌ **Don't assume** settings are immediately available
- ✅ **Check loading state** before using settings
- ✅ **Provide fallbacks** for undefined settings

### **Type Safety:**
- ❌ **Don't use** `any` type
- ✅ **Use optional chaining** `settings.SETUP?.language`
- ✅ **Import types** from `@notex/types`

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
- ✅ **Responsive design**: Test on different screen sizes

---

## 🔄 Future-Proofing

### **When Adding New Features:**
- ✅ **Consider i18n** from day one
- ✅ **Design for settings** configurability
- ✅ **Plan for multiple markets** (not just pt-PT)
- ✅ **Think accessibility** (ARIA labels, keyboard nav)
- ✅ **Mobile-first approach** for responsive design

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

**Remember**: When in doubt, follow the existing patterns in the codebase. Consistency is key! 🗝️

*This file should be updated whenever we establish new patterns or best practices.*