// Context menu functionality
import { state, elements } from './state.js';
import { sendMessage, escapeHtml } from './utils.js';
import { icons, groupColors } from './icons.js';
import { openUrlModal, openGroupModal } from './modals.js';

// Hide context menu
export function hideContextMenu() {
    if (state.contextMenu) {
        state.contextMenu.remove();
        state.contextMenu = null;
    }
}

// Show context menu for a tab
export async function showContextMenu(e, tabId) {
    e.preventDefault();
    hideContextMenu();

    const tab = state.tabs.find(t => t.id === tabId);
    if (!tab) return;

    state.contextMenu = document.createElement('div');
    state.contextMenu.className = 'vt-context-menu';

    const existingGroups = Object.values(state.groups);
    const isInGroup = tab.groupId && tab.groupId !== -1;

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

    state.contextMenu.innerHTML = `
      <div class="vt-context-item" data-action="new-tab-modal">${icons.plus}<span>New tab to the bottom</span></div>
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

    state.contextMenu.style.left = `${Math.min(e.clientX, window.innerWidth - 200)}px`;
    state.contextMenu.style.top = `${Math.min(e.clientY, window.innerHeight - 400)}px`;
    elements.container.appendChild(state.contextMenu);

    state.contextMenu.querySelectorAll('.vt-context-item').forEach(item => {
        item.addEventListener('click', (evt) => {
            if (item.classList.contains('vt-context-submenu')) return;
            evt.stopPropagation();

            const action = item.dataset.action;

            if (action === 'new-tab-modal') {
                hideContextMenu();
                openUrlModal('new-tab');
                return;
            }
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
                state.pendingGroupTabId = tabId;
                hideContextMenu();
                openGroupModal();
                return;
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

// Show context menu for a group header
export function showGroupContextMenu(e, groupId) {
    e.preventDefault();
    e.stopPropagation();
    hideContextMenu();

    state.contextMenu = document.createElement('div');
    state.contextMenu.className = 'vt-context-menu';
    state.contextMenu.innerHTML = `
        <div class="vt-context-item" data-action="new-tab-in-group">${icons.plus}<span>New tab in group</span></div>
        <div class="vt-context-divider"></div>
        <div class="vt-context-item" data-action="ungroup">${icons.ungroup}<span>Ungroup</span></div>
        <div class="vt-context-divider"></div>
        <div class="vt-context-item" data-action="move-group-to-new-window">${icons.externalLink}<span>Move group to new window</span></div>
        <div class="vt-context-item" data-action="close-group">${icons.x}<span>Close group</span></div>
    `;

    state.contextMenu.style.left = `${Math.min(e.clientX, window.innerWidth - 200)}px`;
    state.contextMenu.style.top = `${Math.min(e.clientY, window.innerHeight - 200)}px`;
    elements.container.appendChild(state.contextMenu);

    state.contextMenu.querySelector('[data-action="new-tab-in-group"]').addEventListener('click', () => {
        sendMessage({ action: 'new-tab' }).then(() => {
            sendMessage({ action: 'new-tab-in-group', groupId });
        });
        hideContextMenu();
    });

    state.contextMenu.querySelector('[data-action="ungroup"]').addEventListener('click', () => {
        const groupTabs = state.tabs.filter(t => t.groupId === groupId);
        groupTabs.forEach(t => sendMessage({ action: 'remove-from-group', tabId: t.id }));
        hideContextMenu();
    });

    state.contextMenu.querySelector('[data-action="move-group-to-new-window"]').addEventListener('click', () => {
        sendMessage({ action: 'move-group-to-new-window', groupId });
        hideContextMenu();
    });

    state.contextMenu.querySelector('[data-action="close-group"]').addEventListener('click', () => {
        sendMessage({ action: 'close-group', groupId });
        hideContextMenu();
    });
}

// Setup container click listener to hide context menu
export function setupContextMenuListener() {
    elements.container.addEventListener('click', (e) => {
        if (state.contextMenu && !state.contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });
}
