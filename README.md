# 📚 NoteX - Compendium of Linguistic Doubts

> Modern knowledge management system for Portuguese language questions, built with accessibility and internationalization in mind.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black.svg)](https://nextjs.org/)
[![PNPM](https://img.shields.io/badge/PNPM-8+-orange.svg)](https://pnpm.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green.svg)](https://supabase.com/)

## 🌟 Overview

NoteX is a comprehensive knowledge management system designed specifically for Portuguese language questions and linguistic doubts. Built as a monorepo with modern web technologies, it provides fast search, accessibility-first design, and multi-market support.

### ✨ Key Features

- 🚀 **Fast Search**: Full-text search with Portuguese language support using PostgreSQL FTS
- 🌍 **Internationalization**: Multi-language support (PT-PT primary, extensible to PT-BR/CPLP)
- ♿ **Accessibility First**: WCAG 2.2 AA compliant with keyboard navigation and screen reader support
- 🎨 **Design System**: Consistent UI with light/dark themes and responsive design
- 📱 **PWA Ready**: Progressive Web App with offline capabilities
- 🔒 **Secure**: Row-level security (RLS) and role-based access control
- ⚡ **Performance**: Optimized for fast loading and smooth interactions

## 🏗️ Architecture

This is a pnpm monorepo with the following structure:

```text
notex/
├── apps/
│   └── web/                 # Next.js App Router application
├── packages/
│   ├── config/              # Settings and internationalization
│   ├── database/            # Database access and repositories
│   ├── types/               # Shared TypeScript definitions
│   ├── ui/                  # Reusable UI components
│   └── utils/               # Utility functions
├── tools/
│   ├── eslint-config/       # Shared ESLint configuration
│   └── tsconfig/            # Shared TypeScript configuration
├── scripts/                 # Build and maintenance scripts
└── _examples/               # Documentation and examples
```

### Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript 5
- **Styling**: SCSS Modules with design tokens
- **Database**: PostgreSQL with Supabase (hybrid columns + JSONB)
- **Search**: Full-text search with `unaccent` and `pg_trgm` extensions
- **Package Manager**: PNPM with workspace support
- **Deployment**: Vercel
- **Development**: ESLint, Prettier, TypeScript strict mode

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PNPM 8+
- Supabase account (for database)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/mapherez/notex.git
   cd notex
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

4. **Start development server**

   ```bash
   pnpm dev
   ```

5. **Open your browser**
   - Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Usage

### Development Workflow

```bash
# Start development server
pnpm dev

# Type checking
pnpm type-check

# Linting
pnpm lint

# Build all packages
pnpm build

# Format JSON files (locales, settings)
pnpm cleanup
```

### Key Concepts

#### Internationalization (i18n)

All user-facing strings are externalized to locale files. Never hardcode strings directly in components.

```tsx
// ❌ Wrong
<h1>Knowledge Cards</h1>

// ✅ Correct
<h1>{localize('CARDS_PAGE_TITLE')}</h1>
```

Locale files are stored in `packages/config/src/i18n/` with support for multiple markets.

#### Settings-Driven Configuration

Application behavior is controlled through settings files with a layered approach:

1. **Base settings** (common defaults)
2. **Market overrides** (PT-PT, PT-BR, etc.)
3. **Environment settings** (dev, staging, prod)
4. **User preferences** (theme, accessibility settings)

```tsx
// Usage in components
const { settings } = useSettings();
const buttonConfig = settings.HOMEPAGE?.buttons?.viewCards;
```

#### Component Architecture

Components follow a consistent pattern with proper separation of concerns:

```text
ComponentName/
├── ComponentName.tsx      # Main component ('use client' if needed)
├── ComponentName.module.scss  # Styles
├── index.ts               # Clean exports
└── types.ts               # Type definitions (if complex)
```

## 🗂️ Project Structure Details

### Apps

- **`apps/web`**: Main Next.js application
  - App Router with server/client component separation
  - PWA manifest and service worker
  - Responsive design with mobile-first approach

### Packages

- **`packages/config`**: Configuration management
  - Settings system with deep merge support
  - Internationalization with locale loading
  - Market-specific configurations

- **`packages/database`**: Data access layer
  - Supabase client configuration
  - Repository pattern for data operations
  - Row-level security policies

- **`packages/types`**: TypeScript definitions
  - Shared interfaces and types
  - Database schema types
  - Component prop types

- **`packages/ui`**: UI component library
  - Reusable components (Button, Card, SearchBar, etc.)
  - Design tokens and themes
  - Accessibility-first components

- **`packages/utils`**: Utility functions
  - Data validation with Zod
  - Date formatting and manipulation
  - Accessibility helpers
  - Platform detection for responsive UI

### Tools

- **`tools/eslint-config`**: Shared ESLint configuration
- **`tools/tsconfig`**: Shared TypeScript configuration

## 🔧 Development Guidelines

### Code Quality

- **TypeScript Strict Mode**: All code must pass strict type checking
- **ESLint**: Automated code quality checks
- **Prettier**: Consistent code formatting
- **Accessibility**: WCAG 2.2 AA compliance required

### Internationalization Rules

1. Never hardcode user-facing strings
2. Use SCREAMING_SNAKE_CASE for locale keys
3. Group related keys logically
4. Test with multiple locales (PT-PT, EN-US)

### Settings Management

1. Add new settings to the `AppSettings` interface
2. Update default settings in `packages/config/src/settings/`
3. Consider market-specific overrides
4. Use descriptive, nested keys

### Component Development

1. Use existing UI components from `@notex/ui`
2. Add 'use client' directive for React hooks
3. Extract configuration to settings when applicable
4. Follow the established component structure

## 🗄️ Database Schema

The system uses a hybrid PostgreSQL schema:

### Core Tables

- **`entries`**: Knowledge cards with stable columns + flexible JSONB payload
- **`entry_links`**: Relationships between entries
- **`tags`** & **`entry_tags`**: Tagging system
- **`user_notes`**: Private user notes on entries

### Key Features

- **Full-Text Search**: Optimized for Portuguese with `unaccent` and `pg_trgm`
- **Row-Level Security**: Automatic data isolation
- **Defaults on Read**: Graceful handling of missing data
- **Audit Trail**: Change tracking for content management

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Build

```bash
# Build all packages
pnpm build

# Build web application
cd apps/web && pnpm build
```

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes following the guidelines
4. Run tests and linting: `pnpm type-check && pnpm lint`
5. Format code: `pnpm cleanup`
6. Commit with conventional commits
7. Push and create a pull request

### Code Review Checklist

- [ ] TypeScript strict mode passes
- [ ] ESLint passes with no errors
- [ ] All user-facing strings are localized
- [ ] Settings are properly configured
- [ ] Accessibility requirements met
- [ ] Responsive design tested
- [ ] Cross-browser compatibility verified

## 📋 Available Scripts

```bash
# Development
pnpm dev              # Start development server
pnpm build            # Build all packages
pnpm lint             # Run ESLint
pnpm type-check       # Type check all packages
pnpm cleanup          # Format JSON files

# Package-specific
pnpm --filter web dev         # Start web app only
pnpm --filter @notex/types build  # Build types package
```

## 🔐 Environment Variables

Create a `.env.local` file with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 📚 Documentation

- [Copilot Guidelines](./COPILOT_GUIDELINES.md) - Development best practices
- [Start Instructions](./_examples/START_INSTRUCTIONS.md) - Detailed project plan
- [Architecture Decisions](./infra/docs/) - ADRs and technical decisions

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with ❤️ for the Portuguese language community. Special thanks to the linguistic experts and educators who contribute to making language learning accessible to all.

---

**Note**: This project is part of an effort to democratize access to Portuguese language knowledge and promote linguistic clarity across Portuguese-speaking communities.
