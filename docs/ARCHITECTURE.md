# Architecture Overview

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Chrome Browser                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    Messages    ┌──────────────────────┐   │
│  │  Background  │◄──────────────►│   Content Script     │   │
│  │   (Service   │                │   (Shadow DOM UI)    │   │
│  │   Worker)    │                │                      │   │
│  └──────────────┘                └──────────────────────┘   │
│         │                                   │                │
│         │                                   │                │
│         ▼                                   ▼                │
│  ┌──────────────┐                ┌──────────────────────┐   │
│  │  Chrome APIs │                │   Webpage DOM        │   │
│  │  - tabs      │                │   (isolated via      │   │
│  │  - groups    │                │    Shadow DOM)       │   │
│  │  - storage   │                └──────────────────────┘   │
│  │  - commands  │                                           │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Tab Updates
```
Chrome Tab Event → Background Script → Broadcast to Content Scripts → Re-render UI
```

### User Actions
```
User Click → Content Script → sendMessage → Background Script → Chrome API → Response
```

### Keyboard Shortcuts
```
User Presses Alt+T → Chrome Commands API → Background Script → Content Script → Open Modal
```

## State Management

All state lives in `src/content/state.js`:

```javascript
export const state = {
    // UI State
    isExpanded: false,
    isPinned: false,
    searchQuery: '',
    
    // Data
    tabs: [],
    groups: {},
    
    // Drag & Drop
    draggedTabId: null,
    dropPosition: null,
    
    // Modals
    modalMode: 'new-tab',
    modalSuggestionsList: [],
    
    // ... more
};
```

State is mutated directly (no reactivity library). After state changes, manually trigger `renderTabs()`.

## Shadow DOM Isolation

The sidebar UI is rendered inside a **closed Shadow DOM** to prevent CSS conflicts with host pages:

```javascript
const host = document.createElement('div');
const shadow = host.attachShadow({ mode: 'closed' });
// All UI rendered inside shadow
```

## Module Dependencies

```
index.js
├── state.js (shared state)
├── icons.js (SVG icons)
├── utils.js
│   └── state.js
├── favicon.js
│   └── icons.js
├── sidebar.js
│   ├── state.js
│   ├── utils.js
│   └── icons.js
├── tabs.js
│   ├── state.js
│   ├── utils.js
│   ├── icons.js
│   ├── favicon.js
│   └── context-menu.js
├── context-menu.js
│   ├── state.js
│   ├── utils.js
│   └── icons.js
├── url-bar.js
│   ├── state.js
│   └── utils.js
├── modals.js
│   ├── state.js
│   ├── utils.js
│   └── icons.js
└── onboarding.js
    ├── state.js
    └── utils.js
```

## Chrome Extension Manifest

Key manifest configurations:

- **Manifest V3** — Modern extension format
- **Service Worker** — Background script as service worker
- **Content Scripts** — Injected on all URLs at `document_idle`
- **Commands** — Keyboard shortcuts registered globally
- **Permissions** — tabs, tabGroups, storage, topSites, history
