# NoteX Agent Instructions

These rules apply to the whole repository.

## CSS Refactor Source Of Truth

- Treat `Audit/99_css_audit_decision_log.md` as the master plan for CSS refactor order, gates, and safety rules.
- Use the numbered audit files for local detail before touching the related area.
- Do not start component primitives, shell migration, page migration, dashboard cleanup, responsive ownership, or editor cleanup until the required earlier phase is complete.
- Do not touch NoteDetail editor, Tiptap, ProseMirror, node views, or TOC selectors without reading `Audit/16_note_detail_editor_migration_plan.md`.

## Style Ownership

- Every CSS selector must have a clear owner.
- Global primitives belong in `src/styles/components` or `src/styles/base`, not in page files.
- Page files may compose primitives and define page-only layout/widgets, but must not become owners of reusable primitives.
- Keep editor/content typography separate from UI typography.
- Move selectors while preserving class names before considering renames.
- Do not create a generic `.card` or a large catch-all primitives file.

## Tokens And Themes

- CSS custom properties are the public styling API.
- Add design-system tokens only for reusable system rules, not for every local value.
- Keep dark/light theme values in `src/styles/themes`.
- Keep accent and palette expansion incremental; do not add a full accent system without a dedicated decision.
- Hardcoded values are acceptable only for artwork, intrinsic dimensions, contextual offsets, fallbacks, or documented one-off behavior.

## Responsive Rules

- Prefer semantic breakpoint helpers/tokens over new hardcoded media query values.
- Keep responsive rules near the owner when that owner exists.
- Do not change responsive behavior in the same step as moving selector ownership.
- Treat `1180px` as content/layout collapse behavior, not as a real desktop breakpoint.
- `1440p` means `2560x1440`, not `1440px` width.

## Validation Minimums

- Documentation-only changes do not require a build.
- SCSS changes should run `npm run check:styles` and `npm run build` when feasible.
- If breakpoints, z-index, or theme behavior changes, smoke test Dashboard, Profile, Notes list/grid, NoteDetail, Tags, and key modals in dark and light themes.
- If validation cannot be run, report exactly what was skipped and why.
