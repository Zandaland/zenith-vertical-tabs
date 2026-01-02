# Styling Guide

Styles are organized in `public/styles/` directory and loaded into the Shadow DOM:

| File | Purpose |
|------|---------|
| `base.css` | CSS variables, container, trigger |
| `sidebar.css` | Sidebar panel, header, footer, URL section |
| `tabs.css` | Tab list, pinned tabs, groups, animations |
| `drag-drop.css` | Drag states, drop zones, ghost element |
| `context-menu.css` | Context menu, tab preview tooltip |
| `modals.css` | URL modal, group creation modal |
| `onboarding.css` | Onboarding overlay and steps |

## CSS Architecture

### Naming Convention
BEM-inspired with `vt-` prefix (Vertical Tabs):

```css
.vt-tab { }           /* Block */
.vt-tab-active { }    /* Modifier */
.vt-tab-title { }     /* Element */
```

### Key Classes

| Class | Description |
|-------|-------------|
| `#vertical-tabs-container` | Root container |
| `#vertical-tabs-sidebar` | Main sidebar panel |
| `.vt-expanded` | Sidebar expanded state |
| `.vt-tab` | Regular tab item |
| `.vt-tab-active` | Active tab highlight |
| `.vt-pinned-tab` | Pinned tab in grid |
| `.vt-group` | Tab group container |
| `.vt-group-header` | Collapsible group header |
| `.vt-context-menu` | Right-click menu |
| `#vt-modal-overlay` | Command palette overlay |
| `#vt-modal` | Command palette dialog |

### CSS Variables

```css
:root {
    --bg-primary: #1a1a1a;
    --bg-secondary: #252525;
    --bg-hover: #333;
    --bg-active: #444;
    --text-primary: #fff;
    --text-secondary: #888;
    --accent: #4a9eff;
    --border: #333;
    --shadow: 0 4px 20px rgba(0,0,0,0.5);
}
```

### Group Colors

```css
.vt-group-grey { --group-color: #5f6368; }
.vt-group-blue { --group-color: #1a73e8; }
.vt-group-red { --group-color: #d93025; }
.vt-group-yellow { --group-color: #f9ab00; }
.vt-group-green { --group-color: #188038; }
.vt-group-pink { --group-color: #d01884; }
.vt-group-purple { --group-color: #9334e6; }
.vt-group-cyan { --group-color: #007b83; }
.vt-group-orange { --group-color: #fa903e; }
```

## Shadow DOM

Styles are injected into Shadow DOM for isolation:

```javascript
const cssFiles = [
  'styles/base.css',
  'styles/sidebar.css',
  'styles/tabs.css',
  'styles/drag-drop.css',
  'styles/context-menu.css',
  'styles/modals.css',
  'styles/onboarding.css'
];

cssFiles.forEach(file => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL(file);
  shadow.appendChild(link);
});
```

This prevents:
- Host page styles from affecting sidebar
- Sidebar styles from leaking to host page

## Animations

### Sidebar Slide
```css
#vertical-tabs-sidebar {
    transform: translateX(-300px);
    transition: transform 0.25s ease, opacity 0.25s ease;
}

#vertical-tabs-sidebar.vt-expanded {
    transform: translateX(0);
}
```

### Modal Fade
```css
#vt-modal-overlay {
    opacity: 0;
    transition: opacity 0.15s ease;
}

#vt-modal-overlay.active {
    opacity: 1;
}
```

### Tab Hover
```css
.vt-tab:hover {
    background: var(--bg-hover);
}
```

## Dark Mode

The extension uses a dark theme by default. Colors are defined using CSS variables for easy theming.

## Responsive Design

The sidebar has a fixed width of 260px. The modal is centered with max-width: 600px.

## Adding New Styles

1. Add CSS to the appropriate file in `public/styles/`
2. Use `vt-` prefix for new classes
3. Use existing CSS variables from `base.css`
4. Rebuild: `npm run build`
