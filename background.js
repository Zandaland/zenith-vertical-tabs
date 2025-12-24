// Background service worker for Zenith Vertical Tabs extension

let panelWindowId = null;
let mainWindowId = null;
let notifyTimeout = null;
const tabSnapshots = {}; // Cache for tab snapshots
let captureTimeout = null;

// Helper to get favicon URL with Google fallback
function getFaviconUrl(url) {
    if (!url) return '';
    try {
        const parsedUrl = new URL(url);
        // For chrome:// and extension pages, return empty (content script handles fallback)
        if (parsedUrl.protocol === 'chrome:' || parsedUrl.protocol === 'chrome-extension:') {
            return '';
        }
        return `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`;
    } catch {
        return '';
    }
}

function isRestrictedPage(url) {
    if (!url) return true;
    return url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('about:') ||
        url.startsWith('edge://') ||
        url.startsWith('brave://');
}

async function openPanelWindow(windowId) {
    if (windowId) {
        mainWindowId = windowId;
    } else {
        try {
            const currentWindow = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
            mainWindowId = currentWindow.id;
        } catch (e) {
            return;
        }
    }

    if (panelWindowId) {
        try {
            await chrome.windows.remove(panelWindowId);
            panelWindowId = null;
        } catch {
            panelWindowId = null;
        }
    }

    const currentWindow = await chrome.windows.get(mainWindowId);
    const panelWidth = 300;
    const panelHeight = Math.min(700, currentWindow.height - 100);

    const panel = await chrome.windows.create({
        url: 'panel.html',
        type: 'popup',
        width: panelWidth,
        height: panelHeight,
        left: currentWindow.left + 10,
        top: currentWindow.top + 50,
        focused: true
    });

    panelWindowId = panel.id;
}

chrome.windows.onFocusChanged.addListener((windowId) => {
    if (panelWindowId && windowId !== panelWindowId && windowId !== chrome.windows.WINDOW_ID_NONE) {
        chrome.windows.remove(panelWindowId).catch(() => { });
        panelWindowId = null;
    }
});

chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        // First time install
        await chrome.storage.local.set({ onboardingShown: false });

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab && isRestrictedPage(tab.url)) {
            // If on a restricted page, open Google to show onboarding
            chrome.tabs.create({ url: 'https://www.google.com', active: true });
        } else if (tab) {
            // If on a regular page, try to show it there (might require a refresh, but we'll try)
            chrome.tabs.sendMessage(tab.id, { action: 'show-onboarding' }).catch(() => {
                // If message fails (content script not injected yet), suggest a reload? 
                // Or just open Google anyway for a guaranteed experience.
                chrome.tabs.create({ url: 'https://www.google.com', active: true });
            });
        } else {
            // No tab found? Open Google as fallback
            chrome.tabs.create({ url: 'https://www.google.com', active: true });
        }
    }
});

chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-sidebar') {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (activeTab && isRestrictedPage(activeTab.url)) {
            openPanelWindow(activeTab.windowId);
        } else if (activeTab) {
            chrome.tabs.sendMessage(activeTab.id, { action: 'toggle-sidebar' }).catch(() => { });
        }
    }

    if (command === 'open-url-bar') {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && !activeTab.url.startsWith('chrome://') && !activeTab.url.startsWith('edge://') && !activeTab.url.startsWith('about:')) {
            chrome.tabs.sendMessage(activeTab.id, {
                action: 'open-url-modal',
                mode: 'new-tab',
                currentUrl: ''
            }).catch(() => {
                // Fallback if content script fails to respond
                chrome.tabs.create({ windowId: activeTab.windowId });
            });
        } else {
            // On restricted pages, just open a new tab
            chrome.tabs.create({ windowId: activeTab?.windowId });
        }
    }

    if (command === 'edit-url-bar') {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && !activeTab.url.startsWith('chrome://') && !activeTab.url.startsWith('edge://') && !activeTab.url.startsWith('about:')) {
            chrome.tabs.sendMessage(activeTab.id, {
                action: 'open-url-modal',
                mode: 'current-tab',
                currentUrl: activeTab.url
            }).catch(() => { });
        }
    }
});

