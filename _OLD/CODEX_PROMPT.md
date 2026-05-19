# Codex Prompt

Build a production-quality web app called NoteX.

I will attach reference images.
Those images are the exact target UI.
Do not reinterpret them.
Recreate the same layout, structure, spacing, proportions, and visual hierarchy.

The final app must match the provided reference images exactly in:

- dashboard
- note detail page
- profile page
- sidebar
- cards
- colors
- dark surfaces
- typography scale
- spacing
- proportions
- tags
- metadata panels

This is not inspiration.
This is the target implementation.

## Requirements

Use:

- React
- TypeScript
- Vite
- TailwindCSS
- React Router
- Zustand
- IndexedDB
- Dexie
- PWA

Deploy target:

- Vercel

V1 only:

- local-first
- offline-first
- no backend
- no PostgreSQL yet
- no Google sync yet
- manual export/import only

## Required Routes

/
/notes
/notes/:id
/favorites
/recent
/trash
/collections
/profile

## Rules

- Build reusable components
- Use clean architecture
- Use realistic mock data
- Keep code production-ready
- No placeholder lorem ipsum
- No generic template dashboard
- No visual redesign
- Maintain exact UI fidelity

## Work Phases

Phase 1

- project setup
- routes
- app shell
- theme foundation

Phase 2

- reusable UI components
- sidebar
- top bar
- cards
- tags
- panels

Phase 3

- dashboard
- notes
- note detail
- profile
- remaining routes

Phase 4

- IndexedDB integration
- mock data persistence
- export/import
- offline behavior

Phase 5

- polish
- responsiveness
- visual refinement until it matches the references closely

At the end of each phase:

- summarize what was built
- list changed files

Priority:
UI fidelity first.
Architecture second.
Everything must feel like the exact product shown in the reference images.
