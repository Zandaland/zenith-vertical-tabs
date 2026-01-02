// Zenith Vertical Tabs - Main Entry Point
// This file orchestrates all modules and initializes the extension

import { state, elements } from './state.js';
import { icons } from './icons.js';
import { isExtensionValid, sendMessage } from './utils.js';
import { loadPinnedState, loadSidebarWidth, expand, collapse, toggle, setupSidebarListeners, setupResizeHandle } from './sidebar.js';
import { hideContextMenu, setupContextMenuListener } from './context-menu.js';
import { setupUrlBarListeners, updateUrlBarDisplay } from './url-bar.js';
import { openUrlModal, closeUrlModal, openGroupModal, closeGroupModal, setupUrlModalListeners, setupGroupModalListeners, setupGlobalKeyboardCapture } from './modals.js';
import { fetchTabs, renderTabs, debouncedRenderTabs } from './tabs.js';
import { checkOnboarding, setupOnboardingListeners } from './onboarding.js';

// Prevent duplicate injection
if (document.getElementById('vertical-tabs-host')) {
  throw new Error('Zenith already injected');
}

// Create Shadow DOM host element for CSS isolation
const host = document.createElement('div');
host.id = 'vertical-tabs-host';
host.style.cssText = `
    all: initial;
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 2147483647;
    pointer-events: none;
`;

function inject() {
  if (!document.body) {
    setTimeout(inject, 50);
    return;
  }
  document.body.appendChild(host);
}
inject();

// Create shadow root with closed mode for maximum isolation
const shadow = host.attachShadow({ mode: 'closed' });
elements.shadow = shadow;

