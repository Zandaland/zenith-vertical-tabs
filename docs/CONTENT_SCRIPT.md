# Content Script Documentation

The content script (`src/content/`) provides the sidebar UI. It's modular for maintainability.

## Entry Point: `index.js`

Responsibilities:
1. Create Shadow DOM host
2. Build HTML structure
3. Populate `elements` object with DOM references
4. Initialize all module listeners
5. Set up message listeners
6. Load initial state

## Modules

### `state.js`
Centralized state store.

```javascript
import { state, elements } from './state.js';

// Reading state
if (state.isExpanded) { ... }

// Mutating state
state.tabs = newTabs;
state.searchQuery = 'hello';

// DOM elements (populated by index.js)
elements.sidebar.classList.add('vt-expanded');
```

### `icons.js`
SVG icon definitions as template strings.

```javascript
import { icons, chromePageIcons, groupColors } from './icons.js';

element.innerHTML = icons.plus;  // SVG string
```

### `utils.js`
Shared utility functions.

| Function | Description |
|----------|-------------|
| `isExtensionValid()` | Check if extension context is valid |
| `sendMessage(msg)` | Promise-based message to background |
| `getDomain(url)` | Extract hostname from URL |
| `getDisplayTitle(tab)` | Human-readable tab title |
| `escapeHtml(text)` | XSS-safe HTML escaping |
| `getFilteredTabs()` | Filter tabs by search query |

### `favicon.js`
Favicon resolution with fallbacks.

```javascript
import { getBestFavicon, getFallbackIcon } from './favicon.js';

const src = getBestFavicon(tab);  // Best available favicon
const fallback = getFallbackIcon(tab.url);  // SVG fallback
```

Resolution order:
1. Chrome page icon (settings, extensions, etc.)
2. Tab's `favIconUrl`
3. Google favicon service
4. Generic globe/file icon

### `sidebar.js`
Sidebar visibility and pin state.

```javascript
import { expand, collapse, toggle, loadPinnedState } from './sidebar.js';

expand();   // Show sidebar
collapse(); // Hide sidebar (unless pinned)
toggle();   // Toggle visibility + pin state
```

### `tabs.js`
Tab list rendering and interaction.

```javascript
import { fetchTabs, renderTabs, debouncedRenderTabs } from './tabs.js';

await fetchTabs();     // Fetch from background and render
renderTabs();          // Re-render current state
debouncedRenderTabs(); // Debounced render (prevents flicker)
```

Handles:
- Pinned tabs grid
- Regular tab list
- Group headers
- Drag & drop
- Tab previews
- All click/hover events

### `context-menu.js`
Right-click context menus.

```javascript
import { showContextMenu, showGroupContextMenu, hideContextMenu } from './context-menu.js';

showContextMenu(event, tabId, openGroupModal);
showGroupContextMenu(event, groupId);
hideContextMenu();
```

### `url-bar.js`
URL input with suggestions.

```javascript
import { setupUrlBarListeners, updateUrlBarDisplay, hideSuggestions } from './url-bar.js';

setupUrlBarListeners(renderTabs);  // Initialize
updateUrlBarDisplay();              // Sync URL bar with current page
```

### `modals.js`
URL modal (command palette) and group creation modal.

```javascript
import { openUrlModal, closeUrlModal, openGroupModal, closeGroupModal } from './modals.js';

openUrlModal('new-tab');                    // New tab mode
openUrlModal('edit-url', window.location);  // Edit URL mode
openGroupModal();                           // Group creation
```

### `onboarding.js`
First-run tutorial flow.

```javascript
import { checkOnboarding, setupOnboardingListeners } from './onboarding.js';

checkOnboarding();          // Show if first run
setupOnboardingListeners(); // Button handlers
```

## Adding a New Feature

1. **Create module** in `src/content/newfeature.js`
2. **Import shared state**: `import { state, elements } from './state.js'`
3. **Export functions**: `export function doSomething() { ... }`
4. **Wire up in index.js**:
   ```javascript
   import { doSomething, setupNewFeatureListeners } from './newfeature.js';
   setupNewFeatureListeners();
   ```
5. **Rebuild**: `npm run build`

## DOM Element References

All DOM elements are accessed via `elements` object:

```javascript
elements.sidebar      // #vertical-tabs-sidebar
elements.tabList      // #vertical-tabs-list
elements.modalOverlay // #vt-modal-overlay
elements.modalInput   // #vt-modal-input
// ... see state.js for full list
```