// Get all tabs with groups info
async function getAllTabsWithGroups(windowId) {
    let targetWindowId = windowId;

    // If no windowId provided or it's the panel window, try to get current focused normal window
    if (!targetWindowId || (panelWindowId && targetWindowId === panelWindowId)) {
        try {
            const lastFocused = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
            targetWindowId = lastFocused.id;
        } catch (e) {
            targetWindowId = mainWindowId;
        }
    }

    const tabs = await chrome.tabs.query({ windowId: targetWindowId });

    let groups = [];
    try {
        // tabGroups.query uses windowId directly
        if (targetWindowId) {
            groups = await chrome.tabGroups.query({ windowId: targetWindowId });
        } else {
            // Get groups from current window
            const currentWindow = await chrome.windows.getCurrent();
            groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
        }
    } catch (e) {
        // Try to get all groups as fallback
        try {
            groups = await chrome.tabGroups.query({});
        } catch (e2) { }
    }

    const groupMap = {};
    groups.forEach(g => {
        groupMap[g.id] = {
            id: g.id,
            title: g.title || '',
            color: g.color,
            collapsed: g.collapsed
        };
    });

    return {
        tabs: tabs.map(tab => ({
            id: tab.id,
            index: tab.index,
            title: tab.title || 'New Tab',
            url: tab.url,
            // Use tab's favicon if available, otherwise use Google's favicon service
            favIconUrl: tab.favIconUrl || getFaviconUrl(tab.url),
            active: tab.active,
            pinned: tab.pinned,
            groupId: tab.groupId,
            audible: tab.audible,
            mutedInfo: tab.mutedInfo,
            discarded: tab.discarded,
            status: tab.status,
            width: tab.width // Important for aspect ratio if we need it
        })),
        groups: groupMap
    };
}

async function captureSnapshot(windowId) {
    if (captureTimeout) clearTimeout(captureTimeout);
    captureTimeout = setTimeout(async () => {
        try {
            // If no windowId provided, get current focused
            let targetWindowId = windowId;
            if (!targetWindowId) {
                const win = await chrome.windows.getLastFocused();
                targetWindowId = win.id;
            }

            const [activeTab] = await chrome.tabs.query({ active: true, windowId: targetWindowId });
            if (activeTab && !isRestrictedPage(activeTab.url) && activeTab.status === 'complete') {
                const dataUrl = await chrome.tabs.captureVisibleTab(targetWindowId, { format: 'jpeg', quality: 40 });
                tabSnapshots[activeTab.id] = dataUrl;
            }
        } catch (e) {
            // Capture failed (minimized, restricted page, etc)
        }
    }, 1000); // 1s delay to ensure page is settled
}

