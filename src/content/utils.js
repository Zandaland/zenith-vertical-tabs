// Utility functions for the extension
import { state } from './state.js';

// Check if extension context is still valid
export function isExtensionValid() {
    try {
        return chrome && chrome.runtime && chrome.runtime.id;
    } catch {
        return false;
    }
}

// Send message to background script
export function sendMessage(message) {
    return new Promise((resolve) => {
        if (!isExtensionValid()) {
            resolve(null);
            return;
        }
        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    resolve(null);
                    return;
                }
                resolve(response);
            });
        } catch {
            resolve(null);
        }
    });
}

// Extract domain from URL
export function getDomain(url) {
    if (!url) return '';
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return '';
    }
}

// Get display title for a tab
export function getDisplayTitle(tab) {
    const url = tab.url || '';
    const title = tab.title || '';
    if (url.startsWith('chrome://newtab') || url === 'chrome://new-tab-page/') return 'New Tab';
    if (url.startsWith('chrome://extensions')) return 'Extensions';
    if (url.startsWith('chrome://settings')) return 'Settings';
    if (url.startsWith('chrome://')) return url.replace('chrome://', '').split('/')[0];
    if (!title || title === url) return getDomain(url) || 'New Tab';
    return title;
}

// Escape HTML to prevent XSS
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Get filtered tabs based on search query
export function getFilteredTabs() {
    if (!state.searchQuery) return state.tabs;
    const q = state.searchQuery.toLowerCase();
    return state.tabs.filter(tab =>
        (tab.title || '').toLowerCase().includes(q) ||
        (tab.url || '').toLowerCase().includes(q)
    );
}
