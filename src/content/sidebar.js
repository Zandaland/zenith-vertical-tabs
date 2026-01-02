// Sidebar visibility and pin functionality
import { state, elements } from './state.js';
import { sendMessage } from './utils.js';
import { icons } from './icons.js';

// Sidebar width constraints
const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 260;

// Calculate body margin (sidebar width + margins)
function getBodyMargin() {
    return state.sidebarWidth + 20; // 10px margin on each side
}

// Apply sidebar width to CSS
function applySidebarWidth() {
    if (elements.sidebar) {
        elements.sidebar.style.setProperty('--vt-width', `${state.sidebarWidth}px`);
        elements.sidebar.style.width = `${state.sidebarWidth}px`;
    }
}

// Load sidebar width from storage
export async function loadSidebarWidth() {
    try {
        const result = await chrome.storage.local.get('sidebarWidth');
        state.sidebarWidth = result.sidebarWidth || DEFAULT_WIDTH;
        applySidebarWidth();
    } catch (e) {
        state.sidebarWidth = DEFAULT_WIDTH;
        applySidebarWidth();
    }
}

// Save sidebar width to storage
async function saveSidebarWidth() {
    try {
        await chrome.storage.local.set({ sidebarWidth: state.sidebarWidth });
    } catch (e) { }
}

// Update body margin for pinned state (pushes website content)
function updateBodyForPinned(isPinned) {
    if (isPinned) {
        document.body.classList.add('zenith-sidebar-pinned');
        document.body.style.marginLeft = `${getBodyMargin()}px`;
        document.body.style.transition = 'margin-left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    } else {
        document.body.classList.remove('zenith-sidebar-pinned');
        document.body.style.marginLeft = '';
        document.body.style.transition = 'margin-left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        // Clean up transition after animation
        setTimeout(() => {
            if (!document.body.classList.contains('zenith-sidebar-pinned')) {
                document.body.style.transition = '';
            }
        }, 300);
    }
}

// Setup resize handle drag functionality
export function setupResizeHandle() {
    if (!elements.resizeHandle) return;

    let startX = 0;
    let startWidth = 0;

    const onMouseMove = (e) => {
        if (!state.isResizing) return;

        // Calculate new width based on mouse position
        const deltaX = e.clientX - startX;
        let newWidth = startWidth + deltaX;

        // Clamp to min/max
        newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));

        // Update state and apply
        state.sidebarWidth = newWidth;
        applySidebarWidth();

        // Update body margin if pinned
        if (state.isPinned) {
            document.body.style.marginLeft = `${getBodyMargin()}px`;
        }
    };

    const onMouseUp = () => {
        if (!state.isResizing) return;

        state.isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        elements.sidebar.classList.remove('vt-resizing');

        // Save the new width
        saveSidebarWidth();

        // Remove listeners
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    elements.resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();

        state.isResizing = true;
        startX = e.clientX;
        startWidth = state.sidebarWidth;

        // Set cursor and prevent text selection globally
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        elements.sidebar.classList.add('vt-resizing');

        // Add global listeners
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}


// Load pinned state from storage
export async function loadPinnedState() {
    try {
        const result = await chrome.storage.local.get('sidebarPinned');
        state.isPinned = result.sidebarPinned || false;
        updatePinButton();
        if (state.isPinned) {
            elements.sidebar.classList.add('vt-no-transition');
            elements.sidebar.classList.add('vt-pinned');
            updateBodyForPinned(true);
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

    // Update pinned class based on current pin state
    if (state.isPinned) {
        elements.sidebar.classList.add('vt-pinned');
    }
}

// Collapse sidebar
export function collapse() {
    if (!state.isExpanded || state.isPinned) return;
    state.isExpanded = false;
    elements.sidebar.classList.remove('vt-expanded');
    elements.sidebar.classList.remove('vt-pinned');
    state.searchQuery = '';
    if (elements.searchInput) elements.searchInput.value = '';
}

// Toggle sidebar
export function toggle() {
    if (state.isExpanded) {
        state.isPinned = false;
        state.isExpanded = false;
        elements.sidebar.classList.remove('vt-expanded');
        elements.sidebar.classList.remove('vt-pinned');
        updateBodyForPinned(false);
        updatePinButton();
        savePinnedState();
    } else {
        state.isPinned = true;
        elements.sidebar.classList.add('vt-pinned');
        updateBodyForPinned(true);
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

        if (state.isPinned) {
            elements.sidebar.classList.add('vt-pinned');
            updateBodyForPinned(true);
        } else {
            elements.sidebar.classList.remove('vt-pinned');
            updateBodyForPinned(false);
            if (!elements.sidebar.matches(':hover')) {
                collapse();
                hideContextMenu();
            }
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
                    elements.sidebar.classList.add('vt-pinned');
                    updateBodyForPinned(true);
                    expand();
                    fetchTabs();
                    updateUrlBarDisplay();
                } else if (!state.isPinned && state.isExpanded) {
                    elements.sidebar.classList.remove('vt-pinned');
                    updateBodyForPinned(false);
                    collapse();
                    hideContextMenu();
                }
            }
        });
    } catch (e) { }
}