// Capture current active tab on startup
chrome.windows.getLastFocused({ populate: true }, (window) => {
    if (window && window.id) {
        captureSnapshot(window.id);
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Determine the windowId for the request
    // 1. Explicitly in request
    // 2. From the sender's tab
    // 3. Fallback to mainWindowId (mostly for panel/popup)
    let windowId = request.windowId || sender.tab?.windowId || mainWindowId;

    // Special handling for the fallback panel
    const isFromPanel = sender.url && sender.url.includes('panel.html');
    if (isFromPanel && !request.windowId) {
        windowId = mainWindowId;
    }

    if (request.action === 'get-tabs') {
        getAllTabsWithGroups(windowId).then(data => sendResponse(data));
        return true;
    }

    if (request.action === 'get-windows') {
        chrome.windows.getAll({ populate: false, windowTypes: ['normal'] }, (windows) => {
            sendResponse({ windows });
        });
        return true;
    }

    if (request.action === 'get-tab-preview') {
        const snapshot = tabSnapshots[request.tabId] || null;
        sendResponse({ snapshot });
        return true;
    }

    if (request.action === 'get-suggestions') {
        (async () => {
            const query = (request.query || '').toLowerCase().trim();
            let suggestions = [];

            function getFaviconUrl(url) {
                try {
                    const domain = new URL(url).hostname;
                    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
                } catch {
                    return null;
                }
            }

            if (!query) {
                // Show top sites when no query
                try {
                    const topSites = await chrome.topSites.get();
                    suggestions = topSites.slice(0, 8).map(site => ({
                        title: site.title || site.url,
                        url: site.url,
                        favicon: getFaviconUrl(site.url),
                        isSearch: false,
                        type: 'top-site'
                    }));
                } catch (e) { }
            } else {
                // 1. Search Open Tabs
                try {
                    const allTabs = await chrome.tabs.query({ windowId: windowId });
                    const matchingTabs = allTabs.filter(tab =>
                        (tab.title || '').toLowerCase().includes(query) ||
                        (tab.url || '').toLowerCase().includes(query)
                    );

                    matchingTabs.forEach(tab => {
                        suggestions.push({
                            title: tab.title || tab.url,
                            url: tab.url,
                            favicon: tab.favIconUrl || getFaviconUrl(tab.url),
                            isSearch: false,
                            isTab: true,
                            tabId: tab.id,
                            score: 100 // Highest priority
                        });
                    });
                } catch (e) { }

                // 2. Search History
                try {
                    const historyItems = await chrome.history.search({
                        text: query,
                        maxResults: 50,
                        startTime: Date.now() - (90 * 24 * 60 * 60 * 1000) // Last 90 days
                    });

                    historyItems.forEach(item => {
                        let score = 0;
                        const urlLower = item.url.toLowerCase();
                        const titleLower = (item.title || '').toLowerCase();

                        try {
                            const urlObj = new URL(item.url);
                            const hostname = urlObj.hostname.replace('www.', '');
                            const isHomepage = urlObj.pathname === '/' || urlObj.pathname === '';

                            // Boost score if query matches the domain precisely
                            if (hostname === query || hostname === query + '.com' || hostname === query + '.org' || hostname === query + '.net') {
                                score += 80;
                            } else if (hostname.includes(query)) {
                                score += 50;
                            }

                            // Boost if it's a homepage
                            if (isHomepage) {
                                score += 20;
                            }

                            // Boost if query is at the start of title or domain
                            if (titleLower.startsWith(query) || hostname.startsWith(query)) {
                                score += 15;
                            }

                            // Standard history relevance (visit count boost)
                            score += Math.min((item.visitCount || 0) * 2, 20);

                        } catch (e) {
                            if (urlLower.includes(query)) score += 10;
                        }

                        // Remove duplicates (prefer tab or existing suggestion)
                        if (!suggestions.some(s => s.url === item.url)) {
                            suggestions.push({
                                title: item.title || item.url,
                                url: item.url,
                                favicon: getFaviconUrl(item.url),
                                isSearch: false,
                                score: score
                            });
                        }
                    });
                } catch (e) { }

                // Sort suggestions by score
                suggestions.sort((a, b) => (b.score || 0) - (a.score || 0));

                // Limit result set
                suggestions = suggestions.slice(0, 8);

                // Add Google search option if it's not a clear URL
                const isLikelyUrl = query.includes('.') && !query.includes(' ');
                suggestions.push({
                    title: `Search Google for "${query}"`,
                    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                    favicon: null,
                    isSearch: true,
                    score: -1 // Always last
                });
            }

            sendResponse({ suggestions });
        })();
        return true;
    }

    if (request.action === 'switch-tab') {
        chrome.tabs.update(request.tabId, { active: true });
        chrome.tabs.get(request.tabId, (tab) => {
            if (tab && tab.windowId) {
                chrome.windows.update(tab.windowId, { focused: true });
            }
        });
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'close-tab') {
        chrome.tabs.remove(request.tabId);
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'new-tab') {
        chrome.tabs.create({ windowId: windowId });
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'new-tab-url') {
        chrome.tabs.create({ url: request.url, windowId: windowId });
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'pin-tab') {
        chrome.tabs.update(request.tabId, { pinned: request.pinned });
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'mute-tab') {
        chrome.tabs.update(request.tabId, { muted: request.muted });
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'duplicate-tab') {
        chrome.tabs.duplicate(request.tabId);
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'new-tab-right') {
        chrome.tabs.get(request.tabId, (tab) => {
            chrome.tabs.create({ windowId: tab.windowId, index: tab.index + 1 });
            sendResponse({ success: true });
        });
        return true;
    }

    if (request.action === 'close-other-tabs') {
        chrome.tabs.get(request.tabId, (tab) => {
            chrome.tabs.query({ windowId: tab.windowId }, (tabs) => {
                const tabIdsToRemove = tabs.filter(t => t.id !== tab.id && !t.pinned).map(t => t.id);
                chrome.tabs.remove(tabIdsToRemove);
                sendResponse({ success: true });
            });
        });
        return true;
    }

    if (request.action === 'close-tabs-to-right') {
        chrome.tabs.get(request.tabId, (tab) => {
            chrome.tabs.query({ windowId: tab.windowId }, (tabs) => {
                const tabIdsToRemove = tabs.filter(t => t.index > tab.index && !t.pinned).map(t => t.id);
                chrome.tabs.remove(tabIdsToRemove);
                sendResponse({ success: true });
            });
        });
        return true;
    }

    if (request.action === 'move-tab-to-new-window') {
        chrome.windows.create({ tabId: request.tabId });
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'move-tab-to-window') {
        chrome.tabs.move(request.tabId, { windowId: request.windowId, index: -1 });
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'discard-tab') {
        chrome.tabs.discard(request.tabId);
        sendResponse({ success: true });
        return true;
    }

    // Navigation actions
    if (request.action === 'go-back') {
        chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
            if (tabs[0]) chrome.tabs.goBack(tabs[0].id);
        });
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'go-forward') {
        chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
            if (tabs[0]) chrome.tabs.goForward(tabs[0].id);
        });
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'reload') {
        chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
            if (tabs[0]) chrome.tabs.reload(tabs[0].id);
        });
        sendResponse({ success: true });
        return true;
    }

    // Reload a specific tab by ID
    if (request.action === 'reload-tab') {
        chrome.tabs.reload(request.tabId);
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'go-home') {
        chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
            if (tabs[0]) chrome.tabs.update(tabs[0].id, { url: 'chrome://newtab' });
        });
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'navigate') {
        const tabIdToUpdate = request.tabId || (sender.tab ? sender.tab.id : null);
        if (tabIdToUpdate) {
            chrome.tabs.update(tabIdToUpdate, { url: request.url });
        } else {
            chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
                if (tabs[0]) chrome.tabs.update(tabs[0].id, { url: request.url });
            });
        }
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'close-panel') {
        if (panelWindowId) {
            chrome.windows.remove(panelWindowId).catch(() => { });
            panelWindowId = null;
        }
        sendResponse({ success: true });
        return true;
    }

    // Move tab to a new position (drag & drop)
    if (request.action === 'move-tab') {
        chrome.tabs.move(request.tabId, { index: request.newIndex });
        sendResponse({ success: true });
        return true;
    }

    // Add tab to existing group
    if (request.action === 'add-to-group') {
        chrome.tabs.group({ tabIds: request.tabId, groupId: request.groupId });
        sendResponse({ success: true });
        return true;
    }

    // Remove tab from its group
    if (request.action === 'remove-from-group') {
        chrome.tabs.ungroup(request.tabId);
        sendResponse({ success: true });
        return true;
    }

    // Create a new group with the active tab
    if (request.action === 'create-group') {
        (async () => {
            const [activeTab] = await chrome.tabs.query({ active: true, windowId: windowId });
            if (activeTab) {
                const groupId = await chrome.tabs.group({ tabIds: activeTab.id });
                await chrome.tabGroups.update(groupId, {
                    title: request.name,
                    color: request.color
                });
            }
            sendResponse({ success: true });
        })();
        return true;
    }

    // Create a new group with a specific tab
    if (request.action === 'create-group-with-tab') {
        (async () => {
            const groupId = await chrome.tabs.group({ tabIds: request.tabId });
            await chrome.tabGroups.update(groupId, {
                title: request.name,
                color: request.color
            });
            sendResponse({ success: true });
        })();
        return true;
    }

    // Close all tabs in a group (delete group)
    if (request.action === 'close-group') {
        (async () => {
            const allTabs = await chrome.tabs.query({ windowId: windowId });
            const groupTabs = allTabs.filter(t => t.groupId === request.groupId);
            if (groupTabs.length > 0) {
                await chrome.tabs.remove(groupTabs.map(t => t.id));
            }
            sendResponse({ success: true });
        })();
        return true;
    }

    if (request.action === 'new-tab-in-group') {
        (async () => {
            const newTab = await chrome.tabs.create({ windowId: windowId });
            await chrome.tabs.group({ tabIds: newTab.id, groupId: request.groupId });
            sendResponse({ success: true, tabId: newTab.id });
        })();
        return true;
    }

    if (request.action === 'move-group-to-new-window') {
        (async () => {
            const allTabs = await chrome.tabs.query({ windowId: windowId });
            const groupTabs = allTabs.filter(t => t.groupId === request.groupId);
            if (groupTabs.length > 0) {
                const tabIds = groupTabs.map(t => t.id);
                const newWindow = await chrome.windows.create({ tabId: tabIds[0] });
                if (tabIds.length > 1) {
                    await chrome.tabs.move(tabIds.slice(1), { windowId: newWindow.id, index: -1 });
                }
                // Grouping is window-specific, so we might need to regroup in the new window
                // But chrome.windows.create with tabId might preserve group if it's the only tab?
                // Actually moving more tabs to the new window will ungroup them unless we regroup.
                const newGroupId = await chrome.tabs.group({ tabIds, windowId: newWindow.id });
                // Note: Title and color are not automatically preserved across windows easily in some versions, 
                // but let's try to set them.
                const group = await chrome.tabGroups.get(request.groupId);
                if (group) {
                    await chrome.tabGroups.update(newGroupId, { title: group.title, color: group.color });
                }
            }
            sendResponse({ success: true });
        })();
        return true;
    }

    if (request.action === 'refresh-all-tabs') {
        chrome.tabs.query({ windowId: windowId }, (tabs) => {
            tabs.forEach(tab => {
                // Don't refresh the current onboarding tab
                if (tab.id !== sender.tab.id && !isRestrictedPage(tab.url)) {
                    chrome.tabs.reload(tab.id);
                }
            });
        });
        sendResponse({ success: true });
        return true;
    }
});