// Create container inside shadow DOM
const container = document.createElement('div');
container.id = 'vertical-tabs-container';
container.innerHTML = `
    <div id="vertical-tabs-trigger"></div>
    <div id="vertical-tabs-sidebar">
      <div id="vertical-tabs-header">
        <div class="vt-header-left">
          <button class="vt-nav-btn" id="vt-back" title="Back">${icons.arrowLeft}</button>
          <button class="vt-nav-btn" id="vt-forward" title="Forward">${icons.arrowRight}</button>
          <button class="vt-nav-btn" id="vt-refresh" title="Refresh">${icons.refresh}</button>
        </div>
        <div class="vt-header-actions">
          <button class="vt-icon-btn" id="vt-pin-btn" title="Keep open">${icons.pin}</button>
          <button class="vt-icon-btn" id="vt-new-tab" title="New tab">${icons.plus}</button>
        </div>
      </div>
      <div id="vt-url-section">
        <div id="vt-url-wrapper">
          <input type="text" id="vt-url" placeholder="Search or enter URL..." autocomplete="off" spellcheck="false">
          <div id="vt-suggestions"></div>
        </div>
      </div>
      <div id="vt-search-wrap">
        <input type="text" id="vt-search" placeholder="Search tabs..." autocomplete="off" spellcheck="false">
      </div>
      <div id="vertical-tabs-list"></div>
      <div id="vt-bottom-section">
        <button class="vt-create-group-btn" id="vt-create-group-btn">${icons.folderPlus}<span>New Group</span></button>
      </div>
      <div id="vertical-tabs-footer">
        <div class="vt-shortcut">
          <span class="vt-key">Alt</span>
          <span class="vt-key">V</span>
          <span class="vt-shortcut-text">toggle</span>
        </div>
        <a href="https://buymeacoffee.com/azizln" target="_blank" rel="noopener" class="vt-coffee-link" title="Buy me a coffee ☕">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>
        </a>
      </div>
      <div id="vt-resize-handle"></div>
    </div>
    <div id="vt-modal-overlay">
      <div id="vt-modal">
        <input type="text" id="vt-modal-input" placeholder="Search the web or enter URL..." autocomplete="off" spellcheck="false">
        <div id="vt-modal-suggestions"></div>
      </div>
    </div>
    <div id="vt-group-modal-overlay">
      <div id="vt-group-modal">
        <div class="vt-group-modal-header">Create Tab Group</div>
        <div class="vt-group-modal-content">
          <div class="vt-group-modal-field">
            <label class="vt-group-modal-label">Group Name</label>
            <input type="text" id="vt-group-name-input" class="vt-group-modal-input" placeholder="Enter group name..." autocomplete="off" spellcheck="false">
          </div>
          <div class="vt-group-modal-field">
            <label class="vt-group-modal-label">Color</label>
            <div class="vt-group-modal-colors" id="vt-group-colors"></div>
          </div>
        </div>
        <div class="vt-group-modal-footer">
          <button class="vt-group-modal-btn vt-group-modal-btn-secondary" id="vt-group-cancel">Cancel</button>
          <button class="vt-group-modal-btn vt-group-modal-btn-primary" id="vt-group-create">Create</button>
        </div>
      </div>
    </div>
    <div id="vt-onboarding-overlay">
      <div class="vt-onboarding-particles">
        <div class="vt-particle"></div>
        <div class="vt-particle"></div>
        <div class="vt-particle"></div>
        <div class="vt-particle"></div>
        <div class="vt-particle"></div>
      </div>
      <div id="vt-onboarding-modal">
        <div class="vt-onboarding-progress">
          <div class="vt-onboarding-progress-bar" id="vt-onboarding-progress-bar"></div>
        </div>
        <div class="vt-onboarding-content">
          <div class="vt-onboarding-step active" data-step="1">
            <div class="vt-onboarding-logo-text">ZENITH</div>
            <div class="vt-onboarding-badge">Welcome</div>
            <h2 class="vt-onboarding-title">Meet Zenith</h2>
            <p class="vt-onboarding-text">
              Your new vertical tabs experience. Clean, fast, and beautifully minimal.
            </p>
            <div class="vt-onboarding-refresh-note">
              <div class="vt-onboarding-refresh-header">
                <span class="vt-onboarding-refresh-icon">ℹ️</span>
                <span class="vt-onboarding-refresh-label">One-time setup</span>
              </div>
              <div class="vt-onboarding-refresh-text">
                Please refresh your current tabs to enable Zenith everywhere.
              </div>
              <button id="vt-onboarding-refresh-tabs-btn" class="vt-onboarding-refresh-btn">Refresh All Tabs</button>
            </div>
          </div>
          <div class="vt-onboarding-step" data-step="2">
            <div class="vt-onboarding-illustration">
              <svg viewBox="0 0 120 120" fill="none">
                <rect x="15" y="20" width="35" height="80" rx="6" stroke="#fff" stroke-width="2" fill="rgba(255,255,255,0.03)" class="vt-onboarding-sidebar-rect"/>
                <rect x="55" y="20" width="50" height="80" rx="6" stroke="rgba(255,255,255,0.15)" stroke-width="1" fill="none"/>
                <circle cx="32" cy="35" r="4" fill="#fff" opacity="0.8"/>
                <circle cx="32" cy="50" r="4" fill="#fff" opacity="0.6"/>
                <circle cx="32" cy="65" r="4" fill="#fff" opacity="0.4"/>
                <path d="M10 60L20 60" stroke="#fff" stroke-width="2" stroke-linecap="round" class="vt-onboarding-hover-arrow"/>
              </svg>
            </div>
            <div class="vt-onboarding-badge">Getting Started</div>
            <h2 class="vt-onboarding-title">Access Your Tabs</h2>
            <p class="vt-onboarding-text">
              Hover the <strong>left edge</strong> of your screen to reveal the sidebar, or pin it open.
            </p>
            <div class="vt-onboarding-shortcut-row">
              <div class="vt-onboarding-shortcut">
                <div class="vt-onboarding-keys">
                  <span class="vt-key">Alt</span>
                  <span class="vt-key-plus">+</span>
                  <span class="vt-key">V</span>
                </div>
                <span class="vt-onboarding-shortcut-label">Toggle Sidebar</span>
              </div>
            </div>
          </div>
          <div class="vt-onboarding-step" data-step="3">
            <div class="vt-onboarding-illustration">
              <svg viewBox="0 0 120 120" fill="none">
                <rect x="20" y="25" width="80" height="20" rx="6" stroke="rgba(255,255,255,0.3)" stroke-width="2" fill="rgba(255,255,255,0.05)"/>
                <rect x="25" y="30" width="10" height="10" rx="2" fill="#fff" opacity="0.6"/>
                <rect x="40" y="32" width="40" height="6" rx="2" fill="rgba(255,255,255,0.3)"/>
                <rect x="20" y="50" width="80" height="20" rx="6" stroke="rgba(255,255,255,0.4)" stroke-width="2" fill="rgba(255,255,255,0.08)" class="vt-onboarding-drag-tab"/>
                <rect x="25" y="55" width="10" height="10" rx="2" fill="#fff" opacity="0.6"/>
                <rect x="40" y="57" width="35" height="6" rx="2" fill="rgba(255,255,255,0.3)"/>
                <rect x="20" y="75" width="80" height="20" rx="6" stroke="rgba(255,255,255,0.25)" stroke-width="2" fill="rgba(255,255,255,0.03)"/>
                <rect x="25" y="80" width="10" height="10" rx="2" fill="#fff" opacity="0.6"/>
                <rect x="40" y="82" width="45" height="6" rx="2" fill="rgba(255,255,255,0.3)"/>
              </svg>
            </div>
            <div class="vt-onboarding-badge">Organization</div>
            <h2 class="vt-onboarding-title">Stay Organized</h2>
            <p class="vt-onboarding-text">
              <strong>Drag tabs</strong> to reorder, <strong>right-click</strong> for options, or create <strong>groups</strong> to keep related tabs together.
            </p>
            <div class="vt-onboarding-tip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              <span>Pro tip: Drag a tab onto another to create a group instantly</span>
            </div>
          </div>
          <div class="vt-onboarding-step" data-step="4">
            <div class="vt-onboarding-illustration vt-onboarding-illustration-success">
              <svg viewBox="0 0 120 120" fill="none">
                <circle cx="60" cy="60" r="45" stroke="#fff" stroke-width="3" fill="none" class="vt-onboarding-success-circle"/>
                <path d="M40 60L55 75L80 45" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" class="vt-onboarding-checkmark"/>
              </svg>
            </div>
            <div class="vt-onboarding-badge vt-onboarding-badge-success">Ready</div>
            <h2 class="vt-onboarding-title">You're All Set!</h2>
            <p class="vt-onboarding-text">
              Enjoy a cleaner, more focused browsing experience with Zenith.
            </p>
            <div class="vt-onboarding-shortcuts-grid">
              <div class="vt-onboarding-shortcut-card">
                <div class="vt-onboarding-keys">
                  <span class="vt-key">Alt</span><span class="vt-key-plus">+</span><span class="vt-key">T</span>
                </div>
                <span>New Tab</span>
              </div>
              <div class="vt-onboarding-shortcut-card">
                <div class="vt-onboarding-keys">
                  <span class="vt-key">Alt</span><span class="vt-key-plus">+</span><span class="vt-key">K</span>
                </div>
                <span>Edit URL</span>
              </div>
            </div>
          </div>
        </div>
        <div class="vt-onboarding-footer">
          <button class="vt-onboarding-btn vt-onboarding-btn-secondary" id="vt-onboarding-skip">Skip</button>
          <div class="vt-onboarding-step-indicator">
            <span id="vt-onboarding-step-current">1</span>
            <span class="vt-onboarding-step-divider">/</span>
            <span id="vt-onboarding-step-total">4</span>
          </div>
          <button class="vt-onboarding-btn vt-onboarding-btn-primary" id="vt-onboarding-next">
            <span>Continue</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div id="vt-tab-preview"></div>
`;

