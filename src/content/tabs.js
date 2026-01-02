// Tab rendering and event listeners
import { state, elements } from './state.js';
import { sendMessage, escapeHtml, getDisplayTitle, getDomain, getFilteredTabs } from './utils.js';
import { icons } from './icons.js';
import { getBestFavicon, getFallbackIcon } from './favicon.js';
import { showContextMenu, showGroupContextMenu } from './context-menu.js';

// Clear active states from tabs
export function clearActiveStates() {
    elements.tabList.querySelectorAll('.vt-tab.vt-tab-active, .vt-pinned-tab.active').forEach(active => {
        active.classList.remove('vt-tab-active');
        active.classList.remove('active');
    });
}

// Fetch tabs from background
export async function fetchTabs() {
    const response = await sendMessage({ action: 'get-tabs' });
    if (response) {
        state.tabs = response.tabs || [];
        state.groups = response.groups || {};
        renderTabs();
    }
}

// Update tab preview
export function updateTabPreview(tab, x, y) {
    if (!tab || !elements.tabPreview) return;

    const title = getDisplayTitle(tab);
    const url = tab.url || '';
    const favicon = getBestFavicon(tab);
    const fallback = getFallbackIcon(url);

    let badgesHtml = '';
    if (tab.audible) {
        badgesHtml += `<div class="vt-preview-badge">${tab.mutedInfo?.muted ? icons.muted : icons.volume} Audio Playing</div>`;
    }
    if (tab.discarded) {
        badgesHtml += `<div class="vt-preview-badge">💤 Suspended</div>`;
    }

    elements.tabPreview.innerHTML = `
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

    sendMessage({ action: 'get-tab-preview', tabId: tab.id }).then(response => {
        if (response && response.snapshot) {
            const imgContainer = elements.tabPreview.querySelector('#vt-preview-image-container');
            if (imgContainer) {
                imgContainer.innerHTML = `<img class="vt-preview-snapshot" src="${response.snapshot}">`;
            }
        }
    });

    const sidebarRect = elements.sidebar.getBoundingClientRect();
    let left = sidebarRect.right + 10;
    let top = y - 20;

    const previewRect = elements.tabPreview.getBoundingClientRect();
    if (top + (previewRect.height || 100) > window.innerHeight) {
        top = window.innerHeight - (previewRect.height || 100) - 10;
    }

    elements.tabPreview.style.top = `${top}px`;
    elements.tabPreview.style.left = `${left}px`;
    elements.tabPreview.classList.add('visible');
}

// Hide tab preview
export function hideTabPreview() {
    if (elements.tabPreview) {
        elements.tabPreview.classList.remove('visible');
    }
}

// Render pinned tabs
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

// Render a single tab item
function renderTabItem(tab) {
    const title = getDisplayTitle(tab);
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

// Render a group
function renderGroup(group, groupTabs) {
    const isCollapsed = state.collapsedGroups.has(group.id);
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
export function debouncedRenderTabs() {
    if (state.renderTimeout) return;
    state.renderTimeout = requestAnimationFrame(() => {
        try {
            renderTabs();
        } finally {
            state.renderTimeout = null;
        }
    });
}

// Clear all drop indicators and drag-related classes
function clearDropIndicators() {
    elements.tabList.querySelectorAll('.drag-over, .drag-over-below, .drag-target, .drop-target-group').forEach(el => {
        el.classList.remove('drag-over', 'drag-over-below', 'drag-target', 'drop-target-group');
        el.style.background = '';
    });
    state.dropTarget = null;
    state.dropPosition = null;
}

// Render all tabs
export function renderTabs(openGroupModal = null) {
    const filtered = getFilteredTabs();

    const currentData = {
        tabs: state.tabs.map(t => ({
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
        groups: state.groups,
        searchQuery: state.searchQuery,
        collapsed: Array.from(state.collapsedGroups)
    };

    if (state.lastRenderedData && JSON.stringify(state.lastRenderedData) === JSON.stringify(currentData)) {
        return;
    }

    if (state.lastRenderedData) {
        const prev = state.lastRenderedData;
        const next = currentData;

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
                const el = elements.tabList.querySelector(`[data-tab-id="${tab.id}"]`);

                if (el) {
                    const isPinned = el.classList.contains('vt-pinned-tab');
                    const activeClass = isPinned ? 'active' : 'vt-tab-active';

                    // Always trust the authoritative active state from Chrome
                    if (tab.active) el.classList.add(activeClass);
                    else el.classList.remove(activeClass);

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
                state.lastRenderedData = currentData;
                return;
            }
        }
    }

    state.lastRenderedData = currentData;

    if (filtered.length === 0) {
        elements.tabList.innerHTML = `<div class="vt-empty">${state.searchQuery ? 'No matching tabs' : 'No tabs'}</div>`;
        return;
    }

    const pinnedTabs = filtered.filter(t => t.pinned);
    const unpinnedTabs = filtered.filter(t => !t.pinned);

    const groupedTabs = {};
    const ungroupedTabs = [];

    unpinnedTabs.forEach(tab => {
        const hasGroup = tab.groupId !== undefined && tab.groupId !== null && tab.groupId !== -1 && state.groups[tab.groupId];
        if (hasGroup) {
            if (!groupedTabs[tab.groupId]) groupedTabs[tab.groupId] = [];
            groupedTabs[tab.groupId].push(tab);
        } else {
            ungroupedTabs.push(tab);
        }
    });

    let html = renderPinnedTabs(pinnedTabs);

    Object.keys(groupedTabs).forEach(groupId => {
        const group = state.groups[groupId] || state.groups[parseInt(groupId)];
        if (group) {
            html += renderGroup(group, groupedTabs[groupId]);
        }
    });

    if (ungroupedTabs.length > 0) {
        html += ungroupedTabs.map(renderTabItem).join('');
    }

    elements.tabList.innerHTML = html;
    attachEventListeners(openGroupModal);
}

// Attach event listeners to rendered tabs
function attachEventListeners(openGroupModal) {
    // Pinned tabs
    elements.tabList.querySelectorAll('.vt-pinned-tab').forEach(el => {
        el.addEventListener('click', () => {
            const tabId = parseInt(el.dataset.tabId);
            sendMessage({ action: 'switch-tab', tabId });
        });

        el.addEventListener('mouseenter', () => {
            if (state.draggedTabId !== null) return;
            const tabId = parseInt(el.dataset.tabId);
            const tab = state.tabs.find(t => t.id === tabId);
            if (tab) {
                if (tab.active) return;
                if (state.previewTimeout) clearTimeout(state.previewTimeout);
                state.previewTimeout = setTimeout(() => {
                    const rect = el.getBoundingClientRect();
                    updateTabPreview(tab, rect.right, rect.top);
                }, 1500);
            }
        });

        el.addEventListener('mouseleave', () => {
            if (state.previewTimeout) clearTimeout(state.previewTimeout);
            hideTabPreview();
        });

        el.addEventListener('contextmenu', (e) => showContextMenu(e, parseInt(el.dataset.tabId)));
    });

    // Regular tabs
    elements.tabList.querySelectorAll('.vt-tab').forEach(el => {
        el.addEventListener('click', (e) => {
            if (!e.target.closest('.vt-close') && !e.target.closest('.vt-badge') && !e.target.closest('.vt-favicon-refresh')) {
                const tabId = parseInt(el.dataset.tabId);
                sendMessage({ action: 'switch-tab', tabId });
            }
        });

        el.addEventListener('mouseenter', () => {
            if (state.draggedTabId !== null) return;
            const tabId = parseInt(el.dataset.tabId);
            const tab = state.tabs.find(t => t.id === tabId);
            if (tab) {
                if (tab.active) return;
                if (state.previewTimeout) clearTimeout(state.previewTimeout);
                state.previewTimeout = setTimeout(() => {
                    const rect = el.getBoundingClientRect();
                    updateTabPreview(tab, rect.right, rect.top);
                }, 1500);
            }
        });

        el.addEventListener('mouseleave', () => {
            if (state.previewTimeout) clearTimeout(state.previewTimeout);
            hideTabPreview();
        });

        el.addEventListener('contextmenu', (e) => showContextMenu(e, parseInt(el.dataset.tabId)));

        // Drag and drop handlers
        el.addEventListener('dragstart', (e) => {
            const tabId = parseInt(el.dataset.tabId);
            const tab = state.tabs.find(t => t.id === tabId);

            state.draggedTabId = tabId;
            state.draggedElement = el;
            state.draggedFromGroupId = tab?.groupId ?? null;

            // Add dragging class after a tiny delay so the ghost looks right
            requestAnimationFrame(() => {
                el.classList.add('dragging');
            });

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', tabId.toString());

            // Create custom drag image
            const ghost = document.createElement('div');
            ghost.className = 'vt-drag-ghost';
            ghost.innerHTML = `
                <img src="${getBestFavicon(tab)}" onerror="this.style.display='none'" alt="">
                <span>${getDisplayTitle(tab)}</span>
            `;
            ghost.style.position = 'absolute';
            ghost.style.top = '-1000px';
            elements.shadow.appendChild(ghost);

            // Use the ghost as drag image
            e.dataTransfer.setDragImage(ghost, 20, 20);

            // Remove ghost after drag starts
            setTimeout(() => ghost.remove(), 0);
        });

        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            clearDropIndicators();
            state.draggedTabId = null;
            state.draggedElement = null;
            state.draggedFromGroupId = null;
        });

        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            if (state.draggedElement === el) return;

            const rect = el.getBoundingClientRect();
            const offsetY = e.clientY - rect.top;
            const threshold = rect.height * 0.4; // 40% from top/bottom for above/below

            clearDropIndicators();

            if (offsetY < threshold) {
                el.classList.add('drag-over');
                state.dropPosition = 'above';
            } else if (offsetY > rect.height - threshold) {
                el.classList.add('drag-over', 'drag-over-below');
                state.dropPosition = 'below';
            } else {
                // Middle zone - no indicator, just highlight slightly
                el.classList.add('drag-over');
                state.dropPosition = 'above';
            }
            state.dropTarget = el;
        });

        el.addEventListener('dragleave', (e) => {
            // Only remove if we're actually leaving the element
            if (!el.contains(e.relatedTarget)) {
                el.classList.remove('drag-over', 'drag-over-below');
            }
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (state.draggedTabId === null) return;

            const targetTabId = parseInt(el.dataset.tabId);
            if (state.draggedTabId === targetTabId) {
                clearDropIndicators();
                return;
            }

            const targetTab = state.tabs.find(t => t.id === targetTabId);
            const draggedTab = state.tabs.find(t => t.id === state.draggedTabId);

            if (targetTab) {
                // Calculate new index
                let newIndex = targetTab.index;
                if (state.dropPosition === 'below') newIndex++;

                // If dragged tab is before target, adjust index
                if (draggedTab && draggedTab.index < targetTab.index) {
                    newIndex--;
                }

                // Check if target is in a group - if so, add dragged tab to that group
                const targetGroupId = targetTab.groupId;
                const hasValidGroup = targetGroupId !== undefined && targetGroupId !== null && targetGroupId !== -1;

                if (hasValidGroup && state.draggedFromGroupId !== targetGroupId) {
                    // Moving into a different group
                    sendMessage({ action: 'add-to-group', tabId: state.draggedTabId, groupId: targetGroupId });
                } else if (!hasValidGroup && state.draggedFromGroupId !== null && state.draggedFromGroupId !== -1) {
                    // Moving out of a group to ungrouped area
                    sendMessage({ action: 'remove-from-group', tabId: state.draggedTabId });
                }

                // Move to new position
                sendMessage({ action: 'move-tab', tabId: state.draggedTabId, newIndex: Math.max(0, newIndex) });
            }

            clearDropIndicators();
        });
    });

    // Refresh buttons
    elements.tabList.querySelectorAll('.vt-favicon-refresh').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            sendMessage({ action: 'reload-tab', tabId: parseInt(btn.dataset.tabId) });
        });
    });

    // Close buttons
    elements.tabList.querySelectorAll('.vt-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            sendMessage({ action: 'close-tab', tabId: parseInt(btn.dataset.tabId) });
        });
    });

    // Mute badges
    elements.tabList.querySelectorAll('.vt-badge[data-action="mute"]').forEach(badge => {
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabId = parseInt(badge.dataset.tabId);
            const tab = state.tabs.find(t => t.id === tabId);
            if (tab) {
                sendMessage({ action: 'mute-tab', tabId, muted: !tab.mutedInfo?.muted });
            }
        });
    });

    // Group headers
    elements.tabList.querySelectorAll('.vt-group-header').forEach(el => {
        el.addEventListener('click', () => {
            if (state.draggedTabId !== null) return;
            const groupId = parseInt(el.dataset.groupId);
            if (state.collapsedGroups.has(groupId)) {
                state.collapsedGroups.delete(groupId);
            } else {
                state.collapsedGroups.add(groupId);
            }
            renderTabs(openGroupModal);
        });

        el.addEventListener('contextmenu', (e) => showGroupContextMenu(e, parseInt(el.dataset.groupId)));

        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';

            clearDropIndicators();
            el.classList.add('drag-target');

            // Also highlight the parent group
            const groupEl = el.closest('.vt-group');
            if (groupEl) {
                groupEl.classList.add('drop-target-group');
            }
        });

        el.addEventListener('dragleave', (e) => {
            if (!el.contains(e.relatedTarget)) {
                el.classList.remove('drag-target');
                const groupEl = el.closest('.vt-group');
                if (groupEl && !groupEl.contains(e.relatedTarget)) {
                    groupEl.classList.remove('drop-target-group');
                }
            }
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (state.draggedTabId === null) {
                clearDropIndicators();
                return;
            }

            const groupId = parseInt(el.dataset.groupId);

            // Only add to group if not already in this group
            if (state.draggedFromGroupId !== groupId) {
                sendMessage({ action: 'add-to-group', tabId: state.draggedTabId, groupId });
            }

            clearDropIndicators();
        });
    });

    // Groups (for dropping tabs on the group body)
    elements.tabList.querySelectorAll('.vt-group').forEach(groupEl => {
        groupEl.addEventListener('dragover', (e) => {
            // Let child elements handle their own dragover
            if (e.target.closest('.vt-tab') || e.target.closest('.vt-group-header')) return;

            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            // Don't show indicators if dragging within same group
            if (state.draggedElement && groupEl.contains(state.draggedElement)) return;

            clearDropIndicators();
            groupEl.classList.add('drop-target-group');
            state.dropTarget = groupEl;
        });

        groupEl.addEventListener('dragleave', (e) => {
            if (!groupEl.contains(e.relatedTarget)) {
                groupEl.classList.remove('drop-target-group', 'drag-over', 'drag-over-below');
            }
        });

        groupEl.addEventListener('drop', (e) => {
            // Let child elements handle their own drop
            if (e.target.closest('.vt-tab') || e.target.closest('.vt-group-header')) return;

            e.preventDefault();
            e.stopPropagation();

            if (state.draggedTabId === null) {
                clearDropIndicators();
                return;
            }

            const groupId = parseInt(groupEl.dataset.groupId);

            // Add tab to this group if not already in it
            if (state.draggedFromGroupId !== groupId) {
                sendMessage({ action: 'add-to-group', tabId: state.draggedTabId, groupId });
            }

            clearDropIndicators();
        });
    });
}
