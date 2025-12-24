// Zenith Vertical Tabs - Arc/Zen Style with Groups & Pinned
(function () {
    if (document.getElementById('vertical-tabs-host')) return;

    function isExtensionValid() {
        try { return chrome && chrome.runtime && chrome.runtime.id; } catch { return false; }
    }

    function sendMessage(message) {
        return new Promise((resolve) => {
            if (!isExtensionValid()) { resolve(null); return; }
            try {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) { resolve(null); return; }
                    resolve(response);
                });
            } catch { resolve(null); }
        });
    }

    let isExpanded = false;
    let isPinned = false;
    let tabs = [];
    let groups = {};
    let searchQuery = '';
    let contextMenu = null;
    let collapsedGroups = new Set();
    let lastRenderedData = null;
    let pendingSwitchTabId = null;
    let switchTabTimeout = null;
    let renderTimeout = null;

    function clearActiveStates() {
        tabList.querySelectorAll('.vt-tab.vt-tab-active, .vt-pinned-tab.active').forEach(active => {
            active.classList.remove('vt-tab-active');
            active.classList.remove('active');
        });
    }

    // Load pinned state from storage
    async function loadPinnedState() {
        try {
            const result = await chrome.storage.local.get('sidebarPinned');
            isPinned = result.sidebarPinned || false;
            updatePinButton();
            if (isPinned) {
                sidebar.classList.add('vt-no-transition');
                expand();
                // Remove to allow future animations (mouse hover etc)
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        sidebar.classList.remove('vt-no-transition');
                    });
                });
            }
        } catch (e) { }
    }

    // Save pinned state to storage
    async function savePinnedState() {
        try {
            await chrome.storage.local.set({ sidebarPinned: isPinned });
        } catch (e) { }
    }

    // Listen for storage changes to sync across tabs
    try {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.sidebarPinned) {
                isPinned = changes.sidebarPinned.newValue || false;
                updatePinButton();
                if (isPinned && !isExpanded) {
                    expand();
                } else if (!isPinned && isExpanded) {
                    collapse();
                }
            }
        });
    } catch (e) { }

    const icons = {
        plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`,
        x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
        pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>`,
        pinFilled: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>`,
        globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
        file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
        volume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
        muted: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
        chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`,
        copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
        pinSmall: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.76z"/></svg>`,
        unpin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.76z"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
        arrowLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
        arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
        refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
        home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
        folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
        folderPlus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`,
        ungroup: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="3" y1="3" x2="21" y2="21"/></svg>`,
        window: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="8" x2="22" y2="8"/></svg>`,
        externalLink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
    };

    // Drag and drop state
    let draggedTabId = null;
    let draggedElement = null;
    let dropTarget = null;
    let dropPosition = null; // 'above', 'below', or 'group'
    let pendingGroupTabId = null; // Tab to add when creating a new group

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
          <!-- Step 1: Welcome -->
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

          <!-- Step 2: Sidebar -->
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

          <!-- Step 3: Organization -->
          <div class="vt-onboarding-step" data-step="3">
            <div class="vt-onboarding-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
            </div>
            <div class="vt-onboarding-title">Stay Organized</div>
            <div class="vt-onboarding-text">
              Keep your workflow clean by <b>Pinning</b> important tabs or creating <b>Groups</b>. Just right-click any tab or use the "New Group" button at the bottom.
            </div>
          </div>

          <!-- Step 4: Command Palette -->
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

          <!-- Step 5: Final -->
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

    // Hide container until styles are loaded to prevent flash of unstyled content
    container.style.visibility = 'hidden';

    // Essential inline styles to ensure proper behavior even before CSS loads
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
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('styles.css');
    shadow.appendChild(styleLink);

    // Show container immediately (CSS will apply as it loads)
    container.style.visibility = 'visible';
    shadow.appendChild(container);

    // Query elements from shadow DOM instead of document
    const trigger = shadow.getElementById('vertical-tabs-trigger');
    const sidebar = shadow.getElementById('vertical-tabs-sidebar');
    const tabList = shadow.getElementById('vertical-tabs-list');
    const newTabBtn = shadow.getElementById('vt-new-tab');
    const pinBtn = shadow.getElementById('vt-pin-btn');
    const searchInput = shadow.getElementById('vt-search');

    const backBtn = shadow.getElementById('vt-back');
    const forwardBtn = shadow.getElementById('vt-forward');
    const refreshBtn = shadow.getElementById('vt-refresh');
    const urlInput = shadow.getElementById('vt-url');
    const suggestionsEl = shadow.getElementById('vt-suggestions');
    const createGroupBtn = shadow.getElementById('vt-create-group-btn');
    const tabPreview = shadow.getElementById('vt-tab-preview');
    let previewTimeout = null;


    async function fetchTabs() {
        const response = await sendMessage({ action: 'get-tabs' });
        if (response) {
            tabs = response.tabs || [];
            groups = response.groups || {};
            renderTabs();
        }
    }

    function getDomain(url) {
        if (!url) return '';
        try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
    }

    function getDisplayTitle(tab) {
        const url = tab.url || '';
        const title = tab.title || '';
        if (url.startsWith('chrome://newtab') || url === 'chrome://new-tab-page/') return 'New Tab';
        if (url.startsWith('chrome://extensions')) return 'Extensions';
        if (url.startsWith('chrome://settings')) return 'Settings';
        if (url.startsWith('chrome://')) return url.replace('chrome://', '').split('/')[0];
        if (!title || title === url) return getDomain(url) || 'New Tab';
        return title;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function getFilteredTabs() {
        if (!searchQuery) return tabs;
        const q = searchQuery.toLowerCase();
        return tabs.filter(tab =>
            (tab.title || '').toLowerCase().includes(q) ||
            (tab.url || '').toLowerCase().includes(q)
        );
    }

    // Get Google's favicon service URL for a domain
    function getGoogleFaviconUrl(url) {
        if (!url) return null;
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol === 'chrome:' || parsedUrl.protocol === 'chrome-extension:') {
                return null;
            }
            return `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`;
        } catch {
            return null;
        }
    }

    // Chrome page specific icons
    const chromePageIcons = {
        settings: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
        extensions: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
        history: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        downloads: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        bookmarks: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
        newtab: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`
    };

    function getChromePageIcon(url) {
        if (!url) return null;
        if (url.startsWith('chrome://newtab') || url === 'chrome://new-tab-page/') {
            return `data:image/svg+xml,${encodeURIComponent(chromePageIcons.newtab.replace('currentColor', '#888'))}`;
        }
        if (url.startsWith('chrome://settings')) {
            return `data:image/svg+xml,${encodeURIComponent(chromePageIcons.settings.replace('currentColor', '#888'))}`;
        }
        if (url.startsWith('chrome://extensions')) {
            return `data:image/svg+xml,${encodeURIComponent(chromePageIcons.extensions.replace('currentColor', '#888'))}`;
        }
        if (url.startsWith('chrome://history')) {
            return `data:image/svg+xml,${encodeURIComponent(chromePageIcons.history.replace('currentColor', '#888'))}`;
        }
        if (url.startsWith('chrome://downloads')) {
            return `data:image/svg+xml,${encodeURIComponent(chromePageIcons.downloads.replace('currentColor', '#888'))}`;
        }
        if (url.startsWith('chrome://bookmarks')) {
            return `data:image/svg+xml,${encodeURIComponent(chromePageIcons.bookmarks.replace('currentColor', '#888'))}`;
        }
        return null;
    }

    function updateTabPreview(tab, x, y) {
        if (!tab || !tabPreview) return;

        const title = getDisplayTitle(tab);
        const url = tab.url || '';
        const domain = getDomain(url);
        const favicon = getBestFavicon(tab);
        const fallback = getFallbackIcon(url);

        let badgesHtml = '';
        if (tab.audible) {
            badgesHtml += `<div class="vt-preview-badge">${tab.mutedInfo?.muted ? icons.muted : icons.volume} Audio Playing</div>`;
        }
        if (tab.discarded) {
            badgesHtml += `<div class="vt-preview-badge">💤 Suspended</div>`;
        }

        tabPreview.innerHTML = `
            <div class="vt-preview-header">
                <img class="vt-preview-favicon" src="${favicon}" onerror="this.src='${fallback}'">
                <div class="vt-preview-content">
                    <div class="vt-preview-title">${escapeHtml(title)}</div>
                    <div class="vt-preview-url">${escapeHtml(url)}</div>
                </div>
            </div>
            <div id="vt-preview-image-container"></div>
            ${badgesHtml ? `<div class="vt-preview-meta">${badgesHtml}</div>` : ''}
        `;

        // Request snapshot
        sendMessage({ action: 'get-tab-preview', tabId: tab.id }).then(response => {
            if (response && response.snapshot) {
                const imgContainer = tabPreview.querySelector('#vt-preview-image-container');
                if (imgContainer) {
                    imgContainer.innerHTML = `<img class="vt-preview-snapshot" src="${response.snapshot}">`;
                }
            }
        });

        // Position logic
        const sidebarRect = sidebar.getBoundingClientRect();
        let left = sidebarRect.right + 10;
        let top = y - 20;

        // Ensure it doesn't go off screen vertically
        const previewRect = tabPreview.getBoundingClientRect();
        if (top + (previewRect.height || 100) > window.innerHeight) {
            top = window.innerHeight - (previewRect.height || 100) - 10;
        }

        // If sidebar is on the right (future proofing), flip side
        // But currently it's on left.

        tabPreview.style.top = `${top}px`;
        tabPreview.style.left = `${left}px`;
        tabPreview.classList.add('visible');
    }

    function hideTabPreview() {
        if (tabPreview) {
            tabPreview.classList.remove('visible');
        }
    }

    function getFallbackIcon(url) {
        // Check for specific chrome:// page icons first
        const chromeIcon = getChromePageIcon(url);
        if (chromeIcon) return chromeIcon;

        // For chrome:// and extension pages, use file icon
        if (url && (url.startsWith('chrome://') || url.startsWith('chrome-extension://'))) {
            return `data:image/svg+xml,${encodeURIComponent(icons.file.replace('currentColor', '#666'))}`;
        }
        // For regular pages, fallback to globe icon
        return `data:image/svg+xml,${encodeURIComponent(icons.globe.replace('currentColor', '#666'))}`;
    }

    // Get best available favicon URL
    function getBestFavicon(tab) {
        // Check for specific chrome:// page icons first
        const chromeIcon = getChromePageIcon(tab.url);
        if (chromeIcon) return chromeIcon;

        // If tab has a favicon, use it
        if (tab.favIconUrl && tab.favIconUrl.length > 0) {
            return tab.favIconUrl;
        }
        // Try Google's favicon service for regular URLs
        const googleFavicon = getGoogleFaviconUrl(tab.url);
        if (googleFavicon) {
            return googleFavicon;
        }
        // Fallback to inline SVG icon
        return getFallbackIcon(tab.url);
    }

    function renderPinnedTabs(pinnedTabs) {
        if (pinnedTabs.length === 0) return '';

        const tabsHtml = pinnedTabs.map(tab => {
            const fallback = getFallbackIcon(tab.url);
            const favicon = getBestFavicon(tab);
            const audioBadge = tab.audible ? `<div class="vt-audio-badge">${tab.mutedInfo?.muted ? icons.muted : icons.volume}</div>` : '';

            return `
        <div class="vt-pinned-tab ${tab.active ? 'active' : ''}" data-tab-id="${tab.id}" title="${escapeHtml(getDisplayTitle(tab))}">
          <div class="vt-favicon-wrapper">
            <img src="${favicon}" onerror="this.src='${fallback}'" alt="">
          </div>
          ${audioBadge}
        </div>
      `;
        }).join('');

        return `
      <div class="vt-section">
        <div class="vt-section-label">Pinned</div>
        <div class="vt-pinned-grid">${tabsHtml}</div>
      </div>
    `;
    }

    function renderTabItem(tab) {
        const title = getDisplayTitle(tab);
        const domain = getDomain(tab.url);
        const fallback = getFallbackIcon(tab.url);
        const favicon = getBestFavicon(tab);

        let badges = '';
        if (tab.audible) {
            const audioIcon = tab.mutedInfo?.muted ? icons.muted : icons.volume;
            const audioClass = tab.mutedInfo?.muted ? 'vt-badge-muted' : 'vt-badge-audio';
            badges += `<div class="vt-badge ${audioClass}" data-action="mute" data-tab-id="${tab.id}">${audioIcon}</div>`;
        }
        if (tab.discarded) {
            badges += `<div class="vt-badge vt-badge-discarded" title="Suspended">💤</div>`;
        }

        return `
      <div class="vt-tab ${tab.active ? 'vt-tab-active' : ''}" data-tab-id="${tab.id}" draggable="true">
        <div class="vt-favicon-wrapper">
          <img class="vt-favicon" src="${favicon}" onerror="this.src='${fallback}'" alt="">
          <button class="vt-favicon-refresh" data-tab-id="${tab.id}" title="Reload">${icons.refresh}</button>
        </div>
        <div class="vt-tab-content">
          <span class="vt-tab-title">${escapeHtml(title)}</span>
        </div>
        <div class="vt-tab-badges">${badges}</div>
        <button class="vt-close" data-tab-id="${tab.id}" title="Close">${icons.x}</button>
      </div>
    `;
    }

    function renderGroup(group, groupTabs) {
        const isCollapsed = collapsedGroups.has(group.id);
        const tabsHtml = isCollapsed ? '' : groupTabs.map(renderTabItem).join('');

        return `
      <div class="vt-group vt-group-${group.color} ${isCollapsed ? 'collapsed' : ''}" data-group-id="${group.id}">
        <div class="vt-group-header" data-group-id="${group.id}">
          <div class="vt-group-dot"></div>
          <span class="vt-group-title">${escapeHtml(group.title) || 'Unnamed'}</span>
          <span class="vt-group-count">${groupTabs.length}</span>
          <div class="vt-group-chevron">${icons.chevron}</div>
        </div>
        <div class="vt-group-tabs">${tabsHtml}</div>
      </div>
    `;
    }

    // Debounced render to prevent UI flicker
    // Optimized render to prevent UI flicker
    function debouncedRenderTabs() {
        if (renderTimeout) return;
        renderTimeout = true;
        // Use microtask for near-instant execution while grouping rapid updates
        queueMicrotask(() => {
            renderTabs();
            renderTimeout = null;
        });
    }

    function renderTabs() {
        const filtered = getFilteredTabs();

        // Create state object for comparison
        const currentData = {
            tabs: tabs.map(t => ({
                id: t.id,
                title: t.title,
                url: t.url,
                favIconUrl: t.favIconUrl,
                active: t.active,
                pinned: t.pinned,
                groupId: t.groupId,
                audible: t.audible,
                muted: t.mutedInfo?.muted,
                discarded: t.discarded
            })),
            groups: groups,
            searchQuery: searchQuery,
            collapsed: Array.from(collapsedGroups)
        };

        // Skip render if structure and content are identical
        if (lastRenderedData && JSON.stringify(lastRenderedData) === JSON.stringify(currentData)) {
            return;
        }

        // Optimistic UI update: if only non-structural things changed, just update existing elements
        if (lastRenderedData) {
            const prev = lastRenderedData;
            const next = currentData;

            // Check if structural things are same
            const structuralSame =
                prev.tabs.length === next.tabs.length &&
                prev.tabs.every((t, i) => t.id === next.tabs[i].id && t.pinned === next.tabs[i].pinned && t.groupId === next.tabs[i].groupId) &&
                prev.searchQuery === next.searchQuery &&
                prev.collapsed.length === next.collapsed.length &&
                prev.collapsed.every((val, i) => val === next.collapsed[i]);

            if (structuralSame) {
                let complexChange = false;
                for (let i = 0; i < next.tabs.length; i++) {
                    const tab = next.tabs[i];
                    const prevTab = prev.tabs[i];
                    const el = tabList.querySelector(`[data-tab-id="${tab.id}"]`);

                    if (el) {
                        const isPinned = el.classList.contains('vt-pinned-tab');
                        const activeClass = isPinned ? 'active' : 'vt-tab-active';

                        if (pendingSwitchTabId) {
                            if (tab.id === pendingSwitchTabId) {
                                if (tab.active) {
                                    pendingSwitchTabId = null;
                                    if (switchTabTimeout) clearTimeout(switchTabTimeout);
                                }
                                el.classList.add(activeClass);
                            } else {
                                el.classList.remove(activeClass);
                            }
                        } else {
                            if (tab.active) el.classList.add(activeClass);
                            else el.classList.remove(activeClass);
                        }

                        if (tab.title !== prevTab.title) {
                            const titleEl = el.querySelector('.vt-tab-title');
                            if (titleEl) titleEl.textContent = getDisplayTitle(tab);
                            if (isPinned) el.title = getDisplayTitle(tab);
                        }

                        if (tab.audible !== prevTab.audible ||
                            tab.muted !== prevTab.muted ||
                            tab.discarded !== prevTab.discarded ||
                            tab.favIconUrl !== prevTab.favIconUrl) {
                            complexChange = true;
                            break;
                        }
                    } else {
                        complexChange = true;
                        break;
                    }
                }

                if (!complexChange) {
                    lastRenderedData = currentData;
                    return;
                }
            }
        }

        lastRenderedData = currentData;

        if (filtered.length === 0) {
            tabList.innerHTML = `<div class="vt-empty">${searchQuery ? 'No matching tabs' : 'No tabs'}</div>`;
            return;
        }

        const pinnedTabs = filtered.filter(t => t.pinned);
        const unpinnedTabs = filtered.filter(t => !t.pinned);

        const groupedTabs = {};
        const ungroupedTabs = [];

        unpinnedTabs.forEach(tab => {
            // Check if tab belongs to a group (groupId is a positive number when in a group)
            const hasGroup = tab.groupId !== undefined && tab.groupId !== null && tab.groupId !== -1 && groups[tab.groupId];
            if (hasGroup) {
                if (!groupedTabs[tab.groupId]) groupedTabs[tab.groupId] = [];
                groupedTabs[tab.groupId].push(tab);
            } else {
                ungroupedTabs.push(tab);
            }
        });

        let html = renderPinnedTabs(pinnedTabs);

        // Render groups - use string keys from groupedTabs
        Object.keys(groupedTabs).forEach(groupId => {
            const group = groups[groupId] || groups[parseInt(groupId)];
            if (group) {
                html += renderGroup(group, groupedTabs[groupId]);
            }
        });

        if (ungroupedTabs.length > 0) {
            html += ungroupedTabs.map(renderTabItem).join('');
        }

        tabList.innerHTML = html;
        attachEventListeners();
    }

    function attachEventListeners() {
        tabList.querySelectorAll('.vt-pinned-tab').forEach(el => {
            el.addEventListener('click', (e) => {
                const tabId = parseInt(el.dataset.tabId);
                pendingSwitchTabId = tabId;
                if (switchTabTimeout) clearTimeout(switchTabTimeout);
                switchTabTimeout = setTimeout(() => { pendingSwitchTabId = null; }, 1000);

                // Optimistic UI update
                clearActiveStates();
                el.classList.add('active');
                sendMessage({ action: 'switch-tab', tabId });
            });

            el.addEventListener('mouseenter', (e) => {
                if (draggedTabId !== null) return;
                const tabId = parseInt(el.dataset.tabId);
                const tab = tabs.find(t => t.id === tabId);
                if (tab) {
                    if (tab.active) return;
                    if (previewTimeout) clearTimeout(previewTimeout);
                    previewTimeout = setTimeout(() => {
                        const rect = el.getBoundingClientRect();
                        updateTabPreview(tab, rect.right, rect.top);
                    }, 1500);
                }
            });

            el.addEventListener('mouseleave', () => {
                if (previewTimeout) clearTimeout(previewTimeout);
                hideTabPreview();
            });

            el.addEventListener('contextmenu', (e) => showContextMenu(e, parseInt(el.dataset.tabId)));
        });

        tabList.querySelectorAll('.vt-tab').forEach(el => {
            el.addEventListener('click', (e) => {
                if (!e.target.closest('.vt-close') && !e.target.closest('.vt-badge') && !e.target.closest('.vt-favicon-refresh')) {
                    const tabId = parseInt(el.dataset.tabId);
                    pendingSwitchTabId = tabId;
                    if (switchTabTimeout) clearTimeout(switchTabTimeout);
                    switchTabTimeout = setTimeout(() => { pendingSwitchTabId = null; }, 1000);

                    // Optimistic UI update
                    clearActiveStates();
                    el.classList.add('vt-tab-active');
                    sendMessage({ action: 'switch-tab', tabId });
                }
            });

            el.addEventListener('mouseenter', (e) => {
                if (draggedTabId !== null) return;
                const tabId = parseInt(el.dataset.tabId);
                const tab = tabs.find(t => t.id === tabId);
                if (tab) {
                    if (tab.active) return;
                    if (previewTimeout) clearTimeout(previewTimeout);
                    previewTimeout = setTimeout(() => {
                        const rect = el.getBoundingClientRect();
                        updateTabPreview(tab, rect.right, rect.top);
                    }, 1500);
                }
            });

            el.addEventListener('mouseleave', () => {
                if (previewTimeout) clearTimeout(previewTimeout);
                hideTabPreview();
            });

            el.addEventListener('contextmenu', (e) => showContextMenu(e, parseInt(el.dataset.tabId)));

            // Drag and drop handlers
            el.addEventListener('dragstart', (e) => {
                draggedTabId = parseInt(el.dataset.tabId);
                draggedElement = el;
                el.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', draggedTabId);
            });

            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
                clearDropIndicators();
                draggedTabId = null;
                draggedElement = null;
            });

            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedElement === el) return;

                const rect = el.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;

                clearDropIndicators();

                if (e.clientY < midY) {
                    el.classList.add('drag-over');
                    dropPosition = 'above';
                } else {
                    el.classList.add('drag-over', 'drag-over-below');
                    dropPosition = 'below';
                }
                dropTarget = el;
            });

            el.addEventListener('dragleave', () => {
                el.classList.remove('drag-over', 'drag-over-below');
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedTabId === null) return;

                const targetTabId = parseInt(el.dataset.tabId);
                if (draggedTabId === targetTabId) return;

                const targetTab = tabs.find(t => t.id === targetTabId);
                if (targetTab) {
                    // Calculate the new index based on drop position
                    let newIndex = targetTab.index;
                    if (dropPosition === 'below') newIndex++;

                    sendMessage({ action: 'move-tab', tabId: draggedTabId, newIndex });
                }

                clearDropIndicators();
            });
        });

        // Refresh buttons on favicons
        tabList.querySelectorAll('.vt-favicon-refresh').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tabId = parseInt(btn.dataset.tabId);
                sendMessage({ action: 'reload-tab', tabId });
            });
        });

        tabList.querySelectorAll('.vt-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                sendMessage({ action: 'close-tab', tabId: parseInt(btn.dataset.tabId) });
            });
        });

        tabList.querySelectorAll('.vt-badge[data-action="mute"]').forEach(badge => {
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                const tabId = parseInt(badge.dataset.tabId);
                const tab = tabs.find(t => t.id === tabId);
                if (tab) {
                    sendMessage({ action: 'mute-tab', tabId, muted: !tab.mutedInfo?.muted });
                }
            });
        });

        tabList.querySelectorAll('.vt-group-header').forEach(el => {
            el.addEventListener('click', (e) => {
                // Only toggle if not dropping
                if (draggedTabId !== null) return;
                const groupId = parseInt(el.dataset.groupId);
                if (collapsedGroups.has(groupId)) {
                    collapsedGroups.delete(groupId);
                } else {
                    collapsedGroups.add(groupId);
                }
                renderTabs();
            });

            // Right-click context menu for groups
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                hideContextMenu();

                const groupId = parseInt(el.dataset.groupId);
                const group = groups[groupId];

                contextMenu = document.createElement('div');
                contextMenu.className = 'vt-context-menu';
                contextMenu.innerHTML = `
                    <div class="vt-context-item" data-action="new-tab-in-group">${icons.plus}<span>New tab in group</span></div>
                    <div class="vt-context-divider"></div>
                    <div class="vt-context-item" data-action="ungroup">${icons.ungroup}<span>Ungroup</span></div>
                    <div class="vt-context-divider"></div>
                    <div class="vt-context-item" data-action="move-group-to-new-window">${icons.externalLink}<span>Move group to new window</span></div>
                    <div class="vt-context-item" data-action="close-group">${icons.x}<span>Close group</span></div>
                `;

                contextMenu.style.left = `${Math.min(e.clientX, window.innerWidth - 200)}px`;
                contextMenu.style.top = `${Math.min(e.clientY, window.innerHeight - 200)}px`;
                container.appendChild(contextMenu);

                contextMenu.querySelector('[data-action="new-tab-in-group"]').addEventListener('click', () => {
                    // Create new tab and then group it
                    sendMessage({ action: 'new-tab' }).then(() => {
                        // After new tab is created, it will be active. We need to find it.
                        // Actually better to have a background action that does both.
                        // But for now, let's just create it and maybe the user has to group it manually or we fix background.
                        // Let's assume background should handle "new-tab-in-group"
                        sendMessage({ action: 'new-tab-in-group', groupId });
                    });
                    hideContextMenu();
                });

                contextMenu.querySelector('[data-action="ungroup"]').addEventListener('click', () => {
                    // Find all tabs in group and ungroup them
                    const groupTabs = tabs.filter(t => t.groupId === groupId);
                    groupTabs.forEach(t => sendMessage({ action: 'remove-from-group', tabId: t.id }));
                    hideContextMenu();
                });

                contextMenu.querySelector('[data-action="move-group-to-new-window"]').addEventListener('click', () => {
                    sendMessage({ action: 'move-group-to-new-window', groupId });
                    hideContextMenu();
                });

                contextMenu.querySelector('[data-action="close-group"]').addEventListener('click', () => {
                    sendMessage({ action: 'close-group', groupId });
                    hideContextMenu();
                });
            });

            // Allow dropping tabs onto group headers to add to group
            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.style.background = 'var(--bg-active)';
            });

            el.addEventListener('dragleave', () => {
                el.style.background = '';
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.style.background = '';
                if (draggedTabId === null) return;

                const groupId = parseInt(el.dataset.groupId);
                sendMessage({ action: 'add-to-group', tabId: draggedTabId, groupId });
                clearDropIndicators();
            });
        });

        // Allow dropping tabs above/below entire groups
        tabList.querySelectorAll('.vt-group').forEach(groupEl => {
            groupEl.addEventListener('dragover', (e) => {
                // Don't interfere with header drops
                if (e.target.closest('.vt-group-header')) return;

                e.preventDefault();
                if (draggedElement && groupEl.contains(draggedElement)) return;

                const rect = groupEl.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;

                clearDropIndicators();

                if (e.clientY < midY) {
                    groupEl.classList.add('drag-over');
                    dropPosition = 'above';
                } else {
                    groupEl.classList.add('drag-over', 'drag-over-below');
                    dropPosition = 'below';
                }
                dropTarget = groupEl;
            });

            groupEl.addEventListener('dragleave', (e) => {
                // Only remove if leaving group entirely
                if (!groupEl.contains(e.relatedTarget)) {
                    groupEl.classList.remove('drag-over', 'drag-over-below');
                }
            });

            groupEl.addEventListener('drop', (e) => {
                // Don't interfere with header drops
                if (e.target.closest('.vt-group-header')) return;

                e.preventDefault();
                if (draggedTabId === null) return;

                const groupId = parseInt(groupEl.dataset.groupId);
                const groupTabs = tabs.filter(t => t.groupId === groupId);

                if (groupTabs.length > 0) {
                    let newIndex;
                    if (dropPosition === 'above') {
                        // Move to just before the first tab in the group
                        newIndex = Math.min(...groupTabs.map(t => t.index));
                    } else {
                        // Move to just after the last tab in the group
                        newIndex = Math.max(...groupTabs.map(t => t.index)) + 1;
                    }
                    sendMessage({ action: 'move-tab', tabId: draggedTabId, newIndex });
                }

                clearDropIndicators();
            });
        });
    }

    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', openGroupModal);
    }

    function clearDropIndicators() {
        tabList.querySelectorAll('.drag-over, .drag-over-below').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-below');
        });
        dropTarget = null;
        dropPosition = null;
    }

    async function showContextMenu(e, tabId) {
        e.preventDefault();
        hideContextMenu();

        const tab = tabs.find(t => t.id === tabId);
        if (!tab) return;

        contextMenu = document.createElement('div');
        contextMenu.className = 'vt-context-menu';

        // Build group options
        const groupColors = { grey: '#9ca3af', blue: '#3b82f6', red: '#ef4444', yellow: '#eab308', green: '#22c55e', pink: '#ec4899', purple: '#a855f7', cyan: '#06b6d4', orange: '#f97316' };
        const existingGroups = Object.values(groups);
        const isInGroup = tab.groupId && tab.groupId !== -1;

        // Fetch windows for "Move to window" submenu
        const windowsResponse = await sendMessage({ action: 'get-windows' });
        const windowList = (windowsResponse?.windows || []).filter(w => w.id !== tab.windowId);

        let groupMenuHtml = '';
        if (!tab.pinned) {
            groupMenuHtml = `
                <div class="vt-context-divider"></div>
                <div class="vt-context-item" data-action="new-group">${icons.folderPlus}<span>Add to new group</span></div>
            `;

            if (existingGroups.length > 0) {
                groupMenuHtml += `<div class="vt-context-item vt-context-submenu" data-action="add-to-group">
                    ${icons.folder}<span>Add to group</span>
                    <div class="vt-context-submenu-items">
                        ${existingGroups.map(g => `
                            <div class="vt-context-item" data-action="add-to-existing-group" data-group-id="${g.id}">
                                <span style="width: 10px; height: 10px; border-radius: 50%; background: ${groupColors[g.color] || groupColors.grey}; flex-shrink: 0;"></span>
                                <span>${escapeHtml(g.title) || 'Unnamed'}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }

            if (isInGroup) {
                groupMenuHtml += `<div class="vt-context-item" data-action="remove-from-group">${icons.ungroup}<span>Remove from group</span></div>`;
            }
        }

        let windowMenuHtml = `
            <div class="vt-context-item vt-context-submenu" data-action="move-to-window">
                ${icons.window}<span>Move tab to another window</span>
                <div class="vt-context-submenu-items">
                    <div class="vt-context-item" data-action="move-to-new-window">${icons.plus}<span>New window</span></div>
                    ${windowList.length > 0 ? '<div class="vt-context-divider"></div>' : ''}
                    ${windowList.map((w, i) => `
                        <div class="vt-context-item" data-action="move-to-existing-window" data-window-id="${w.id}">
                            ${icons.window}<span>Window ${i + 1}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        contextMenu.innerHTML = `
      <div class="vt-context-item" data-action="new-tab-right">${icons.plus}<span>New tab to the right</span></div>
      <div class="vt-context-item" data-action="reload">${icons.refresh}<span>Reload</span></div>
      <div class="vt-context-item" data-action="duplicate">${icons.copy}<span>Duplicate</span></div>
      <div class="vt-context-item" data-action="pin">${tab.pinned ? icons.unpin : icons.pinSmall}<span>${tab.pinned ? 'Unpin' : 'Pin'} tab</span></div>
      <div class="vt-context-item" data-action="mute">${tab.mutedInfo?.muted ? icons.volume : icons.muted}<span>${tab.mutedInfo?.muted ? 'Unmute' : 'Mute site'}</span></div>
      <div class="vt-context-divider"></div>
      ${windowMenuHtml}
      ${groupMenuHtml}
      <div class="vt-context-divider"></div>
      <div class="vt-context-item" data-action="close">${icons.x}<span>Close</span></div>
      <div class="vt-context-item" data-action="close-others"><span>Close other tabs</span></div>
      <div class="vt-context-item" data-action="close-to-right"><span>Close tabs to the bottom</span></div>
    `;

        contextMenu.style.left = `${Math.min(e.clientX, window.innerWidth - 200)}px`;
        contextMenu.style.top = `${Math.min(e.clientY, window.innerHeight - 400)}px`;
        container.appendChild(contextMenu);

        contextMenu.querySelectorAll('.vt-context-item').forEach(item => {
            item.addEventListener('click', (evt) => {
                // Don't close if clicking the submenu parent
                if (item.classList.contains('vt-context-submenu')) return;
                evt.stopPropagation();

                const action = item.dataset.action;
                if (action === 'new-tab-right') sendMessage({ action: 'new-tab-right', tabId });
                if (action === 'reload') sendMessage({ action: 'reload-tab', tabId });
                if (action === 'pin') sendMessage({ action: 'pin-tab', tabId, pinned: !tab.pinned });
                if (action === 'duplicate') sendMessage({ action: 'duplicate-tab', tabId });
                if (action === 'mute') sendMessage({ action: 'mute-tab', tabId, muted: !tab.mutedInfo?.muted });
                if (action === 'move-to-new-window') sendMessage({ action: 'move-tab-to-new-window', tabId });
                if (action === 'move-to-existing-window') sendMessage({ action: 'move-tab-to-window', tabId, windowId: parseInt(item.dataset.windowId) });
                if (action === 'close') sendMessage({ action: 'close-tab', tabId });
                if (action === 'close-others') sendMessage({ action: 'close-other-tabs', tabId });
                if (action === 'close-to-right') sendMessage({ action: 'close-tabs-to-right', tabId });

                if (action === 'new-group') {
                    pendingGroupTabId = tabId;
                    openGroupModal();
                }
                if (action === 'add-to-existing-group') {
                    const groupId = parseInt(item.dataset.groupId);
                    sendMessage({ action: 'add-to-group', tabId, groupId });
                }
                if (action === 'remove-from-group') {
                    sendMessage({ action: 'remove-from-group', tabId });
                }
                hideContextMenu();
            });
        });
    }

    function hideContextMenu() {
        if (contextMenu) {
            contextMenu.remove();
            contextMenu = null;
        }
    }

    document.addEventListener('click', hideContextMenu);

    function expand() {
        if (isExpanded) return;
        isExpanded = true;
        sidebar.classList.add('vt-expanded');
        fetchTabs();
        updateUrlBarDisplay();
    }

    function collapse() {
        if (!isExpanded || isPinned) return;
        isExpanded = false;
        sidebar.classList.remove('vt-expanded');
        searchQuery = '';
        searchInput.value = '';
        hideContextMenu();
    }

    function toggle() {
        if (isExpanded) {
            isPinned = false;
            isExpanded = false;
            sidebar.classList.remove('vt-expanded');
            updatePinButton();
            savePinnedState();
        } else {
            isPinned = true;
            updatePinButton();
            savePinnedState();
            expand();
        }
    }

    function updatePinButton() {
        pinBtn.innerHTML = isPinned ? icons.pinFilled : icons.pin;
        pinBtn.style.color = isPinned ? '#fff' : '';
    }

    pinBtn.addEventListener('click', () => {
        isPinned = !isPinned;
        updatePinButton();
        savePinnedState();
        if (!isPinned && !sidebar.matches(':hover')) collapse();
    });

    trigger.addEventListener('mouseenter', expand);
    sidebar.addEventListener('mouseleave', () => {
        setTimeout(() => {
            if (!sidebar.matches(':hover') && !trigger.matches(':hover') && !contextMenu) collapse();
        }, 150);
    });

    newTabBtn.addEventListener('click', () => openUrlModal('new-tab', ''));

    backBtn.addEventListener('click', () => sendMessage({ action: 'go-back' }));
    forwardBtn.addEventListener('click', () => sendMessage({ action: 'go-forward' }));
    refreshBtn.addEventListener('click', () => sendMessage({ action: 'reload' }));

    // URL bar with smart suggestions
    let suggestions = [];
    let selectedSuggestion = -1;

    function hideSuggestions() {
        suggestionsEl.style.display = 'none';
        suggestions = [];
        selectedSuggestion = -1;
    }

    function showSuggestions(items) {
        suggestions = items;
        selectedSuggestion = -1;
        if (items.length === 0) {
            hideSuggestions();
            return;
        }
        suggestionsEl.innerHTML = items.map((item, i) => {
            const iconHtml = item.isSearch
                ? '<div class="vt-suggestion-icon">🔍</div>'
                : item.favicon
                    ? `<img class="vt-suggestion-favicon" src="${item.favicon}" alt="" onerror="this.style.display='none'">`
                    : '<div class="vt-suggestion-icon">🌐</div>';

            const tagHtml = item.isTab
                ? '<span class="vt-suggestion-tag">SWITCH TO TAB</span>'
                : (item.type === 'top-site' ? '<span class="vt-suggestion-tag">TOP SITE</span>' : '');

            return `
            <div class="vt-suggestion" data-index="${i}" data-url="${item.url}" data-tab-id="${item.tabId || ''}">
              ${iconHtml}
              <div class="vt-suggestion-text">
                <div class="vt-suggestion-title">${escapeHtml(item.title)} ${tagHtml}</div>
                <div class="vt-suggestion-url">${escapeHtml(item.url)}</div>
              </div>
            </div>
          `;
        }).join('');
        suggestionsEl.style.display = 'block';

        suggestionsEl.querySelectorAll('.vt-suggestion').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                navigateTo(el.dataset.url, el.dataset.tabId);
            });
        });
    }

    function updateSelection() {
        suggestionsEl.querySelectorAll('.vt-suggestion').forEach((el, i) => {
            el.classList.toggle('selected', i === selectedSuggestion);
        });
    }

    function navigateTo(url, tabId = null) {
        if (tabId) {
            sendMessage({ action: 'switch-tab', tabId: parseInt(tabId) });
        } else {
            sendMessage({ action: 'navigate', url });
        }
        urlInput.blur();
        hideSuggestions();
    }

    async function fetchSuggestions(query) {
        if (!query.trim()) {
            // Show top sites when empty
            const response = await sendMessage({ action: 'get-suggestions', query: '' });
            if (response && response.suggestions) {
                showSuggestions(response.suggestions.slice(0, 6));
            }
            return;
        }

        const response = await sendMessage({ action: 'get-suggestions', query });
        if (response && response.suggestions) {
            showSuggestions(response.suggestions.slice(0, 8));
        }
    }

    function updateUrlBarDisplay() {
        // Only update if not focused (user is not editing)
        if (document.activeElement !== urlInput) {
            try {
                const url = new URL(window.location.href);
                urlInput.value = url.hostname.replace('www.', '') || window.location.href;
            } catch {
                urlInput.value = window.location.href;
            }
        }
    }

    urlInput.addEventListener('focus', () => {
        urlInput.value = window.location.href;
        urlInput.select();
        fetchSuggestions('');
    });

    urlInput.addEventListener('blur', () => {
        setTimeout(() => {
            hideSuggestions();
            updateUrlBarDisplay();
        }, 150);
    });

    urlInput.addEventListener('input', (e) => {
        fetchSuggestions(e.target.value);
    });

    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (suggestions.length > 0) {
                selectedSuggestion = Math.min(selectedSuggestion + 1, suggestions.length - 1);
                updateSelection();
            }
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (suggestions.length > 0) {
                selectedSuggestion = Math.max(selectedSuggestion - 1, -1);
                updateSelection();
            }
        }
        if (e.key === 'Enter') {
            if (selectedSuggestion >= 0 && suggestions[selectedSuggestion]) {
                navigateTo(suggestions[selectedSuggestion].url, suggestions[selectedSuggestion].tabId);
            } else {
                let url = urlInput.value.trim();
                if (url) {
                    if (!url.match(/^https?:\/\//)) {
                        if (url.includes('.') && !url.includes(' ')) {
                            url = 'https://' + url;
                        } else {
                            url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
                        }
                    }
                    navigateTo(url);
                }
            }
        }
        if (e.key === 'Escape') {
            hideSuggestions();
            urlInput.value = '';
            urlInput.blur();
        }
    });

    searchInput.addEventListener('input', (e) => { searchQuery = e.target.value; renderTabs(); });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { searchQuery = ''; searchInput.value = ''; renderTabs(); searchInput.blur(); }
        if (e.key === 'Enter' && getFilteredTabs().length > 0) {
            sendMessage({ action: 'switch-tab', tabId: getFilteredTabs()[0].id });
        }
    });

    if (isExtensionValid()) {
        try {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'toggle-sidebar') { toggle(); sendResponse({ success: true }); }
                if (request.action === 'open-url-modal') {
                    openUrlModal(request.mode, request.currentUrl);
                    sendResponse({ success: true });
                }
                if (request.action === 'tabs-updated') {
                    tabs = request.tabs || [];
                    groups = request.groups || {};
                    if (isExpanded) debouncedRenderTabs();
                }
            });
        } catch { }
    }

    fetchTabs();
    loadPinnedState();

    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'v') {
            setTimeout(() => { if (isExpanded) searchInput.focus(); }, 100);
        }
    });

    // Global capture listener to prevent site shortcuts when our inputs are focused
    const interceptEvents = ['keydown', 'keyup', 'keypress'];
    interceptEvents.forEach(eventType => {
        window.addEventListener(eventType, (e) => {
            const activeEl = shadow.activeElement;
            const path = e.composedPath();
            const isFromOurInput = path.some(el =>
                el === modalInput || el === urlInput || el === searchInput || el === groupNameInput
            );

            if (isFromOurInput || (activeEl && (activeEl === modalInput || activeEl === urlInput || activeEl === searchInput || activeEl === groupNameInput))) {
                // Stop propagation at the capture phase to prevent site listeners from ever seeing the event
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, true);
    });

    // URL Modal (Zen-style command palette)
    const modalOverlay = shadow.getElementById('vt-modal-overlay');
    const modal = shadow.getElementById('vt-modal');
    const modalInput = shadow.getElementById('vt-modal-input');
    const modalSuggestions = shadow.getElementById('vt-modal-suggestions');
    let modalSuggestionsList = [];
    let modalSelectedIndex = -1;
    let modalMode = 'new-tab'; // 'new-tab' or 'current-tab'

    function openUrlModal(mode = 'new-tab', currentUrl = '') {
        modalMode = mode;
        modalOverlay.classList.add('active');
        modalInput.value = currentUrl;

        // Immediate focus and retry to ensure it catches
        modalInput.focus();
        if (currentUrl) modalInput.select();

        setTimeout(() => {
            modalInput.focus();
            if (currentUrl) modalInput.select();
        }, 10);

        setTimeout(() => {
            modalInput.focus();
        }, 50);

        if (currentUrl) {
            fetchModalSuggestions(currentUrl);
        } else {
            fetchModalSuggestions('');
        }
    }

    function closeUrlModal() {
        modalOverlay.classList.remove('active');
        modalInput.value = '';
        modalSuggestions.innerHTML = '';
        modalSuggestionsList = [];
        modalSelectedIndex = -1;
    }

    function showModalSuggestions(items) {
        modalSuggestionsList = items;
        modalSelectedIndex = -1;
        if (items.length === 0) {
            modalSuggestions.innerHTML = '';
            return;
        }
        modalSuggestions.innerHTML = items.map((item, i) => {
            const iconHtml = item.isSearch
                ? '<div class="vt-modal-suggestion-icon">🔍</div>'
                : item.favicon
                    ? `<img class="vt-modal-suggestion-favicon" src="${item.favicon}" alt="">`
                    : '<div class="vt-modal-suggestion-icon">🌐</div>';

            const tagHtml = item.isTab
                ? '<span class="vt-suggestion-tag">SWITCH TO TAB</span>'
                : (item.type === 'top-site' ? '<span class="vt-suggestion-tag">TOP SITE</span>' : '');

            return `
            <div class="vt-modal-suggestion" data-index="${i}" data-url="${item.url}" data-tab-id="${item.tabId || ''}">
              ${iconHtml}
              <div class="vt-modal-suggestion-text">
                <div class="vt-modal-suggestion-title">${escapeHtml(item.title)} ${tagHtml}</div>
                <div class="vt-modal-suggestion-url">${escapeHtml(item.url)}</div>
              </div>
            </div>
          `;
        }).join('');

        modalSuggestions.querySelectorAll('.vt-modal-suggestion').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                modalNavigateTo(el.dataset.url, el.dataset.tabId);
            });
        });
    }

    function updateModalSelection() {
        modalSuggestions.querySelectorAll('.vt-modal-suggestion').forEach((el, i) => {
            el.classList.toggle('selected', i === modalSelectedIndex);
        });
    }

    function modalNavigateTo(url, tabId = null) {
        if (tabId) {
            sendMessage({ action: 'switch-tab', tabId: parseInt(tabId) });
        } else if (modalMode === 'new-tab') {
            sendMessage({ action: 'new-tab-url', url });
        } else {
            sendMessage({ action: 'navigate', url });
        }
        closeUrlModal();
    }

    async function fetchModalSuggestions(query) {
        const response = await sendMessage({ action: 'get-suggestions', query });
        if (response && response.suggestions) {
            showModalSuggestions(response.suggestions.slice(0, 8));
        }
    }

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeUrlModal();
    });

    modalInput.addEventListener('input', (e) => {
        fetchModalSuggestions(e.target.value);
    });

    modalInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (modalSuggestionsList.length > 0) {
                modalSelectedIndex = Math.min(modalSelectedIndex + 1, modalSuggestionsList.length - 1);
                updateModalSelection();
            }
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (modalSuggestionsList.length > 0) {
                modalSelectedIndex = Math.max(modalSelectedIndex - 1, -1);
                updateModalSelection();
            }
        }
        if (e.key === 'Enter') {
            if (modalSelectedIndex >= 0 && modalSuggestionsList[modalSelectedIndex]) {
                modalNavigateTo(modalSuggestionsList[modalSelectedIndex].url, modalSuggestionsList[modalSelectedIndex].tabId);
            } else {
                let url = modalInput.value.trim();
                if (url) {
                    if (!url.match(/^https?:\/\//)) {
                        if (url.includes('.') && !url.includes(' ')) {
                            url = 'https://' + url;
                        } else {
                            url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
                        }
                    }
                    modalNavigateTo(url);
                }
            }
        }
        if (e.key === 'Escape') {
            closeUrlModal();
        }
    });

    // Tab Group Modal
    const groupModalOverlay = shadow.getElementById('vt-group-modal-overlay');
    const groupNameInput = shadow.getElementById('vt-group-name-input');
    const groupColorsContainer = shadow.getElementById('vt-group-colors');
    const groupCancelBtn = shadow.getElementById('vt-group-cancel');
    const groupCreateBtn = shadow.getElementById('vt-group-create');

    const groupColorOptions = [
        { name: 'grey', color: '#9ca3af' },
        { name: 'blue', color: '#3b82f6' },
        { name: 'red', color: '#ef4444' },
        { name: 'yellow', color: '#eab308' },
        { name: 'green', color: '#22c55e' },
        { name: 'pink', color: '#ec4899' },
        { name: 'purple', color: '#a855f7' },
        { name: 'cyan', color: '#06b6d4' },
        { name: 'orange', color: '#f97316' }
    ];

    let selectedGroupColor = 'blue';

    function renderGroupColors() {
        if (!groupColorsContainer) return;
        groupColorsContainer.innerHTML = groupColorOptions.map(c => `
            <div class="vt-group-color-option ${selectedGroupColor === c.name ? 'selected' : ''}" 
                 data-color="${c.name}" 
                 style="background: ${c.color}">
            </div>
        `).join('');

        groupColorsContainer.querySelectorAll('.vt-group-color-option').forEach(el => {
            el.addEventListener('click', () => {
                selectedGroupColor = el.dataset.color;
                renderGroupColors();
            });
        });
    }

    function openGroupModal() {
        if (!groupModalOverlay) {
            return;
        }
        groupModalOverlay.classList.add('active');
        if (groupNameInput) {
            groupNameInput.value = '';
        }
        selectedGroupColor = 'blue';
        renderGroupColors();

        // Immediate focus and retry
        if (groupNameInput) groupNameInput.focus();
        setTimeout(() => {
            if (groupNameInput) groupNameInput.focus();
        }, 10);
        setTimeout(() => {
            if (groupNameInput) groupNameInput.focus();
        }, 50);
    }

    function closeGroupModal() {
        if (!groupModalOverlay) return;
        groupModalOverlay.classList.remove('active');
        if (groupNameInput) groupNameInput.value = '';
        pendingGroupTabId = null;
    }

    async function createGroup() {
        const name = (groupNameInput ? groupNameInput.value.trim() : '') || 'New Group';
        const color = selectedGroupColor;

        if (pendingGroupTabId) {
            // Create group with a specific tab
            await sendMessage({ action: 'create-group-with-tab', tabId: pendingGroupTabId, name, color });
        } else {
            // Create empty group (only possible with active tab)
            await sendMessage({ action: 'create-group', name, color });
        }

        closeGroupModal();
    }

    if (groupModalOverlay) {
        groupModalOverlay.addEventListener('click', (e) => {
            if (e.target === groupModalOverlay) closeGroupModal();
        });
    }

    if (groupCancelBtn) {
        groupCancelBtn.addEventListener('click', closeGroupModal);
    }

    if (groupCreateBtn) {
        groupCreateBtn.addEventListener('click', createGroup);
    }

    if (groupNameInput) {
        groupNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') createGroup();
            if (e.key === 'Escape') closeGroupModal();
        });
    }

    // Onboarding Logic
    const onboardingOverlay = shadow.getElementById('vt-onboarding-overlay');
    const onboardingNextBtn = shadow.getElementById('vt-onboarding-next');
    const onboardingSkipBtn = shadow.getElementById('vt-onboarding-skip');
    const onboardingSteps = shadow.querySelectorAll('.vt-onboarding-step');
    const onboardingDots = shadow.querySelectorAll('.vt-onboarding-dot');
    let onboardingCurrentStep = 1;
    const onboardingTotalSteps = 5;

    function showOnboardingStep(step) {
        onboardingSteps.forEach(s => s.classList.remove('active'));
        onboardingDots.forEach(d => d.classList.remove('active'));

        const currentStepEl = shadow.querySelector(`.vt-onboarding-step[data-step="${step}"]`);
        const currentDotEl = shadow.querySelector(`.vt-onboarding-dot[data-step="${step}"]`);

        if (currentStepEl) currentStepEl.classList.add('active');
        if (currentDotEl) currentDotEl.classList.add('active');

        onboardingNextBtn.textContent = step === onboardingTotalSteps ? 'Get Started' : 'Next';
        onboardingSkipBtn.style.visibility = step === onboardingTotalSteps ? 'hidden' : 'visible';
    }

    async function closeOnboarding() {
        onboardingOverlay.classList.remove('active');
        await chrome.storage.local.set({ onboardingShown: true });
    }

    onboardingNextBtn.addEventListener('click', () => {
        if (onboardingCurrentStep < onboardingTotalSteps) {
            onboardingCurrentStep++;
            showOnboardingStep(onboardingCurrentStep);
        } else {
            closeOnboarding();
        }
    });

    onboardingSkipBtn.addEventListener('click', closeOnboarding);

    const onboardingRefreshBtn = shadow.getElementById('vt-onboarding-refresh-tabs-btn');
    if (onboardingRefreshBtn) {
        onboardingRefreshBtn.addEventListener('click', () => {
            onboardingRefreshBtn.textContent = 'Refreshing...';
            onboardingRefreshBtn.style.opacity = '0.5';
            onboardingRefreshBtn.style.pointerEvents = 'none';
            sendMessage({ action: 'refresh-all-tabs' });
            setTimeout(() => {
                onboardingRefreshBtn.textContent = 'Done!';
            }, 1000);
        });
    }

    // Initial check for onboarding
    async function checkOnboarding() {
        try {
            const result = await chrome.storage.local.get('onboardingShown');
            if (result.onboardingShown === false) {
                // Set to true immediately so other tabs/refreshes don't show it
                await chrome.storage.local.set({ onboardingShown: true });
                onboardingOverlay.classList.add('active');
            }
        } catch (e) { }
    }

    // Also listen for manual show trigger from background
    if (isExtensionValid()) {
        try {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'show-onboarding') {
                    // Set to true immediately so refreshes don't show it
                    chrome.storage.local.set({ onboardingShown: true });
                    onboardingCurrentStep = 1;
                    showOnboardingStep(1);
                    onboardingOverlay.classList.add('active');
                    sendResponse({ success: true });
                }
            });
        } catch (e) { }
    }

    // Wait a bit before checking to avoid flashing during initial load
    setTimeout(checkOnboarding, 500);

})();