// Hide container until styles are loaded
container.style.visibility = 'hidden';

// Essential inline styles
const essentialStyles = document.createElement('style');
essentialStyles.textContent = `
    #vertical-tabs-container {
        position: fixed;
        top: 0;
        left: 0;
        height: 100vh;
        width: 100vw;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        pointer-events: none;
        overflow: hidden;
        display: flex;
    }
    #vertical-tabs-sidebar {
        width: 260px;
        transform: translateX(-300px);
        opacity: 0;
        pointer-events: auto;
        flex-shrink: 0;
    }
    #vertical-tabs-trigger {
        width: 10px;
        height: 100%;
        pointer-events: auto;
        flex-shrink: 0;
    }
    #vt-modal-overlay, #vt-group-modal-overlay, #vt-onboarding-overlay {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
    }
    #vt-modal-overlay.active, #vt-group-modal-overlay.active, #vt-onboarding-overlay.active {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
    }
`;
shadow.appendChild(essentialStyles);

// Inject styles into shadow DOM
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

// Show container
container.style.visibility = 'visible';
shadow.appendChild(container);

// Populate element references
elements.container = container;
elements.trigger = shadow.getElementById('vertical-tabs-trigger');
elements.sidebar = shadow.getElementById('vertical-tabs-sidebar');
elements.tabList = shadow.getElementById('vertical-tabs-list');
elements.newTabBtn = shadow.getElementById('vt-new-tab');
elements.pinBtn = shadow.getElementById('vt-pin-btn');
elements.searchInput = shadow.getElementById('vt-search');
elements.backBtn = shadow.getElementById('vt-back');
elements.forwardBtn = shadow.getElementById('vt-forward');
elements.refreshBtn = shadow.getElementById('vt-refresh');
elements.urlInput = shadow.getElementById('vt-url');
elements.suggestionsEl = shadow.getElementById('vt-suggestions');
elements.createGroupBtn = shadow.getElementById('vt-create-group-btn');
elements.tabPreview = shadow.getElementById('vt-tab-preview');
elements.modalOverlay = shadow.getElementById('vt-modal-overlay');
elements.modal = shadow.getElementById('vt-modal');
elements.modalInput = shadow.getElementById('vt-modal-input');
elements.modalSuggestions = shadow.getElementById('vt-modal-suggestions');
elements.groupModalOverlay = shadow.getElementById('vt-group-modal-overlay');
elements.groupNameInput = shadow.getElementById('vt-group-name-input');
elements.groupColorsContainer = shadow.getElementById('vt-group-colors');
elements.groupCancelBtn = shadow.getElementById('vt-group-cancel');
elements.groupCreateBtn = shadow.getElementById('vt-group-create');
elements.onboardingOverlay = shadow.getElementById('vt-onboarding-overlay');
elements.onboardingNextBtn = shadow.getElementById('vt-onboarding-next');
elements.onboardingSkipBtn = shadow.getElementById('vt-onboarding-skip');
elements.onboardingSteps = shadow.querySelectorAll('.vt-onboarding-step');
elements.onboardingRefreshBtn = shadow.getElementById('vt-onboarding-refresh-tabs-btn');
elements.resizeHandle = shadow.getElementById('vt-resize-handle');

