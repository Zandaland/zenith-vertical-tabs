// Modal functionality (URL modal and Group modal)
import { state, elements } from './state.js';
import { sendMessage, escapeHtml } from './utils.js';
import { groupColorOptions } from './icons.js';

// ================== URL Modal ==================

// Open URL modal
export function openUrlModal(mode = 'new-tab', currentUrl = '') {
    state.modalMode = mode;
    elements.modalOverlay.classList.add('active');
    elements.modalInput.value = currentUrl;

    // Focus the input reliably in Shadow DOM
    const focusInput = () => {
        elements.modalInput.focus();
        if (currentUrl) elements.modalInput.select();
    };

    // Multiple focus attempts to ensure it works in Shadow DOM
    focusInput();
    requestAnimationFrame(focusInput);
    setTimeout(focusInput, 0);
    setTimeout(focusInput, 50);

    if (currentUrl) {
        fetchModalSuggestions(currentUrl);
    } else {
        fetchModalSuggestions('');
    }
}

// Close URL modal
export function closeUrlModal() {
    elements.modalOverlay.classList.remove('active');
    elements.modalInput.value = '';
    elements.modalSuggestions.innerHTML = '';
    state.modalSuggestionsList = [];
    state.modalSelectedIndex = -1;
}

// Show modal suggestions
export function showModalSuggestions(items) {
    state.modalSuggestionsList = items;
    state.modalSelectedIndex = -1;
    if (items.length === 0) {
        elements.modalSuggestions.innerHTML = '';
        return;
    }
    elements.modalSuggestions.innerHTML = items.map((item, i) => {
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

    elements.modalSuggestions.querySelectorAll('.vt-modal-suggestion').forEach(el => {
        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            modalNavigateTo(el.dataset.url, el.dataset.tabId);
        });
    });
}

// Update modal selection
export function updateModalSelection() {
    elements.modalSuggestions.querySelectorAll('.vt-modal-suggestion').forEach((el, i) => {
        el.classList.toggle('selected', i === state.modalSelectedIndex);
        if (i === state.modalSelectedIndex) {
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    });
}

// Navigate from modal
export function modalNavigateTo(url, tabId = null) {
    if (tabId) {
        sendMessage({ action: 'switch-tab', tabId: parseInt(tabId) });
    } else if (state.modalMode === 'new-tab') {
        sendMessage({ action: 'new-tab-url', url });
    } else {
        sendMessage({ action: 'navigate', url });
    }
    closeUrlModal();
}

// Fetch modal suggestions
export async function fetchModalSuggestions(query) {
    const response = await sendMessage({ action: 'get-suggestions', query });
    if (response && response.suggestions) {
        showModalSuggestions(response.suggestions.slice(0, 8));
    }
}

// Modal keydown handler
export function handleModalKeydown(e) {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (state.modalSuggestionsList.length > 0) {
            state.modalSelectedIndex = Math.min(state.modalSelectedIndex + 1, state.modalSuggestionsList.length - 1);
            updateModalSelection();
        }
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (state.modalSuggestionsList.length > 0) {
            state.modalSelectedIndex = Math.max(state.modalSelectedIndex - 1, -1);
            updateModalSelection();
        }
    }
    if (e.key === 'Enter') {
        if (state.modalSelectedIndex >= 0 && state.modalSuggestionsList[state.modalSelectedIndex]) {
            modalNavigateTo(state.modalSuggestionsList[state.modalSelectedIndex].url, state.modalSuggestionsList[state.modalSelectedIndex].tabId);
        } else {
            let url = elements.modalInput.value.trim();
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
}

// Setup URL modal listeners
export function setupUrlModalListeners() {
    elements.modalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) closeUrlModal();
    });

    elements.modalInput.addEventListener('input', (e) => {
        fetchModalSuggestions(e.target.value);
    });

    elements.modalInput.addEventListener('keydown', handleModalKeydown);
}

// ================== Group Modal ==================

// Render group colors
export function renderGroupColors() {
    if (!elements.groupColorsContainer) return;
    elements.groupColorsContainer.innerHTML = groupColorOptions.map(c => `
        <div class="vt-group-color-option ${state.selectedGroupColor === c.name ? 'selected' : ''}" 
             data-color="${c.name}" 
             style="background: ${c.color}">
        </div>
    `).join('');

    elements.groupColorsContainer.querySelectorAll('.vt-group-color-option').forEach(el => {
        el.addEventListener('click', () => {
            state.selectedGroupColor = el.dataset.color;
            renderGroupColors();
        });
    });
}

// Open group modal
export function openGroupModal() {
    if (!elements.groupModalOverlay) return;
    elements.groupModalOverlay.classList.add('active');
    if (elements.groupNameInput) {
        elements.groupNameInput.value = '';
    }
    state.selectedGroupColor = 'blue';
    renderGroupColors();

    if (elements.groupNameInput) elements.groupNameInput.focus();
    setTimeout(() => {
        if (elements.groupNameInput) elements.groupNameInput.focus();
    }, 10);
}

// Close group modal
export function closeGroupModal() {
    if (!elements.groupModalOverlay) return;
    elements.groupModalOverlay.classList.remove('active');
    if (elements.groupNameInput) elements.groupNameInput.value = '';
    state.pendingGroupTabId = null;
}

// Create group
export async function createGroup() {
    const name = (elements.groupNameInput ? elements.groupNameInput.value.trim() : '') || 'New Group';
    const color = state.selectedGroupColor;

    if (state.pendingGroupTabId) {
        await sendMessage({ action: 'create-group-with-tab', tabId: state.pendingGroupTabId, name, color });
    } else {
        await sendMessage({ action: 'create-group', name, color });
    }

    closeGroupModal();
}

// Setup group modal listeners
export function setupGroupModalListeners() {
    if (elements.groupModalOverlay) {
        elements.groupModalOverlay.addEventListener('click', (e) => {
            if (e.target === elements.groupModalOverlay) closeGroupModal();
        });
    }

    if (elements.groupCancelBtn) {
        elements.groupCancelBtn.addEventListener('click', closeGroupModal);
    }

    if (elements.groupCreateBtn) {
        elements.groupCreateBtn.addEventListener('click', createGroup);
    }

    if (elements.groupNameInput) {
        elements.groupNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') createGroup();
            if (e.key === 'Escape') closeGroupModal();
        });
    }
}

// Setup global capture listener for modal keyboard
export function setupGlobalKeyboardCapture() {
    window.addEventListener('keydown', (e) => {
        const activeEl = elements.shadow?.activeElement;

        if (activeEl && (activeEl === elements.modalInput || activeEl === elements.urlInput ||
            activeEl === elements.searchInput || activeEl === elements.groupNameInput)) {
            e.stopPropagation();
            e.stopImmediatePropagation();

            if (activeEl === elements.modalInput) {
                handleModalKeydown(e);
            }
        }
    }, true);

    ['keyup', 'keypress'].forEach(eventType => {
        window.addEventListener(eventType, (e) => {
            const activeEl = elements.shadow?.activeElement;
            if (activeEl && (activeEl === elements.modalInput || activeEl === elements.urlInput ||
                activeEl === elements.searchInput || activeEl === elements.groupNameInput)) {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, true);
    });
}
