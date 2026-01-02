# Developer Documentation

Technical documentation for the Zenith Vertical Tabs development team.

## Contents

1. [Architecture](./ARCHITECTURE.md) — System design and data flow
2. [Content Script](./CONTENT_SCRIPT.md) — Module breakdown and APIs
3. [Background Script](./BACKGROUND_SCRIPT.md) — Service worker and messaging
4. [Styling](./STYLING.md) — CSS architecture and theming
5. [Testing](./TESTING.md) — Manual testing checklist

## Quick Reference

### Build Commands
```bash
npm run build    # Production build
npm run dev      # Watch mode
```

### Key Files
| File | Purpose |
|------|---------|
| `src/content/index.js` | Content script entry |
| `src/background.js` | Service worker |
| `public/manifest.json` | Extension manifest |
| `public/styles.css` | All styles |
| `vite.config.js` | Build configuration |

### Message Actions
| Action | Direction | Description |
|--------|-----------|-------------|
| `get-tabs` | content → bg | Fetch all tabs |
| `switch-tab` | content → bg | Switch to tab |
| `close-tab` | content → bg | Close tab |
| `tabs-updated` | bg → content | Tab list changed |
| `toggle-sidebar` | bg → content | Toggle visibility |
| `open-url-modal` | bg → content | Open command palette |