// Initialize all module listeners
setupSidebarListeners(fetchTabs, updateUrlBarDisplay, hideContextMenu);
setupContextMenuListener();
setupUrlBarListeners(renderTabs);
setupUrlModalListeners();
setupGroupModalListeners();
setupOnboardingListeners();
setupGlobalKeyboardCapture();
setupResizeHandle();

// New tab button
elements.newTabBtn.addEventListener('click', () => openUrlModal('new-tab'));

// Create group button
if (elements.createGroupBtn) {
  elements.createGroupBtn.addEventListener('click', openGroupModal);
}

// Global keyboard shortcuts (fallback - main shortcuts via Chrome commands API)
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key.toLowerCase() === 'v') {
    e.preventDefault();
    toggle();
    if (state.isExpanded) {
      fetchTabs();
      updateUrlBarDisplay();
    }
  }
  if (e.altKey && e.key.toLowerCase() === 't') {
    e.preventDefault();
    openUrlModal('new-tab');
  }
  if (e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openUrlModal('edit-url', window.location.href);
  }
});

// Listen for messages from background
if (isExtensionValid()) {
  try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggle-sidebar') {
        toggle();
        if (state.isExpanded) {
          fetchTabs();
          updateUrlBarDisplay();
        }
        sendResponse({ success: true });
      }
      if (request.action === 'open-url-modal') {
        openUrlModal(request.mode, request.currentUrl);
        sendResponse({ success: true });
      }
      if (request.action === 'tabs-updated') {
        state.tabs = request.tabs || [];
        state.groups = request.groups || {};
        debouncedRenderTabs();
        sendResponse({ success: true });
      }
    });
  } catch (e) { }
}

// Initial setup
loadSidebarWidth();
loadPinnedState();
fetchTabs();
updateUrlBarDisplay();
checkOnboarding();
