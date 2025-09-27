# Performance Optimizations

- Add caching for frequently accessed cards
- Implement pagination for card listings
- Optimize search queries with better indexing

## User Experience

- Add loading states and error handling
- Implement card drafts and auto-save
- Add keyboard shortcuts and better navigation

## Features

- Add user management (admin can change user roles)
- Implement card versioning/history
- Add comments or discussion on cards
- Export/import functionality

## Technical

- Add comprehensive testing
- Implement rate limiting
- Add monitoring and analytics

--------------------------------------------
SVGs:

- Extract all SVGs into single files, for reusability. Create a scss file listing all existing svg files, to turn them into classes that can be used in `i` elements

Filters:

- All filters need to be changed

Modal:

- Turn login modal into a 'general purpose' modal, so that other content can be injected into it
