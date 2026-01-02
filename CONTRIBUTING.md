# Contributing to Zenith Vertical Tabs

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/vertical-chrome.git
cd vertical-chrome

# Install dependencies
npm install

# Build the extension
npm run build

# Or use watch mode for development
npm run dev
```

## Loading the Extension

1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist/` folder

## Making Changes

### Content Script (`src/content/`)

The content script is modular. Each file has a specific responsibility:

- **state.js** — Shared state object (tabs, groups, UI state)
- **utils.js** — Helper functions (sendMessage, escapeHtml, etc.)
- **icons.js** — SVG icon definitions
- **favicon.js** — Tab favicon resolution logic
- **sidebar.js** — Sidebar expand/collapse/pin
- **tabs.js** — Tab rendering and event handling
- **context-menu.js** — Right-click context menus
- **url-bar.js** — URL input with suggestions
- **modals.js** — URL modal and group creation modal
- **onboarding.js** — First-run tutorial
- **index.js** — Main entry point, DOM setup, event wiring

### Adding a New Feature

1. Create a new module in `src/content/` if needed
2. Import shared state from `state.js`
3. Import utilities from `utils.js`
4. Export your functions
5. Import and wire up in `index.js`

### Styling

All styles are in `public/styles.css`. The content script uses Shadow DOM for isolation.

## Code Style

- Use ES6+ features
- Prefer `const` over `let`
- Use descriptive function names
- Keep modules focused and small
- Add JSDoc comments for exported functions

## Building

```bash
npm run build
```

This bundles all modules into Chrome-compatible single files in `dist/`.

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a PR with a clear description

## Questions?

Open an issue on GitHub!
