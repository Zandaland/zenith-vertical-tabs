// Sidebar visibility and pin functionality
import { state, elements } from './state.js';
import { sendMessage } from './utils.js';
import { icons } from './icons.js';

// Load pinned state from storage
export async function loadPinnedState() {
    try {
        const result = await chrome.storage.local.get('sidebarPinned');
        state.isPinned = result.sidebarPinned || false;
        updatePinButton();
        if (state.isPinned) {
            elements.sidebar.classList.add('vt-no-transition');
            expand();
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    elements.sidebar.classList.remove('vt-no-transition');
                });
            });
        }
    } catch (e) { }
}

// Save pinned state to storage
export async function savePinnedState() {
    try {
        await chrome.storage.local.set({ sidebarPinned: state.isPinned });
    } catch (e) { }
}

// Update pin button appearance
export function updatePinButton() {
    if (!elements.pinBtn) return;
    elements.pinBtn.innerHTML = state.isPinned ? icons.pinFilled : icons.pin;
    elements.pinBtn.style.color = state.isPinned ? '#fff' : '';
}

// Expand sidebar
export function expand() {
    if (state.isExpanded) return;
    state.isExpanded = true;
    elements.sidebar.classList.add('vt-expanded');
}

// Collapse sidebar
export function collapse() {
    if (!state.isExpanded || state.isPinned) return;
    state.isExpanded = false;
    elements.sidebar.classList.remove('vt-expanded');
    state.searchQuery = '';
    if (elements.searchInput) elements.searchInput.value = '';
}

// Toggle sidebar
export function toggle() {
    if (state.isExpanded) {
        state.isPinned = false;
        state.isExpanded = false;
        elements.sidebar.classList.remove('vt-expanded');
        updatePinButton();
        savePinnedState();
    } else {
        state.isPinned = true;
        updatePinButton();
        savePinnedState();
        expand();
    }
}

// Setup sidebar event listeners
export function setupSidebarListeners(fetchTabs, updateUrlBarDisplay, hideContextMenu) {
    // Pin button
    elements.pinBtn.addEventListener('click', () => {
        state.isPinned = !state.isPinned;
        updatePinButton();
        savePinnedState();
        if (!state.isPinned && !elements.sidebar.matches(':hover')) {
            collapse();
            hideContextMenu();
        }
    });

    // Trigger expand on hover
    elements.trigger.addEventListener('mouseenter', () => {
        expand();
        fetchTabs();
        updateUrlBarDisplay();
    });

    // Collapse on leave
    elements.sidebar.addEventListener('mouseleave', () => {
        setTimeout(() => {
            if (!elements.sidebar.matches(':hover') && !elements.trigger.matches(':hover') && !state.contextMenu) {
                collapse();
                hideContextMenu();
            }
        }, 150);
    });

    // Navigation buttons
    elements.backBtn.addEventListener('click', () => sendMessage({ action: 'go-back' }));
    elements.forwardBtn.addEventListener('click', () => sendMessage({ action: 'go-forward' }));
    elements.refreshBtn.addEventListener('click', () => sendMessage({ action: 'reload' }));

    // Listen for storage changes to sync across tabs
    try {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.sidebarPinned) {
                state.isPinned = changes.sidebarPinned.newValue || false;
                updatePinButton();
                if (state.isPinned && !state.isExpanded) {
                    expand();
                    fetchTabs();
                    updateUrlBarDisplay();
                } else if (!state.isPinned && state.isExpanded) {
                    collapse();
                    hideContextMenu();
                }
            }
        });
    } catch (e) { }
}
