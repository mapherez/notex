# Architecture constraints

## Styling

Create a centralized theme and styling architecture.
Do not scatter visual decisions across components.
Use SCSS maps as the source of truth for theme values such as colors, surfaces, borders, radii, shadows, spacing, and text roles. Emit runtime CSS variables with the `--nx-` prefix for theme switching.
Prefer semantic theme tokens over hardcoded values.
Use SCSS variables, mixins, functions, and grouped partials for app styling. Avoid inline visual styling in React components.
The styling system must make it easy to update the app theme from a small number of files.

## Localization

Do not hardcode any user-facing strings in components.
All UI text must come from locale JSON files.
At minimum support:

- pt
- en

Create a localization structure such as:

- src/locales/pt.json
- src/locales/en.json

Organize translation keys by feature/page.

## Settings

Create a settings.json file for app-level default configuration.
Also create a separate user settings model stored locally for runtime preferences.

Examples include:

- theme
- language
- username
- startup page
- preferred layout

Do not mix:

- static app config
- runtime user preferences

Do not hardcode:

- UI text
- color values
- repeated spacing values
- theme decisions
- app defaults that belong in configuration
