# Background Script Documentation

The background script (`src/background.js`) is a service worker that:
- Manages Chrome tab/group APIs
- Handles keyboard shortcuts
- Broadcasts updates to content scripts

## Message Handlers

### Tab Operations

| Action | Payload | Response | Description |
|--------|---------|----------|-------------|
| `get-tabs` | — | `{ tabs, groups }` | Get all tabs and groups |
| `switch-tab` | `{ tabId }` | — | Activate tab |
| `close-tab` | `{ tabId }` | — | Close tab |
| `reload-tab` | `{ tabId }` | — | Reload tab |
| `duplicate-tab` | `{ tabId }` | — | Duplicate tab |
| `pin-tab` | `{ tabId, pinned }` | — | Pin/unpin tab |
| `mute-tab` | `{ tabId, muted }` | — | Mute/unmute tab |
| `move-tab` | `{ tabId, newIndex }` | — | Reorder tab |
| `new-tab` | — | — | Create new tab |
| `new-tab-url` | `{ url }` | — | Create tab with URL |
| `new-tab-right` | `{ tabId }` | — | New tab after given tab |

### Group Operations

| Action | Payload | Response | Description |
|--------|---------|----------|-------------|
| `create-group` | `{ name, color }` | — | Create empty group |
| `create-group-with-tab` | `{ tabId, name, color }` | — | Create group with tab |
| `add-to-group` | `{ tabId, groupId }` | — | Add tab to group |
| `remove-from-group` | `{ tabId }` | — | Remove tab from group |
| `close-group` | `{ groupId }` | — | Close all tabs in group |

### Navigation

| Action | Payload | Response | Description |
|--------|---------|----------|-------------|
| `navigate` | `{ url }` | — | Navigate current tab |
| `go-back` | — | — | History back |
| `go-forward` | — | — | History forward |
| `reload` | — | — | Reload current tab |

### Suggestions

| Action | Payload | Response | Description |
|--------|---------|----------|-------------|
| `get-suggestions` | `{ query }` | `{ suggestions }` | Search suggestions |
| `get-tab-preview` | `{ tabId }` | `{ snapshot }` | Tab screenshot |

## Broadcasting Updates

When tabs change, background broadcasts to all content scripts:

```javascript
// In background.js
async function broadcastTabsUpdate() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const groups = await getTabGroups();
    
    // Send to all tabs in current window
    for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
            action: 'tabs-updated',
            tabs,
            groups
        });
    }
}
```

## Keyboard Commands

Defined in `manifest.json`, handled in background:

```javascript
chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-sidebar') {
        sendToActiveTab({ action: 'toggle-sidebar' });
    }
    if (command === 'open-url-bar') {
        sendToActiveTab({ action: 'open-url-modal', mode: 'new-tab' });
    }
    if (command === 'edit-url-bar') {
        sendToActiveTab({ action: 'open-url-modal', mode: 'edit-url', currentUrl });
    }
});
```

## Tab Event Listeners

```javascript
chrome.tabs.onCreated.addListener(broadcastTabsUpdate);
chrome.tabs.onRemoved.addListener(broadcastTabsUpdate);
chrome.tabs.onUpdated.addListener(broadcastTabsUpdate);
chrome.tabs.onMoved.addListener(broadcastTabsUpdate);
chrome.tabs.onActivated.addListener(broadcastTabsUpdate);
chrome.tabGroups.onCreated.addListener(broadcastTabsUpdate);
chrome.tabGroups.onUpdated.addListener(broadcastTabsUpdate);
chrome.tabGroups.onRemoved.addListener(broadcastTabsUpdate);
```

## Suggestions Algorithm

1. **Open Tabs** — Match title/URL against query
2. **Top Sites** — From `chrome.topSites` API
3. **History** — Recent history matching query
4. **Search** — Google search suggestion

Priority: Open tabs > Exact matches > Top sites > History > Search
