# Testing Checklist

Manual testing checklist for Zenith Vertical Tabs.

## Setup
1. Run `npm run build`
2. Load `dist/` in `chrome://extensions` (Developer mode)
3. Refresh any open tabs

## Core Functionality

### Sidebar
- [ ] Hover left edge → sidebar appears
- [ ] Move mouse away → sidebar hides
- [ ] Click pin button → sidebar stays open
- [ ] Click pin again → unpins
- [ ] `Alt+V` → toggles sidebar
- [ ] `Alt+V` → sidebar stays pinned after toggle

### Tabs
- [ ] All open tabs appear in list
- [ ] Active tab is highlighted
- [ ] Click tab → switches to it
- [ ] Click X → closes tab
- [ ] Hover favicon → reload button appears
- [ ] Click reload button → reloads tab
- [ ] Hover inactive tab (1.5s) → preview appears
- [ ] Right-click tab → context menu appears

### Tab Context Menu
- [ ] New tab to the right
- [ ] Reload
- [ ] Duplicate
- [ ] Pin/Unpin tab
- [ ] Mute/Unmute site
- [ ] Move to window submenu
- [ ] Add to group submenu
- [ ] Remove from group (if in group)
- [ ] Close
- [ ] Close other tabs
- [ ] Close tabs to bottom

### Pinned Tabs
- [ ] Pinned tabs appear in grid at top
- [ ] Click pinned tab → switches to it
- [ ] Right-click → context menu with unpin option

### Tab Groups
- [ ] Groups display with color dot
- [ ] Click group header → collapses/expands
- [ ] Right-click group header → group context menu
- [ ] Drag tab to group header → adds to group
- [ ] "New Group" button → opens group modal

### Group Modal
- [ ] Group name input focused
- [ ] Color options clickable
- [ ] Cancel closes modal
- [ ] Create creates group
- [ ] Enter key creates group
- [ ] Escape closes modal

### Search
- [ ] Type in search → filters tabs
- [ ] Matching tabs shown
- [ ] Clear search → all tabs shown
- [ ] Arrow keys → navigate tabs
- [ ] Enter → switch to selected tab

### URL Bar
- [ ] Click URL bar → shows current URL
- [ ] Type → suggestions appear
- [ ] Arrow keys → navigate suggestions
- [ ] Enter → navigates
- [ ] Escape → closes suggestions
- [ ] URL auto-completes with https://

### Command Palette (Alt+T)
- [ ] `Alt+T` → opens modal
- [ ] Input focused
- [ ] Suggestions load (tabs, history, top sites)
- [ ] Type → suggestions filter
- [ ] Arrow keys → navigate
- [ ] Enter → opens in new tab
- [ ] Escape → closes
- [ ] Click suggestion → opens

### Edit URL (Alt+K)
- [ ] `Alt+K` → opens modal with current URL
- [ ] URL is selected
- [ ] Enter → navigates current tab

### Drag & Drop
- [ ] Drag tab → drop indicator appears
- [ ] Drop above/below → reorders
- [ ] Drag to group header → adds to group

### Onboarding
- [ ] Fresh install → onboarding appears
- [ ] Next button → advances steps
- [ ] Skip → closes onboarding
- [ ] Dots show progress
- [ ] "Refresh Now" button works
- [ ] "Get Started" closes onboarding

### Audio Tabs
- [ ] Playing tab shows speaker icon
- [ ] Click speaker → mutes/unmutes
- [ ] Muted tab shows muted icon

### Suspended Tabs
- [ ] Suspended tabs show 💤 badge

## Edge Cases
- [ ] Works on chrome:// pages (limited)
- [ ] Works on file:// pages
- [ ] Works with 50+ tabs
- [ ] No console errors
- [ ] Sidebar z-index above page content

## Keyboard Navigation
- [ ] Tab → navigates buttons
- [ ] Enter → activates focused button
- [ ] Escape → closes modals/menus

## Cross-Tab Sync
- [ ] Pin in one tab → sidebar pins in other tabs
- [ ] Open new tab → appears in sidebar
- [ ] Close tab → removed from sidebar
