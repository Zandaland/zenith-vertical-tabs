// Centralized state management for the extension
export const state = {
    isExpanded: false,
    isPinned: false,
    tabs: [],
    groups: {},
    searchQuery: '',
    contextMenu: null,
    collapsedGroups: new Set(),
    lastRenderedData: null,
    renderTimeout: null,

    // Drag and drop state
    draggedTabId: null,
    draggedElement: null,
    draggedFromGroupId: null,
    dropTarget: null,
    dropPosition: null,
    pendingGroupTabId: null,

    // Modal state
    modalSuggestionsList: [],
    modalSelectedIndex: -1,
    modalMode: 'new-tab',

    // URL bar state
    suggestions: [],
    selectedSuggestion: -1,

    // Tab navigation state
    selectedTabIndex: -1,

    // Group modal state
    selectedGroupColor: 'blue',

    // Onboarding state
    onboardingCurrentStep: 1,
    onboardingTotalSteps: 5,

    // Preview timeout
    previewTimeout: null
};

// DOM element references - populated after DOM is created
export const elements = {
    shadow: null,
    container: null,
    trigger: null,
    sidebar: null,
    tabList: null,
    newTabBtn: null,
    pinBtn: null,
    searchInput: null,
    backBtn: null,
    forwardBtn: null,
    refreshBtn: null,
    urlInput: null,
    suggestionsEl: null,
    createGroupBtn: null,
    tabPreview: null,
    modalOverlay: null,
    modal: null,
    modalInput: null,
    modalSuggestions: null,
    groupModalOverlay: null,
    groupNameInput: null,
    groupColorsContainer: null,
    groupCancelBtn: null,
    groupCreateBtn: null,
    onboardingOverlay: null,
    onboardingNextBtn: null,
    onboardingSkipBtn: null,
    onboardingSteps: null,
    onboardingDots: null,
    onboardingRefreshBtn: null
};
