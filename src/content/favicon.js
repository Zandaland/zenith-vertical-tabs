// Favicon handling utilities
import { icons, chromePageIcons } from './icons.js';

// Get Google's favicon service URL for a domain
export function getGoogleFaviconUrl(url) {
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

// Get icon for chrome:// pages
export function getChromePageIcon(url) {
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

// Get fallback icon for a URL
export function getFallbackIcon(url) {
    const chromeIcon = getChromePageIcon(url);
    if (chromeIcon) return chromeIcon;

    if (url && (url.startsWith('chrome://') || url.startsWith('chrome-extension://'))) {
        return `data:image/svg+xml,${encodeURIComponent(icons.file.replace('currentColor', '#666'))}`;
    }
    return `data:image/svg+xml,${encodeURIComponent(icons.globe.replace('currentColor', '#666'))}`;
}

// Get best available favicon URL
export function getBestFavicon(tab) {
    const chromeIcon = getChromePageIcon(tab.url);
    if (chromeIcon) return chromeIcon;

    if (tab.favIconUrl && tab.favIconUrl.length > 0) {
        return tab.favIconUrl;
    }
    const googleFavicon = getGoogleFaviconUrl(tab.url);
    if (googleFavicon) {
        return googleFavicon;
    }
    return getFallbackIcon(tab.url);
}