// Debounced notification to prevent excessive updates
function debouncedNotifyTabChange(windowId) {
    if (notifyTimeout) clearTimeout(notifyTimeout);
    notifyTimeout = setTimeout(() => {
        notifyTabChange(windowId);
    }, 16);
}

function notifyTabChange(windowId) {
    if (windowId) {
        // Notify specific window
        getAllTabsWithGroups(windowId).then(data => {
            chrome.tabs.query({ windowId: windowId }, (allTabs) => {
                allTabs.forEach(tab => {
                    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'tabs-updated',
                            ...data
                        }).catch(() => { });
                    }
                });
            });
        });
    } else {
        // Fallback: Notify all windows
        chrome.windows.getAll({ populate: false }, (windows) => {
            windows.forEach(win => notifyTabChange(win.id));
        });
    }
}

// Use debounced version for all tab events
chrome.tabs.onCreated.addListener((tab) => debouncedNotifyTabChange(tab.windowId));
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => debouncedNotifyTabChange(removeInfo.windowId));
chrome.tabs.onMoved.addListener((tabId, moveInfo) => debouncedNotifyTabChange(moveInfo.windowId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only trigger on meaningful UI changes
    const hasMeaningfulChange =
        changeInfo.title !== undefined ||
        changeInfo.favIconUrl !== undefined ||
        changeInfo.status === 'complete' ||
        changeInfo.pinned !== undefined ||
        changeInfo.groupId !== undefined ||
        changeInfo.audible !== undefined ||
        changeInfo.mutedInfo !== undefined;

    if (hasMeaningfulChange) {
        debouncedNotifyTabChange(tab.windowId);
    }

    if (changeInfo.status === 'complete' && tab.active) {
        captureSnapshot(tab.windowId);
    }
});
chrome.tabs.onActivated.addListener((activeInfo) => {
    notifyTabChange(activeInfo.windowId);
    captureSnapshot(activeInfo.windowId);
});

try {
    chrome.tabGroups.onCreated.addListener((group) => debouncedNotifyTabChange(group.windowId));
    chrome.tabGroups.onRemoved.addListener((group) => debouncedNotifyTabChange(group.windowId));
    chrome.tabGroups.onUpdated.addListener((group) => debouncedNotifyTabChange(group.windowId));
} catch (e) { }
