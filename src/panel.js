// Panel script for Zenith Vertical Tabs (chrome:// pages fallback)
let tabs = [];
let searchQuery = '';
let loadTabsTimeout = null;
let previewTimeout = null;

const tabsEl = document.getElementById('tabs');
const searchEl = document.getElementById('search');
const newTabBtn = document.getElementById('new-tab');
const urlBar = document.getElementById('url-bar');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const refreshBtn = document.getElementById('refresh-btn');

const icons = {
    x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
    volume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
    muted: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
};

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
    if (url.startsWith('chrome://history')) return 'History';
    if (url.startsWith('chrome://downloads')) return 'Downloads';
    if (url.startsWith('chrome://')) return url.replace('chrome://', '').split('/')[0];
    if (!title || title === url) return getDomain(url) || 'New Tab';
    return title;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
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

function getFallbackIcon(url) {
    // Check for specific chrome:// page icons first
    const chromeIcon = getChromePageIcon(url);
    if (chromeIcon) return chromeIcon;

    // For chrome:// and extension pages, use file icon
    if (url && (url.startsWith('chrome://') || url.startsWith('chrome-extension://'))) {
        return `data:image/svg+xml,${encodeURIComponent(icons.file.replace('currentColor', '#666'))}`;
    }
    // For regular pages, try Google's favicon service
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
        return `data:image/svg+xml,${encodeURIComponent(icons.globe.replace('currentColor', '#666'))}`;
    }
}

// Get best available favicon
function getBestFavicon(tab) {
    // Check for specific chrome:// page icons first
    const chromeIcon = getChromePageIcon(tab.url);
    if (chromeIcon) return chromeIcon;

    if (tab.favIconUrl && tab.favIconUrl.length > 0) {
        return tab.favIconUrl;
    }
    return getFallbackIcon(tab.url);
}

function getFilteredTabs() {
    if (!searchQuery) return tabs;
    const q = searchQuery.toLowerCase();
    return tabs.filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.url || '').toLowerCase().includes(q)
    );
}

function closePanel() {
    chrome.runtime.sendMessage({ action: 'close-panel' });
}

function updateUrlBar() {
    const activeTab = tabs.find(t => t.active);
    if (activeTab) {
        try {
            const url = new URL(activeTab.url);
            urlBar.value = url.hostname.replace('www.', '') || activeTab.url;
        } catch {
            urlBar.value = activeTab.url || '';
        }
    }
}

const tabPreview = document.createElement('div');
tabPreview.id = 'vt-tab-preview';
document.body.appendChild(tabPreview);

