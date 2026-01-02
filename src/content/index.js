// Zenith Vertical Tabs - Main Entry Point
// This file orchestrates all modules and initializes the extension

import { state, elements } from './state.js';
import { icons } from './icons.js';
import { isExtensionValid, sendMessage } from './utils.js';
import { loadPinnedState, expand, collapse, toggle, setupSidebarListeners } from './sidebar.js';
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
      <div id="vt-onboarding-modal">
        <div class="vt-onboarding-content">
          <div class="vt-onboarding-step active" data-step="1">
            <div class="vt-onboarding-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div class="vt-onboarding-title">Welcome to Zenith</div>
            <div class="vt-onboarding-text">
              Transform your browsing with a premium, focused workspace. Zenith Vertical Tabs brings order to your digital life with a sleek Zen-inspired interface.
            </div>
            <div class="vt-onboarding-refresh-note">
              <div class="vt-onboarding-refresh-icon">ℹ️</div>
              <div class="vt-onboarding-refresh-text">
                <b>One-time setup:</b> Please refresh your current tabs to enable Zenith everywhere.
              </div>
              <button id="vt-onboarding-refresh-tabs-btn" class="vt-onboarding-refresh-btn">Refresh Now</button>
            </div>
          </div>
          <div class="vt-onboarding-step" data-step="2">
            <div class="vt-onboarding-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
            </div>
            <div class="vt-onboarding-title">The Sidebar</div>
            <div class="vt-onboarding-text">
              Hover over the <b>left edge</b> of your screen to reveal your tabs. You can pin the sidebar to keep it permanently visible.
            </div>
            <div class="vt-onboarding-shorcut-tip">
              <span class="vt-key">Alt</span> + <span class="vt-key">V</span>
              <span class="vt-shortcut-text">Toggle Sidebar</span>
            </div>
          </div>
          <div class="vt-onboarding-step" data-step="3">
            <div class="vt-onboarding-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
            </div>
            <div class="vt-onboarding-title">Stay Organized</div>
            <div class="vt-onboarding-text">
              Keep your workflow clean by <b>Pinning</b> important tabs or creating <b>Groups</b>. Just right-click any tab or use the "New Group" button at the bottom.
            </div>
          </div>
          <div class="vt-onboarding-step" data-step="4">
            <div class="vt-onboarding-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <div class="vt-onboarding-title">Quick Search</div>
            <div class="vt-onboarding-text">
              Open the smart command palette to search the web, your history, or switch between open tabs instantly.
            </div>
            <div class="vt-onboarding-shorcut-tip" style="margin-bottom: 8px;">
              <span class="vt-key">Alt</span> + <span class="vt-key">T</span>
              <span class="vt-shortcut-text">New Tab Search</span>
            </div>
            <div class="vt-onboarding-shorcut-tip">
              <span class="vt-key">Alt</span> + <span class="vt-key">K</span>
              <span class="vt-shortcut-text">Edit Current URL</span>
            </div>
          </div>
          <div class="vt-onboarding-step" data-step="5">
            <div class="vt-onboarding-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div class="vt-onboarding-title">You're All Set!</div>
            <div class="vt-onboarding-text">
              Ready to experience a more tranquil way of browsing? Enjoy Zenith Vertical Tabs.
            </div>
          </div>
        </div>
        <div class="vt-onboarding-footer">
          <div class="vt-onboarding-dots">
            <div class="vt-onboarding-dot active" data-step="1"></div>
            <div class="vt-onboarding-dot" data-step="2"></div>
            <div class="vt-onboarding-dot" data-step="3"></div>
            <div class="vt-onboarding-dot" data-step="4"></div>
            <div class="vt-onboarding-dot" data-step="5"></div>
          </div>
          <div class="vt-onboarding-btns">
            <button class="vt-onboarding-btn vt-onboarding-btn-secondary" id="vt-onboarding-skip">Skip</button>
            <button class="vt-onboarding-btn vt-onboarding-btn-primary" id="vt-onboarding-next">Next</button>
          </div>
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
elements.onboardingDots = shadow.querySelectorAll('.vt-onboarding-dot');
elements.onboardingRefreshBtn = shadow.getElementById('vt-onboarding-refresh-tabs-btn');

// Initialize all module listeners
setupSidebarListeners(fetchTabs, updateUrlBarDisplay, hideContextMenu);
setupContextMenuListener();
setupUrlBarListeners(renderTabs);
setupUrlModalListeners();
setupGroupModalListeners();
setupOnboardingListeners();
setupGlobalKeyboardCapture();

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
loadPinnedState();
fetchTabs();
updateUrlBarDisplay();
checkOnboarding();
