// URL bar with smart suggestions
import { state, elements } from './state.js';
import { sendMessage, escapeHtml, getFilteredTabs } from './utils.js';

// Hide suggestions dropdown
export function hideSuggestions() {
    if (!elements.suggestionsEl) return;
    elements.suggestionsEl.style.display = 'none';
    state.suggestions = [];
    state.selectedSuggestion = -1;
}

// Show suggestions dropdown
export function showSuggestions(items) {
    state.suggestions = items;
    state.selectedSuggestion = -1;
    if (items.length === 0) {
        hideSuggestions();
        return;
    }
    elements.suggestionsEl.innerHTML = items.map((item, i) => {
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
    elements.suggestionsEl.style.display = 'block';

    elements.suggestionsEl.querySelectorAll('.vt-suggestion').forEach(el => {
        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            navigateTo(el.dataset.url, el.dataset.tabId);
        });
    });
}

// Update selection highlight
export function updateSelection() {
    elements.suggestionsEl.querySelectorAll('.vt-suggestion').forEach((el, i) => {
        el.classList.toggle('selected', i === state.selectedSuggestion);
    });
}

// Navigate to URL or switch to tab
export function navigateTo(url, tabId = null) {
    if (tabId) {
        sendMessage({ action: 'switch-tab', tabId: parseInt(tabId) });
    } else {
        sendMessage({ action: 'navigate', url });
    }
    elements.urlInput.blur();
    hideSuggestions();
}

// Fetch suggestions from background
export async function fetchSuggestions(query) {
    if (!query.trim()) {
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

// Update URL bar display
export function updateUrlBarDisplay() {
    if (document.activeElement !== elements.urlInput &&
        elements.shadow?.activeElement !== elements.urlInput) {
        try {
            const url = new URL(window.location.href);
            elements.urlInput.value = url.hostname.replace('www.', '') || window.location.href;
        } catch {
            elements.urlInput.value = window.location.href;
        }
    }
}

// Navigate tabs with arrow keys
export function navigateTabsWithArrowKeys(direction) {
    const filteredTabs = getFilteredTabs();
    if (filteredTabs.length === 0) return;

    clearTabSelection();

    if (direction === 'ArrowDown') {
        state.selectedTabIndex = (state.selectedTabIndex + 1) % filteredTabs.length;
    } else if (direction === 'ArrowUp') {
        state.selectedTabIndex = state.selectedTabIndex <= 0 ? filteredTabs.length - 1 : state.selectedTabIndex - 1;
    }

    highlightTab(filteredTabs[state.selectedTabIndex].id);
}

// Clear tab selection
export function clearTabSelection() {
    elements.tabList.querySelectorAll('.vt-tab, .vt-pinned-tab').forEach(el => {
        el.classList.remove('vt-tab-selected');
    });
}

// Highlight a tab
export function highlightTab(tabId) {
    const tabElement = elements.tabList.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabElement) {
        tabElement.classList.add('vt-tab-selected');
        tabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Setup URL bar event listeners
export function setupUrlBarListeners(renderTabs) {
    elements.urlInput.addEventListener('focus', () => {
        elements.urlInput.value = window.location.href;
        elements.urlInput.select();
        fetchSuggestions('');
    });

    elements.urlInput.addEventListener('blur', () => {
        setTimeout(() => {
            hideSuggestions();
            updateUrlBarDisplay();
        }, 150);
    });

    elements.urlInput.addEventListener('input', (e) => {
        fetchSuggestions(e.target.value);
    });

    elements.urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (state.suggestions.length > 0) {
                state.selectedSuggestion = Math.min(state.selectedSuggestion + 1, state.suggestions.length - 1);
                updateSelection();
            }
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (state.suggestions.length > 0) {
                state.selectedSuggestion = Math.max(state.selectedSuggestion - 1, -1);
                updateSelection();
            }
        }
        if (e.key === 'Enter') {
            if (state.selectedSuggestion >= 0 && state.suggestions[state.selectedSuggestion]) {
                navigateTo(state.suggestions[state.selectedSuggestion].url, state.suggestions[state.selectedSuggestion].tabId);
            } else {
                let url = elements.urlInput.value.trim();
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
            elements.urlInput.value = '';
            elements.urlInput.blur();
        }
    });

    // Search input handlers
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderTabs();
    });

    elements.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            state.searchQuery = '';
            elements.searchInput.value = '';
            renderTabs();
            elements.searchInput.blur();
        }
        if (e.key === 'Enter' && getFilteredTabs().length > 0) {
            if (state.selectedTabIndex >= 0) {
                const filteredTabs = getFilteredTabs();
                if (filteredTabs[state.selectedTabIndex]) {
                    sendMessage({ action: 'switch-tab', tabId: filteredTabs[state.selectedTabIndex].id });
                    state.selectedTabIndex = -1;
                    clearTabSelection();
                }
            } else {
                sendMessage({ action: 'switch-tab', tabId: getFilteredTabs()[0].id });
            }
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            navigateTabsWithArrowKeys(e.key);
        }
    });
}