function updateTabPreview(tab, x, y) {
    if (!tab || !tabPreview) return;

    const title = getDisplayTitle(tab);
    const url = tab.url || '';
    const favicon = getBestFavicon(tab);
    const fallback = getFallbackIcon(url);

    let badgesHtml = '';
    if (tab.audible) {
        badgesHtml += `<div class="vt-preview-badge">${icons.volume} Audio Playing</div>`;
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
    chrome.runtime.sendMessage({ action: 'get-tab-preview', tabId: tab.id }, (response) => {
        if (response && response.snapshot) {
            const imgContainer = document.getElementById('vt-preview-image-container');
            if (imgContainer) {
                imgContainer.innerHTML = `<img class="vt-preview-snapshot" src="${response.snapshot}">`;
            }
        }
    });

    // Position logic
    let left = x + 10;
    let top = y;

    // Ensure it doesn't go off screen
    const previewRect = tabPreview.getBoundingClientRect();
    if (left + (previewRect.width || 280) > window.innerWidth) {
        left = x - (previewRect.width || 280) - 10;
    }
    if (top + (previewRect.height || 100) > window.innerHeight) {
        top = window.innerHeight - (previewRect.height || 100) - 10;
    }

    tabPreview.style.top = `${top}px`;
    tabPreview.style.left = `${left}px`;
    tabPreview.classList.add('visible');
}

function hideTabPreview() {
    if (tabPreview) {
        tabPreview.classList.remove('visible');
    }
}

function render() {
    const filtered = getFilteredTabs();

    if (filtered.length === 0) {
        tabsEl.innerHTML = `<div class="empty">${searchQuery ? 'No matching tabs' : 'No tabs'}</div>`;
        return;
    }

    tabsEl.innerHTML = '';

    filtered.forEach((tab, index) => {
        const title = getDisplayTitle(tab);
        const domain = getDomain(tab.url);
        const fallback = getFallbackIcon(tab.url);
        const favicon = getBestFavicon(tab);

        const tabEl = document.createElement('div');
        tabEl.className = `tab ${tab.active ? 'active' : ''} ${index === selectedIndex ? 'selected' : ''}`;

        const img = document.createElement('img');
        img.className = 'favicon';
        img.src = favicon;
        img.alt = '';
        img.onerror = () => {
            // On error, try Google's favicon service if not already using it
            if (!img.src.includes('google.com/s2/favicons')) {
                img.src = getFallbackIcon(tab.url);
            } else {
                // Final fallback to globe icon
                img.src = `data:image/svg+xml,${encodeURIComponent(icons.globe.replace('currentColor', '#666'))}`;
            }
        };

        const info = document.createElement('div');
        info.className = 'tab-info';
        info.innerHTML = `
      <div class="title">${escapeHtml(title)}</div>
    `;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'close';
        closeBtn.innerHTML = icons.x;
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            chrome.runtime.sendMessage({ action: 'close-tab', tabId: tab.id });
            setTimeout(loadTabs, 100);
        };

        tabEl.appendChild(img);
        tabEl.appendChild(info);
        tabEl.appendChild(closeBtn);

        tabEl.onclick = () => {
            chrome.runtime.sendMessage({ action: 'switch-tab', tabId: tab.id });
            closePanel();
        };

        // Add Hover Preview
        tabEl.addEventListener('mouseenter', (e) => {
            if (tab.active) return;
            if (previewTimeout) clearTimeout(previewTimeout);
            previewTimeout = setTimeout(() => {
                const rect = tabEl.getBoundingClientRect();
                updateTabPreview(tab, rect.right, rect.top);
            }, 1500);
        });

        tabEl.addEventListener('mouseleave', () => {
            if (previewTimeout) clearTimeout(previewTimeout);
            hideTabPreview();
        });

        tabsEl.appendChild(tabEl);
    });
}

async function loadTabs() {
    chrome.runtime.sendMessage({ action: 'get-tabs' }, (response) => {
        if (response && response.tabs) {
            tabs = response.tabs.filter(t => !t.url.includes('panel.html'));
            render();
            updateUrlBar();
        }
    });
}

// Navigation buttons
backBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'go-back' });
});

forwardBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'go-forward' });
});

refreshBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'reload' });
});

// URL bar
urlBar.addEventListener('focus', () => {
    const activeTab = tabs.find(t => t.active);
    if (activeTab) {
        urlBar.value = activeTab.url || '';
        urlBar.select();
    }
});

urlBar.addEventListener('blur', () => {
    updateUrlBar();
});

urlBar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        let url = urlBar.value.trim();
        if (url) {
            if (!url.match(/^https?:\/\//)) {
                if (url.includes('.') && !url.includes(' ')) {
                    url = 'https://' + url;
                } else {
                    url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
                }
            }
            chrome.runtime.sendMessage({ action: 'navigate', url });
            closePanel();
        }
    }
    if (e.key === 'Escape') {
        updateUrlBar();
        urlBar.blur();
    }
});

searchEl.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    render();
});

searchEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (searchQuery) {
            searchQuery = '';
            searchEl.value = '';
            render();
        } else {
            closePanel();
        }
    }
    if (e.key === 'Enter' && getFilteredTabs().length > 0) {
        chrome.runtime.sendMessage({ action: 'switch-tab', tabId: getFilteredTabs()[0].id });
        closePanel();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'v') {
        closePanel();
    }
});

newTabBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'new-tab' });
    closePanel();
});

// Debounced tab loading to prevent excessive updates
function debouncedLoadTabs() {
    if (loadTabsTimeout) clearTimeout(loadTabsTimeout);
    loadTabsTimeout = setTimeout(loadTabs, 100);
}

// Listen for tab changes with debouncing
chrome.tabs.onCreated.addListener(debouncedLoadTabs);
chrome.tabs.onRemoved.addListener(debouncedLoadTabs);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // Only update on meaningful changes
    if (changeInfo.title || changeInfo.favIconUrl || changeInfo.status === 'complete') {
        debouncedLoadTabs();
    }
});
chrome.tabs.onActivated.addListener(debouncedLoadTabs);

loadTabs();
searchEl.focus();
